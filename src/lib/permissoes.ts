/**
 * Permissões por pessoa: o administrador vê tudo e escolhe, para cada usuário e módulo,
 * "sem acesso", "ver" ou "editar". As mesmas regras estão no banco (supabase/schema.sql),
 * que é quem protege os dados de verdade; aqui elas servem para ajustar menu e telas.
 */
import type { CategoriaDocumento } from './types'

export type Modulo = 'funcionarios' | 'ferias' | 'documentos' | 'holerites' | 'ponto' | 'ausencias' | 'fechamento' | 'configuracoes' | 'valores'
export type NivelPermissao = 'ver' | 'editar'
export type Permissoes = Partial<Record<Modulo, NivelPermissao>>

export const MODULOS: { id: Modulo; rotulo: string; descricao: string }[] = [
  { id: 'funcionarios', rotulo: 'Funcionários', descricao: 'Cadastro, dados pessoais e documentos da ficha' },
  { id: 'ferias', rotulo: 'Férias', descricao: 'Saldos, pedidos e férias coletivas' },
  { id: 'documentos', rotulo: 'Documentos', descricao: 'Modelos e geração de documentos' },
  { id: 'holerites', rotulo: 'Holerites', descricao: 'Holerites e cartões assinados, com os valores dos holerites' },
  { id: 'ponto', rotulo: 'Cartão ponto e folha de ocorrências', descricao: 'Cartões, folha de justificativas e histórico por pessoa' },
  { id: 'ausencias', rotulo: 'Lançamentos e bônus', descricao: 'Lançar faltas, atestados e licenças, bônus e cartão benefício' },
  { id: 'fechamento', rotulo: 'Fechamento mensal', descricao: 'Pacote do mês, inclusive holerites e atestados' },
  { id: 'configuracoes', rotulo: 'Configurações', descricao: 'Valores e regras da empresa' },
  { id: 'valores', rotulo: 'Salários e valores', descricao: 'Salários, banco e Pix, descontos e estimativa de rescisão' },
]

export function nivelDe(p: Permissoes | null | undefined, admin: boolean, m: Modulo): NivelPermissao | null {
  if (admin) return 'editar'
  const n = p?.[m]
  return n === 'ver' || n === 'editar' ? n : null
}

export const podeVer = (p: Permissoes | null | undefined, admin: boolean, m: Modulo) => nivelDe(p, admin, m) != null
export const podeEditar = (p: Permissoes | null | undefined, admin: boolean, m: Modulo) => nivelDe(p, admin, m) === 'editar'

/** Módulo de cada tela. Painel e Usuários não entram aqui. */
export function moduloDaRota(caminho: string): Modulo | null {
  const primeiro = caminho.split('/')[1]
  const mapa: Record<string, Modulo> = {
    funcionarios: 'funcionarios',
    ferias: 'ferias',
    documentos: 'documentos',
    holerites: 'holerites',
    ponto: 'ponto',
    justificativas: 'ponto',
    ausencias: 'ausencias',
    fechamento: 'fechamento',
    configuracoes: 'configuracoes',
  }
  return mapa[primeiro] ?? null
}

/** Módulos que abrem cada tela. A página de ocorrências e bônus (e seus endereços antigos) abre com qualquer um dos dois. */
export function modulosDaRota(caminho: string): Modulo[] {
  const combinada = caminho === '/ausencias' || caminho === '/justificativas' || caminho === '/ponto/ocorrencias'
  if (combinada) return ['ponto', 'ausencias']
  const m = moduloDaRota(caminho)
  return m ? [m] : []
}

/** Quem pode alterar um documento guardado, conforme o tipo */
export function modulosDoDocumento(categoria: CategoriaDocumento): Modulo[] {
  if (categoria === 'holerite' || categoria === 'holerite_original') return ['holerites']
  if (categoria === 'ponto_assinado') return ['holerites', 'ponto']
  if (categoria === 'justificativas') return ['ponto']
  return ['funcionarios']
}

const MODULO_DA_TABELA: Record<string, Modulo> = {
  funcionarios: 'funcionarios',
  ferias: 'ferias',
  ausencias: 'ausencias',
  config: 'configuracoes',
  modelos: 'documentos',
  pontos: 'ponto',
  justificativas: 'ponto',
  erros: 'valores',
  aquisicoes: 'valores',
}

/** Confere antes de gravar, para mostrar um aviso claro em vez de um erro do banco */
export function podeGravar(p: Permissoes | null | undefined, admin: boolean, tabela: string, registro?: { categoria?: CategoriaDocumento }, operacao: 'salvar' | 'remover' = 'salvar') {
  if (admin) return true
  if (tabela === 'funcionarios' && operacao === 'remover') return false
  if (tabela === 'documentos') return registro?.categoria ? modulosDoDocumento(registro.categoria).some((m) => podeEditar(p, admin, m)) : true
  const m = MODULO_DA_TABELA[tabela]
  return !!m && podeEditar(p, admin, m)
}

// ---------------------------------------------------------------- nome de usuário

/** "Maria da Silva" → "maria.da.silva" */
export const normalizarUsuario = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')

export const usuarioValido = (s: string) => /^[a-z0-9._-]{3,30}$/.test(s)

const DOMINIO_INTERNO = 'rh-utm.vercel.app'

/** A conta precisa de um e-mail por dentro: quem não tem usa este, que nunca aparece nem recebe mensagens */
export const emailInterno = (usuario: string) => `${usuario}@${DOMINIO_INTERNO}`
export const ehEmailInterno = (email?: string | null) => !!email && email.toLowerCase().endsWith(`@${DOMINIO_INTERNO}`)
