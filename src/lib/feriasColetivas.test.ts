import { describe, expect, it } from 'vitest'
import { periodosAquisitivos } from './clt'
import { planoColetivo, registrosColetiva, validarColetiva } from './feriasColetivas'
import type { Ferias, Funcionario } from './types'

const func = (over: Partial<Funcionario> = {}): Funcionario => ({
  id: 'f1',
  nome: 'Ana',
  cpf: '',
  cargo: 'Vendedora',
  tipo: 'clt',
  dataAdmissao: '2024-03-10',
  salarios: [{ data: '2024-03-10', valor: 3000 }],
  ...over,
})

let n = 0
const id = () => `id${++n}`
const HOJE = '2026-11-20'

describe('planoColetivo', () => {
  it('desconta do período vencido mais antigo', () => {
    const p = planoColetivo(func({ dataAdmissao: '2024-03-10' }), [], [], '2026-12-21', 20, HOJE)
    expect(p.conflito).toBeUndefined()
    expect(p.partes).toEqual([
      { periodoInicio: '2024-03-10', inicio: '2026-12-21', fim: '2027-01-09', dias: 20, antecipada: false, licencaRemunerada: 0 },
    ])
    expect(p.reiniciaPeriodo).toBe(false)
  })

  it('divide entre dois períodos quando o saldo antigo não basta', () => {
    // admitida em 2025-03-10: já usou 20 dos 30 dias do período 2025/26
    const f2 = func({ dataAdmissao: '2025-03-10' })
    const ja: Ferias[] = [
      { id: 'x', funcionarioId: 'f1', periodoInicio: '2025-03-10', inicio: '2026-04-01', fim: '2026-04-20', dias: 20, abono: 0, antecipada: false, status: 'aprovada', criadoEm: HOJE },
    ]
    const p2 = planoColetivo(f2, ja, [], '2026-12-21', 15, HOJE)
    expect(p2.partes).toEqual([
      { periodoInicio: '2025-03-10', inicio: '2026-12-21', fim: '2026-12-30', dias: 10, antecipada: false, licencaRemunerada: 0 },
      { periodoInicio: '2026-03-10', inicio: '2026-12-31', fim: '2027-01-04', dias: 5, antecipada: true, licencaRemunerada: 0 },
    ])
  })

  it('menos de 12 meses: proporcionais, resto como licença remunerada e novo período', () => {
    // admitida em 2026-08-01, coletivas a partir de 2026-12-21: 5 avos -> 12 dias
    const f = func({ dataAdmissao: '2026-08-01' })
    const p = planoColetivo(f, [], [], '2026-12-21', 20, HOJE, true)
    expect(p.reiniciaPeriodo).toBe(true)
    expect(p.diasDescontados).toBe(12)
    expect(p.licencaRemunerada).toBe(8)
    expect(p.partes).toHaveLength(1)
    expect(p.partes[0]).toMatchObject({ inicio: '2026-12-21', fim: '2027-01-09', dias: 12, licencaRemunerada: 8 })
  })

  it('aponta conflito com férias já marcadas', () => {
    const ja: Ferias[] = [
      { id: 'x', funcionarioId: 'f1', periodoInicio: '2024-03-10', inicio: '2026-12-15', fim: '2026-12-24', dias: 10, abono: 0, antecipada: false, status: 'aprovada', criadoEm: HOJE },
    ]
    expect(planoColetivo(func(), ja, [], '2026-12-21', 20, HOJE).conflito).toMatch(/Já tem férias/)
  })
})

describe('menos de 12 meses sem o art. 140 (como faz a contabilidade)', () => {
  it('desconta tudo como antecipado do período em andamento', () => {
    const p = planoColetivo(func({ dataAdmissao: '2026-08-01' }), [], [], '2026-12-21', 20, HOJE)
    expect(p.reiniciaPeriodo).toBe(false)
    expect(p.partes).toEqual([{ periodoInicio: '2026-08-01', inicio: '2026-12-21', fim: '2027-01-09', dias: 20, antecipada: true, licencaRemunerada: 0 }])
  })
})

describe('reinício do período aquisitivo (art. 140)', () => {
  it('encerra o período nas coletivas e começa outro no primeiro dia', () => {
    const f = func({ dataAdmissao: '2026-08-01' })
    const plano = planoColetivo(f, [], [], '2026-12-21', 20, HOJE, true)
    const regs = registrosColetiva(plano, { coletivaId: 'c1', aprovada: true, hoje: HOJE, novoId: id })
    const ps = periodosAquisitivos(f, regs, [], '2027-02-01')
    expect(ps.map((p) => [p.inicio, p.fim])).toEqual([
      ['2026-08-01', '2026-12-20'],
      ['2026-12-21', '2027-12-20'],
    ])
    expect(ps[0]).toMatchObject({ completo: true, direitoTotal: 12, usados: 12, saldo: 0 })
    expect(ps[1].completo).toBe(false)
  })
})

describe('validarColetiva', () => {
  it('exige no mínimo 10 dias e no máximo 2 por ano', () => {
    expect(validarColetiva({ inicio: '2026-12-21', dias: 9, ferias: [], hoje: HOJE }).erros[0]).toMatch(/10 dias/)
    const duas: Ferias[] = ['a', 'b'].map((c) => ({
      id: c, funcionarioId: 'f1', periodoInicio: '2024-03-10', inicio: '2026-07-01', fim: '2026-07-10', dias: 10, abono: 0, antecipada: false, status: 'aprovada', criadoEm: HOJE, coletivaId: c,
    }))
    expect(validarColetiva({ inicio: '2026-12-21', dias: 15, ferias: duas, hoje: HOJE }).erros[0]).toMatch(/no máximo 2/)
    expect(validarColetiva({ inicio: '2026-12-21', dias: 15, ferias: [], hoje: HOJE }).erros).toEqual([])
  })

  it('avisa quando faltam menos de 15 dias', () => {
    expect(validarColetiva({ inicio: '2026-11-30', dias: 15, ferias: [], hoje: HOJE }).avisos.join()).toMatch(/15 dias/)
  })
})

describe('acerto com a contabilidade', () => {
  it('começa no período informado, com o saldo do relatório, e desconta as férias novas', () => {
    const f = func({ dataAdmissao: '2017-03-27', acertoFerias: { periodoInicio: '2024-12-21', saldo: 17, em: '2026-11-18' } })
    const ps = periodosAquisitivos(f, [], [], HOJE)
    expect(ps.map((p) => p.inicio)).toEqual(['2024-12-21', '2025-12-21'])
    expect(ps[0]).toMatchObject({ completo: true, saldo: 17 })
    const plano = planoColetivo(f, [], [], '2026-12-16', 19, HOJE)
    expect(plano.partes.map((p) => [p.periodoInicio, p.dias, p.antecipada])).toEqual([
      ['2024-12-21', 17, false],
      ['2025-12-21', 2, true],
    ])
    const regs = registrosColetiva(plano, { coletivaId: 'c', aprovada: true, hoje: HOJE, novoId: id })
    expect(periodosAquisitivos(f, regs, [], HOJE)[0].saldo).toBe(0)
  })
})
