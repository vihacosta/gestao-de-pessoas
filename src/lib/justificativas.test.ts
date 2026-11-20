import { describe, expect, it } from 'vitest'
import type { DiaPonto } from './cartaoPonto'
import { contar, descreverDia, historicoOcorrencias, ocorrenciasDoMes, passaDaTolerancia, textoOcorrencia } from './justificativas'
import type { Ausencia, CartaoPontoSalvo, Funcionario } from './types'

const h = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
const dia = (data: string, batidas: string[], faltas = 0, rotulo?: string): DiaPonto => ({
  data, diaSemana: 'Seg', rotulo, batidas: batidas.map(h), cargaHoraria: 528, normais: 528 - faltas, faltas, extras: 0, trabalhado: 0,
})
const normal = (n: number) => dia(`2026-10-0${n}`, ['08:00', '12:00', '13:00', '17:48'])

const f = (id: string, nome: string) => ({ id, nome, cpf: '', cargo: '', tipo: 'clt', dataAdmissao: '2025-01-01', salarios: [] }) as Funcionario

describe('folha de justificativas', () => {
  const dias = [normal(1), normal(2), normal(5), dia('2026-10-06', ['08:40', '12:00', '13:00', '17:48'], 40), dia('2026-10-07', ['08:00', '12:00', '13:00', '16:00'], 108), dia('2026-10-08', [], 528, 'Falta'), dia('2026-10-09', [], 528, 'Atestado')]

  it('deduz atraso, saída antecipada e falta pelas batidas', () => {
    expect(descreverDia(dias[3], dias)).toBe('Atraso')
    expect(descreverDia(dias[4], dias)).toBe('Saída antecipada')
    expect(descreverDia(dias[5], dias)).toBe('Falta')
  })

  it('junta cartão e lançamentos à mão sem repetir o dia e ignora atestado', () => {
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias, saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo]
    const ausencias: Ausencia[] = [
      { id: '1', funcionarioId: 'a', tipo: 'atraso', inicio: '2026-10-06', fim: '2026-10-06', horas: 0.5 },
      { id: '2', funcionarioId: 'b', tipo: 'falta_injustificada', inicio: '2026-10-05', fim: '2026-10-05', observacao: 'Ônibus' },
      { id: '3', funcionarioId: 'b', tipo: 'atestado', inicio: '2026-10-12', fim: '2026-10-12' },
    ]
    const lista = ocorrenciasDoMes([f('a', 'Ana'), f('b', 'Bia')], pontos, ausencias, '2026-10')
    expect(lista.map((o) => `${o.data.slice(8)} ${o.funcionarioId} ${textoOcorrencia(o)}`)).toEqual([
      '05 b Falta',
      '06 a Atraso (00:40)',
      '07 a Saída antecipada (01:48)',
      '08 a Falta',
    ])
    expect(lista[0].observacao).toBe('Ônibus')
  })

  it('tolerância: esconde atrasos e saídas de até X minutos, mas nunca faltas', () => {
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias, saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo]
    const lista = ocorrenciasDoMes([f('a', 'Ana')], pontos, [], '2026-10')
    const com = (t: number) => lista.filter((o) => passaDaTolerancia(o, t)).map(textoOcorrencia)
    expect(com(0)).toEqual(['Atraso (00:40)', 'Saída antecipada (01:48)', 'Falta'])
    expect(com(40)).toEqual(['Saída antecipada (01:48)', 'Falta'])
    expect(com(39)).toEqual(['Atraso (00:40)', 'Saída antecipada (01:48)', 'Falta'])
    expect(com(120)).toEqual(['Falta'])
    // falta lançada à mão sem horas sempre entra
    expect(passaDaTolerancia({ id: 'x', funcionarioId: 'a', data: '2026-10-01', descricao: 'Falta justificada', origem: 'manual' }, 999)).toBe(true)
  })

  it('histórico junta todos os meses e conta atestados', () => {
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias, saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo]
    const ausencias: Ausencia[] = [
      { id: '1', funcionarioId: 'a', tipo: 'falta_injustificada', inicio: '2026-09-15', fim: '2026-09-15' },
      { id: '2', funcionarioId: 'a', tipo: 'atestado', inicio: '2026-09-21', fim: '2026-09-22' },
    ]
    const h = historicoOcorrencias([f('a', 'Ana')], pontos, ausencias)
    expect(h[0].data).toBe('2026-10-09') // mais recente primeiro
    expect(contar(h)).toEqual({ falta: 2, atraso: 1, saida: 1, atestado: 3, outro: 0 })
  })
})
