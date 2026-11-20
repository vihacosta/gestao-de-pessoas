import { KeyRound, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Selo, Vazio } from '../components/ui'
import { modoDemo } from '../lib/store'
import { alterarUsuario, cadastrarUsuario, listarUsuarios, removerUsuario, type Usuario } from '../lib/usuarios'

/** Quem pode entrar no sistema */
export default function Usuarios() {
  const { email: meuEmail, admin, definirSenha } = useAuth()
  const [lista, setLista] = useState<Usuario[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)

  const recarregar = useCallback(() => {
    listarUsuarios()
      .then(setLista)
      .catch((e) => setErro(String(e.message ?? e)))
  }, [])
  useEffect(recarregar, [recarregar])

  if (modoDemo)
    return (
      <>
        <Cabecalho titulo="Usuários" />
        <Cartao>
          <Vazio>No modo demonstração não há usuários. Esta tela funciona quando o sistema estiver ligado ao banco de dados (Supabase).</Vazio>
        </Cartao>
      </>
    )

  const eu = meuEmail?.toLowerCase()
  const admins = lista.filter((u) => u.admin).length

  async function acao(fn: () => Promise<void>) {
    try {
      setErro(null)
      await fn()
      recarregar()
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Usuários"
        subtitulo="Quem pode entrar no sistema"
        acoes={
          admin && (
            <Botao onClick={() => setNovoAberto(true)}>
              <Plus size={16} /> Novo usuário
            </Botao>
          )
        }
      />

      {erro && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <div className="grid max-w-3xl gap-4">
        <Cartao>
          <ul className="divide-y divide-gray-100">
            {lista.map((u) => (
              <li key={u.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {u.nome || u.email}
                    {u.email === eu && <span className="ml-2 text-xs font-normal text-gray-400">(você)</span>}
                  </div>
                  <div className="truncate text-sm text-gray-500">{u.email}</div>
                </div>
                {u.admin && (
                  <Selo cor="roxo">
                    <ShieldCheck size={12} /> Administrador
                  </Selo>
                )}
                {admin && u.email !== eu && (
                  <div className="flex items-center gap-1">
                    <Botao
                      variante="fantasma"
                      className="px-2 py-1 text-xs"
                      onClick={() => acao(() => alterarUsuario(u.email, { admin: !u.admin }))}
                      title={u.admin ? 'Deixa de poder cadastrar e remover usuários' : 'Passa a poder cadastrar e remover usuários'}
                    >
                      {u.admin ? 'Tirar admin' : 'Tornar admin'}
                    </Botao>
                    <Botao
                      variante="fantasma"
                      className="px-2 py-1"
                      aria-label="Remover acesso"
                      title="Remover acesso"
                      disabled={u.admin && admins <= 1}
                      onClick={() => confirm(`Remover o acesso de ${u.nome || u.email}? A pessoa não consegue mais entrar.`) && acao(() => removerUsuario(u.email))}
                    >
                      <Trash2 size={15} />
                    </Botao>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!admin && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Só administradores cadastram e removem usuários.</p>}
        </Cartao>

        <TrocarSenha definirSenha={definirSenha} />
      </div>

      <NovoUsuario aberto={novoAberto} onFechar={() => setNovoAberto(false)} onCriado={recarregar} />
    </>
  )
}

function NovoUsuario({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [admin, setAdmin] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const r = await cadastrarUsuario(nome, email, senha, admin)
      if (r.jaTinhaConta) alert('Acesso liberado. Este e-mail já tinha conta antes, então a pessoa entra com a senha antiga (ou usa "Esqueci minha senha").')
      setNome('')
      setEmail('')
      setSenha('')
      setAdmin(false)
      onCriado()
      onFechar()
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
    setEnviando(false)
  }

  return (
    <Modal titulo="Novo usuário" aberto={aberto} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4 p-5">
        <Campo rotulo="Nome">
          <Entrada required value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="E-mail">
          <Entrada type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Campo>
        <Campo rotulo="Senha inicial" dica="Mínimo 6 caracteres. Passe para a pessoa; ela pode trocar depois em Usuários.">
          <Entrada type="text" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          Administrador (pode cadastrar e remover usuários)
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar usuário'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}

function TrocarSenha({ definirSenha }: { definirSenha: (s: string) => Promise<string | null> }) {
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const erro = await definirSenha(senha)
    setMsg(erro ? { ok: false, texto: erro } : { ok: true, texto: 'Senha alterada.' })
    if (!erro) setSenha('')
  }

  return (
    <Cartao className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <KeyRound size={17} /> Trocar minha senha
      </h2>
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Nova senha (mínimo 6 caracteres)" className="min-w-56 flex-1">
          <Entrada type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </Campo>
        <Botao type="submit" variante="secundario">
          Salvar
        </Botao>
      </form>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.texto}</p>}
    </Cartao>
  )
}
