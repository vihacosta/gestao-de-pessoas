/**
 * Bônus por assiduidade mensal (termo nº 9 da empresa, regra de novembro/2026).
 *
 * Perde o bônus do mês quem:
 * 1. está em período de experiência (o bônus começa no mês seguinte ao fim da experiência);
 * 2. teve ausência de `bonusLimiteDia` horas ou mais num único dia, mesmo compensando depois
 *    (só não perde se a ausência foi coberta integralmente por saldo que já existia no banco de horas);
 * 3. somou no mês `bonusLimiteMes` horas ou mais de ausências e atrasos não compensados.
 *
 * Faltas justificadas e atestados contam. Única exceção: falecimento (atestado de óbito).
 *
 * Dia marcado como "Usou banco de horas" nas ocorrências: vale como confirmação do RH de que o saldo
 * cobriu a ausência inteira (5º parágrafo do termo), então não conta em nenhuma das duas regras.
 * Se o saldo estimado pelo cartão for menor que a ausência, o bônus fica mantido e aparece um aviso para conferir.
 */
import { addDays, differenceInCalendarDays, endOfMonth, format, getDay, isAfter, isBefore, max as maxDate, min as minDate } from 'date-fns'
import { d, iso } from './clt'
import { tiposNaFolha, type Justificativa } from './justificativas'
import type { Ausencia, CartaoPontoSalvo, ConfigEmpresa, Funcionario, TipoAusencia } from './types'

export type MarcaBanco = Pick<Justificativa, 'funcionarioId' | 'data' | 'usoBanco'>

/** Jornada diária média (44h semanais em 5 dias) */
export const JORNADA_DIA = 8.8

export const tiposIgnoradosNoBonus: TipoAusencia[] = ['falecimento']

export type StatusBonus = 'recebe' | 'perde' | 'experiencia' | 'fora'

export interface ResultadoBonus {
  status: StatusBonus
  valor: number
  motivos: string[]
  /** Pontos para conferir (não mudam o resultado) */
  avisos: string[]
  /** Calculado a partir do cartão ponto importado */
  usouCartao: boolean
  /** Horas de ausência/atraso não compensadas no mês */
  horasNaoCompensadas: number
  ocorrencias: Ausencia[]
}

export const fimExperiencia = (f: Funcionario, c: ConfigEmpresa) => iso(addDays(d(f.dataAdmissao), c.diasExperiencia - 1))

const fmtH = (h: number) => {
  const horas = Math.floor(h + 1e-9)
  const min = Math.round((h - horas) * 60)
  return min ? `${horas}h${String(min).padStart(2, '0')}` : `${horas}h`
}

/** Dias úteis (seg a sex) da ausência dentro do mês */
function diasNoMes(a: Ausencia, ini: Date, fim: Date): string[] {
  const dias: string[] = []
  const de = maxDate([d(a.inicio), ini])
  const ate = minDate([d(a.fim), fim])
  for (let x = de; !isAfter(x, ate); x = addDays(x, 1)) {
    const dow = getDay(x)
    if (a.inicio === a.fim || (dow !== 0 && dow !== 6)) dias.push(iso(x))
  }
  return dias
}

/** @param mes yyyy-MM */
export function bonusDoMes(f: Funcionario, ausencias: Ausencia[], mes: string, c: ConfigEmpresa, cartao?: CartaoPontoSalvo, marcas: MarcaBanco[] = []): ResultadoBonus {
  const diasBanco = new Set(marcas.filter((j) => j.usoBanco && j.funcionarioId === f.id).map((j) => j.data))
  const ini = d(`${mes}-01`)
  const fim = endOfMonth(ini)
  const vazio = { valor: 0, motivos: [] as string[], avisos: [] as string[], usouCartao: !!cartao, horasNaoCompensadas: 0, ocorrencias: [] as Ausencia[] }

  if (isAfter(d(f.dataAdmissao), fim) || (f.dataDemissao && isBefore(d(f.dataDemissao), ini)))
    return { ...vazio, status: 'fora' }

  // experiência: elegível só a partir do mês seguinte ao fim da experiência
  const fimExp = d(fimExperiencia(f, c))
  if (!isAfter(ini, endOfMonth(fimExp)))
    return { ...vazio, status: 'experiencia', motivos: [`Em experiência até ${format(fimExp, 'dd/MM/yyyy')}`] }

  const todasDoMes = ausencias
    .filter((a) => a.funcionarioId === f.id)
    .filter((a) => !isAfter(d(a.inicio), fim) && !isBefore(d(a.fim), ini))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  let doMes = todasDoMes.filter((a) => !tiposIgnoradosNoBonus.includes(a.tipo))

  const motivos: string[] = []
  const avisos: string[] = []
  let naoCompensadas = 0

  if (cartao) {
    // Dias de falecimento (nojo) registrados à mão não contam
    const diasIgnorados = new Set(todasDoMes.filter((a) => tiposIgnoradosNoBonus.includes(a.tipo)).flatMap((a) => diasNoMes(a, ini, fim)))
    const r = analisarCartao(cartao, c, diasIgnorados, diasBanco)
    motivos.push(...r.motivos)
    avisos.push(...r.avisos)
    naoCompensadas += r.naoCompensadas / 60
    // Do registro manual, só entra o que o cartão não mostra como falta (atestados, licenças, faltas abonadas)
    const diasComRotulo = new Set(cartao.dias.filter((x) => x.rotulo).map((x) => x.data))
    doMes = doMes.filter((a) => tiposSoManuais.includes(a.tipo) && !diasNoMes(a, ini, fim).every((x) => diasComRotulo.has(x)))
  }

  for (const a of doMes) {
    // Só faltas e horas devidas podem ser marcadas como uso do banco
    const dias = diasNoMes(a, ini, fim).filter((x) => !(tiposNaFolha[a.tipo] && diasBanco.has(x)))
    if (!dias.length) continue
    const umDia = a.inicio === a.fim
    const horasDia = umDia && a.horas != null ? a.horas : JORNADA_DIA
    const totalHoras = horasDia * dias.length
    const banco = Math.min(a.horasBanco ?? 0, totalHoras)
    const compensadas = a.horasCompensadas ?? 0
    const cobertaPeloBanco = banco >= totalHoras - 1e-9

    // Regra do dia: 4h ou mais num dia, sem cobertura total do banco, perde mesmo compensando depois
    if (!cobertaPeloBanco && horasDia >= c.bonusLimiteDia) {
      const quando = dias.length > 1 ? `${format(d(dias[0]), 'dd/MM')} a ${format(d(dias[dias.length - 1]), 'dd/MM')}` : format(d(dias[0]), 'dd/MM')
      motivos.push(`Ausência de ${umDia && a.horas != null ? fmtH(horasDia) : dias.length > 1 ? `${dias.length} dias` : 'dia inteiro'} em ${quando}`)
    }
    naoCompensadas += Math.max(0, totalHoras - banco - compensadas)
  }

  if (c.bonusLimiteMes != null && naoCompensadas >= c.bonusLimiteMes - 1e-9)
    motivos.push(`${fmtH(naoCompensadas)} de ausências/atrasos não compensados no mês (limite ${fmtH(c.bonusLimiteMes)})`)

  return {
    status: motivos.length ? 'perde' : 'recebe',
    valor: motivos.length ? 0 : c.valorBonus,
    motivos,
    avisos,
    horasNaoCompensadas: naoCompensadas,
    ocorrencias: doMes,
    usouCartao: !!cartao,
  }
}

/** Tipos de ocorrência que o cartão ponto não mostra na coluna de faltas (dias abonados) */
export const tiposSoManuais: TipoAusencia[] = ['atestado', 'falta_justificada', 'licenca_maternidade', 'licenca_paternidade', 'casamento', 'outro']

/** Rótulos do cartão que não contam como ausência para o bônus */
const rotulosNeutros = ['Férias', 'Folga', 'Dispensa']
const rotulosLicenca = ['Licença-maternidade', 'Licença-paternidade']

/**
 * Aplica as regras do bônus a um cartão ponto (valores em minutos).
 * - Regra do dia: ausência >= limite num dia perde, a menos que o saldo do banco ANTES daquele dia cubra tudo.
 *   O saldo do dia é estimado: saldo anterior + extras - faltas dos dias anteriores do mês.
 * - Regra do mês: faltas - extras do mês - saldo anterior positivo >= limite perde. Atestados não são cobertos pelo banco.
 */
export function analisarCartao(cartao: CartaoPontoSalvo, c: ConfigEmpresa, diasIgnorados = new Set<string>(), diasBanco = new Set<string>()) {
  const motivos: string[] = []
  const avisos: string[] = []
  const limiteDia = c.bonusLimiteDia * 60
  let banco = Math.max(0, cartao.saldoAnterior)
  let faltasComuns = 0
  let atestados = 0
  let extras = 0
  /** Minutos marcados como uso do banco que o saldo estimado não alcançava */
  let confirmadasPeloRH = 0

  for (const dia of [...cartao.dias].sort((a, b) => a.data.localeCompare(b.data))) {
    const quando = format(d(dia.data), 'dd/MM')
    let aus = 0
    let atestado = false
    if (diasIgnorados.has(dia.data) || (dia.rotulo && rotulosNeutros.includes(dia.rotulo))) aus = 0
    else if (dia.rotulo && rotulosLicenca.includes(dia.rotulo)) {
      if (!avisos.some((a) => a.startsWith(dia.rotulo!))) avisos.push(`${dia.rotulo} no mês: confira se recebe o bônus`)
    } else if (dia.rotulo === 'Atestado') {
      aus = Math.max(dia.faltas, dia.cargaHoraria - dia.trabalhado, 0)
      atestado = true
    } else aus = dia.faltas

    if (aus > 0 && !atestado && diasBanco.has(dia.data)) {
      const disponivel = Math.max(0, banco) + dia.extras
      const descoberto = Math.max(0, aus - disponivel)
      if (descoberto > 0) avisos.push(`Uso do banco marcado em ${quando}: o saldo estimado (${fmtH(disponivel / 60)}) não cobre a ausência de ${fmtH(aus / 60)}. Confira no cartão`)
      confirmadasPeloRH += descoberto
      faltasComuns += aus
      extras += dia.extras
      banco += dia.extras - aus + descoberto
      continue
    }

    if (aus > 0 && aus >= limiteDia) {
      if (!atestado && banco >= aus) avisos.push(`Ausência de ${fmtH(aus / 60)} em ${quando} coberta pelo banco de horas (saldo estimado de ${fmtH(banco / 60)} no dia): confira no cartão`)
      else motivos.push(`${atestado ? 'Atestado' : dia.rotulo === 'Falta' ? 'Falta' : 'Ausência'} de ${fmtH(aus / 60)} em ${quando}`)
    }
    if (atestado) atestados += aus
    else faltasComuns += aus
    extras += dia.extras
    banco += dia.extras - (atestado ? 0 : aus)
  }

  const naoCompensadas = Math.max(0, faltasComuns - extras - Math.max(0, cartao.saldoAnterior) - confirmadasPeloRH) + atestados
  return { motivos, avisos, naoCompensadas, faltas: faltasComuns + atestados, extras }
}

export const horasTexto = fmtH
export const diasEntre = (a: Ausencia) => differenceInCalendarDays(d(a.fim), d(a.inicio)) + 1
