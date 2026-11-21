import { ClipboardCheck, FileWarning, Plus, Search, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao, Cabecalho, Cartao, Entrada, Selo, Vazio, Oculto } from '../components/ui'
import { ConferirPlanilhaAtivos } from '../components/ConferirPlanilhaAtivos'
import { brl, dataBR, nomesTipoContrato, salarioEm } from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { useTabela } from '../lib/store'
import { precisaConferir } from '../lib/conferenciaAnual'
import { pendenciasPessoais } from '../lib/documentosPessoais'
import type { DocumentoGuardado, Funcionario } from '../lib/types'

export const somenteDigitos = (s: string) => s.replace(/\D/g, '')

export default function Funcionarios() {
  const { rows, carregando, erro } = useTabela<Funcionario>('funcionarios')
  const [busca, setBusca] = useState('')
  const [mostrarDesligados, setMostrarDesligados] = useState(false)
  const [soPendentes, setSoPendentes] = useState(false)
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const hoje = hojeISO()

  /** Documentos pessoais que faltam, por funcionário ativo */
  const faltam = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const f of rows) {
      if (f.dataDemissao) continue
      const p = pendenciasPessoais(f, documentos.filter((d) => d.funcionarioId === f.id))
      if (p.length) m.set(f.id, p)
    }
    return m
  }, [rows, documentos])

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return rows
      .filter((f) => mostrarDesligados || !f.dataDemissao)
      .filter((f) => !soPendentes || faltam.has(f.id))
      .filter((f) => !b || f.nome.toLowerCase().includes(b) || f.numeroCadastro?.toLowerCase() === b || (somenteDigitos(b) && somenteDigitos(f.cpf).includes(somenteDigitos(b))))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rows, busca, mostrarDesligados, soPendentes, faltam])

  return (
    <>
      <Cabecalho
        titulo="Colaboradores"
        subtitulo={`${rows.filter((f) => !f.dataDemissao).length} ativos`}
        acoes={
          <>
            <ConferirPlanilhaAtivos />
            <Link to="/funcionarios/novo">
              <Botao>
                <Plus size={16} /> Novo colaborador
              </Botao>
            </Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Entrada placeholder="Buscar por nome, CPF ou nº de cadastro" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={mostrarDesligados} onChange={(e) => setMostrarDesligados(e.target.checked)} />
          Mostrar desligados
        </label>
        {faltam.size > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
            Só com documentos pendentes ({faltam.size})
          </label>
        )}
      </div>

      <Cartao>
        {erro && <Vazio>Erro ao carregar: {erro}</Vazio>}
        {!carregando && !erro && lista.length === 0 && <Vazio>Nenhum colaborador encontrado.</Vazio>}
        <ul className="divide-y divide-gray-100">
          {lista.map((f) => (
            <li key={f.id}>
              <Link to={`/funcionarios/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <User size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.nome}</div>
                  <div className="truncate text-sm text-gray-500">
                    {f.numeroCadastro && `Nº ${f.numeroCadastro} · `}
                    {f.cargo} · admissão {dataBR(f.dataAdmissao)}
                  </div>
                  {precisaConferir(f, hoje) && (
                    <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-amber-700">
                      <ClipboardCheck size={13} className="shrink-0" />
                      Conferir dados de {hoje.slice(0, 4)}
                    </div>
                  )}
                  {faltam.has(f.id) && (
                    <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-amber-700" title={`Faltam: ${faltam.get(f.id)!.join(', ')}`}>
                      <FileWarning size={13} className="shrink-0" />
                      {faltam.get(f.id)!.length} documento{faltam.get(f.id)!.length > 1 ? 's' : ''} pendente{faltam.get(f.id)!.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div className="hidden text-right text-sm sm:block">
                  <div><Oculto>{brl(salarioEm(f, hoje))}</Oculto></div>
                </div>
                {f.dataDemissao ? <Selo cor="vermelho">Desligado</Selo> : <Selo cor={f.tipo === 'estagio' ? 'roxo' : f.tipo === 'socio' ? 'cinza' : 'azul'}>{nomesTipoContrato[f.tipo]}</Selo>}
              </Link>
            </li>
          ))}
        </ul>
      </Cartao>
    </>
  )
}
