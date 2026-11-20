import { readFileSync } from 'node:fs'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { dataComDiaSemana, dataExtenso, mesAno, reaisExtenso } from './extenso'
import { camposDoModelo, modelosPadrao, montarDados, preencher } from './modelos'
import type { Funcionario } from './types'

const maria: Funcionario = {
  id: '1',
  nome: 'Maria Teste',
  cpf: '111.222.333-44',
  ctps: '1234567',
  ctpsSerie: '0001',
  ctpsUF: 'PR',
  cargo: 'Vendedora',
  tipo: 'clt',
  dataAdmissao: '2026-11-03',
  salarios: [{ data: '2026-11-03', valor: 2500 }],
}
const joana: Funcionario = { ...maria, id: '2', nome: 'Joana Exemplo', cpf: '999.888.777-66' }

const texto = (b: ArrayBuffer) =>
  new Docxtemplater(new PizZip(b), { delimiters: { start: '{{', end: '}}' }, paragraphLoop: true }).getFullText()

const ler = (id: string) => {
  const buf = readFileSync(`public/modelos/${id}.docx`)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('extenso', () => {
  it('datas', () => {
    expect(dataExtenso('2026-11-19')).toBe('19 de novembro de 2026')
    expect(dataComDiaSemana('2022-02-28')).toBe('segunda-feira dia 28 de fevereiro de 2022')
    expect(mesAno('2018-11')).toBe('Novembro/2018')
  })
  it('valores', () => {
    expect(reaisExtenso(1)).toBe('um real')
    expect(reaisExtenso(100)).toBe('cem reais')
    expect(reaisExtenso(150.5)).toBe('cento e cinquenta reais e cinquenta centavos')
    expect(reaisExtenso(2500)).toBe('dois mil e quinhentos reais')
    expect(reaisExtenso(1234.01)).toBe('mil duzentos e trinta e quatro reais e um centavo')
  })
})

describe('modelos padrão', () => {
  it('todos os campos de cada modelo são preenchidos', async () => {
    for (const m of modelosPadrao) {
      const buf = ler(m.id)
      const dados = montarDados(m, {
        funcionarios: [maria, joana],
        dataDoc: '2026-11-19',
        extras: Object.fromEntries(m.extras.map((c) => [c.chave, c.tipo === 'valor' ? '150,50' : c.tipo === 'mes' ? '2026-11' : c.tipo.startsWith('data') ? '2026-12-01' : 'x'])),
        config: { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, diasExperiencia: 90, socioNome: 'Sócio', socioCpf: '000' },
      })
      for (const campo of camposDoModelo(buf)) {
        if (campo.startsWith('#') || campo.startsWith('/')) continue
        expect(dados[campo] ?? (dados.funcionarios as Record<string, string>[])[0][campo], `${m.id}: ${campo}`).toBeTruthy()
      }
      const saida = texto(await preencher(buf, dados).arrayBuffer())
      expect(saida, m.id).not.toMatch(/\{\{/)
    }
  })

  it('acordo de desconto sai com os dados da funcionária', async () => {
    const m = modelosPadrao.find((x) => x.id === 'admissao-3-acordo-desconto')!
    const blob = preencher(ler(m.id), montarDados(m, { funcionarios: [maria], dataDoc: '2026-11-19', extras: {} }))
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('Maria Teste')
    expect(t).toContain('CTPS nº 1234567 / 0001 PR')
    expect(t).toContain('Maringá, 19 de novembro de 2026')
    expect(t).toContain('CPF: 111.222.333-44')
  })

  it('documento coletivo repete a linha para cada funcionário', async () => {
    const m = modelosPadrao.find((x) => x.id === 'coletivo-ferias-coletivas')!
    const blob = preencher(
      ler(m.id),
      montarDados(m, { funcionarios: [maria, joana], dataDoc: '2026-11-19', extras: { inicio: '2026-12-23', fim: '2027-01-04', retorno: '2027-01-05' } }),
    )
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('Maria Teste - 111.222.333-44')
    expect(t).toContain('Joana Exemplo - 999.888.777-66')
    expect(t).toContain('23 de dezembro de 2026 a 04 de janeiro de 2027')
  })

  it('autorização de desconto escreve o valor por extenso', async () => {
    const m = modelosPadrao.find((x) => x.id === 'autorizacao-de-desconto')!
    const blob = preencher(ler(m.id), montarDados(m, { funcionarios: [maria], dataDoc: '2026-11-19', extras: { valor: '150,50', mes_referencia: '2026-11' } }))
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('R$ 150,50 (cento e cinquenta reais e cinquenta centavos)')
    expect(t).toContain('Novembro/2026')
  })
})
