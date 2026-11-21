import { KeyRound, Plus, ShieldCheck, SlidersHorizontal, Trash2, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Selecao, Selo, Vazio } from '../components/ui'
import { MODULOS, ehEmailInterno, normalizarUsuario, usuarioValido, type Modulo, type NivelPermissao, type Permissoes } from '../lib/permissoes'
import { modoDemo } from '../lib/store'
import { alterarUsuario, cadastrarUsuario, listarUsuarios, redefinirSenha, removerUsuario, type Usuario } from '../lib/usuarios'

/** Quem pode entrar no sistema */
export default function Usuarios() {
  const { email: meuEmail, admin, definirSenha } = useAuth()
  const [lista, setLista] = useState<Usuario[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)

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
                  <div className="truncate text-sm text-gray-500">{[u.usuario, ehEmailInterno(u.email) ? '' : u.email].filter(Boolean).join(' · ')}</div>
                </div>
                {u.admin ? (
                  <Selo cor="roxo">
                    <ShieldCheck size={12} /> Administrador
                  </Selo>
                ) : (
                  <Selo cor={Object.keys(u.permissoes ?? {}).length ? 'azul' : 'amarelo'}>
                    {Object.keys(u.permissoes ?? {}).length ? `${Object.keys(u.permissoes).length} de ${MODULOS.length} módulos` : 'Sem acesso a módulos'}
                  </Selo>
                )}
                {admin && (
                  <div className="flex items-center gap-1">
                    <Botao variante="secundario" className="px-2 py-1 text-xs" onClick={() => setEditando(u)}>
                      <SlidersHorizontal size={13} /> Acesso
                    </Botao>
                    {u.email !== eu && (
                      <Botao
                        variante="fantasma"
                        className="px-2 py-1"
                        aria-label="Remover acesso"
                        title="Remover acesso"
                        disabled={u.admin && admins <= 1}
                        onClick={() => confirm(`Remover o acesso de ${u.nome || u.usuario || u.email}? A pessoa não consegue mais entrar.`) && acao(() => removerUsuario(u.email))}
                      >
                        <Trash2 size={15} />
                      </Botao>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!admin && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Só administradores cadastram usuários e escolhem as permissões.</p>}
        </Cartao>

        <TrocarSenha definirSenha={definirSenha} />
      </div>

      <NovoUsuario aberto={novoAberto} onFechar={() => setNovoAberto(false)} onCriado={recarregar} />
      {editando && <EditarAcesso key={editando.email} u={editando} souEu={editando.email === eu} ultimoAdmin={admins <= 1} onFechar={() => setEditando(null)} onSalvo={recarregar} />}
    </>
  )
}

/** Escolha do que a pessoa pode fazer em cada módulo */
function EscolherPermissoes({ valor, onMudar }: { valor: Permissoes; onMudar: (p: Permissoes) => void }) {
  const definir = (m: Modulo, n: string) => {
    const novo = { ...valor }
    if (n === 'ver' || n === 'editar') novo[m] = n
    else delete novo[m]
    onMudar(novo)
  }
  const todos = (n: '' | NivelPermissao) => onMudar(n ? Object.fromEntries(MODULOS.map((m) => [m.id, n])) : {})
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">O que esta pessoa pode fazer</span>
        <span className="flex gap-3 text-xs">
          <button type="button" className="text-marca-600 underline" onClick={() => todos('')}>Nada</button>
          <button type="button" className="text-marca-600 underline" onClick={() => todos('ver')}>Ver tudo</button>
          <button type="button" className="text-marca-600 underline" onClick={() => todos('editar')}>Editar tudo</button>
        </span>
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {MODULOS.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.rotulo}</div>
              <div className="text-xs text-gray-500">{m.descricao}</div>
            </div>
            <div className="w-32 shrink-0">
              <Selecao aria-label={`Permissão em ${m.rotulo}`} value={valor[m.id] ?? ''} onChange={(e) => definir(m.id, e.target.value)} className="py-1.5">
                <option value="">Sem acesso</option>
                <option value="ver">Ver</option>
                <option value="editar">Editar</option>
              </Selecao>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Dados de login, administrador, permissões e senha de quem já está cadastrado */
function EditarAcesso({ u, souEu, ultimoAdmin, onFechar, onSalvo }: { u: Usuario; souEu: boolean; ultimoAdmin: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [usuario, setUsuario] = useState(u.usuario ?? '')
  const [admin, setAdmin] = useState(u.admin)
  const [permissoes, setPermissoes] = useState<Permissoes>(u.permissoes ?? {})
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (usuario && !usuarioValido(usuario)) return setErro('O usuário precisa ter de 3 a 30 letras, números, ponto, hífen ou sublinhado.')
    if (senha && senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    setEnviando(true)
    setErro(null)
    try {
      await alterarUsuario(u.email, { usuario: usuario || null, admin, permissoes: admin ? {} : permissoes })
      if (senha) await redefinirSenha(u.email, senha)
      onSalvo()
      onFechar()
    } catch (err) {
      setErro(String((err as Error).message ?? err))
    }
    setEnviando(false)
  }

  return (
    <Modal titulo={`Acesso de ${u.nome || u.usuario || u.email}`} aberto onFechar={onFechar} largura="max-w-xl">
      <form onSubmit={enviar} className="space-y-4 p-5">
        <Campo rotulo="Usuário para entrar" dica={ehEmailInterno(u.email) ? 'Esta pessoa entra só com o usuário.' : `Também pode entrar com ${u.email}.`}>
          <Entrada required={ehEmailInterno(u.email)} value={usuario} onChange={(e) => setUsuario(normalizarUsuario(e.target.value))} autoComplete="off" placeholder="maria.silva" />
        </Campo>
        {!souEu && (
          <Campo rotulo="Nova senha" dica="Deixe em branco para não mudar. Passe a senha nova para a pessoa.">
            <Entrada type="text" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          </Campo>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={admin} disabled={souEu || (u.admin && ultimoAdmin)} onChange={(e) => setAdmin(e.target.checked)} />
          Administrador (vê e altera tudo, inclusive usuários)
        </label>
        {!admin && <EscolherPermissoes valor={permissoes} onMudar={setPermissoes} />}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </form>
    </Modal>
  )
}

function NovoUsuario({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState('')
  const [usuario, setUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [admin, setAdmin] = useState(false)
  const [permissoes, setPermissoes] = useState<Permissoes>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!usuarioValido(usuario)) return setErro('O usuário precisa ter de 3 a 30 letras, números, ponto, hífen ou sublinhado.')
    setEnviando(true)
    setErro(null)
    try {
      const r = await cadastrarUsuario({ nome, usuario, email, senha, admin, permissoes })
      if (r.jaTinhaConta) alert('Acesso liberado. Este e-mail já tinha conta antes, então a pessoa entra com a senha antiga (ou usa "Esqueci minha senha").')
      setNome('')
      setUsuario('')
      setEmail('')
      setSenha('')
      setAdmin(false)
      setPermissoes({})
      onCriado()
      onFechar()
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
    setEnviando(false)
  }

  return (
    <Modal titulo="Novo usuário" aberto={aberto} onFechar={onFechar} largura="max-w-xl">
      <form onSubmit={enviar} className="space-y-4 p-5">
        <Campo rotulo="Nome">
          <Entrada required value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => !usuario && setUsuario(normalizarUsuario(nome).slice(0, 30))} />
        </Campo>
        <Campo rotulo="Usuário para entrar" dica="Letras, números, ponto, hífen ou sublinhado.">
          <Entrada required value={usuario} onChange={(e) => setUsuario(normalizarUsuario(e.target.value))} autoComplete="off" placeholder="maria.silva" />
        </Campo>
        <Campo rotulo="E-mail (opcional)" dica="Com e-mail, a pessoa também pode entrar por ele e recuperar a senha sozinha.">
          <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Campo>
        <Campo rotulo="Senha inicial" dica="Mínimo 6 caracteres. Passe para a pessoa; ela pode trocar depois em Usuários.">
          <Entrada type="text" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          Administrador (vê e altera tudo, inclusive usuários)
        </label>
        {!admin && <EscolherPermissoes valor={permissoes} onMudar={setPermissoes} />}
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
