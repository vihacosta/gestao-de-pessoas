import { CalendarCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../auth'
import { Botao, Campo, Entrada } from '../components/ui'
import { modoDemo } from '../lib/store'

type Modo = 'entrar' | 'criar' | 'esqueci'

function Moldura({ children, onSubmit }: { children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-marca-600 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <CalendarCheck className="text-marca-600" />
          <h1 className="text-xl font-bold">Gestão de Pessoas</h1>
        </div>
        {children}
      </form>
    </div>
  )
}

export default function Login() {
  const { entrar, criarConta, esqueciSenha, aviso } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function trocar(m: Modo) {
    setModo(m)
    setErro(null)
    setOk(null)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    setOk(null)
    if (modo === 'entrar') setErro(await entrar(email, senha))
    else if (modo === 'criar') setErro(await criarConta(nome, email, senha))
    else {
      const r = await esqueciSenha(email)
      if (r) setErro(r)
      else setOk('Pronto! Se este e-mail tiver conta, chega um link para criar uma senha nova. Veja também a caixa de spam.')
    }
    setEnviando(false)
  }

  if (modoDemo)
    return (
      <Moldura onSubmit={enviar}>
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Modo demonstração: ainda não há banco de dados configurado. Clique em entrar para explorar com dados de exemplo.
        </p>
        <Botao type="submit" className="w-full">
          Entrar na demonstração
        </Botao>
      </Moldura>
    )

  return (
    <Moldura onSubmit={enviar}>
      {modo === 'criar' && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          Primeiro acesso: crie sua senha. Só funciona para e-mails liberados por quem administra o sistema.
        </p>
      )}
      {modo === 'esqueci' && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">Informe seu e-mail para receber um link e criar uma senha nova.</p>}
      {aviso && modo === 'entrar' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}

      {modo === 'criar' && (
        <Campo rotulo="Seu nome">
          <Entrada required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </Campo>
      )}
      <Campo rotulo="E-mail">
        <Entrada type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      </Campo>
      {modo !== 'esqueci' && (
        <Campo rotulo={modo === 'criar' ? 'Crie uma senha (mínimo 6 caracteres)' : 'Senha'}>
          <Entrada
            type="password"
            required
            minLength={modo === 'criar' ? 6 : undefined}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
          />
        </Campo>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}
      <Botao type="submit" disabled={enviando} className="w-full">
        {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar minha conta' : 'Enviar link'}
      </Botao>

      <div className="flex flex-wrap justify-between gap-2 text-sm">
        {modo === 'entrar' ? (
          <>
            <button type="button" className="text-marca-600 underline" onClick={() => trocar('criar')}>
              Primeiro acesso
            </button>
            <button type="button" className="text-gray-500 underline" onClick={() => trocar('esqueci')}>
              Esqueci minha senha
            </button>
          </>
        ) : (
          <button type="button" className="text-gray-500 underline" onClick={() => trocar('entrar')}>
            Voltar para entrar
          </button>
        )}
      </div>
    </Moldura>
  )
}

/** Tela mostrada quando a pessoa abre o link de "esqueci minha senha" */
export function DefinirSenha() {
  const { definirSenha } = useAuth()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(await definirSenha(senha))
    setEnviando(false)
  }

  return (
    <Moldura onSubmit={enviar}>
      <p className="text-sm text-gray-700">Crie sua nova senha.</p>
      <Campo rotulo="Nova senha (mínimo 6 caracteres)">
        <Entrada type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
      </Campo>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <Botao type="submit" disabled={enviando} className="w-full">
        Salvar nova senha
      </Botao>
    </Moldura>
  )
}
