import { describe, expect, it } from 'vitest'
import { bonusDoMes } from './bonus'
import type { Ausencia, ConfigEmpresa, Funcionario } from './types'

const cfg: ConfigEmpresa = { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, bonusLimiteMes: 4, diasExperiencia: 90 }
const ana: Funcionario = { id: 'a', nome: 'Ana', cpf: '', cargo: '', tipo: 'clt', dataAdmissao: '2025-01-06', salarios: [] }

let n = 0
const aus = (over: Partial<Ausencia>): Ausencia => ({ id: String(n++), funcionarioId: 'a', tipo: 'atraso', inicio: '2026-10-05', fim: '2026-10-05', ...over })
const mes = (a: Ausencia[]) => bonusDoMes(ana, a, '2026-10', cfg)

describe('bônus por assiduidade', () => {
  it('sem ocorrências recebe o valor configurado', () => {
    expect(mes([])).toMatchObject({ status: 'recebe', valor: 100 })
  })

  it('experiência: só a partir do mês seguinte ao fim', () => {
    const nova = { ...ana, dataAdmissao: '2026-08-10' } // experiência até 07/11/2026
    expect(bonusDoMes(nova, [], '2026-11', cfg).status).toBe('experiencia')
    expect(bonusDoMes(nova, [], '2026-12', cfg).status).toBe('recebe')
  })

  it('meio período sem banco perde, mesmo compensando depois', () => {
    expect(mes([aus({ tipo: 'falta_injustificada', horas: 4 })]).status).toBe('perde')
    expect(mes([aus({ tipo: 'falta_injustificada', horas: 4, horasCompensadas: 1 })]).status).toBe('perde')
    expect(mes([aus({ tipo: 'falta_injustificada', horas: 4, horasCompensadas: 4 })]).status).toBe('perde')
  })

  it('meio período coberto pelo banco de horas que já existia não perde', () => {
    expect(mes([aus({ tipo: 'falta_injustificada', horas: 4, horasBanco: 4 })]).status).toBe('recebe')
    // cobertura parcial não protege da regra do dia
    expect(mes([aus({ tipo: 'falta_injustificada', horas: 4, horasBanco: 2 })]).status).toBe('perde')
  })

  it('atrasos pequenos: perde só se a soma não compensada chegar a 4h', () => {
    const tres = [aus({ horas: 0.5 }), aus({ horas: 0.5, inicio: '2026-10-06', fim: '2026-10-06' }), aus({ horas: 0.5, inicio: '2026-10-07', fim: '2026-10-07' })]
    expect(mes(tres).status).toBe('recebe')
    const cinco = [aus({ horas: 2 }), aus({ horas: 3, inicio: '2026-10-06', fim: '2026-10-06' })]
    expect(mes(cinco).status).toBe('perde')
    const compensou = [aus({ horas: 2, horasCompensadas: 1 }), aus({ horas: 3, inicio: '2026-10-06', fim: '2026-10-06', horasCompensadas: 1 })]
    expect(mes(compensou)).toMatchObject({ status: 'recebe', horasNaoCompensadas: 3 })
  })

  it('atestado e falta justificada contam; falecimento não', () => {
    expect(mes([aus({ tipo: 'atestado' })]).status).toBe('perde')
    expect(mes([aus({ tipo: 'falta_justificada' })]).status).toBe('perde')
    expect(mes([aus({ tipo: 'falecimento', fim: '2026-10-06' })]).status).toBe('recebe')
  })

  it('ocorrências de outros meses não contam', () => {
    expect(mes([aus({ tipo: 'atestado', inicio: '2026-09-29', fim: '2026-09-30' })]).status).toBe('recebe')
  })
})
