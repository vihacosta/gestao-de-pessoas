/**
 * Importação de vários PDFs de holerites de uma vez: ignora arquivos repetidos e holerites já guardados,
 * liga cada holerite à pessoa e monta o histórico salarial a partir dos holerites mensais.
 */
import { salarioEm } from './clt'
import { tituloHolerite, type HoleriteLido } from './holerite'
import type { DocumentoGuardado, Funcionario } from './types'

export interface ArquivoLote {
  nome: string
  hash: string
  modificadoEm: number
  holerites?: HoleriteLido[]
  erro?: string
}

export interface ItemLote {
  arquivo: number
  holerite: HoleriteLido
  funcionarioId?: string
  jaImportado: boolean
}

export interface PessoaSemCadastro {
  chave: string
  nome: string
  meses: string[]
}

export interface PlanoLote {
  itens: ItemLote[]
  repetidos: string[]
  naoLidos: { nome: string; motivo: string }[]
  semCadastro: PessoaSemCadastro[]
}

export const chavePessoa = (h: Pick<HoleriteLido, 'cpf' | 'nome'>) => h.cpf || h.nome

export function montarLote(args: {
  arquivos: ArquivoLote[]
  funcionarios: Funcionario[]
  documentos: DocumentoGuardado[]
  /** Escolhas manuais para quem não foi achado: chave da pessoa -> id do cadastro */
  vinculos: Record<string, string>
  encontrar: (h: HoleriteLido, funcionarios: Funcionario[]) => Funcionario | undefined
}): PlanoLote {
  const { arquivos, funcionarios, documentos, vinculos, encontrar } = args
  const repetidos: string[] = []
  const naoLidos: PlanoLote['naoLidos'] = []
  const hashes = new Set<string>()
  const porHolerite = new Map<string, ItemLote>()

  // do mais antigo para o mais novo: se o mesmo holerite vier em dois arquivos, vale o mais novo
  const ordem = arquivos.map((_, i) => i).sort((a, b) => arquivos[a].modificadoEm - arquivos[b].modificadoEm)
  for (const i of ordem) {
    const a = arquivos[i]
    if (a.erro || !a.holerites) {
      naoLidos.push({ nome: a.nome, motivo: a.erro ?? 'Não foi possível ler' })
      continue
    }
    if (hashes.has(a.hash)) {
      repetidos.push(a.nome)
      continue
    }
    hashes.add(a.hash)
    for (const h of a.holerites) {
      const funcionarioId = encontrar(h, funcionarios)?.id ?? (vinculos[chavePessoa(h)] || undefined)
      const titulo = tituloHolerite(h)
      const jaImportado =
        !!funcionarioId && documentos.some((x) => x.funcionarioId === funcionarioId && x.categoria === 'holerite_original' && x.mes === h.mes && x.titulo === titulo)
      porHolerite.set(`${chavePessoa(h)}|${h.mes}|${h.tipo}`, { arquivo: i, holerite: h, funcionarioId, jaImportado })
    }
  }

  const itens = [...porHolerite.values()].sort((a, b) => a.holerite.mes.localeCompare(b.holerite.mes) || a.holerite.nome.localeCompare(b.holerite.nome))
  const sem = new Map<string, PessoaSemCadastro>()
  for (const { holerite: h } of itens) {
    if (encontrar(h, funcionarios)) continue
    const chave = chavePessoa(h)
    const p = sem.get(chave) ?? { chave, nome: h.nome, meses: [] }
    if (!p.meses.includes(h.mes)) p.meses.push(h.mes)
    sem.set(chave, p)
  }
  return { itens, repetidos, naoLidos, semCadastro: [...sem.values()].sort((a, b) => a.nome.localeCompare(b.nome)) }
}

const MOTIVO_HOLERITE = 'Conforme holerite de '

/**
 * Histórico salarial com uma linha em cada mês em que o holerite mensal mudou de valor.
 * Registros manuais e da ficha são mantidos; os gerados por holerite são refeitos.
 * Se o holerite do mês de admissão trouxer outro valor, ele prevalece sobre o da ficha.
 */
export function salariosComHolerites(f: Funcionario, holerites: Pick<HoleriteLido, 'tipo' | 'mes' | 'salario'>[]): Funcionario['salarios'] {
  const porMes = new Map<string, number>()
  for (const h of holerites) if (h.tipo.toUpperCase() === 'MENSAL' && h.salario) porMes.set(h.mes, h.salario)
  if (!porMes.size) return f.salarios

  let salarios = f.salarios.filter((s) => !s.motivo?.startsWith(MOTIVO_HOLERITE))
  for (const [mes, valor] of [...porMes].sort(([a], [b]) => a.localeCompare(b))) {
    const primeiroDia = `${mes}-01`
    const data = f.dataAdmissao > primeiroDia && f.dataAdmissao.startsWith(mes) ? f.dataAdmissao : primeiroDia
    const temAnterior = salarios.some((s) => s.data <= data)
    if (temAnterior && Math.abs(salarioEm({ ...f, salarios }, data) - valor) <= 0.009) continue
    salarios = [...salarios.filter((s) => s.data !== data), { data, valor, motivo: `${MOTIVO_HOLERITE}${mes.slice(5)}/${mes.slice(0, 4)}` }]
  }
  return [...salarios].sort((a, b) => a.data.localeCompare(b.data))
}

/** Linhas do histórico que ainda não existem no cadastro */
export const salariosNovos = (antes: Funcionario['salarios'], depois: Funcionario['salarios']) =>
  depois.filter((s) => !antes.some((x) => x.data === s.data && Math.abs(x.valor - s.valor) <= 0.009))
