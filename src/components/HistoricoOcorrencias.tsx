import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { d } from '../lib/clt'
import {
  categoria,
  contar,
  historicoOcorrencias,
  nomesCategoria,
  passaDaTolerancia,
  textoOcorrencia,
  type Categoria,
  type Justificativa,
  type Ocorrencia,
} from '../lib/justificativas'
import { salvar, useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, Funcionario } from '../lib/types'
import { useConfig } from '../pages/Configuracoes'
import { ImportarHistorico } from './ImportarHistorico'
import { Botao, Cartao, Modulo, Selecao, Selo, Vazio, cx, type CorSelo } from './ui'

const opcoesTolerancia = [0, 10, 15, 20, 25, 30, 45, 60]

/** "Só horas devidas acima de X min" (fica salvo em Configurações) */
export function SeletorTolerancia() {
  const config = useConfig()
  const atual = config.toleranciaJustificativa ?? 0
  const opcoes = opcoesTolerancia.includes(atual) ? opcoesTolerancia : [...opcoesTolerancia, atual].sort((a, b) => a - b)
  return (
    <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700" title="Faltas sempre aparecem. Horas devidas só quando passam deste tempo no dia.">
      Horas devidas acima de
      <div className="w-36"><Selecao
        value={atual}
        onChange={(e) => salvar('config', { ...config, toleranciaJustificativa: Number(e.target.value) })}
        className="py-1.5"
      >
        {opcoes.map((m) => (
          <option key={m} value={m}>
            {m === 0 ? 'qualquer tempo' : `${m} min`}
          </option>
        ))}
      </Selecao></div>
    </label>
  )
}

const corCategoria: Record<Categoria, CorSelo> = { falta: 'vermelho', atestado: 'roxo', horas: 'amarelo', banco: 'azul' }
const ordem: Categoria[] = ['falta', 'atestado', 'horas', 'banco']
/** Uso do banco não é ocorrência ruim: fica fora da tabela e do total por pessoa */
const naTabela: Categoria[] = ['falta', 'atestado', 'horas']

/**
 * Histórico de faltas, atestados e horas devidas com o motivo de cada um.
 * Com `funcionarioId`, mostra só aquela pessoa (ficha do funcionário).
 */
export function HistoricoOcorrencias({ funcionarioId }: { funcionarioId?: string }) {
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: justificativas } = useTabela<Justificativa>('justificativas')
  const tolerancia = useConfig().toleranciaJustificativa ?? 0

  const [pessoa, setPessoa] = useState('')
  const [ano, setAno] = useState('')
  const [tipo, setTipo] = useState<Categoria | ''>('')
  const [limite, setLimite] = useState(30)

  const todas = useMemo(
    () => historicoOcorrencias(funcionarios, pontos, ausencias, justificativas).filter((o) => passaDaTolerancia(o, tolerancia)),
    [funcionarios, pontos, ausencias, justificativas, tolerancia],
  )
  const quem = funcionarioId ?? pessoa
  const anos = [...new Set(todas.filter((o) => !quem || o.funcionarioId === quem).map((o) => o.data.slice(0, 4)))].sort().reverse()
  const doPeriodo = todas.filter((o) => (!quem || o.funcionarioId === quem) && (!ano || o.data.startsWith(ano)))
  const lista = doPeriodo.filter((o) => !tipo || categoria(o) === tipo)
  const totais = contar(doPeriodo)

  const nome = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? ''
  const motivo = (o: Ocorrencia) => justificativas.find((j) => j.id === o.id)?.motivo || o.observacao || ''

  const porPessoa = useMemo(() => {
    const m = new Map<string, Ocorrencia[]>()
    for (const o of doPeriodo.filter((x) => !x.usoBanco)) m.set(o.funcionarioId, [...(m.get(o.funcionarioId) ?? []), o])
    return [...m.entries()].map(([id, l]) => ({ id, total: l.length, c: contar(l) })).sort((a, b) => b.total - a.total)
  }, [doPeriodo])

  const pessoasComOcorrencia = [...new Set(todas.map((o) => o.funcionarioId))].sort((a, b) => nome(a).localeCompare(nome(b)))

  const titulo = 'Histórico de faltas e horas devidas'
  const conteudo = (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className="mr-auto font-semibold">{!funcionarioId && titulo}</span>
        {!funcionarioId && <ImportarHistorico />}
        {!funcionarioId && (
          <div className="w-56"><Selecao value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="py-1.5" aria-label="Pessoa">
            <option value="">Todas as pessoas</option>
            {pessoasComOcorrencia.map((id) => (
              <option key={id} value={id}>
                {nome(id)}
              </option>
            ))}
          </Selecao></div>
        )}
        <div className="w-40"><Selecao value={ano} onChange={(e) => setAno(e.target.value)} className="py-1.5" aria-label="Ano">
          <option value="">Todos os anos</option>
          {anos.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Selecao></div>
      </div>

      {/* Totais: clicar filtra a lista */}
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {ordem.map((c) => (
          <button
            key={c}
            onClick={() => setTipo(tipo === c ? '' : c)}
            className={cx(
              'rounded-lg border px-3 py-2 text-left transition',
              tipo === c ? 'border-marca-500 bg-marca-50 ring-2 ring-marca-100' : 'border-gray-200 hover:bg-gray-50',
            )}
          >
            <div className="text-xl font-bold">{totais[c]}</div>
            <div className="text-xs text-gray-500">{nomesCategoria[c]}</div>
          </button>
        ))}
      </div>
      <p className="px-4 pb-3 text-xs text-gray-500">
        {tolerancia > 0 ? `Horas devidas de até ${tolerancia} minutos no dia não entram na conta. ` : ''}Clique num número para ver só aquele tipo.
      </p>

      {!funcionarioId && !pessoa && porPessoa.length > 0 && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Pessoa</th>
                {naTabela.map((c) => (
                  <th key={c} className="px-3 py-2 text-center font-medium">
                    {nomesCategoria[c]}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {porPessoa.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setPessoa(p.id)}>
                  <td className="px-4 py-2 font-medium">{nome(p.id)}</td>
                  {naTabela.map((c) => (
                    <td key={c} className={cx('px-3 py-2 text-center', p.c[c] === 0 && 'text-gray-300')}>
                      {p.c[c]}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-gray-100">
        {lista.length === 0 && <Vazio>Nenhuma ocorrência{tipo ? ` de ${nomesCategoria[tipo].toLowerCase()}` : ''} neste período.</Vazio>}
        <ul className="divide-y divide-gray-100">
          {lista.slice(0, limite).map((o) => {
            const m = motivo(o)
            return (
              <li key={o.id} className="grid gap-1 px-4 py-2.5 text-sm md:grid-cols-[6rem_1fr_1.6fr] md:items-center md:gap-3">
                <span className="font-medium">{format(d(o.data), 'dd/MM/yyyy')}</span>
                <div>
                  {!funcionarioId && (
                    <Link to={`/funcionarios/${o.funcionarioId}`} className="mr-2 font-medium hover:underline">
                      {nome(o.funcionarioId)}
                    </Link>
                  )}
                  <Selo cor={corCategoria[categoria(o)]}>{textoOcorrencia(o)}</Selo>
                </div>
                <span className={m ? '' : 'text-gray-400'}>{m || (o.usoBanco ? 'Saldo do banco de horas' : 'Sem motivo registrado')}</span>
              </li>
            )
          })}
        </ul>
        {lista.length > limite && (
          <div className="p-3 text-center">
            <Botao variante="fantasma" onClick={() => setLimite(limite + 50)}>
              Mostrar mais ({lista.length - limite} restantes)
            </Botao>
          </div>
        )}
      </div>
    </>
  )

  if (!funcionarioId) return <Cartao>{conteudo}</Cartao>

  // na ficha do funcionário abre fechado, só com os totais
  const comOcorrencia = naTabela.filter((c) => totais[c] > 0)
  return (
    <Modulo
      titulo={titulo}
      resumo={
        comOcorrencia.length ? (
          comOcorrencia.map((c) => <Selo key={c} cor={corCategoria[c]}>{nomesCategoria[c]}: {totais[c]}</Selo>)
        ) : (
          <Selo cor="verde">Sem ocorrências</Selo>
        )
      }
    >
      {conteudo}
    </Modulo>
  )
}
