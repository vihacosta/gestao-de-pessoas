import { describe, expect, it } from 'vitest'
import type { Aquisicao } from './aquisicoes'
import { calcularDesligamento, type MotivoDesligamento } from './demissao'
import type { ErroFuncionario } from './descontoErros'
import { calcularRescisao, diasSaldoSalario } from './rescisao'
import type { Ferias, Funcionario } from './types'

// Período atual desde 10/03/2026 e os anteriores já quitados
const f: Funcionario = {
  id: 'f', nome: 'Maria Teste', cpf: '111.222.333-44', cargo: 'Vendedora', tipo: 'clt', dataAdmissao: '2020-03-10',
  salarios: [{ data: '2020-03-10', valor: 3000 }], acertoFerias: { periodoInicio: '2026-03-10', saldo: 30, em: '2026-03-10' },
}
const calc = (motivo: MotivoDesligamento, over: Partial<Parameters<typeof calcularRescisao>[0]> = {}, func = f, data = '2026-11-21') =>
  calcularRescisao({
    funcionario: func,
    motivo,
    desligamento: calcularDesligamento({ funcionario: func, motivo, data, diasExperiencia: 90 }),
    ferias: [], ausencias: [], erros: [], aquisicoes: [],
    ...over,
  })
const valor = (e: ReturnType<typeof calc>, rotulo: string) => e.verbas.find((l) => l.rotulo.startsWith(rotulo))?.valor

describe('estimativa da rescisão', () => {
  it('saldo de salário no mês de 30 dias', () => {
    expect(diasSaldoSalario('2020-03-10', '2026-11-21')).toBe(21)
    expect(diasSaldoSalario('2020-03-10', '2026-02-28')).toBe(30)
    expect(diasSaldoSalario('2020-03-10', '2026-10-31')).toBe(30)
    expect(diasSaldoSalario('2026-11-10', '2026-11-21')).toBe(12)
  })

  it('dispensa com aviso indenizado', () => {
    const e = calc('dispensa_indenizado', { saldoFgts: 10000 })
    expect(valor(e, 'Saldo de salário')).toBe(2100)
    expect(valor(e, 'Aviso prévio')).toBe(4800)
    expect(valor(e, '13º')).toBe(3000)
    expect(valor(e, 'Férias proporcionais')).toBe(3333.33)
    expect(e.bruto).toBe(13233.33)
    expect(e.depositoFgts).toBe(792)
    expect(e.multaFgts).toBe(4316.8)
    expect(e.custoEmpresa).toBe(18342.13)
  })

  it('pedido de demissão não tem aviso pago nem multa', () => {
    const e = calc('pedido_dispensado', { saldoFgts: 10000 })
    expect(valor(e, 'Aviso prévio')).toBeUndefined()
    expect(e.multaFgts).toBe(0)
  })

  it('acordo paga metade do aviso e multa de 20%', () => {
    const e = calc('acordo', { saldoFgts: 10000 })
    expect(valor(e, 'Aviso prévio')).toBe(2400)
    expect(e.percentualMulta).toBe(0.2)
  })

  it('férias vencidas fora do prazo são pagas em dobro', () => {
    const atrasada = { ...f, dataAdmissao: '2024-01-02', salarios: [{ data: '2024-01-02', valor: 3000 }], acertoFerias: undefined }
    const e = calc('pedido_dispensado', {}, atrasada, '2026-01-15')
    expect(e.verbas.find((l) => l.rotulo.includes('em dobro'))?.detalhe).toContain('30 dias')
    expect(valor(e, 'Férias vencidas em dobro')).toBe(8000)
    expect(valor(e, 'Férias vencidas + 1/3')).toBe(4000)
  })

  it('férias marcadas para depois do desligamento continuam devidas', () => {
    const futura: Ferias = { id: 'x', funcionarioId: 'f', periodoInicio: '2026-03-10', inicio: '2027-02-01', fim: '2027-02-10', dias: 10, abono: 0, antecipada: true, status: 'aprovada', criadoEm: '2026-11-01' }
    expect(valor(calc('dispensa_indenizado', { ferias: [futura] }), 'Férias proporcionais')).toBe(3333.33)
  })

  it('limita as compensações a um mês de salário', () => {
    const aquisicoes: Aquisicao[] = [{ id: 'a', funcionarioId: 'f', data: '2026-10-01', produto: 'Vaso', parcelas: [{ data: '2026-12-01', valor: 2500, paga: false }] }]
    const erros: ErroFuncionario[] = [{ id: 'e', funcionarioId: 'f', data: '2026-10-05', descricao: 'Quebra', valor: 1700 }]
    const e = calc('dispensa_indenizado', { aquisicoes, erros })
    expect(e.totalDescontos).toBe(3000)
    expect(e.avisos.some((a) => a.includes('art. 477'))).toBe(true)
  })

  it('adiantamento de 13º entra como desconto', () => {
    const e = calc('dispensa_indenizado', { adiantamento13: 1500, saldoFgts: 0 })
    expect(e.totalDescontos).toBe(1500)
    expect(e.liquido).toBe(11733.33)
  })

  it('estágio: só bolsa e recesso, sem 13º, aviso ou FGTS', () => {
    const estagio: Funcionario = { ...f, tipo: 'estagio', dataAdmissao: '2026-05-01', salarios: [{ data: '2026-05-01', valor: 1200 }], acertoFerias: undefined }
    const e = calcularRescisao({
      funcionario: estagio, motivo: 'fim_estagio', ferias: [], ausencias: [], erros: [], aquisicoes: [],
      desligamento: calcularDesligamento({ funcionario: estagio, motivo: 'fim_estagio', data: '2026-11-21', ultimoDia: '2026-11-20', diasExperiencia: 90 }),
    })
    expect(e.verbas.map((l) => l.rotulo)).toEqual(['Saldo da bolsa', 'Recesso proporcional'])
    expect(e.custoEmpresa).toBe(e.bruto)
  })
})
