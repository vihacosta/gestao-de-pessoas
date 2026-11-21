import { describe, expect, it } from 'vitest'
import { historicoFerias } from './historicoFerias'
import type { Ferias } from './types'

const reg = (x: Partial<Ferias>): Ferias => ({
  id: 'x',
  funcionarioId: 'a',
  periodoInicio: '2025-01-01',
  inicio: '2026-01-01',
  fim: '2026-01-10',
  dias: 10,
  abono: 0,
  antecipada: false,
  status: 'aprovada',
  criadoEm: '2025-12-01',
  ...x,
})

describe('histórico de férias', () => {
  it('junta as partes das férias coletivas em uma linha', () => {
    const [item] = historicoFerias(
      [
        reg({ id: '1', coletivaId: 'c', inicio: '2026-12-16', fim: '2027-01-01', dias: 17 }),
        reg({ id: '2', coletivaId: 'c', periodoInicio: '2026-01-01', inicio: '2027-01-02', fim: '2027-01-03', dias: 2, antecipada: true }),
      ],
      'a',
      '2026-11-21',
    )
    expect(item).toMatchObject({ inicio: '2026-12-16', fim: '2027-01-03', dias: 19, doSaldo: 17, antecipados: 2, coletiva: true, situacao: 'agendada' })
    expect(item.periodos).toEqual(['2025-01-01', '2026-01-01'])
  })

  it('mostra só a pessoa pedida, da mais recente para a mais antiga', () => {
    const lista = historicoFerias(
      [
        reg({ id: '1', inicio: '2024-01-01', fim: '2024-01-10' }),
        reg({ id: '2', inicio: '2026-11-20', fim: '2026-11-30' }),
        reg({ id: '3', funcionarioId: 'b' }),
      ],
      'a',
      '2026-11-21',
    )
    expect(lista.map((x) => [x.id, x.situacao])).toEqual([
      ['2', 'em_andamento'],
      ['1', 'concluida'],
    ])
  })

  it('conta a licença remunerada nos dias corridos e mantém recusadas e pendentes', () => {
    const lista = historicoFerias(
      [
        reg({ id: '1', coletivaId: 'c', dias: 5, licencaRemunerada: 5, inicio: '2026-12-01', fim: '2026-12-10' }),
        reg({ id: '2', status: 'recusada', inicio: '2026-06-01', fim: '2026-06-10' }),
        reg({ id: '3', status: 'solicitada', inicio: '2027-02-01', fim: '2027-02-10' }),
      ],
      'a',
      '2026-11-21',
    )
    expect(lista.map((x) => x.situacao)).toEqual(['aguardando', 'agendada', 'recusada'])
    expect(lista[1].dias).toBe(10)
  })
})
