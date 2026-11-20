import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './lib/store'
import { meuUsuario, mensagemErroAuth } from './lib/usuarios'

interface Auth {
  logado: boolean
  carregando: boolean
  email: string | null
  nome: string | null
  /** Pode cadastrar e remover usuários (no modo demonstração, sempre) */
  admin: boolean
  /** Mensagem para mostrar na tela de login (ex.: acesso removido) */
  aviso: string | null
  /** Abriu o link de "esqueci minha senha": precisa definir uma nova */
  recuperandoSenha: boolean
  entrar: (email: string, senha: string) => Promise<string | null>
  criarConta: (nome: string, email: string, senha: string) => Promise<string | null>
  esqueciSenha: (email: string) => Promise<string | null>
  definirSenha: (senha: string) => Promise<string | null>
  sair: () => Promise<void>
}

const Ctx = createContext<Auth>(null!)
const CHAVE_DEMO = 'gp:demo-logado'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null)
  const [nome, setNome] = useState<string | null>(null)
  const [admin, setAdmin] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setEmail(localStorage.getItem(CHAVE_DEMO))
      setAdmin(true)
      setCarregando(false)
      return
    }
    const sb = supabase

    /** Confere se o e-mail logado ainda está na lista de usuários */
    async function aplicar(e: string | null) {
      if (!e) {
        setEmail(null)
        setCarregando(false)
        return
      }
      try {
        const u = await meuUsuario(e)
        if (!u) {
          await sb.auth.signOut()
          setAviso('Seu acesso ao sistema foi removido. Fale com quem administra.')
          setEmail(null)
        } else {
          setEmail(e)
          setNome(u.nome)
          setAdmin(u.admin)
        }
      } catch {
        setEmail(e) // sem conexão para conferir: deixa entrar, o banco protege os dados
      }
      setCarregando(false)
    }

    sb.auth.getSession().then(({ data }) => aplicar(data.session?.user.email ?? null))
    const { data } = sb.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') setTimeout(() => aplicar(s?.user.email ?? null), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function entrar(e: string, senha: string) {
    setAviso(null)
    if (!supabase) {
      localStorage.setItem(CHAVE_DEMO, e || 'demonstracao')
      setEmail(e || 'demonstracao')
      return null
    }
    const { error } = await supabase.auth.signInWithPassword({ email: e.trim(), password: senha })
    return error ? mensagemErroAuth(error.message) : null
  }

  async function criarConta(n: string, e: string, senha: string) {
    setAviso(null)
    const { data, error } = await supabase!.auth.signUp({ email: e.trim().toLowerCase(), password: senha, options: { data: { nome: n.trim() } } })
    if (error) return mensagemErroAuth(error.message)
    if (!data.session) return 'Conta criada, mas o Supabase pediu confirmação por e-mail. Desligue "Confirm email" em Authentication > Sign In / Providers > Email.'
    return null
  }

  async function esqueciSenha(e: string) {
    const { error } = await supabase!.auth.resetPasswordForEmail(e.trim(), { redirectTo: window.location.origin })
    return error ? mensagemErroAuth(error.message) : null
  }

  async function definirSenha(senha: string) {
    const { error } = await supabase!.auth.updateUser({ password: senha })
    if (error) return mensagemErroAuth(error.message)
    setRecuperandoSenha(false)
    return null
  }

  async function sair() {
    if (!supabase) localStorage.removeItem(CHAVE_DEMO)
    else await supabase.auth.signOut()
    setEmail(null)
  }

  return (
    <Ctx.Provider
      value={{ logado: !!email, carregando, email, nome, admin, aviso, recuperandoSenha, entrar, criarConta, esqueciSenha, definirSenha, sair }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
