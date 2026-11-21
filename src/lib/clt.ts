/**
 * Regras da CLT (e da Lei do Estágio 11.788/2008) usadas pelo sistema.
 * Todas as datas são strings yyyy-mm-dd, interpretadas no fuso local.
 */
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMonths,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
} from 'date-fns'
import type { Ausencia, Ferias, Funcionario, TipoContrato } from './types'

export const d = (s: string) => parseISO(s)
export const iso = (dt: Date) => format(dt, 'yyyy-MM-dd')

// ---------------------------------------------------------------- salário

export function salarioEm(f: Funcionario, data: string): number {
  const validos = [...f.salarios]
    .filter((s) => s.data <= data)
    .sort((a, b) => a.data.localeCompare(b.data))
  if (validos.length) return validos[validos.length - 1].valor
  // Antes do primeiro registro, vale o primeiro salário cadastrado
  const ordenados = [...f.salarios].sort((a, b) => a.data.localeCompare(b.data))
  return ordenados[0]?.valor ?? 0
}

// ---------------------------------------------------------------- avos

/**
 * Meses trabalhados ("avos") entre início e fim (inclusive).
 * Fração de 15 dias ou mais conta como mês inteiro (CLT art. 146 e Lei 4.090).
 */
export function avos(inicio: string, fim: string): number {
  const ini = d(inicio)
  const fimMais1 = addDays(d(fim), 1)
  if (!isAfter(fimMais1, ini)) return 0
  let meses = differenceInMonths(fimMais1, ini)
  const resto = differenceInCalendarDays(fimMais1, addMonths(ini, meses))
  if (resto >= 15) meses++
  return Math.min(meses, 12)
}

/** Nome do tipo de contratação, para telas e documentos */
export const nomesTipoContrato: Record<TipoContrato, string> = { clt: 'CLT', estagio: 'Estágio', socio: 'Sócio' }

// ---------------------------------------------------------------- férias

/** Tabela do art. 130 da CLT */
export function diasDeDireito(tipo: TipoContrato, faltasInjustificadas: number): number {
  if (tipo === 'estagio') return 30
  if (faltasInjustificadas <= 5) return 30
  if (faltasInjustificadas <= 14) return 24
  if (faltasInjustificadas <= 23) return 18
  if (faltasInjustificadas <= 32) return 12
  return 0
}

function diasSobrepostos(aIni: Date, aFim: Date, bIni: Date, bFim: Date) {
  const ini = maxDate([aIni, bIni])
  const fim = minDate([aFim, bFim])
  const n = differenceInCalendarDays(fim, ini) + 1
  return n > 0 ? n : 0
}

export interface PeriodoAquisitivo {
  inicio: string
  fim: string
  /** Último dia do período concessivo (prazo para gozar as férias) */
  concessivoFim: string
  completo: boolean
  faltasInjustificadas: number
  /** Dias de direito (se completo) ou adquiridos até hoje (se incompleto) */
  direito: number
  /** Direito total ao final do período (estimado, se incompleto) */
  direitoTotal: number
  usados: number
  saldo: number
  /** Data limite para iniciar as férias sem passar do prazo */
  limiteInicio: string
  ferias: Ferias[]
}

export function periodosAquisitivos(
  f: Funcionario,
  ferias: Ferias[],
  ausencias: Ausencia[],
  hoje: string,
): PeriodoAquisitivo[] {
  const lista: PeriodoAquisitivo[] = []
  const limite = f.dataDemissao && f.dataDemissao < hoje ? f.dataDemissao : hoje
  const minhasFerias = ferias.filter((x) => x.funcionarioId === f.id && x.status !== 'recusada')
  const faltas = ausencias.filter(
    (a) => a.funcionarioId === f.id && a.tipo === 'falta_injustificada' && a.horas == null,
  )

  // Acerto com a contabilidade: começa no período informado, com o saldo daquela data
  const acerto = f.acertoFerias && f.acertoFerias.periodoInicio >= f.dataAdmissao ? f.acertoFerias : undefined
  const comeco = acerto?.periodoInicio ?? f.dataAdmissao

  // Férias coletivas com menos de 12 meses (CLT art. 140) encerram o período e começam outro
  const reinicios = [...new Set(minhasFerias.filter((x) => x.reiniciaPeriodo && x.inicio > comeco).map((x) => x.inicio))].sort()

  let inicio = d(comeco)
  while (!isAfter(inicio, d(limite))) {
    const proximoReinicio = reinicios.find((r) => r > iso(inicio))
    const fimNormal = addDays(addYears(inicio, 1), -1)
    // período encerrado antes de 12 meses pelas férias coletivas: direito proporcional
    const encurtado = proximoReinicio != null && !isAfter(d(proximoReinicio), fimNormal)
    const fim = encurtado ? addDays(d(proximoReinicio!), -1) : fimNormal
    const concessivoFim = encurtado ? addYears(fim, 1) : addDays(addYears(inicio, 2), -1)
    const completo = isBefore(fim, d(limite))
    const ateQuando = completo ? fim : d(limite)

    const nFaltas =
      f.tipo === 'clt'
        ? faltas.reduce((s, a) => s + diasSobrepostos(d(a.inicio), d(a.fim), inicio, ateQuando), 0)
        : 0
    const direitoCheio = diasDeDireito(f.tipo, nFaltas)
    const direitoTotal = encurtado ? Math.floor((direitoCheio / 12) * avos(iso(inicio), iso(fim))) : direitoCheio
    // período encerrado pelas coletivas: o direito proporcional já é conhecido
    const direito = completo || encurtado
      ? direitoTotal
      : Math.floor((direitoCheio / 12) * avos(iso(inicio), iso(ateQuando)))

    const ehAcerto = acerto != null && iso(inicio) === acerto.periodoInicio
    const doPeriodo = minhasFerias.filter((x) => x.periodoInicio === iso(inicio) && (!ehAcerto || x.inicio >= acerto.em))
    const usadosAntes = ehAcerto ? Math.max(0, direitoTotal - acerto.saldo) : 0
    const usados = usadosAntes + doPeriodo.reduce((s, x) => s + x.dias + x.abono, 0)
    const saldo = direito - usados
    const saldoTotal = direitoTotal - usados

    lista.push({
      inicio: iso(inicio),
      fim: iso(fim),
      concessivoFim: iso(concessivoFim),
      completo,
      faltasInjustificadas: nFaltas,
      direito,
      direitoTotal,
      usados,
      saldo,
      limiteInicio: iso(addDays(concessivoFim, -Math.max(saldoTotal, 0) + 1)),
      ferias: doPeriodo,
    })
    inicio = addDays(fim, 1)
  }
  return lista
}

export type CodigoStatusFerias =
  | 'vencida'
  | 'vence_em_breve'
  | 'mais_de_90'
  | 'aquisitivo_incompleto'
  | 'saldo_utilizado'

export interface StatusFeriasFuncionario {
  codigo: CodigoStatusFerias
  rotulo: string
  /** Período que exige atenção (o mais antigo com saldo) */
  periodo?: PeriodoAquisitivo
  diasParaLimite?: number
}

export function statusFerias(periodos: PeriodoAquisitivo[], hoje: string): StatusFeriasFuncionario {
  const pendente = periodos.find((p) => p.completo && p.saldo > 0)
  if (pendente) {
    const dias = differenceInCalendarDays(d(pendente.limiteInicio), d(hoje))
    if (differenceInCalendarDays(d(pendente.concessivoFim), d(hoje)) < 0)
      return { codigo: 'vencida', rotulo: 'Vencida (pagar em dobro)', periodo: pendente, diasParaLimite: dias }
    if (dias <= 90)
      return {
        codigo: 'vence_em_breve',
        rotulo: dias < 0 ? 'Prazo estourado' : `Vence em ${dias} dias`,
        periodo: pendente,
        diasParaLimite: dias,
      }
    return { codigo: 'mais_de_90', rotulo: 'Mais de 90 dias', periodo: pendente, diasParaLimite: dias }
  }
  const atual = periodos[periodos.length - 1]
  if (!periodos.some((p) => p.completo))
    return { codigo: 'aquisitivo_incompleto', rotulo: 'Aquisitivo incompleto', periodo: atual }
  return { codigo: 'saldo_utilizado', rotulo: 'Saldo utilizado', periodo: atual }
}

export interface ResultadoValidacao {
  erros: string[]
  avisos: string[]
}

export function validarSolicitacao(args: {
  funcionario: Funcionario
  periodo: PeriodoAquisitivo
  inicio: string
  dias: number
  abono: number
  hoje: string
  /** Ignorar este pedido ao contar os já existentes (edição) */
  ignorarId?: string
}): ResultadoValidacao {
  const { funcionario: f, periodo: p, inicio, dias, abono, hoje } = args
  const erros: string[] = []
  const avisos: string[] = []
  const outras = p.ferias.filter((x) => x.id !== args.ignorarId)
  const usadosOutras = outras.reduce((s, x) => s + x.dias + x.abono, 0)
  const disponivel = p.direitoTotal - usadosOutras
  const restante = disponivel - dias - abono

  if (dias <= 0) erros.push('Selecione o período de férias no calendário.')
  if (restante < 0) erros.push(`O pedido passa do saldo do período (${disponivel} dias disponíveis).`)

  if (f.tipo === 'estagio') {
    if (abono > 0) erros.push('Estagiários não podem vender dias (o recesso não tem abono pecuniário).')
  } else {
    if (dias > 0 && dias < 5) erros.push('Cada período de férias precisa ter no mínimo 5 dias (CLT art. 134 §1º).')
    if (outras.length >= 3) erros.push('As férias só podem ser divididas em até 3 períodos.')
    const limiteAbono = Math.floor(p.direitoTotal / 3)
    if (abono > limiteAbono) erros.push(`O abono pode ser de no máximo ${limiteAbono} dias (1/3 das férias).`)
    if (abono > 0 && outras.some((x) => x.abono > 0)) erros.push('O abono já foi usado neste período.')

    const fracoes = [...outras.map((x) => x.dias), dias]
    const temDe14 = fracoes.some((n) => n >= 14)
    const descansoRestante = restante
    if (!temDe14 && (fracoes.length >= 3 || descansoRestante < 14) && dias > 0)
      erros.push('Um dos períodos de férias precisa ter pelo menos 14 dias (CLT art. 134 §1º).')
    if (restante > 0 && restante < 5 && fracoes.length < 3)
      erros.push(`Sobrariam ${restante} dias, mas cada período precisa ter no mínimo 5 dias.`)
    if (restante > 0 && fracoes.length >= 3)
      erros.push(`Este seria o 3º período e ainda sobrariam ${restante} dias sem poder usar.`)

    const diaSemana = getDay(d(inicio)) // 0 dom, 5 sex, 6 sáb
    if (dias > 0 && (diaSemana === 5 || diaSemana === 6))
      avisos.push(
        'As férias não podem começar nos 2 dias antes do descanso semanal ou de feriado (CLT art. 134 §3º). Confira se o início está correto.',
      )
  }

  if (dias > 0 && differenceInCalendarDays(d(inicio), d(hoje)) < 30)
    avisos.push('O aviso de férias deve ser entregue com pelo menos 30 dias de antecedência.')

  if (!p.completo)
    avisos.push('O período aquisitivo ainda não terminou: estas serão férias antecipadas.')

  if (dias > 0) {
    const fim = addDays(d(inicio), dias - 1)
    if (isAfter(fim, d(p.concessivoFim)) && f.tipo === 'clt')
      avisos.push('As férias terminam depois do prazo (período concessivo): os dias excedentes devem ser pagos em dobro.')
  }

  return { erros, avisos }
}

export interface ValoresFerias {
  ferias: number
  terco: number
  abono: number
  tercoAbono: number
  total: number
}

export function valoresFerias(salario: number, dias: number, abono: number, tipo: TipoContrato): ValoresFerias {
  const diaria = salario / 30
  const ferias = diaria * dias
  const terco = tipo === 'clt' ? ferias / 3 : 0
  const ab = tipo === 'clt' ? diaria * abono : 0
  const tercoAbono = tipo === 'clt' ? ab / 3 : 0
  return { ferias, terco, abono: ab, tercoAbono, total: ferias + terco + ab + tercoAbono }
}

// ---------------------------------------------------------------- 13º

export function decimoTerceiro(f: Funcionario, ano: number, hoje: string) {
  if (f.tipo !== 'clt') return { avos: 0, valor: 0 }
  const iniAno = d(`${ano}-01-01`)
  const fimAno = d(`${ano}-12-31`)
  const ini = maxDate([iniAno, d(f.dataAdmissao)])
  const fim = f.dataDemissao ? minDate([fimAno, d(f.dataDemissao)]) : fimAno
  let n = 0
  for (let m = startOfMonth(ini); !isAfter(m, fim); m = addMonths(m, 1)) {
    const dias = diasSobrepostos(m, endOfMonth(m), ini, fim)
    if (dias >= 15) n++
  }
  const salario = salarioEm(f, hoje)
  return { avos: n, valor: (salario * n) / 12 }
}

// ---------------------------------------------------------------- FGTS

export const ALIQUOTA_FGTS = 0.08

export function fgtsMensal(f: Funcionario, hoje: string) {
  return f.tipo === 'clt' ? salarioEm(f, hoje) * ALIQUOTA_FGTS : 0
}

/** Estimativa dos depósitos mensais (8% do salário de cada mês) desde a admissão. */
export function fgtsAcumuladoEstimado(f: Funcionario, hoje: string) {
  if (f.tipo !== 'clt') return 0
  const fim = f.dataDemissao && f.dataDemissao < hoje ? d(f.dataDemissao) : d(hoje)
  let total = 0
  for (let m = startOfMonth(d(f.dataAdmissao)); isBefore(endOfMonth(m), fim); m = addMonths(m, 1)) {
    total += salarioEm(f, iso(endOfMonth(m))) * ALIQUOTA_FGTS
  }
  return total
}

// ---------------------------------------------------------------- aniversário

export function aniversarioEmpresa(dataAdmissao: string, hoje: string) {
  const adm = d(dataAdmissao)
  const h = d(hoje)
  let anos = h.getFullYear() - adm.getFullYear()
  let proximo = addYears(adm, anos)
  if (isBefore(proximo, h) || anos <= 0) {
    proximo = addYears(adm, anos + 1)
  }
  const diasAte = differenceInCalendarDays(proximo, h)
  const completos = differenceInCalendarDays(h, addYears(adm, anos)) >= 0 ? anos : anos - 1
  return { anosCompletos: Math.max(completos, 0), proximo: iso(proximo), anosNoProximo: proximo.getFullYear() - adm.getFullYear(), diasAte }
}

// ---------------------------------------------------------------- formatação

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const dataBR = (s?: string) => (s ? format(d(s), 'dd/MM/yyyy') : '—')
