/**
 * Leitura do "Cartão Ponto" exportado pelo Ponto AtecSoft (PDF com texto).
 * Recebe os textos de cada página com a posição (x, y) e devolve, por funcionário,
 * os dias com faltas, horas extras, rótulos (Atestado, Falta, Férias...) e o banco de horas.
 */

export interface TextoPosicionado {
  x: number
  y: number
  str: string
}

export interface DiaPonto {
  data: string // yyyy-mm-dd
  diaSemana: string // Seg, Ter... ou FER
  /** Rótulo no lugar das batidas: Atestado, Falta, Férias, Folga, Licença-maternidade, Dispensa... */
  rotulo?: string
  batidas: number[] // minutos do dia
  cargaHoraria: number // minutos (coluna CH P)
  normais: number // minutos (coluna Norm)
  faltas: number // minutos (coluna Faltas)
  extras: number // minutos (ExUt + ExSab + ExDom + ExFer)
  trabalhado: number // minutos calculados pelas batidas
}

export interface CartaoLido {
  nome: string
  cpf: string // só dígitos
  pis?: string
  matricula?: string
  admissao?: string // yyyy-mm-dd
  ctps?: string
  /** Páginas do PDF (começando em 0) */
  paginas: number[]
  dias: DiaPonto[]
  saldoAnterior: number // minutos (pode ser negativo)
  saldoTotal: number // minutos
}

export interface ArquivoPontoLido {
  inicio: string
  fim: string
  /** yyyy-MM do período */
  mes: string
  cartoes: CartaoLido[]
}

export const rotulos: Record<string, string> = {
  atesta: 'Atestado',
  falta: 'Falta',
  ferias: 'Férias',
  folga: 'Folga',
  'lic.ma': 'Licença-maternidade',
  'lic.pa': 'Licença-paternidade',
  dispen: 'Dispensa',
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const ehHora = (s: string) => /^[+-]?\d{1,3}:\d\d$/.test(s)
export const minutos = (s: string) => {
  const m = s.match(/^([+-])?(\d{1,3}):(\d\d)$/)
  if (!m) return 0
  const v = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -v : v
}
const dataISO = (br: string) => {
  const [d, m, a] = br.split('/')
  return `${a}-${m}-${d}`
}

function agruparLinhas(itens: TextoPosicionado[]) {
  const linhas: { y: number; itens: TextoPosicionado[] }[] = []
  for (const it of [...itens].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y)) {
    const l = linhas.find((x) => Math.abs(x.y - it.y) <= 2)
    if (l) l.itens.push(it)
    else linhas.push({ y: it.y, itens: [it] })
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x)
  return linhas
}

interface Colunas {
  ch: number
  norm: number
  faltas: number
  exut: number
  adnot: number
}

function lerPagina(itens: TextoPosicionado[]) {
  const linhas = agruparLinhas(itens)
  const texto = (l: (typeof linhas)[number]) => l.itens.map((i) => i.str).join(' ')
  const tudo = linhas.map(texto).join('\n')

  const periodo = tudo.match(/Per[ií]odo:\s*(\d\d\/\d\d\/\d{4})\s*at[ée]\s*(\d\d\/\d\d\/\d{4})/)
  const linhaNome = linhas.find((l) => l.itens.some((i) => /^Funcion[aá]rio:/.test(i.str.trim())))
  if (!linhaNome) return null
  const nome = linhaNome.itens
    .filter((i) => !/^Funcion[aá]rio:/.test(i.str.trim()) && i.x < 280)
    .map((i) => i.str.trim())
    .join(' ')
    .trim()

  const depoisDe = (rotulo: RegExp) => {
    for (const l of linhas) {
      const idx = l.itens.findIndex((i) => rotulo.test(i.str))
      if (idx < 0) continue
      const mesmo = l.itens[idx].str.replace(rotulo, '').trim()
      if (mesmo) return mesmo.split(/\s{2,}/)[0]
      const prox = l.itens[idx + 1]
      if (prox && !/:\s*$/.test(prox.str.trim())) return prox.str.trim()
      return ''
    }
    return ''
  }
  const cpf = (tudo.match(/CPF:\s*([\d.\-]+)/)?.[1] ?? '').replace(/\D/g, '')
  const pis = depoisDe(/^PIS:\s*/).replace(/\D/g, '') || undefined
  const matricula = depoisDe(/^Matr[ií]cula:\s*/) || undefined
  const adm = tudo.match(/Admiss[aã]o:\s*(\d\d\/\d\d\/\d{4})/)?.[1]
  const ctpsBruto = depoisDe(/^CTPS:\s*/)
  const ctps = ctpsBruto && !/^Grupo/i.test(ctpsBruto) ? ctpsBruto : undefined

  // posições das colunas pelo cabeçalho
  const cab = linhas.find((l) => l.itens.some((i) => i.str.trim() === 'Dia') && l.itens.some((i) => /Faltas/.test(i.str)))
  const pos = (re: RegExp, padrao: number) => cab?.itens.find((i) => re.test(i.str))?.x ?? padrao
  const col: Colunas = {
    ch: pos(/^CH/, 252),
    norm: pos(/^Norm/, 279),
    faltas: pos(/^Faltas/, 305),
    exut: pos(/^ExUt/, 332),
    adnot: pos(/^AdNot/, 448),
  }

  const dias: DiaPonto[] = []
  let fimDosDias = false
  for (const l of linhas) {
    if (/Observa[cç][oõ]es|Informa[cç][oõ]es Banco/i.test(texto(l))) fimDosDias = true
    if (fimDosDias) continue
    const primeiro = l.itens[0]
    const m = primeiro.x < 60 ? primeiro.str.trim().match(/^(\d\d\/\d\d\/\d{4})\s+(Seg|Ter|Qua|Qui|Sex|Sab|Sáb|Dom|FER)\b\s*(.*)$/) : null
    if (!m) continue
    const dia: DiaPonto = { data: dataISO(m[1]), diaSemana: m[2], batidas: [], cargaHoraria: 0, normais: 0, faltas: 0, extras: 0, trabalhado: 0 }
    const textosRotulo: string[] = m[3] ? [m[3]] : []
    for (const it of l.itens.slice(1)) {
      for (const pedaco of it.str.trim().split(/\s+/)) {
        if (!pedaco) continue
        if (!ehHora(pedaco)) {
          if (it.x < col.ch - 5) textosRotulo.push(pedaco)
          continue
        }
        const v = minutos(pedaco)
        if (it.x < col.ch - 5) dia.batidas.push(v)
        else if (it.x < col.norm - 5) dia.cargaHoraria = v
        else if (it.x < col.faltas - 5) dia.normais = v
        else if (it.x < col.exut - 5) dia.faltas = v
        else if (it.x < col.adnot - 5) dia.extras += v
      }
    }
    const rot = textosRotulo.join(' ').split(/\s+/).map((t) => rotulos[semAcento(t).toLowerCase()]).find(Boolean)
    if (rot) dia.rotulo = rot
    for (let i = 0; i + 1 < dia.batidas.length; i += 2) dia.trabalhado += Math.max(0, dia.batidas[i + 1] - dia.batidas[i])
    dias.push(dia)
  }

  const saldo = (re: RegExp) => {
    const l = linhas.find((x) => re.test(texto(x)))
    const v = l?.itens.map((i) => i.str.trim()).find((s) => /^[+-]\d{1,3}:\d\d$/.test(s))
    return v ? minutos(v) : undefined
  }

  // Para quem foi admitido no mês, o sistema de ponto repete o saldo do mês como "anterior"
  let saldoAnterior = saldo(/Saldo anterior/i)
  const ateAnterior = tudo.match(/Saldo anterior \(at[ée] (\d\d\/\d\d\/\d{4})\)/i)?.[1]
  if (periodo && ateAnterior && dataISO(ateAnterior) >= dataISO(periodo[1])) saldoAnterior = 0

  return {
    periodo: periodo ? { inicio: dataISO(periodo[1]), fim: dataISO(periodo[2]) } : undefined,
    nome,
    cpf,
    pis,
    matricula,
    admissao: adm ? dataISO(adm) : undefined,
    ctps,
    dias,
    saldoAnterior,
    saldoTotal: saldo(/Saldo total/i),
  }
}

/** Lê todas as páginas e junta as páginas seguidas do mesmo funcionário. */
export function lerCartoes(paginas: TextoPosicionado[][]): ArquivoPontoLido {
  const cartoes: CartaoLido[] = []
  let periodo: { inicio: string; fim: string } | undefined
  paginas.forEach((itens, n) => {
    const p = lerPagina(itens)
    if (!p) return
    periodo ??= p.periodo
    const ultimo = cartoes[cartoes.length - 1]
    const mesmo = ultimo && (p.cpf ? ultimo.cpf === p.cpf : ultimo.nome === p.nome)
    if (mesmo) {
      ultimo.paginas.push(n)
      ultimo.dias.push(...p.dias.filter((d) => !ultimo.dias.some((x) => x.data === d.data)))
      if (p.saldoAnterior != null) ultimo.saldoAnterior = p.saldoAnterior
      if (p.saldoTotal != null) ultimo.saldoTotal = p.saldoTotal
    } else {
      cartoes.push({
        nome: p.nome,
        cpf: p.cpf,
        pis: p.pis,
        matricula: p.matricula,
        admissao: p.admissao,
        ctps: p.ctps,
        paginas: [n],
        dias: p.dias,
        saldoAnterior: p.saldoAnterior ?? 0,
        saldoTotal: p.saldoTotal ?? 0,
      })
    }
  })
  if (!periodo) throw new Error('Não encontrei o período do cartão ponto. Confira se o arquivo é o "Cartão Ponto" do sistema de ponto.')
  return { ...periodo, mes: periodo.inicio.slice(0, 7), cartoes }
}

export const somaFaltas = (c: { dias: DiaPonto[] }) => c.dias.reduce((s, d) => s + d.faltas, 0)
export const somaExtras = (c: { dias: DiaPonto[] }) => c.dias.reduce((s, d) => s + d.extras, 0)
