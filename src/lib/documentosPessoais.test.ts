import { describe, expect, it } from 'vitest'
import { pendenciasPessoais, situacaoPessoal } from './documentosPessoais'
import type { DocumentoGuardado, TipoDocPessoal } from './types'

const doc = (t: TipoDocPessoal): DocumentoGuardado => ({
  id: t,
  funcionarioId: 'f1',
  categoria: 'pessoal',
  tipoPessoal: t,
  titulo: t,
  caminho: '',
  tamanho: 1,
  enviadoEm: '2026-11-19',
})

describe('documentos pessoais', () => {
  it('sem nada enviado, tudo pendente (CNH/RG/CPF contam como um)', () => {
    expect(pendenciasPessoais({}, [])).toEqual([
      'Foto do funcionário',
      'Carteira de Trabalho (CTPS)',
      'CNH ou RG + CPF',
      'Comprovante do estado civil',
      'Certidão de nascimento dos filhos',
      'CPF dos filhos',
      'Comprovante de residência atual',
      'Cartão do Vale Transporte',
    ])
  })

  it('com CNH, RG e CPF ficam dispensados', () => {
    const s = situacaoPessoal({}, [doc('cnh')])
    expect(s.cnh).toBe('enviado')
    expect(s.rg).toBe('dispensado')
    expect(s.cpf).toBe('dispensado')
  })

  it('com RG e CPF, CNH fica dispensada; só RG pede CNH ou CPF', () => {
    expect(situacaoPessoal({}, [doc('rg'), doc('cpf')]).cnh).toBe('dispensado')
    expect(pendenciasPessoais({}, [doc('rg')])).toContain('CNH ou CPF')
  })

  it('"não se aplica" tira filhos e VT das pendências', () => {
    const todos = (['foto', 'ctps', 'cnh', 'estado_civil', 'residencia'] as TipoDocPessoal[]).map(doc)
    expect(pendenciasPessoais({ docsNaoAplica: ['certidao_filhos', 'cpf_filhos', 'vale_transporte'] }, todos)).toEqual([])
  })

  it('documentos de outra categoria não contam', () => {
    expect(situacaoPessoal({}, [{ ...doc('foto'), categoria: 'outro' }]).foto).toBe('pendente')
  })
})
