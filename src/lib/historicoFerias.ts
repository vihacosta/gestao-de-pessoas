/**
 * Histórico de férias de uma pessoa, da mais recente para a mais antiga.
 * As férias coletivas podem estar gravadas em mais de um registro (um por período aquisitivo);
 * aqui elas viram uma linha só.
 */
import type { Ferias } from './types'

export type SituacaoHistorico = 'aguardando' | 'recusada' | 'agendada' | 'em_andamento' | 'concluida'

export interface ItemHistoricoFerias {
  id: string
  inicio: string
  fim: string
  /** Dias corridos fora, incluindo licença remunerada */
  dias: number
  /** Dias descontados de períodos já completos */
  doSaldo: number
  antecipados: number
  licencaRemunerada: number
  abono: number
  coletiva: boolean
  situacao: SituacaoHistorico
  /** Início dos períodos aquisitivos usados */
  periodos: string[]
  observacao?: string
}

function situacao(x: Ferias, inicio: string, fim: string, hoje: string): SituacaoHistorico {
  if (x.status === 'recusada') return 'recusada'
  if (x.status === 'solicitada') return 'aguardando'
  if (fim < hoje) return 'concluida'
  return inicio > hoje ? 'agendada' : 'em_andamento'
}

export function historicoFerias(ferias: Ferias[], funcionarioId: string, hoje: string): ItemHistoricoFerias[] {
  const grupos = new Map<string, Ferias[]>()
  for (const x of ferias) {
    if (x.funcionarioId !== funcionarioId) continue
    const chave = x.coletivaId ? `${x.coletivaId}:${x.status}` : x.id
    grupos.set(chave, [...(grupos.get(chave) ?? []), x])
  }

  return [...grupos.entries()]
    .map(([id, partes]) => {
      const inicio = partes.map((x) => x.inicio).sort()[0]
      const fim = partes.map((x) => x.fim).sort().at(-1)!
      const soma = (valor: (x: Ferias) => number) => partes.reduce((s, x) => s + valor(x), 0)
      const licencaRemunerada = soma((x) => x.licencaRemunerada ?? 0)
      return {
        id,
        inicio,
        fim,
        dias: soma((x) => x.dias) + licencaRemunerada,
        doSaldo: soma((x) => (x.antecipada ? 0 : x.dias)),
        antecipados: soma((x) => (x.antecipada ? x.dias : 0)),
        licencaRemunerada,
        abono: soma((x) => x.abono),
        coletiva: !!partes[0].coletivaId,
        situacao: situacao(partes[0], inicio, fim, hoje),
        periodos: [...new Set(partes.map((x) => x.periodoInicio))].sort(),
        observacao: partes[0].coletivaId ? undefined : partes[0].observacao,
      }
    })
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
}
