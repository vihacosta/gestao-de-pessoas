import { describe, expect, it } from 'vitest'
import { aquisicoesDaPlanilha, criarParcelas, parcelasDoMes, pendenteAquisicao, quitada, totalAquisicao, type Aquisicao } from './aquisicoes'

describe('aquisição de mercadorias', () => {
  it('divide em parcelas mensais sem perder centavos', () => {
    const p = criarParcelas(100, 3, '2026-01-05')
    expect(p.map((x) => [x.data, x.valor])).toEqual([
      ['2026-01-05', 33.34],
      ['2026-02-05', 33.33],
      ['2026-03-05', 33.33],
    ])
  })

  it('soma total, pendente e parcelas do mês', () => {
    const a: Aquisicao = { id: '1', funcionarioId: 'f', data: '2026-01-02', produto: 'Vaso', parcelas: criarParcelas(90, 3, '2026-01-05') }
    a.parcelas[0].paga = true
    expect(totalAquisicao(a)).toBe(90)
    expect(pendenteAquisicao(a)).toBe(60)
    expect(quitada(a)).toBe(false)
    expect(parcelasDoMes([a], '2026-02').map((x) => x.i)).toEqual([1])
  })

  it('lê a planilha: agrupa parcelas da compra e ignora DESCONTO', () => {
    const r = aquisicoesDaPlanilha([
      {
        aba: 'FULANA',
        linhas: [
          ['DATA', 'TIPO', 'PRODUTO', 'DATA DE PG', 'VALOR', 'PARCELA', 'STATUS', 'DOCUMENTO'],
          ['', 'AQUISIÇÃO', 'CJ TAÇAS', 43530, 40, '1/2', 'QUITADO', 'OK'],
          ['', 'AQUISIÇÃO', 'CJ TAÇAS', 43560, 40, '2/2', '', ''],
          [45811, 'AQUISIÇÃO', '3524601', 45842, 29.88, '1/1', 'QUITADO', 'OK'],
          [45756, 'DESCONTO', 'COTAÇÃO ERRADA', 'X', 100, '1/1', 'NÃO FOI COBRADO', 'X'],
        ],
      },
      { aba: 'CICLANA - 2019', linhas: [['CONTROLE ULTRAMARINE AQUISIÇÃO'], ['DATA', 'VALOR ', 'PARCELA', 'PRODUTO', 'STATUS'], [43530, 74.79, '1/1', 'COPOS', 'QUITADO']] },
    ])
    expect(r.map((a) => [a.pessoa, a.produto, a.data, a.parcelas.map((p) => [p.valor, p.paga])])).toEqual([
      ['FULANA', 'CJ TAÇAS', '2019-03-06', [[40, true], [40, false]]],
      ['FULANA', '3524601', '2025-06-03', [[29.88, true]]],
      ['CICLANA', 'COPOS', '2019-03-06', [[74.79, true]]],
    ])
  })
})
