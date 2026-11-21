import { describe, expect, it } from 'vitest'
import type { HoleriteLido } from './holerite'
import { tituloHolerite } from './holerite'
import { montarLote, salariosComHolerites, salariosNovos, type ArquivoLote } from './holeritesLote'
import type { DocumentoGuardado, Funcionario } from './types'

const func = (x: Partial<Funcionario> = {}) =>
  ({ id: 'a', nome: 'Ana Exemplo', cpf: '000.000.000-01', cargo: 'Teste', tipo: 'clt', dataAdmissao: '2025-02-10', salarios: [], ...x }) as Funcionario

const hol = (mes: string, salario = 2000, x: Partial<HoleriteLido> = {}): HoleriteLido => ({
  nome: 'ANA EXEMPLO',
  cpf: '00000000001',
  tipo: 'MENSAL',
  mes,
  salario,
  creditos: [],
  debitos: [],
  paginas: [0],
  ...x,
})

const arq = (nome: string, hash: string, holerites?: HoleriteLido[], modificadoEm = 1): ArquivoLote => ({ nome, hash, modificadoEm, holerites })
const encontrar = (h: HoleriteLido, fs: Funcionario[]) => fs.find((f) => f.cpf.replace(/\D/g, '') === h.cpf)
const lote = (arquivos: ArquivoLote[], documentos: DocumentoGuardado[] = [], vinculos = {}) =>
  montarLote({ arquivos, funcionarios: [func()], documentos, vinculos, encontrar })

describe('importação de holerites em lote', () => {
  it('ignora arquivo repetido e informa o que não foi lido', () => {
    const p = lote([arq('a.pdf', 'x', [hol('2026-01')]), arq('copia.pdf', 'x', [hol('2026-01')], 2), { nome: 'outro.pdf', hash: 'y', modificadoEm: 3, erro: 'Não é holerite' }])
    expect(p.itens).toHaveLength(1)
    expect(p.repetidos).toEqual(['copia.pdf'])
    expect(p.naoLidos).toEqual([{ nome: 'outro.pdf', motivo: 'Não é holerite' }])
  })

  it('no mesmo holerite em dois arquivos diferentes, vale o mais novo', () => {
    const p = lote([arq('novo.pdf', 'n', [hol('2026-01', 2200)], 5), arq('velho.pdf', 'v', [hol('2026-01', 2000)], 1)])
    expect(p.itens).toHaveLength(1)
    expect(p.itens[0].holerite.salario).toBe(2200)
  })

  it('marca o que já está guardado e separa 13º do mensal', () => {
    const doc = { id: 'd', funcionarioId: 'a', categoria: 'holerite_original', mes: '2025-11', titulo: tituloHolerite(hol('2025-11')), caminho: 'c', tamanho: 1, enviadoEm: '2025-12-01' } as DocumentoGuardado
    const p = lote([arq('a.pdf', 'x', [hol('2025-11'), hol('2025-11', 2000, { tipo: '13º SALARIO - 1ª PARCELA' })])], [doc])
    expect(p.itens.map((i) => [i.holerite.tipo, i.jaImportado])).toEqual([
      ['MENSAL', true],
      ['13º SALARIO - 1ª PARCELA', false],
    ])
  })

  it('lista quem não tem cadastro e aceita o vínculo manual', () => {
    const fora = hol('2026-01', 1500, { nome: 'BIA FORA', cpf: '00000000002' })
    expect(lote([arq('a.pdf', 'x', [fora])]).semCadastro).toEqual([{ chave: '00000000002', nome: 'BIA FORA', meses: ['2026-01'] }])
    expect(lote([arq('a.pdf', 'x', [fora])], [], { '00000000002': 'a' }).itens[0].funcionarioId).toBe('a')
  })
})

describe('histórico salarial pelos holerites', () => {
  const admissao = { data: '2025-02-10', valor: 2000, motivo: 'Ficha de admissão' }

  it('cria uma linha só nos meses em que o valor mudou', () => {
    const r = salariosComHolerites(func({ salarios: [admissao] }), [hol('2025-03'), hol('2025-04'), hol('2026-01', 2100), hol('2026-02', 2100), hol('2026-03', 2224)])
    expect(r.map((s) => [s.data, s.valor])).toEqual([
      ['2025-02-10', 2000],
      ['2026-01-01', 2100],
      ['2026-03-01', 2224],
    ])
  })

  it('refaz linhas geradas por holerite e mantém as manuais', () => {
    const f = func({ salarios: [admissao, { data: '2025-08-15', valor: 2050, motivo: 'Reajuste' }, { data: '2026-10-01', valor: 2300, motivo: 'Conforme holerite de 10/2026' }] })
    const r = salariosComHolerites(f, [hol('2025-09', 2050), hol('2026-09', 2300), hol('2026-10', 2300)])
    expect(r.map((s) => [s.data, s.valor])).toEqual([
      ['2025-02-10', 2000],
      ['2025-08-15', 2050],
      ['2026-09-01', 2300],
    ])
  })

  it('no mês de admissão usa a data de admissão', () => {
    const r = salariosComHolerites(func({ salarios: [admissao] }), [hol('2025-02', 2150)])
    expect(r).toEqual([{ data: '2025-02-10', valor: 2150, motivo: 'Conforme holerite de 02/2025' }])
  })

  it('cadastro sem salário recebe o primeiro holerite; 13º não entra', () => {
    const r = salariosComHolerites(func(), [hol('2025-11', 9999, { tipo: '13º SALARIO - 1ª PARCELA' }), hol('2025-12', 2500)])
    expect(r.map((s) => [s.data, s.valor])).toEqual([['2025-12-01', 2500]])
  })

  it('sem holerite mensal não muda nada e mostra só as linhas novas', () => {
    const f = func({ salarios: [admissao] })
    expect(salariosComHolerites(f, [])).toBe(f.salarios)
    expect(salariosNovos(f.salarios, salariosComHolerites(f, [hol('2026-01', 2100)])).map((s) => s.valor)).toEqual([2100])
  })
})
