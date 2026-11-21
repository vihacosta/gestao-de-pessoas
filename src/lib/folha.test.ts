import { describe, expect, it } from 'vitest'
import type { Aquisicao } from './aquisicoes'
import type { ErroFuncionario } from './descontoErros'
import { diasUteisPadrao, idDiasUteis, idRegistroFolha, linhasPlanilhaFolha, montarFolha, somaFolha, textoHoras, valorValeTransporte, type RegistroFolha } from './folha'
import type { CartaoPontoSalvo, ConfigEmpresa, Funcionario } from './types'

const func = (p: Partial<Funcionario> = {}): Funcionario => ({
  id: 'a',
  nome: 'Pessoa Teste',
  cpf: '',
  cargo: 'Cargo',
  tipo: 'clt',
  dataAdmissao: '2020-01-01',
  salarios: [{ data: '2020-01-01', valor: 2000 }],
  ...p,
})
const config: ConfigEmpresa = { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, bonusLimiteMes: 4, diasExperiencia: 90, valorAlimentacao: 110 }
const base = { mes: '2026-10', registros: [] as RegistroFolha[], erros: [] as ErroFuncionario[], aquisicoes: [] as Aquisicao[], ausencias: [], pontos: [] as CartaoPontoSalvo[], marcas: [], config, hoje: '2026-11-21' }
const uma = (extra: Partial<typeof base> = {}, f = func()) => montarFolha({ ...base, ...extra, ativos: [f] }).linhas[0]

describe('folha do mês', () => {
  it('salário total segue a fórmula da planilha', () => {
    const registros = [{ id: idRegistroFolha('a', '2026-10'), mes: '2026-10', funcionarioId: 'a', comissao: 50 }]
    const l = uma({ registros }, func({ beneficioCultura: 140 }))
    expect(l.descontoVA).toBe(22)
    expect(l.mobilidade).toBe(100)
    // 2000 + 100 + 140 + 110 - 22 + 50
    expect(l.salarioTotal).toBe(2378)
  })

  it('compras, erros e adiantamento aparecem, mas não mudam o salário total', () => {
    const aquisicoes: Aquisicao[] = [{ id: 'c', funcionarioId: 'a', data: '2026-09-01', produto: 'x', parcelas: [{ data: '2026-10-05', valor: 40, paga: false }, { data: '2026-11-05', valor: 40, paga: false }] }]
    const erros: ErroFuncionario[] = [
      { id: 'e1', funcionarioId: 'a', data: '2026-09-10', descricao: '', valor: 100 },
      { id: 'e2', funcionarioId: 'a', data: '2026-10-15', descricao: '', valor: 50 },
    ]
    const registros = [{ id: idRegistroFolha('a', '2026-10'), mes: '2026-10', funcionarioId: 'a', adiantamento: 200 }]
    const l = uma({ aquisicoes, erros, registros })
    expect(l).toMatchObject({ compras: 40, erros: 75, errosPendentes: true, adiantamento: 200, descontos: 315 })
    expect(l.salarioTotal).toBe(2188)
  })

  it('erro já descontado fica só no mês do desconto', () => {
    const pago = { descontadoEm: '2026-08-05', valorDescontado: 75, pagamentoId: 'p' }
    const erros: ErroFuncionario[] = [
      { id: 'e1', funcionarioId: 'a', data: '2026-06-10', descricao: '', valor: 100, ...pago },
      { id: 'e2', funcionarioId: 'a', data: '2026-07-15', descricao: '', valor: 50, ...pago },
    ]
    expect(uma({ erros, mes: '2026-08' }).erros).toBe(75)
    expect(uma({ erros }).erros).toBe(0)
  })

  it('desconto de erro ainda não feito não entra em mês antigo', () => {
    const erros: ErroFuncionario[] = [
      { id: 'e1', funcionarioId: 'a', data: '2026-03-10', descricao: '', valor: 100 },
      { id: 'e2', funcionarioId: 'a', data: '2026-04-15', descricao: '', valor: 50 },
    ]
    expect(uma({ erros, mes: '2026-05' }).erros).toBe(0)
    expect(uma({ erros }).erros).toBe(75)
  })

  it('parcela atrasada é avisada à parte', () => {
    const aquisicoes: Aquisicao[] = [{ id: 'c', funcionarioId: 'a', data: '2026-08-01', produto: 'x', parcelas: [{ data: '2026-09-05', valor: 30, paga: false }] }]
    expect(uma({ aquisicoes })).toMatchObject({ compras: 0, comprasAtrasadas: 30 })
  })
})

describe('vale transporte', () => {
  const comPasse = func({ passesDia: 2, valorPasse: 6 })

  it('passes × valor × dias úteis', () => {
    expect(valorValeTransporte(comPasse, 22)).toBe(264)
    expect(diasUteisPadrao('2026-10')).toBe(22)
    expect(uma({}, comPasse)).toMatchObject({ recebeVT: true, valeTransporte: 264 })
  })
  it('usa os dias úteis digitados no mês', () => {
    const registros = [{ id: idDiasUteis('2026-10'), mes: '2026-10', diasUteis: 20 }]
    expect(uma({ registros }, comPasse).valeTransporte).toBe(240)
  })
  it('botão Não zera o valor', () => {
    const registros = [{ id: idRegistroFolha('a', '2026-10'), mes: '2026-10', funcionarioId: 'a', recebeVT: false }]
    expect(uma({ registros }, comPasse)).toMatchObject({ recebeVT: false, valeTransporte: 0 })
  })
  it('quem marcou Não fica sem vale, mesmo com registro antigo do mês', () => {
    const registros = [{ id: idRegistroFolha('a', '2026-10'), mes: '2026-10', funcionarioId: 'a', recebeVT: true }]
    expect(uma({ registros }, func({ usaValeTransporte: false }))).toMatchObject({ usaVT: false, recebeVT: false, valeTransporte: 0 })
  })
  it('Sim sem passe cadastrado não calcula valor', () => {
    expect(uma({}, func({ usaValeTransporte: true }))).toMatchObject({ usaVT: true, temPasse: false, recebeVT: false, valeTransporte: 0 })
  })
  it('sem passe cadastrado começa em Não', () => {
    expect(uma().recebeVT).toBe(false)
  })
})

describe('horas e planilha', () => {
  it('formata como na planilha', () => {
    expect(textoHoras(-258)).toBe('(04:18)')
    expect(textoHoras(1903)).toBe('31:43')
  })
  it('planilha traz colunas, linha e totais', () => {
    const { linhas, diasUteis } = montarFolha({ ...base, ativos: [func(), func({ id: 'b', nome: 'Outra Pessoa' })] })
    expect(somaFolha(linhas, 'salario')).toBe(4000)
    const p = linhasPlanilhaFolha(linhas, 'Outubro de 2026', diasUteis)
    expect(p[1]).toEqual(['Dias úteis', 22])
    expect(p[3][0]).toBe('COLABORADOR')
    expect(p[4][0]).toBe('Outra Pessoa')
    expect(p[p.length - 1][0]).toBe('TOTAL')
    expect(p[3].length).toBe(p[4].length)
  })
})
