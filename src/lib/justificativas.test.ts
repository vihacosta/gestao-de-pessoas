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

  it('atraso e saída antecipada viram horas devidas; dia sem batidas é falta', () => {
    expect(descreverDia(dias[3])).toBe('Horas devidas')
    expect(descreverDia(dias[4])).toBe('Horas devidas')
    expect(descreverDia(dias[5])).toBe('Falta')
  })

  it('atraso e saída no mesmo dia viram uma ocorrência só, com o total devido', () => {
    const ambos = { ...dia('2026-09-21', ['08:53', '11:58', '13:02', '18:07'], 50), cargaHoraria: 540 } // jornada 08:00-18:00
    const cartao = { id: 'a-2026-09', funcionarioId: 'a', mes: '2026-09', dias: [ambos], saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo
    expect(ocorrenciasDoMes([f('a', 'Ana')], [cartao], [], '2026-09').map(textoOcorrencia)).toEqual(['Horas devidas (00:50)'])
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
      '06 a Horas devidas (00:40)',
      '07 a Horas devidas (01:48)',
      '08 a Falta',
    ])
    expect(lista[0].observacao).toBe('Ônibus')
  })

  it('tolerância: esconde atrasos e saídas de até X minutos, mas nunca faltas', () => {
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias, saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo]
    const lista = ocorrenciasDoMes([f('a', 'Ana')], pontos, [], '2026-10')
    const com = (t: number) => lista.filter((o) => passaDaTolerancia(o, t)).map(textoOcorrencia)
    expect(com(0)).toEqual(['Horas devidas (00:40)', 'Horas devidas (01:48)', 'Falta'])
    expect(com(40)).toEqual(['Horas devidas (01:48)', 'Falta'])
    expect(com(39)).toEqual(['Horas devidas (00:40)', 'Horas devidas (01:48)', 'Falta'])
    expect(com(120)).toEqual(['Falta'])
    // falta lançada à mão sem horas sempre entra
    expect(passaDaTolerancia({ id: 'x', funcionarioId: 'a', data: '2026-10-01', descricao: 'Falta justificada', origem: 'manual' }, 999)).toBe(true)
  })

  it('atraso compensado no dia não entra; compensação parcial mostra só o que faltou', () => {
    const compensado = { ...dia('2026-10-13', ['08:30', '12:00', '13:00', '18:18'], 30), extras: 30 }
    const parcial = { ...dia('2026-10-14', ['08:40', '12:00', '13:00', '18:18'], 40), extras: 30 }
    const semExtra = dia('2026-10-15', ['08:30', '12:00', '13:00', '18:18'], 30) // cumpriu a jornada pelas batidas
    const cartao = { id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias: [normal(1), normal(2), normal(5), compensado, parcial, semExtra], saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo
    const manual: Ausencia = { id: '1', funcionarioId: 'a', tipo: 'atraso', inicio: '2026-10-13', fim: '2026-10-13', horas: 0.5 }
    const lista = ocorrenciasDoMes([f('a', 'Ana')], [cartao], [manual], '2026-10')
    expect(lista.map((o) => `${o.data.slice(8)} ${textoOcorrencia(o)}`)).toEqual(['14 Horas devidas (00:10)'])
  })

  it('histórico junta todos os meses e conta atestados', () => {
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias, saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo]
    const ausencias: Ausencia[] = [
      { id: '1', funcionarioId: 'a', tipo: 'falta_injustificada', inicio: '2026-09-15', fim: '2026-09-15' },
      { id: '2', funcionarioId: 'a', tipo: 'atestado', inicio: '2026-09-21', fim: '2026-09-22' },
    ]
    const h = historicoOcorrencias([f('a', 'Ana')], pontos, ausencias)
    expect(h[0].data).toBe('2026-10-09') // mais recente primeiro
    expect(contar(h)).toEqual({ falta: 2, atestado: 3, horas: 2, banco: 0 })
  })

  it('uso do banco de horas sai de faltas e horas devidas, mesmo abaixo da tolerância continua visível', () => {
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: '2026-10', dias, saldoAnterior: 0, saldoTotal: 0 } as unknown as CartaoPontoSalvo]
    const marcas = [
      { id: 'a-2026-10-06', funcionarioId: 'a', data: '2026-10-06', motivo: '', usoBanco: true },
      { id: 'a-2026-10-08', funcionarioId: 'a', data: '2026-10-08', motivo: '', usoBanco: true },
    ]
    const lista = ocorrenciasDoMes([f('a', 'Ana')], pontos, [], '2026-10', marcas)
    expect(lista.map(textoOcorrencia)).toEqual(['Uso do banco de horas (00:40)', 'Horas devidas (01:48)', 'Uso do banco de horas (08:48)'])
    expect(contar(lista)).toEqual({ falta: 0, atestado: 0, horas: 1, banco: 2 })
    expect(passaDaTolerancia(lista[0], 120)).toBe(true)
    expect(contar(historicoOcorrencias([f('a', 'Ana')], pontos, [], marcas))).toEqual({ falta: 0, atestado: 1, horas: 1, banco: 2 })
  })
})
