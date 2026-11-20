import { describe, expect, it } from 'vitest'
import { mesesParaSeparar, planoSeparacao } from './pontoDigitalizado'
import type { DocumentoGuardado } from './types'

const doc = (id: string, funcionarioId: string, mes: string, titulo: string): DocumentoGuardado => ({
  id,
  funcionarioId,
  categoria: 'ponto_assinado',
  mes,
  titulo,
  caminho: `documentos/${funcionarioId}/ponto_assinado/${id}.pdf`,
  tamanho: 1000,
  enviadoEm: '2026-11-19',
})

describe('cartões digitalizados do mês inteiro', () => {
  it('agrupa as cópias por mês e ignora os já individuais', () => {
    const meses = mesesParaSeparar([
      doc('1', 'a', '2019-11', 'Cartão ponto 11/2019 – todos os funcionários (digitalizado)'),
      doc('2', 'b', '2019-11', 'Cartão ponto 11/2019 – todos os funcionários (digitalizado)'),
      doc('3', 'a', '2019-10', 'Cartão ponto 10/2019 – todos os funcionários (digitalizado)'),
      doc('4', 'c', '2019-11', 'Cartão ponto 11/2019 (digitalizado)'),
    ])
    expect(meses.map((m) => [m.mes, m.copias.map((c) => c.funcionarioId)])).toEqual([
      ['2019-11', ['a', 'b']],
      ['2019-10', ['a']],
    ])
  })

  it('cada pessoa fica com as suas páginas; quem não tem página perde a cópia', () => {
    const p = planoSeparacao(['a', 'b', 'c'], [['a'], ['a'], [], ['b', 'a'], ['x']])
    expect(p.paginas.get('a')).toEqual([0, 1, 3])
    expect(p.paginas.get('b')).toEqual([3])
    expect(p.semPagina).toEqual(['c'])
    expect(p.paginasSemDono).toEqual([2, 4])
  })
})
