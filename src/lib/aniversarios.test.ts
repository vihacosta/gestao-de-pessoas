import { describe, expect, it } from 'vitest'
import {
  acharFuncionario,
  aniversarioNascimento,
  conferirAtivos,
  funcionarioDaPlanilha,
  nomeProprio,
  salariosDaFolha,
  ehMarcoPresente,
  lerDataBR,
  linhasDosAtivos,
  proximoMarcoEmpresa,
  proximosAniversariantes,
  textoMarco,
} from './aniversarios'
import type { Funcionario } from './types'

const func = (p: Partial<Funcionario>): Funcionario => ({ id: p.nome ?? 'x', nome: 'Fulana', cpf: '', cargo: '', tipo: 'clt', dataAdmissao: '2020-01-01', salarios: [], ...p })

describe('marcos de empresa com presente', () => {
  it('só 1, 3, 5, 10 e 15 anos têm presente', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 11, 15, 20].filter(ehMarcoPresente)).toEqual([1, 3, 5, 10, 15])
    expect(ehMarcoPresente(0)).toBe(false)
  })
  it('texto do selo', () => {
    expect(textoMarco(5)).toBe('5 anos: presente')
    expect(textoMarco(1)).toBe('1 ano: presente')
  })
  it('olha o próximo aniversário de empresa', () => {
    // admitida em 21/09/2017: em 19/11/2026 o próximo é 21/09/2027, 10 anos
    expect(proximoMarcoEmpresa('2017-09-21', '2026-11-19')).toMatchObject({ proximo: '2027-09-21', anosNoProximo: 10, presente: true })
    // 12/01/2021: próximo 12/01/2027, 6 anos, sem presente
    expect(proximoMarcoEmpresa('2021-01-12', '2026-11-19')).toMatchObject({ anosNoProximo: 6, presente: false })
    // admitida há pouco: o primeiro ano já é marco
    expect(proximoMarcoEmpresa('2026-08-07', '2026-11-19')).toMatchObject({ anosNoProximo: 1, presente: true })
    // no próprio dia, o marco é o de hoje
    expect(proximoMarcoEmpresa('2023-11-19', '2026-11-19')).toMatchObject({ diasAte: 0, anosNoProximo: 3, presente: true })
  })
})

describe('aniversário de nascimento', () => {
  it('próximo aniversário e idade que completa', () => {
    expect(aniversarioNascimento('1990-12-01', '2026-11-19')).toEqual({ proximo: '2026-12-01', diasAte: 12, idade: 36 })
    expect(aniversarioNascimento('1990-03-04', '2026-11-19')).toEqual({ proximo: '2027-03-04', diasAte: 105, idade: 37 })
  })
  it('hoje conta como aniversário (dias = 0)', () => {
    expect(aniversarioNascimento('2000-11-19', '2026-11-19')).toEqual({ proximo: '2026-11-19', diasAte: 0, idade: 26 })
  })
  it('29 de fevereiro vira 28 em ano não bissexto', () => {
    expect(aniversarioNascimento('2000-02-29', '2027-01-10').proximo).toBe('2027-02-28')
    expect(aniversarioNascimento('2000-02-29', '2028-01-10').proximo).toBe('2028-02-29')
  })
  it('lista dos próximos 30 dias: só ativos com data, em ordem', () => {
    const lista = proximosAniversariantes(
      [
        func({ nome: 'B', dataNascimento: '1995-12-10' }),
        func({ nome: 'A', dataNascimento: '1990-11-19' }),
        func({ nome: 'Longe', dataNascimento: '1990-01-30' }),
        func({ nome: 'Sem data' }),
        func({ nome: 'Desligada', dataNascimento: '1990-11-20', dataDemissao: '2026-01-01' }),
        func({ nome: 'Virada do ano', dataNascimento: '1990-12-31' }),
      ],
      '2026-11-19',
    )
    expect(lista.map((x) => [x.f.nome, x.a.diasAte])).toEqual([
      ['A', 0],
      ['B', 21],
    ])
    expect(proximosAniversariantes([func({ nome: 'C', dataNascimento: '1990-01-05' })], '2026-12-20').map((x) => x.a.proximo)).toEqual(['2027-01-05'])
  })
})

describe('planilha RELAÇÃO DE FUNCIONÁRIOS ATIVOS', () => {
  // Formato real: coluna A vazia; ANIVERSÁRIO salvo com o ano em que foi digitado (só vale dia/mês)
  const abas = [
    {
      aba: 'FUNCIONARIOS ATIVOS',
      linhas: [
        [],
        ['', 'NUMERO CONTROLE', 'FUNCIONÁRIO', 'SITUAÇÃO', 'ANIVERSÁRIO', 'DATA ADMISSÃO', '1 ANO', '3 ANOS', '5 ANOS', '10 ANOS', '15 ANOS'],
        ['', 1, 'DESLIGADO', 'DESLIGADO'],
        ['', 10, 'RAFAELA CRISTINA DA SILVA MOREIRA', 'ATIVO', 45939, 42999, 43344],
        ['', 30, 'NAYARA CRISTINA OLIVEIRA', 'DESLIGADO'],
        ['', 58, 'LARISSA PATRICIA DE SOUZA', 'ATIVO', 45731, 45876],
        ['', '', 'BRUNA REGINA BATISTA DOS REIS', 'ATIVO'],
      ] as (string | number)[][],
    },
    { aba: 'FOLHA DE PAGAMENTO', linhas: [] },
  ]

  it('lê nomes, situação, aniversário (dia/mês) e admissão', () => {
    expect(linhasDosAtivos(abas)).toEqual([
      { linha: 4, numero: '10', nome: 'RAFAELA CRISTINA DA SILVA MOREIRA', situacao: 'ATIVO', aniversario: { dia: 9, mes: 10 }, admissao: '2017-09-21' },
      { linha: 5, numero: '30', nome: 'NAYARA CRISTINA OLIVEIRA', situacao: 'DESLIGADO', aniversario: undefined, admissao: undefined },
      { linha: 6, numero: '58', nome: 'LARISSA PATRICIA DE SOUZA', situacao: 'ATIVO', aniversario: { dia: 15, mes: 3 }, admissao: '2025-08-07' },
      { linha: 7, numero: undefined, nome: 'BRUNA REGINA BATISTA DOS REIS', situacao: 'ATIVO', aniversario: undefined, admissao: undefined },
    ])
  })

  it('acha o funcionário pelo nome, sem ligar dois parecidos', () => {
    const fs = [{ nome: 'Rafaela Cristina da Silva Moreira' }, { nome: 'Larissa de Souza' }, { nome: 'Mariana Ferreira' }, { nome: 'Mariana Rodrigues' }]
    expect(acharFuncionario('RAFAELA CRISTINA DA SILVA MOREIRA', fs)?.nome).toBe('Rafaela Cristina da Silva Moreira')
    expect(acharFuncionario('LARISSA PATRICIA DE SOUZA', fs)?.nome).toBe('Larissa de Souza')
    expect(acharFuncionario('MARIANA', fs)).toBeUndefined()
    expect(acharFuncionario('João Henrique', [{ nome: 'JOAO HENRIQUE MARTINS SILVA' }])?.nome).toBe('JOAO HENRIQUE MARTINS SILVA')
  })

  it('aponta quem está sem nascimento ou com admissão diferente', () => {
    const r = conferirAtivos(
      [
        func({ nome: 'Rafaela Cristina da Silva Moreira', dataAdmissao: '2017-09-21', dataNascimento: '1990-10-09', numeroCadastro: '10' }), // tudo certo
        func({ nome: 'Larissa Patricia de Souza', dataAdmissao: '2025-08-04', dataNascimento: '1999-03-16' }), // admissão e dia diferentes
        func({ nome: 'Bruna Regina Batista dos Reis', dataAdmissao: '2026-01-05' }), // sem nascimento
        func({ nome: 'Pessoa Nova', dataAdmissao: '2026-10-01' }), // não está na planilha
        func({ nome: 'Ex', dataDemissao: '2025-01-01' }), // desligada: fora da conferência
      ],
      linhasDosAtivos(abas),
    )
    expect(r.itens.map((c) => [c.f.nome, c.semNascimento, c.nascimentoDiferente, c.admissaoDiferente, c.planilha?.linha])).toEqual([
      ['Bruna Regina Batista dos Reis', true, false, false, 7],
      ['Larissa Patricia de Souza', false, true, true, 6],
      ['Pessoa Nova', true, false, false, undefined],
    ])
    expect(r.foraDoSistema).toEqual([])
    expect(conferirAtivos([], linhasDosAtivos(abas)).foraDoSistema.map((l) => l.nome)).toEqual([
      'RAFAELA CRISTINA DA SILVA MOREIRA',
      'LARISSA PATRICIA DE SOUZA',
      'BRUNA REGINA BATISTA DOS REIS',
    ])
  })

  it('lê a data digitada dd/mm/aaaa', () => {
    expect(lerDataBR('09/10/1990')).toBe('1990-10-09')
    expect(lerDataBR('9/3/1999')).toBe('1999-03-09')
    expect(lerDataBR('31/02/1990')).toBeUndefined()
    expect(lerDataBR('09/10/')).toBeUndefined()
  })
})

describe('cadastro a partir da planilha de ativos', () => {
  it('pega o último salário bruto de cada pessoa na FOLHA DE PAGAMENTO', () => {
    const m = salariosDaFolha([
      {
        aba: 'FOLHA DE PAGAMENTO',
        linhas: [
          [],
          ['', 'DATA PAGAMENTO DA FOLHA', 'DATA DE ADMISSÃO', 'PERÍODO DE EXPERIÊNCIA', 'SALÁRIO BRUTO', 'FUNCIONÁRIO'],
          ['', 45387, 42999, 'NÃO', 2772, 'FULANA DE TAL'],
          ['', 45600, 42999, 'NÃO', 2900, 'FULANA DE TAL'],
          ['', 45500, 42999, 'NÃO', 2800, 'FULANA DE TAL'],
          ['', 45387, 45307, 'NÃO', 'R$ 1.932,50', 'CICLANA SOUZA'],
        ],
      },
    ])
    expect(m.get('FULANA DE TAL')?.valor).toBe(2900)
    expect(m.get('CICLANA SOUZA')?.valor).toBe(1932.5)
  })

  it('monta o cadastro com nome, admissão e salário; sem admissão não cadastra', () => {
    expect(nomeProprio('MARIA DA SILVA E SOUZA')).toBe('Maria da Silva e Souza')
    const f = funcionarioDaPlanilha({ linha: 3, nome: 'MARIA DA SILVA', situacao: 'ATIVO', admissao: '2021-01-12' }, { valor: 2000 })
    expect(f).toMatchObject({ nome: 'Maria da Silva', dataAdmissao: '2021-01-12', tipo: 'clt', cpf: '', salarios: [{ data: '2021-01-12', valor: 2000 }] })
    expect(funcionarioDaPlanilha({ linha: 4, nome: 'SEM DATA', situacao: 'ATIVO' })).toBeUndefined()
  })
})
