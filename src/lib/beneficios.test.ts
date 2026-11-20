import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { linhasCartao, planilhaCartao, textoTabela } from './beneficios'
import type { ConfigEmpresa, Funcionario } from './types'

const cfg: ConfigEmpresa = { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, bonusLimiteMes: 4, diasExperiencia: 90, valorAlimentacao: 110 }
const f = (id: string, nome: string, extra: Partial<Funcionario> = {}): Funcionario => ({
  id, nome, cpf: `000.000.000-0${id}`, cargo: '', tipo: 'clt', dataAdmissao: '2024-01-10', salarios: [{ data: '2024-01-10', valor: 2000 }], ...extra,
})

describe('planilha do cartão benefício', () => {
  const pessoas = [
    f('1', 'Bia Exemplo', { beneficioCultura: 140 }),
    f('2', 'Ana Exemplo'),
    f('3', 'Sócia Exemplo', { semCartaoBeneficio: true }),
    f('4', 'Nova Exemplo', { dataAdmissao: '2026-09-15' }), // em experiência
    f('5', 'Saiu Exemplo', { dataDemissao: '2026-08-31' }),
  ]

  it('alimentação fixa, mobilidade = bônus, cultura da ficha', () => {
    const ausencias = [{ id: 'a', funcionarioId: '2', tipo: 'falta_injustificada' as const, inicio: '2026-10-05', fim: '2026-10-05' }]
    const l = linhasCartao(pessoas, ausencias, [], cfg, '2026-10')
    expect(l.map((x) => [x.nome, x.alimentacao, x.mobilidade, x.cultura])).toEqual([
      ['ANA EXEMPLO', 110, 0, 0],
      ['BIA EXEMPLO', 110, 100, 140],
      ['NOVA EXEMPLO', 110, 0, 0],
    ])
    expect(textoTabela(l).split('\n')[2]).toBe('BIA EXEMPLO\t000.000.000-01\t\t110\t100\t\t140\t\t\t')
  })

  it('gera um xlsx válido com cabeçalho e valores', async () => {
    const blob = planilhaCartao(linhasCartao(pessoas, [], [], cfg, '2026-10'))
    const zip = new PizZip(await blob.arrayBuffer())
    const xml = zip.file('xl/worksheets/sheet1.xml')!.asText()
    expect(xml).toContain('Valor Fixo em Auxilio Alimentacao')
    expect(xml).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">BIA EXEMPLO</t></is></c>')
    expect(xml).toContain('<c r="E3"><v>100</v></c>')
    expect(xml).not.toContain('r="C3"') // matrícula em branco
  })
})
