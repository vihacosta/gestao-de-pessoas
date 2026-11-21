/**
 * Leitura do PDF de holerites enviado pela contabilidade ("HOLERITH - MENSAL de OUTUBRO/2026").
 * Cada página traz o holerite de um funcionário (em duas vias); lemos só a primeira via.
 */
import type { TextoPosicionado } from './cartaoPonto'

export interface Verba {
  codigo: string
  descricao: string
  referencia?: string
  valor: number
}

export interface HoleriteLido {
  nome: string
  cpf: string // só dígitos
  /** MENSAL, FÉRIAS, 13º SALÁRIO... como aparece no título */
  tipo: string
  mes: string // yyyy-MM
  salario?: number
  creditos: Verba[]
  debitos: Verba[]
  totalCreditos?: number
  totalDebitos?: number
  liquido?: number
  /** Páginas do PDF (começando em 0) */
  paginas: number[]
}

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
export const valorBR = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))
const ehValor = (s: string) => /^\d{1,3}(\.\d{3})*,\d\d$/.test(s.trim())

function linhas(itens: TextoPosicionado[]) {
  const ls: { y: number; itens: TextoPosicionado[] }[] = []
  for (const it of [...itens].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y)) {
    const l = ls.find((x) => Math.abs(x.y - it.y) <= 3.5)
    if (l) l.itens.push(it)
    else ls.push({ y: it.y, itens: [it] })
  }
  for (const l of ls) l.itens.sort((a, b) => a.x - b.x)
  return ls
}

/** Uma verba: código, descrição, referência opcional e valor (último número) */
function verba(itens: TextoPosicionado[]): Verba | null {
  const textos = itens.map((i) => i.str.trim()).filter(Boolean)
  if (textos.length < 2 || !/^\d{3,5}$/.test(textos[0])) return null
  const ultimo = textos[textos.length - 1]
  if (!ehValor(ultimo)) return null
  const meio = textos.slice(1, -1)
  const descricao: string[] = []
  const ref: string[] = []
  for (const t of meio) (ref.length || (ehValor(t) && descricao.length) ? ref : descricao).push(t)
  return { codigo: textos[0], descricao: descricao.join(' '), referencia: ref.join(' ') || undefined, valor: valorBR(ultimo) }
}

function lerPagina(itens: TextoPosicionado[]): Omit<HoleriteLido, 'paginas'> | null {
  const ls = linhas(itens)
  const iTitulo = ls.findIndex((l) => /HOLERIT/i.test(l.itens.map((i) => i.str).join(' ')))
  if (iTitulo < 0) return null
  const titulo = semAcento(ls[iTitulo].itens.map((i) => i.str).join(' ')).toUpperCase()
  // "MENSAL de OUTUBRO/2026" ou "13º SALÁRIO - 1ª PARCELA em NOVEMBRO/2025"
  const m = titulo.match(/HOLERITH?E?\s*-\s*(.+?)\s+(?:DE|EM)\s+([A-Z]+)\s*\/\s*(\d{4})/)
  if (!m) return null
  const mesN = MESES.indexOf(m[2]) + 1
  if (!mesN) return null

  // primeira via: do título até o próximo título
  const fimVia = ls.findIndex((l, i) => i > iTitulo && /HOLERIT/i.test(l.itens.map((x) => x.str).join(' ')))
  const via = ls.slice(iTitulo, fimVia < 0 ? undefined : fimVia)
  const texto = (l: (typeof via)[number]) => l.itens.map((i) => i.str).join(' ')

  const lCpf = via.find((l) => /CPF\s*[\d.]/.test(texto(l)))
  if (!lCpf) return null
  const cpf = (texto(lCpf).match(/CPF\s*([\d.\-]+)/)?.[1] ?? '').replace(/\D/g, '')
  const nome = lCpf.itens
    .filter((i) => !/CPF/.test(i.str))
    .map((i) => i.str.trim())
    .join(' ')
    .replace(/^\d+\s+/, '')
    .trim()
  const sal = via.map(texto).join('\n').match(/Sal[aá]rio\s+R\$\s*([\d.,]+)/)?.[1]

  // verbas: entre o cabeçalho CRÉDITO/DÉBITO e o quadro de bases
  const iCab = via.findIndex((l) => /CR[ÉE]DITO/.test(texto(l)) && /D[ÉE]BITO/.test(texto(l)))
  const cabDebito = iCab >= 0 ? via[iCab].itens.find((i) => /D[ÉE]BITO/.test(i.str)) : undefined
  const meioX = cabDebito ? cabDebito.x - 3 : 300
  const iBases = via.findIndex((l, i) => i > iCab && /I N S S|Base Calc/.test(texto(l)))
  const creditos: Verba[] = []
  const debitos: Verba[] = []
  if (iCab >= 0)
    for (const l of via.slice(iCab + 1, iBases < 0 ? undefined : iBases)) {
      const c = verba(l.itens.filter((i) => i.x < meioX))
      const d = verba(l.itens.filter((i) => i.x >= meioX))
      if (c) creditos.push(c)
      if (d) debitos.push(d)
    }

  const totalDe = (re: RegExp) => {
    for (const l of via) {
      const i = l.itens.findIndex((x) => re.test(x.str.trim()))
      if (i < 0) continue
      const v = l.itens.slice(i + 1).find((x) => ehValor(x.str))
      if (v) return valorBR(v.str)
    }
    return undefined
  }

  return {
    nome,
    cpf,
    tipo: m[1].trim(),
    mes: `${m[3]}-${String(mesN).padStart(2, '0')}`,
    salario: sal ? valorBR(sal) : undefined,
    creditos,
    debitos,
    totalCreditos: totalDe(/^CR[ÉE]DITO$/),
    totalDebitos: totalDe(/^D[ÉE]BITO$/),
    liquido: totalDe(/^L[IÍ]QUIDO$/),
  }
}

/** Lê todas as páginas; páginas seguidas do mesmo CPF e tipo viram um holerite só. */
export function lerHolerites(paginas: TextoPosicionado[][]): HoleriteLido[] {
  const lista: HoleriteLido[] = []
  paginas.forEach((itens, n) => {
    const h = lerPagina(itens)
    if (!h) return
    const ultimo = lista[lista.length - 1]
    if (ultimo && ultimo.cpf === h.cpf && ultimo.tipo === h.tipo && ultimo.mes === h.mes) {
      ultimo.paginas.push(n)
      ultimo.creditos.push(...h.creditos)
      ultimo.debitos.push(...h.debitos)
      ultimo.totalCreditos = h.totalCreditos ?? ultimo.totalCreditos
      ultimo.totalDebitos = h.totalDebitos ?? ultimo.totalDebitos
      ultimo.liquido = h.liquido ?? ultimo.liquido
    } else lista.push({ ...h, paginas: [n] })
  })
  if (!lista.length) throw new Error('Não encontrei holerites neste PDF. Confira se é o arquivo de holerites da contabilidade.')
  return lista
}

/** Título do documento guardado: "Holerite 10/2026" ou "Holerite 13º salario - 1ª parcela 11/2025" */
export const tituloHolerite = (h: Pick<HoleriteLido, 'tipo' | 'mes'>) =>
  `Holerite ${h.tipo.toLowerCase() === 'mensal' ? '' : h.tipo.toLowerCase() + ' '}${h.mes.slice(5)}/${h.mes.slice(0, 4)}`

/** Verbas que parecem ser o bônus por assiduidade */
export const verbaBonus = (h: HoleriteLido) => h.creditos.filter((v) => /ASSIDU|BONUS|B[ÔO]NUS|PR[ÊE]MIO|GRATIFICA/i.test(semAcento(v.descricao)))
