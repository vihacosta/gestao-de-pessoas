/**
 * Documentos pessoais pedidos na admissão (checklist do funcionário).
 */
import type { DocumentoGuardado, Funcionario, TipoDocPessoal } from './types'

export interface ItemPessoal {
  tipo: TipoDocPessoal
  nome: string
  dica?: string
  /** Aceita vários arquivos separados (ex.: um por filho) */
  varios?: boolean
  /** Pode ser marcado como "não se aplica" */
  podeNaoAplicar?: boolean
}

export const itensPessoais: ItemPessoal[] = [
  { tipo: 'foto', nome: 'Foto 3x4' },
  { tipo: 'ctps', nome: 'Carteira de Trabalho (CTPS)' },
  { tipo: 'cnh', nome: 'CNH – Carteira de Motorista', dica: 'Se tiver, não precisa de RG e CPF' },
  { tipo: 'rg', nome: 'RG – Carteira de Identidade', dica: 'Só se não tiver CNH' },
  { tipo: 'cpf', nome: 'CPF', dica: 'Só se não tiver CNH' },
  { tipo: 'estado_civil', nome: 'Comprovante do estado civil', dica: 'Casado: certidão de casamento · Solteiro: certidão de nascimento' },
  { tipo: 'certidao_filhos', nome: 'Certidão de nascimento dos filhos', dica: 'Uma por filho', varios: true, podeNaoAplicar: true },
  { tipo: 'cpf_filhos', nome: 'CPF dos filhos', dica: 'Um por filho', varios: true, podeNaoAplicar: true },
  { tipo: 'residencia', nome: 'Comprovante de residência atual' },
  { tipo: 'vale_transporte', nome: 'Cartão do Vale Transporte', dica: 'Se for usar', podeNaoAplicar: true },
]

export const nomeItemPessoal = (t: TipoDocPessoal) => itensPessoais.find((i) => i.tipo === t)?.nome ?? t

export type SituacaoItem = 'enviado' | 'pendente' | 'nao_se_aplica' | 'dispensado'

/** Situação de cada item do checklist para um funcionário */
export function situacaoPessoal(f: Pick<Funcionario, 'docsNaoAplica'>, docs: DocumentoGuardado[]): Record<TipoDocPessoal, SituacaoItem> {
  const tem = (t: TipoDocPessoal) => docs.some((d) => d.categoria === 'pessoal' && d.tipoPessoal === t)
  const naoAplica = new Set(f.docsNaoAplica ?? [])
  const r = {} as Record<TipoDocPessoal, SituacaoItem>
  for (const i of itensPessoais) {
    if (tem(i.tipo)) r[i.tipo] = 'enviado'
    else if (i.podeNaoAplicar && naoAplica.has(i.tipo)) r[i.tipo] = 'nao_se_aplica'
    else if ((i.tipo === 'rg' || i.tipo === 'cpf') && tem('cnh')) r[i.tipo] = 'dispensado'
    else if (i.tipo === 'cnh' && tem('rg') && tem('cpf')) r[i.tipo] = 'dispensado'
    else r[i.tipo] = 'pendente'
  }
  return r
}

/** Nomes do que ainda falta entregar (CNH / RG / CPF contam como um item só) */
export function pendenciasPessoais(f: Pick<Funcionario, 'docsNaoAplica'>, docs: DocumentoGuardado[]): string[] {
  const s = situacaoPessoal(f, docs)
  const faltam: string[] = []
  for (const i of itensPessoais) {
    if (s[i.tipo] !== 'pendente') continue
    if (i.tipo === 'cnh') {
      faltam.push(s.rg === 'enviado' ? 'CNH ou CPF' : s.cpf === 'enviado' ? 'CNH ou RG' : 'CNH ou RG + CPF')
    } else if (i.tipo === 'rg' || i.tipo === 'cpf') {
      continue // já coberto pelo item da CNH
    } else faltam.push(i.nome)
  }
  return faltam
}
