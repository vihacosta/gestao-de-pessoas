/**
 * Usuários do sistema (tabela "usuarios" no Supabase).
 * Só e-mails desta lista conseguem criar conta e ver os dados (ver supabase/schema.sql).
 */
import { clienteCadastro, supabase } from './store'

export interface Usuario {
  email: string
  nome: string | null
  admin: boolean
  criado_em: string
}

/** Traduz os erros do Supabase Auth para mensagens claras */
export function mensagemErroAuth(msg: string): string {
  if (/database error|EMAIL_SEM_ACESSO/i.test(msg)) return 'Este e-mail não tem acesso ao sistema. Peça para quem administra cadastrar você em Usuários.'
  if (/already registered|already exists/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci minha senha".'
  if (/password/i.test(msg) && /(6|characters|short|weak)/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. No Supabase, desligue "Confirm email" (Authentication > Sign In / Providers > Email).'
  return msg
}

export async function listarUsuarios(): Promise<Usuario[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('usuarios').select('*').order('nome')
  if (error) throw error
  return data as Usuario[]
}

export async function meuUsuario(email: string): Promise<Usuario | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('usuarios').select('*').eq('email', email.toLowerCase()).maybeSingle()
  if (error) throw error
  return data as Usuario | null
}

/** Libera o e-mail e cria a conta com a senha informada (sem deslogar quem está cadastrando) */
export async function cadastrarUsuario(nome: string, email: string, senha: string, admin: boolean): Promise<{ jaTinhaConta: boolean }> {
  if (!supabase) throw new Error('Disponível só com o banco de dados (Supabase) configurado.')
  email = email.trim().toLowerCase()
  const { error } = await supabase.from('usuarios').insert({ email, nome: nome.trim(), admin })
  if (error) throw new Error(/duplicate/i.test(error.message) ? 'Este e-mail já está na lista de usuários.' : error.message)
  const r = await clienteCadastro()!.auth.signUp({ email, password: senha, options: { data: { nome: nome.trim() } } })
  if (r.error) {
    if (/already registered|already exists/i.test(r.error.message)) return { jaTinhaConta: true }
    await supabase.from('usuarios').delete().eq('email', email)
    throw new Error(mensagemErroAuth(r.error.message))
  }
  return { jaTinhaConta: false }
}

export async function alterarUsuario(email: string, dados: Partial<Pick<Usuario, 'nome' | 'admin'>>) {
  const { error } = await supabase!.from('usuarios').update(dados).eq('email', email)
  if (error) throw error
}

/** Tira o acesso: a conta continua existindo, mas não vê mais nada nem consegue entrar */
export async function removerUsuario(email: string) {
  const { error } = await supabase!.from('usuarios').delete().eq('email', email)
  if (error) throw error
}
