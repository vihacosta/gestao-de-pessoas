import { Check, Plus, Search, Trash2, User, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeloStatusFerias, SolicitarFerias } from '../components/SolicitarFerias'
import { Botao, Cabecalho, Cartao, Entrada, Selecao, Selo, Vazio, cx } from '../components/ui'
import { dataBR, periodosAquisitivos, statusFerias } from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { remover, salvar, useTabela } from '../lib/store'
import type { Ausencia, Ferias, Funcionario } from '../lib/types'
import { somenteDigitos } from './Funcionarios'

const ordemStatus = { vencida: 0, vence_em_breve: 1, mais_de_90: 2, aquisitivo_incompleto: 3, saldo_utilizado: 4 }

export default function FeriasPage() {
  const [aba, setAba] = useState<'vencer' | 'solicitacoes'>('vencer')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<{ aberto: boolean; fid?: string }>({ aberto: false })

  return (
    <>
      <Cabecalho
        titulo="Gestão de férias"
        subtitulo="Regras da CLT aplicadas automaticamente"
        acoes={
          <Botao onClick={() => setModal({ aberto: true })}>
            <Plus size={16} /> Solicitar férias
          </Botao>
        }
      />
      <div className="mb-4 flex gap-6 border-b border-gray-200 text-sm">
        {(
          [
            ['vencer', 'Férias a vencer'],
            ['solicitacoes', 'Solicitações e acompanhamento'],
          ] as const
        ).map(([k, r]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={cx('-mb-px border-b-2 pb-2', aba === k ? 'border-marca-600 font-semibold text-gray-900' : 'border-transparent text-gray-500')}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Entrada placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
      </div>

      {aba === 'vencer' ? <AVencer busca={busca} onSolicitar={(fid) => setModal({ aberto: true, fid })} /> : <Solicitacoes busca={busca} />}

      <SolicitarFerias aberto={modal.aberto} funcionarioId={modal.fid} onFechar={() => setModal({ aberto: false })} />
    </>
  )
}

function filtrar(f: Funcionario, busca: string) {
  const b = busca.trim().toLowerCase()
  if (!b) return true
  return f.nome.toLowerCase().includes(b) || (!!somenteDigitos(b) && somenteDigitos(f.cpf).includes(somenteDigitos(b)))
}

function AVencer({ busca, onSolicitar }: { busca: string; onSolicitar: (fid: string) => void }) {
  const { rows: funcionarios, carregando } = useTabela<Funcionario>('funcionarios')
  const { rows: ferias } = useTabela<Ferias>('ferias')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const hoje = hojeISO()

  const linhas = useMemo(
    () =>
      funcionarios
        .filter((f) => !f.dataDemissao && filtrar(f, busca))
        .map((f) => {
          const ps = periodosAquisitivos(f, ferias, ausencias, hoje)
          return { f, status: statusFerias(ps, hoje), atual: ps[ps.length - 1] }
        })
        .sort((a, b) => ordemStatus[a.status.codigo] - ordemStatus[b.status.codigo] || a.f.nome.localeCompare(b.f.nome)),
    [funcionarios, ferias, ausencias, hoje, busca],
  )

  if (!carregando && linhas.length === 0) return <Cartao><Vazio>Nenhum colaborador encontrado.</Vazio></Cartao>

  return (
    <Cartao className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Colaborador</th>
            <th className="px-3 py-3 font-medium">Período aquisitivo</th>
            <th className="px-3 py-3 font-medium">Saldo</th>
            <th className="px-3 py-3 font-medium">Iniciar até</th>
            <th className="px-3 py-3 font-medium">Situação</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.map(({ f, status, atual }) => {
            const p = status.periodo ?? atual
            const pendente = status.codigo === 'vencida' || status.codigo === 'vence_em_breve' || status.codigo === 'mais_de_90'
            return (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/funcionarios/${f.id}`} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><User size={16} /></span>
                    <span>
                      <span className="block font-medium">{f.nome}</span>
                      <span className="block text-xs text-gray-500">{f.cargo}{f.tipo === 'estagio' ? ' · estágio' : ''}</span>
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3">{p ? `${dataBR(p.inicio)} a ${dataBR(p.fim)}` : '—'}</td>
                <td className="px-3 py-3">
                  {p ? (
                    <>
                      <b>{p.saldo}</b> dias{!p.completo && <span className="block text-xs text-gray-400">adquiridos até hoje</span>}
                    </>
                  ) : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{pendente && p ? dataBR(p.limiteInicio) : '—'}</td>
                <td className="px-3 py-3"><SeloStatusFerias status={status} /></td>
                <td className="px-3 py-3 text-right">
                  <Botao variante="fantasma" className="px-2 py-1" onClick={() => onSolicitar(f.id)}>Solicitar</Botao>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Cartao>
  )
}

const rotuloStatus = { solicitada: ['Aguardando aprovação', 'amarelo'], aprovada: ['Aprovada', 'verde'], recusada: ['Recusada', 'vermelho'] } as const

function Solicitacoes({ busca }: { busca: string }) {
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: ferias, carregando } = useTabela<Ferias>('ferias')
  const [filtro, setFiltro] = useState<'todas' | 'solicitada' | 'futuras'>('todas')
  const hoje = hojeISO()

  const porId = new Map(funcionarios.map((f) => [f.id, f]))
  const lista = ferias
    .filter((x) => {
      const f = porId.get(x.funcionarioId)
      if (!f || !filtrar(f, busca)) return false
      if (filtro === 'solicitada') return x.status === 'solicitada'
      if (filtro === 'futuras') return x.status !== 'recusada' && x.fim >= hoje
      return true
    })
    .sort((a, b) => b.inicio.localeCompare(a.inicio))

  const mudar = (x: Ferias, status: Ferias['status']) => salvar('ferias', { ...x, status })

  return (
    <>
      <Selecao value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="mb-3 max-w-xs">
        <option value="todas">Todas</option>
        <option value="solicitada">Aguardando aprovação</option>
        <option value="futuras">Em andamento e futuras</option>
      </Selecao>
      <Cartao>
        {!carregando && lista.length === 0 && <Vazio>Nenhuma solicitação.</Vazio>}
        <ul className="divide-y divide-gray-100">
          {lista.map((x) => {
            const f = porId.get(x.funcionarioId)!
            const [rot, cor] = rotuloStatus[x.status]
            const emCurso = x.status === 'aprovada' && x.inicio <= hoje && x.fim >= hoje
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <div className="font-medium">{f.nome}</div>
                  <div className="text-sm text-gray-500">
                    {dataBR(x.inicio)} a {dataBR(x.fim)} · {x.dias} dias
                    {x.abono > 0 && ` + ${x.abono} vendidos`}
                    {x.antecipada && ' · antecipadas'}
                  </div>
                  {x.observacao && <div className="text-xs text-gray-500">{x.observacao}</div>}
                </div>
                {emCurso ? <Selo cor="azul">De férias agora</Selo> : <Selo cor={cor}>{rot}</Selo>}
                <div className="flex gap-1">
                  {x.status === 'solicitada' && (
                    <>
                      <Botao variante="secundario" className="px-2 py-1" onClick={() => mudar(x, 'aprovada')}><Check size={14} /> Aprovar</Botao>
                      <Botao variante="secundario" className="px-2 py-1" onClick={() => mudar(x, 'recusada')}><X size={14} /> Recusar</Botao>
                    </>
                  )}
                  <Botao
                    variante="fantasma"
                    className="px-2 py-1"
                    aria-label="Excluir"
                    onClick={() => confirm(`Excluir as férias de ${f.nome} (${dataBR(x.inicio)})?`) && remover('ferias', x.id)}
                  >
                    <Trash2 size={14} />
                  </Botao>
                </div>
              </li>
            )
          })}
        </ul>
      </Cartao>
    </>
  )
}
