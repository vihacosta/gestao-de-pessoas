/**
 * Férias coletivas (CLT arts. 139 a 141).
 * - Até 2 períodos por ano, nenhum com menos de 10 dias.
 * - Comunicar o órgão local do Ministério do Trabalho e o sindicato com 15 dias de antecedência.
 * - Quem tem menos de 12 meses de casa: a CLT (art. 140) manda dar férias proporcionais e começar um
 *   novo período aquisitivo no primeiro dia das coletivas. A contabilidade da empresa, porém, desconta
 *   esses dias como antecipados do período em andamento; por isso o art. 140 é opcional (`reiniciar`).
 *   Dias além do saldo viram licença remunerada.
 */
import { addDays, addYears, differenceInCalendarDays, getDay, isAfter } from 'date-fns'
import { avos, d, dataBR, diasDeDireito, iso, periodosAquisitivos } from './clt'
import type { Ausencia, Ferias, Funcionario } from './types'

export interface ParteColetiva {
  periodoInicio: string
  inicio: string
  fim: string
  /** Dias descontados do saldo deste período */
  dias: number
  antecipada: boolean
  licencaRemunerada: number
}

export interface PlanoColetivo {
  funcionario: Funcionario
  /** Registros de férias a criar (um por período aquisitivo usado) */
  partes: ParteColetiva[]
  diasDescontados: number
  licencaRemunerada: number
  reiniciaPeriodo: boolean
  /** Motivo para não incluir esta pessoa (ex.: já tem férias nas mesmas datas) */
  conflito?: string
}

export const fimColetiva = (inicio: string, dias: number) => iso(addDays(d(inicio), dias - 1))

export function planoColetivo(
  f: Funcionario,
  ferias: Ferias[],
  ausencias: Ausencia[],
  inicio: string,
  dias: number,
  hoje: string,
  /** Aplicar o art. 140 a quem tem menos de 12 meses (por padrão segue a contabilidade: desconta como antecipadas) */
  reiniciar = false,
): PlanoColetivo {
  const fim = fimColetiva(inicio, dias)
  const vazio = { funcionario: f, partes: [], diasDescontados: 0, licencaRemunerada: 0, reiniciaPeriodo: false }

  if (f.dataAdmissao >= inicio) return { ...vazio, conflito: `Admitido em ${dataBR(f.dataAdmissao)}, depois do início.` }
  const choque = ferias.find((x) => x.funcionarioId === f.id && x.status !== 'recusada' && x.inicio <= fim && x.fim >= inicio)
  if (choque) return { ...vazio, conflito: `Já tem férias de ${dataBR(choque.inicio)} a ${dataBR(choque.fim)}.` }

  const periodos = periodosAquisitivos(f, ferias, ausencias, hoje)
  const menosDe12 = reiniciar && f.tipo === 'clt' && isAfter(addYears(d(f.dataAdmissao), 1), d(inicio))

  if (menosDe12) {
    const p = periodos[periodos.length - 1]
    const proporcional = Math.floor((diasDeDireito(f.tipo, p?.faltasInjustificadas ?? 0) / 12) * avos(f.dataAdmissao, iso(addDays(d(inicio), -1))))
    const desconto = Math.max(0, Math.min(dias, proporcional - (p?.usados ?? 0)))
    const licenca = dias - desconto
    return {
      ...vazio,
      partes: [{ periodoInicio: p?.inicio ?? f.dataAdmissao, inicio, fim, dias: desconto, antecipada: false, licencaRemunerada: licenca }],
      diasDescontados: desconto,
      licencaRemunerada: licenca,
      reiniciaPeriodo: true,
    }
  }

  const partes: ParteColetiva[] = []
  let falta = dias
  let dia = inicio
  for (const p of periodos) {
    const disponivel = p.direitoTotal - p.usados
    if (falta <= 0) break
    if (disponivel <= 0) continue
    const n = Math.min(disponivel, falta)
    partes.push({ periodoInicio: p.inicio, inicio: dia, fim: fimColetiva(dia, n), dias: n, antecipada: !p.completo, licencaRemunerada: 0 })
    falta -= n
    dia = iso(addDays(d(dia), n))
  }
  if (falta > 0) {
    // sem saldo para todos os dias: o restante é licença remunerada
    const ultima = partes[partes.length - 1]
    if (ultima) {
      ultima.fim = fim
      ultima.licencaRemunerada = falta
    } else {
      const atual = periodos[periodos.length - 1]
      partes.push({ periodoInicio: atual?.inicio ?? f.dataAdmissao, inicio, fim, dias: 0, antecipada: false, licencaRemunerada: falta })
    }
  }
  return { ...vazio, partes, diasDescontados: dias - falta, licencaRemunerada: falta }
}

export function validarColetiva(args: { inicio: string; dias: number; ferias: Ferias[]; hoje: string }) {
  const { inicio, dias, ferias, hoje } = args
  const erros: string[] = []
  const avisos: string[] = []
  if (dias > 0 && dias < 10) erros.push('Cada período de férias coletivas precisa ter no mínimo 10 dias (CLT art. 139 §1º).')
  const ano = inicio.slice(0, 4)
  const doAno = new Set(ferias.filter((x) => x.coletivaId && x.status !== 'recusada' && x.inicio.startsWith(ano)).map((x) => x.coletivaId))
  if (doAno.size >= 2) erros.push(`Já foram lançadas 2 férias coletivas em ${ano}: a CLT permite no máximo 2 períodos por ano.`)
  const diaSemana = getDay(d(inicio))
  if (diaSemana === 5 || diaSemana === 6)
    avisos.push('As férias não podem começar nos 2 dias antes do descanso semanal ou de feriado (CLT art. 134 §3º). Confira se o início está correto.')
  if (differenceInCalendarDays(d(inicio), d(hoje)) < 15)
    avisos.push('Faltam menos de 15 dias: a comunicação ao Ministério do Trabalho e ao sindicato deve ser feita com 15 dias de antecedência.')
  return { erros, avisos }
}

/** Registros de férias a gravar para o plano de uma pessoa. */
export function registrosColetiva(plano: PlanoColetivo, args: { coletivaId: string; aprovada: boolean; hoje: string; novoId: () => string }): Ferias[] {
  return plano.partes.map((p, i) => ({
    id: args.novoId(),
    funcionarioId: plano.funcionario.id,
    periodoInicio: p.periodoInicio,
    inicio: p.inicio,
    fim: p.fim,
    dias: p.dias,
    abono: 0,
    antecipada: p.antecipada,
    status: args.aprovada ? 'aprovada' : 'solicitada',
    observacao: 'Férias coletivas',
    criadoEm: args.hoje,
    coletivaId: args.coletivaId,
    licencaRemunerada: p.licencaRemunerada || undefined,
    reiniciaPeriodo: (plano.reiniciaPeriodo && i === 0) || undefined,
  }))
}
