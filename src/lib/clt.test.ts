import { describe, expect, it } from 'vitest'
import {
  aniversarioEmpresa,
  avos,
  decimoTerceiro,
  diasDeDireito,
  periodosAquisitivos,
  statusFerias,
  validarSolicitacao,
  valoresFerias,
} from './clt'
import type { Ausencia, Ferias, Funcionario } from './types'

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

const ferias = (over: Partial<Ferias>): Ferias => ({
  id: Math.random().toString(),
  funcionarioId: 'f1',
  periodoInicio: '2024-03-10',
  inicio: '2025-06-01',
  fim: '2025-06-30',
  dias: 30,
  abono: 0,
  antecipada: false,
  status: 'aprovada',
  criadoEm: '2025-01-01',
  ...over,
})

describe('avos', () => {
  it('conta meses e frações de 15 dias', () => {
    expect(avos('2024-01-01', '2024-12-31')).toBe(12)
    expect(avos('2024-01-01', '2024-03-14')).toBe(2)
    expect(avos('2024-01-01', '2024-03-15')).toBe(3)
  })
})

describe('diasDeDireito (art. 130)', () => {
  it('reduz conforme as faltas', () => {
    expect(diasDeDireito('clt', 5)).toBe(30)
    expect(diasDeDireito('clt', 6)).toBe(24)
    expect(diasDeDireito('clt', 20)).toBe(18)
    expect(diasDeDireito('clt', 30)).toBe(12)
    expect(diasDeDireito('clt', 33)).toBe(0)
    expect(diasDeDireito('estagio', 40)).toBe(30)
  })
})

describe('periodosAquisitivos', () => {
  it('gera períodos e calcula saldo', () => {
    const ps = periodosAquisitivos(func(), [], [], '2025-11-19')
    expect(ps).toHaveLength(2)
    expect(ps[0]).toMatchObject({
      inicio: '2024-03-10',
      fim: '2025-03-09',
      concessivoFim: '2026-03-09',
      completo: true,
      saldo: 30,
      limiteInicio: '2026-02-08',
    })
    expect(ps[1].completo).toBe(false)
    expect(ps[1].direito).toBe(20) // 8 avos (10/03 a 19/11) -> 20 dias
  })

  it('desconta férias e faltas injustificadas', () => {
    const aus: Ausencia[] = [
      { id: 'a', funcionarioId: 'f1', tipo: 'falta_injustificada', inicio: '2024-05-01', fim: '2024-05-07' },
    ]
    const ps = periodosAquisitivos(func(), [ferias({ dias: 10 })], aus, '2025-11-19')
    expect(ps[0].faltasInjustificadas).toBe(7)
    expect(ps[0].direito).toBe(24)
    expect(ps[0].saldo).toBe(14)
  })
})

describe('statusFerias', () => {
  it('aquisitivo incompleto no primeiro ano', () => {
    const ps = periodosAquisitivos(func(), [], [], '2024-12-01')
    expect(statusFerias(ps, '2024-12-01').codigo).toBe('aquisitivo_incompleto')
  })
  it('mais de 90 dias, vence em breve, vencida', () => {
    const f = func()
    expect(statusFerias(periodosAquisitivos(f, [], [], '2025-04-01'), '2025-04-01').codigo).toBe('mais_de_90')
    expect(statusFerias(periodosAquisitivos(f, [], [], '2025-12-01'), '2025-12-01').codigo).toBe('vence_em_breve')
    expect(statusFerias(periodosAquisitivos(f, [], [], '2026-03-10'), '2026-03-10').codigo).toBe('vencida')
  })
  it('saldo utilizado', () => {
    const ps = periodosAquisitivos(func(), [ferias({})], [], '2025-11-19')
    expect(statusFerias(ps, '2025-11-19').codigo).toBe('saldo_utilizado')
  })
})

describe('validarSolicitacao', () => {
  const f = func()
  const periodo = (fs: Ferias[] = []) => periodosAquisitivos(f, fs, [], '2025-11-19')[0]

  it('aceita 30 dias numa segunda-feira com antecedência', () => {
    const r = validarSolicitacao({ funcionario: f, periodo: periodo(), inicio: '2026-01-05', dias: 30, abono: 0, hoje: '2025-11-19' })
    expect(r.erros).toEqual([])
    expect(r.avisos).toEqual([])
  })
  it('bloqueia menos de 5 dias e exige um período de 14', () => {
    const r1 = validarSolicitacao({ funcionario: f, periodo: periodo(), inicio: '2026-01-05', dias: 4, abono: 0, hoje: '2025-11-19' })
    expect(r1.erros.join()).toMatch(/mínimo 5 dias/)
    const r2 = validarSolicitacao({ funcionario: f, periodo: periodo([ferias({ dias: 10 })]), inicio: '2026-01-05', dias: 10, abono: 0, hoje: '2025-11-19' })
    expect(r2.erros.join()).toMatch(/14 dias/)
  })
  it('limita o abono a 1/3', () => {
    const r = validarSolicitacao({ funcionario: f, periodo: periodo(), inicio: '2026-01-05', dias: 19, abono: 11, hoje: '2025-11-19' })
    expect(r.erros.join()).toMatch(/no máximo 10 dias/)
  })
  it('avisa sobre início na sexta e falta de antecedência', () => {
    const r = validarSolicitacao({ funcionario: f, periodo: periodo(), inicio: '2025-11-28', dias: 30, abono: 0, hoje: '2025-11-19' })
    expect(r.avisos).toHaveLength(2)
  })
})

describe('valores', () => {
  it('férias + 1/3 + abono', () => {
    const v = valoresFerias(3000, 20, 10, 'clt')
    expect(v.ferias).toBe(2000)
    expect(v.terco).toBeCloseTo(666.67, 2)
    expect(v.abono).toBe(1000)
    expect(v.total).toBeCloseTo(4000, 2)
    expect(valoresFerias(1500, 30, 0, 'estagio').total).toBe(1500)
  })
  it('13º proporcional', () => {
    expect(decimoTerceiro(func(), 2024, '2024-12-01')).toEqual({ avos: 10, valor: 2500 })
    expect(decimoTerceiro(func({ tipo: 'estagio' }), 2024, '2024-12-01').valor).toBe(0)
  })
  it('aniversário de empresa', () => {
    expect(aniversarioEmpresa('2024-03-10', '2025-11-19')).toMatchObject({ anosCompletos: 1, proximo: '2026-03-10', anosNoProximo: 2 })
    expect(aniversarioEmpresa('2024-03-10', '2026-03-10')).toMatchObject({ anosCompletos: 2, diasAte: 0 })
    expect(aniversarioEmpresa('2026-11-19', '2026-11-19')).toMatchObject({ anosCompletos: 0, proximo: '2027-11-19', anosNoProximo: 1 })
  })
})
