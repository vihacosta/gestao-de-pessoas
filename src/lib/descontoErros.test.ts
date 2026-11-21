import { describe, expect, it } from 'vitest'
import { aviso, calcularDesconto, explicacao, fimDoPeriodo, grupoDoErro, gruposDeErros, situacaoErro, type ErroFuncionario } from './descontoErros'

let n = 0
const erro = (data: string, valor: number, extra: Partial<ErroFuncionario> = {}): ErroFuncionario => ({
  id: `e${++n}`, funcionarioId: 'maria', data, descricao: 'Quebra', valor, ...extra,
})

describe('aviso de cada erro', () => {
  const erro = (id: string, data: string, valor = 50, extra: Partial<ErroFuncionario> = {}): ErroFuncionario => ({ id, funcionarioId: 'f', data, descricao: '', valor, ...extra })
  const sit = (lista: ErroFuncionario[], id: string) => {
    const e = lista.find((x) => x.id === id)!
    return situacaoErro(grupoDoErro(gruposDeErros(lista, '2026-11-21'), id)!, e, lista)
  }

  it('primeiro erro não desconta', () => {
    expect(sit([erro('a', '2026-01-10')], 'a')).toEqual({ dias: undefined, desconta: false, texto: '1º erro: não desconta' })
  })
  it('35 dias depois do anterior desconta', () => {
    const l = [erro('a', '2026-01-10'), erro('b', '2026-02-14')]
    expect(sit(l, 'b')).toEqual({ dias: 35, desconta: true, texto: '35 dias depois do erro anterior: desconta' })
    expect(sit(l, 'a').desconta).toBe(true)
  })
  it('depois de 3 meses abre nova contagem e não desconta', () => {
    const r = sit([erro('a', '2026-01-10'), erro('b', '2026-05-10')], 'b')
    expect(r.desconta).toBe(false)
    expect(r.texto).toBe('120 dias depois do erro anterior: não desconta (nova contagem de 3 meses)')
  })
  it('erro único acima do limite desconta', () => {
    expect(sit([erro('a', '2026-01-10', 300)], 'a').desconta).toBe(true)
  })
  it('erro já pago não aparece como desconto a fazer', () => {
    const pago = { descontadoEm: '2026-03-05', valorDescontado: 50, pagamentoId: 'p' }
    const l = [erro('a', '2026-01-10', 50, pago), erro('b', '2026-02-14', 50, pago)]
    expect(sit(l, 'b')).toMatchObject({ dias: 35, desconta: false })
  })
})

describe('política de desconto por erros', () => {
  it('um único erro em 3 meses não é descontado', () => {
    const [g] = gruposDeErros([erro('2026-01-10', 150)], '2026-02-01')
    expect(g.desconto).toBe(0)
    expect(aviso(g)).toBe('não desconta (1º erro em 3 meses)')
    expect(g.aberto).toBe(true)
    expect(explicacao(g)).toContain('até 09/04/2026')
  })

  it('exemplo da Maria: 150 + 50 + 25 = 225, dividido por 3 = R$ 75', () => {
    const [g] = gruposDeErros([erro('2026-01-05', 150), erro('2026-02-03', 50), erro('2026-02-20', 25)], '2026-03-01')
    expect(g.total).toBe(225)
    expect(g.desconto).toBe(75)
    expect(aviso(g)).toBe('desconta R$ 75,00')
    // A soma passa de 200: é o caso que a empresa ainda vai confirmar
    expect(g.aConfirmar).toBe(true)
  })

  it('vários erros somando até 200: desconta a média', () => {
    const grupos = gruposDeErros([erro('2026-01-10', 100), erro('2026-02-05', 50), erro('2026-02-20', 30)], '2026-03-01')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].desconto).toBe(60)
    expect(aviso(grupos[0])).toBe('desconta R$ 60,00')
    expect(grupos[0].aConfirmar).toBe(false)
  })

  it('exemplo da Joana: um erro de 350 desconta 150, mesmo sozinho', () => {
    const [g] = gruposDeErros([erro('2026-01-15', 350)], '2026-01-20')
    expect(g.desconto).toBe(150)
    expect(aviso(g)).toBe('desconta R$ 150,00')
  })

  it('vários erros acima de 200 fica marcado como regra a confirmar', () => {
    const [g] = gruposDeErros([erro('2026-01-10', 150), erro('2026-02-05', 100)], '2026-02-10')
    expect(g.aConfirmar).toBe(true)
    expect(g.excedente).toBe(50)
    expect(g.media).toBe(125)
    expect(g.desconto).toBe(125) // regra provisória: o maior dos dois
    expect(calcularDesconto([150, 100], 'excedente').desconto).toBe(50)
    expect(calcularDesconto([300, 300, 300], 'media').desconto).toBe(300)
    expect(calcularDesconto([300, 300, 300], 'menor').desconto).toBe(300)
    expect(calcularDesconto([300, 300, 300], 'maior').desconto).toBe(700)
    expect(explicacao(g)).toContain('a confirmar')
  })

  it('o período de 3 meses vai do primeiro erro até a véspera do mesmo dia, 3 meses depois', () => {
    expect(fimDoPeriodo('2026-01-10')).toBe('2026-04-09')
    const grupos = gruposDeErros([erro('2026-01-10', 80), erro('2026-04-09', 40)], '2026-05-01')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].desconto).toBe(60)
  })

  it('erro depois de 3 meses abre um novo período e o anterior fica sem desconto', () => {
    const grupos = gruposDeErros([erro('2026-01-10', 80), erro('2026-04-10', 40)], '2026-05-01')
    expect(grupos).toHaveLength(2)
    expect(grupos.map(aviso)).toEqual(['não desconta (1º erro em 3 meses)', 'não desconta (1º erro em 3 meses)'])
    expect(grupos[1].aberto).toBe(false)
    expect(explicacao(grupos[1])).toContain('não é descontado')
  })

  it('depois de pago, a contagem recomeça no próximo erro', () => {
    const pagos = { descontadoEm: '2026-02-28', valorDescontado: 60 }
    const grupos = gruposDeErros(
      [erro('2026-01-10', 100, pagos), erro('2026-02-05', 20, pagos), erro('2026-03-01', 90)],
      '2026-03-05',
    )
    expect(grupos).toHaveLength(2)
    expect(grupos[0].pago).toBe(false)
    expect(aviso(grupos[0])).toBe('não desconta (1º erro em 3 meses)')
    expect(grupos[1].pago).toBe(true)
    expect(aviso(grupos[1])).toBe('descontado R$ 60,00 em 28/02/2026')
  })
})
