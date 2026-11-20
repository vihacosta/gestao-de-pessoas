import { describe, expect, it } from 'vitest'
import type { TextoPosicionado } from './cartaoPonto'
import { lerHolerites, verbaBonus } from './holerite'

// Página fictícia no layout da contabilidade (duas vias por página)
function via(y: number, nome: string, cpf: string, bonus = false): TextoPosicionado[] {
  const t = (x: number, dy: number, str: string) => ({ x, y: y - dy, str })
  return [
    t(299, 0, '0001 EMPRESA EXEMPLO LTDA'),
    t(399, 23, 'HOLERITH - MENSAL de OUTUBRO/2026'),
    t(49, 38, `0000099 ${nome}`),
    t(487, 38, `CPF ${cpf}`),
    t(49, 63, 'Salário R$ 2.000,00 / Mes'),
    t(47, 90, 'CRÉDITO'), t(209, 90, 'Referência'), t(282, 90, 'Valor'), t(311, 90, 'DÉBITO'), t(476, 90, 'Referência'), t(545, 90, 'Valor'),
    t(48, 101, '0001'), t(72, 101, 'SALARIO NORMAL'), t(207, 101, '30,00'), t(230, 101, 'Dia(s)'), t(266, 101, '2.000,00'),
    t(312, 101, '5601'), t(336, 101, 'INSS SALARIO'), t(476, 101, '7,50'), t(494, 101, '%'), t(537, 101, '150,00'),
    ...(bonus ? [t(48, 112, '0150'), t(72, 112, 'BONUS ASSIDUIDADE'), t(266, 112, '100,00')] : []),
    t(48, 218, 'I N S S'),
    t(479, 218, 'CRÉDITO'), t(531, 218, bonus ? '2.100,00' : '2.000,00'),
    t(479, 227, 'DÉBITO'), t(538, 227, '150,00'),
    t(480, 249.5, 'LIQUIDO'), t(527, 247, bonus ? '1.950,00' : '1.850,00'),
  ]
}
const pagina = (nome: string, cpf: string, bonus = false) => [...via(786, nome, cpf, bonus), ...via(391, nome, cpf, bonus)]

describe('holerites da contabilidade', () => {
  it('lê cada página, só a primeira via', () => {
    const r = lerHolerites([pagina('ANA EXEMPLO', '000.000.000-01'), pagina('BIA EXEMPLO', '000.000.000-02', true)])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ nome: 'ANA EXEMPLO', cpf: '00000000001', tipo: 'MENSAL', mes: '2026-10', salario: 2000, totalCreditos: 2000, totalDebitos: 150, liquido: 1850, paginas: [0] })
    expect(r[0].creditos).toEqual([{ codigo: '0001', descricao: 'SALARIO NORMAL', referencia: '30,00 Dia(s)', valor: 2000 }])
    expect(r[0].debitos).toEqual([{ codigo: '5601', descricao: 'INSS SALARIO', referencia: '7,50 %', valor: 150 }])
    expect(verbaBonus(r[0])).toEqual([])
    expect(verbaBonus(r[1]).map((v) => v.valor)).toEqual([100])
  })

  it('recusa PDF que não é de holerites', () => {
    expect(() => lerHolerites([[{ x: 0, y: 0, str: 'qualquer coisa' }]])).toThrow(/holerites/)
  })
})
