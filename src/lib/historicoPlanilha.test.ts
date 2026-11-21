import { describe, expect, it } from 'vitest'
import { classificar, dataDaCelula, linhasDaPlanilha, motivoDaLinha, registrosDoHistorico, sugerirVinculo, type LinhaPlanilha } from './historicoPlanilha'
import { contar, historicoOcorrencias } from './justificativas'
import type { Funcionario } from './types'

const l = (tipo: string, detalhe: string, motivo = '', nome = 'ANA', data = '2022-03-10'): LinhaPlanilha => ({ aba: 'A', linha: 2, data, nome, tipo, detalhe, motivo })
const desc = (x: LinhaPlanilha) => {
  const c = classificar(x)
  return 'ignorar' in c ? `ignorar: ${c.ignorar}` : c.descricao
}

describe('planilha antiga de atrasos e faltas', () => {
  it('converte datas do Excel e dd/mm/aaaa', () => {
    expect(dataDaCelula(44526)).toBe('2021-11-26')
    expect(dataDaCelula('26/11/2021')).toBe('2021-11-26')
    expect(dataDaCelula('')).toBeUndefined()
  })

  it('classifica pela anotação e pelo tipo', () => {
    expect(desc(l('FALTA', 'NÃO VEIO', 'GREVE ONIBUS'))).toBe('Falta')
    expect(desc(l('FALTA', 'NÃO VEIO', 'ATESTADO - GRIPE'))).toBe('Atestado')
    expect(desc(l('ATRASO', 'CHEGOU ATRASADA'))).toBe('Atraso')
    expect(desc(l('ATRASO', 'FER SAIU AS 16:30'))).toBe('Saída antecipada')
    expect(desc(l('FALTA', 'SAIU MAIS CEDO'))).toBe('Saída antecipada')
    expect(desc(l('ATRASO', 'ATRASOU NO ALMOÇO'))).toBe('Atraso no almoço')
    expect(desc(l('PONTO', 'NÃO BATEU O PONTO'))).toBe('ignorar: problema de ponto')
    expect(desc(l('PONTO', 'BATEU O PONTO ATRASADA'))).toBe('ignorar: problema de ponto')
    expect(desc(l('EXTRA', 'FEZ HORA EXTRA'))).toBe('ignorar: hora extra / banco de horas')
    expect(desc(l('PONTO', 'SAIU MAIS CEDO', 'TIROU ALGUMAS HORAS DO BANCO DE HORAS'))).toBe('ignorar: hora extra / banco de horas')
    expect(desc(l('EXTRA', 'TROCOU O FERIADO', 'CARNAVAL', 'TODAS'))).toBe('ignorar: lançamento para todos')
  })

  it('guarda a anotação no motivo só quando traz algo além do tipo', () => {
    expect(motivoDaLinha(l('ATRASO', 'CHEGOU ATRASADA', 'PNEU FUROU'))).toBe('PNEU FUROU')
    expect(motivoDaLinha(l('ATRASO', 'FER SAIU AS 16:30', 'PEGAR NA ESCOLA'))).toBe('PEGAR NA ESCOLA (FER SAIU AS 16:30)')
  })

  it('lê as abas pelo cabeçalho DATA | NOME', () => {
    const linhas = linhasDaPlanilha([
      { aba: 'ATIVOS', linhas: [['DATA', 'NOME', 'TIPO', 'ANOT', 'OCORRÊNCIA'], [44526, 'mariana', 'ATRASO', 'CHEGOU ATRASADA', 'PNEU']] },
      { aba: 'OUTRA', linhas: [['qualquer coisa']] },
    ])
    expect(linhas).toEqual([{ aba: 'ATIVOS', linha: 2, data: '2021-11-26', nome: 'MARIANA', tipo: 'ATRASO', detalhe: 'CHEGOU ATRASADA', motivo: 'PNEU' }])
  })

  it('sugere o funcionário pelo primeiro nome só quando não há dúvida', () => {
    const fs = [
      { id: '1', nome: 'Mariana Ferreira da Rosa' },
      { id: '2', nome: 'Daniele Santos' },
      { id: '3', nome: 'Danieli Souza' },
      { id: '4', nome: 'Ana Regina Lima' },
      { id: '5', nome: 'Ana Beatriz Costa' },
    ]
    expect(sugerirVinculo('MARIANA', fs)).toBe('1')
    expect(sugerirVinculo('DANIELI', fs)).toBe('3')
    expect(sugerirVinculo('ANA', fs)).toBeUndefined()
    expect(sugerirVinculo('ANA REGINA', fs)).toBe('4')
    expect(sugerirVinculo('NAYARA', fs)).toBeUndefined()
  })

  it('gera ids fixos (sem duplicar) e entra no histórico sem repetir o dia do cartão', () => {
    const linhas = [l('ATRASO', 'CHEGOU ATRASADA', 'TIA FALECEU'), l('ATRASO', 'SAIU MAIS CEDO', 'VELÓRIO'), l('FALTA', 'NÃO VEIO', 'ÔNIBUS', 'ANA', '2026-10-06')]
    const reg = registrosDoHistorico(linhas, new Map([['ANA', 'a']]))
    expect(reg.map((r) => r.id)).toEqual(['hist-a-2022-03-10-1', 'hist-a-2022-03-10-2', 'hist-a-2026-10-06-1'])
    expect(registrosDoHistorico(linhas, new Map())).toEqual([])

    const f = { id: 'a', nome: 'Ana', cpf: '', cargo: '', tipo: 'clt', dataAdmissao: '2020-01-01', salarios: [] } as Funcionario
    const ausencias = [{ id: 'x', funcionarioId: 'a', tipo: 'falta_injustificada' as const, inicio: '2026-10-06', fim: '2026-10-06' }]
    const h = historicoOcorrencias([f], [], ausencias, reg)
    expect(contar(h)).toEqual({ falta: 1, atestado: 0, horas: 2, banco: 0 })
    // o motivo da planilha vai para o dia que já existia
    expect(h.find((o) => o.data === '2026-10-06')?.observacao).toBe('ÔNIBUS')
  })
})
