/**
 * Conferência anual do cadastro: todo começo de ano, os dados de cada funcionário ativo
 * (endereço, telefone, contato de emergência...) precisam ser confirmados.
 */
import type { Funcionario } from './types'

/** O que lembrar de perguntar para a pessoa */
export const itensConferencia = [
  'Endereço (mudou de casa?)',
  'Telefone e e-mail',
  'Contatos de emergência (ainda falam com essa pessoa?)',
  'Estado civil',
  'Dependentes / filhos',
  'Grau de instrução',
  'PIX e dados bancários',
]

/**
 * Precisa conferir se a última conferência (ou a admissão, para quem nunca foi conferido)
 * foi num ano anterior ao atual. Quem entrou neste ano já tem os dados novos.
 */
export function precisaConferir(f: Pick<Funcionario, 'dataDemissao' | 'dataAdmissao' | 'dadosConferidosEm'>, hoje: string): boolean {
  if (f.dataDemissao) return false
  const base = f.dadosConferidosEm ?? f.dataAdmissao
  return !!base && base.slice(0, 4) < hoje.slice(0, 4)
}
