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
/** Cadastro com todos os campos preenchidos (dados fictícios) */
const completa: Funcionario = {
  ...maria,
  rg: '12.345.678-9',
  pis: '123.45678.90-1',
  dataNascimento: '1995-04-10',
  sexo: 'Feminino',
  estadoCivil: 'Solteiro(a)',
  grauInstrucao: 'Médio completo',
  naturalidade: 'Maringá/PR',
  nomeMae: 'Mãe Teste',
  nomePai: 'Pai Teste',
  telefone: '(44) 90000-0000',
  email: 'teste@exemplo.com',
  endereco: 'Rua das Flores',
  numero: '100',
  complemento: 'Casa 2',
  bairro: 'Centro',
  municipio: 'Maringá',
  cep: '87000-000',
  horarioJornada: '08:00 às 18:00',
  dependentes: 'Filho Teste (filho)',
  contatoEmergencia1: 'Contato Um (44) 91111-1111',
  contatoEmergencia2: 'Contato Dois (44) 92222-2222',
  pix: 'teste@exemplo.com',
  dadosBancarios: 'Banco 001, ag. 1234, c/c 5678-9',
}

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
        funcionarios: [completa, joana],
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

  it('acordo de desconto segue a política da planilha', async () => {
    const m = modelosPadrao.find((x) => x.id === 'admissao-3-acordo-desconto')!
    const blob = preencher(ler(m.id), montarDados(m, { funcionarios: [completa], dataDoc: '2026-11-19', extras: {} }))
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('dividindo o total pelo número de ocorrências')
    expect(t).toContain('desconto de R$ 75,00')
    expect(t).toContain('o desconto será de R$ 150,00')
    expect(t).toContain('o período de 3 (três) meses é reiniciado')
    expect(t).not.toContain('primeira quebra será desconsiderada')
    expect(t).not.toContain('10% de desconto')
    expect(t).not.toMatch(/\{\{/)
  })

  it('ficha cadastral sai com os dados do cadastro', async () => {
    const m = modelosPadrao.find((x) => x.id === 'admissao-1-ficha-cadastral')!
    const blob = preencher(ler(m.id), montarDados(m, { funcionarios: [completa], dataDoc: '2026-11-19', extras: {} }))
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('Maria Teste')
    expect(t).toContain('111.222.333-44')
    expect(t).toContain('Rua das Flores, 100')
    expect(t).toContain('87000-000')
    expect(t).toContain('CLT')
    expect(t).toContain('R$ 2.500,00')
    expect(t).not.toMatch(/\{\{/)
    // vai só para a contabilidade: sem declaração, data ou assinatura
    expect(t).not.toContain('Declaro')
    expect(t).not.toContain('Maringá, 19 de novembro')
    expect(t).not.toContain('____')
  })

  it('ficha cadastral com campos vazios não quebra', async () => {
    const m = modelosPadrao.find((x) => x.id === 'admissao-1-ficha-cadastral')!
    const blob = preencher(ler(m.id), montarDados(m, { funcionarios: [{ ...maria, tipo: 'estagio' }], dataDoc: '2026-11-19', extras: {} }))
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('Estágio')
    expect(t).not.toMatch(/\{\{/)
  })

  it('documento coletivo repete a linha da tabela para cada funcionário', async () => {
    const m = modelosPadrao.find((x) => x.id === 'coletivo-ferias-coletivas')!
    const blob = preencher(
      ler(m.id),
      montarDados(m, { funcionarios: [maria, joana], dataDoc: '2026-11-19', extras: { inicio: '2026-12-23', fim: '2027-01-04', retorno: '2027-01-05' } }),
    )
    const t = texto(await blob.arrayBuffer())
    expect(t).toContain('Maria Teste111.222.333-44')
    expect(t).toContain('Joana Exemplo999.888.777-66')
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
