import { Check, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { criarParcelas, pendenteAquisicao, quitada, totalAquisicao, type Aquisicao } from '../lib/aquisicoes'
import { brl, dataBR } from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { novoId, remover, salvar, useTabela } from '../lib/store'
import { Botao, Campo, Entrada, Modal, Modulo, Selo, Vazio, Oculto } from './ui'

/** "1.250,50", "150", "40.5" → número */
const numero = (s: string) => {
  const t = s.replace(/[R$\s]/g, '')
  return Number(/^\d+\.\d{1,2}$/.test(t) ? t : t.replace(/\./g, '').replace(',', '.'))
}
const mesBR = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`

/** Aquisição de mercadorias: compras do funcionário descontadas em folha, em parcelas */
export function AquisicoesFuncionario({ funcionarioId }: { funcionarioId: string }) {
  const { rows } = useTabela<Aquisicao>('aquisicoes')
  const [lancando, setLancando] = useState(false)
  const lista = useMemo(() => rows.filter((a) => a.funcionarioId === funcionarioId).sort((a, b) => b.data.localeCompare(a.data)), [rows, funcionarioId])
  const pendente = lista.reduce((s, a) => s + pendenteAquisicao(a), 0)

  async function alternarParcela(a: Aquisicao, i: number) {
    await salvar<Aquisicao>('aquisicoes', { ...a, parcelas: a.parcelas.map((p, j) => (j === i ? { ...p, paga: !p.paga } : p)) })
  }

  async function excluir(a: Aquisicao) {
    if (confirm(`Excluir a aquisição de ${dataBR(a.data)} (${a.produto}, ${brl(totalAquisicao(a))})?`)) await remover('aquisicoes', a.id)
  }

  return (
    <Modulo
      titulo="Aquisição de mercadorias"
      resumo={pendente > 0 ? <Selo cor="amarelo">a descontar: <Oculto>{brl(pendente)}</Oculto></Selo> : <Selo cor="cinza">{lista.length ? 'Nada a descontar' : 'Nenhuma aquisição'}</Selo>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-xs text-gray-500">Compras descontadas em folha. Clique numa parcela para marcar como descontada.</p>
        </div>
        <Botao variante="secundario" onClick={() => setLancando(true)}>
          <Plus size={16} /> Lançar aquisição
        </Botao>
      </div>

      {lista.length === 0 && <Vazio>Nenhuma aquisição lançada.</Vazio>}
      <ul className="divide-y divide-gray-100">
        {lista.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
            <span className="w-24 shrink-0 text-gray-500">{dataBR(a.data)}</span>
            <span className="min-w-40 flex-1">
              <span className="font-medium">{a.produto}</span>
              <span className="ml-2 text-gray-500"><Oculto>{brl(totalAquisicao(a))}</Oculto></span>
              {a.observacao && <span className="block text-xs text-gray-500">{a.observacao}</span>}
            </span>
            <span className="flex flex-wrap gap-1">
              {a.parcelas.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => alternarParcela(a, i)}
                  title={p.paga ? 'Descontada. Clique para desfazer.' : 'Clique quando for descontada na folha'}
                  className={
                    p.paga
                      ? 'inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500'
                      : 'inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200'
                  }
                >
                  {p.paga && <Check size={11} />}
                  {i + 1}/{a.parcelas.length} · {mesBR(p.data)} · <Oculto>{brl(p.valor)}</Oculto>
                </button>
              ))}
            </span>
            {quitada(a) && <Selo cor="verde">quitada</Selo>}
            <Botao variante="fantasma" className="px-1.5 py-1" aria-label="Excluir" onClick={() => excluir(a)}>
              <Trash2 size={14} />
            </Botao>
          </li>
        ))}
      </ul>
      <LancarAquisicao aberto={lancando} onFechar={() => setLancando(false)} funcionarioId={funcionarioId} />
    </Modulo>
  )
}

function LancarAquisicao({ aberto, onFechar, funcionarioId }: { aberto: boolean; onFechar: () => void; funcionarioId: string }) {
  const [data, setData] = useState(hojeISO())
  const [produto, setProduto] = useState('')
  const [valor, setValor] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [primeiro, setPrimeiro] = useState(hojeISO().slice(0, 7))
  const v = numero(valor)
  const n = Math.max(1, Number(parcelas) || 1)
  const previa = v > 0 && primeiro ? criarParcelas(v, n, `${primeiro}-05`) : []

  async function enviar() {
    if (!produto.trim() || !(v > 0) || !primeiro) return
    await salvar<Aquisicao>('aquisicoes', { id: novoId(), funcionarioId, data, produto: produto.trim(), parcelas: previa })
    setProduto('')
    setValor('')
    setParcelas('1')
    onFechar()
  }

  return (
    <Modal titulo="Lançar aquisição de mercadoria" aberto={aberto} onFechar={onFechar}>
      <div className="space-y-4 p-5 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data da compra">
            <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Valor total (R$)">
            <Entrada inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="150,00" />
          </Campo>
          <Campo rotulo="Produto(s)" className="sm:col-span-2">
            <Entrada value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Código ou descrição" />
          </Campo>
          <Campo rotulo="Parcelas">
            <Entrada type="number" min={1} max={12} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
          </Campo>
          <Campo rotulo="Primeiro desconto na folha de">
            <Entrada type="month" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} />
          </Campo>
        </div>
        {previa.length > 0 && (
          <p className="rounded-lg bg-gray-50 p-3 text-gray-700">
            {previa.map((p, i) => `${i + 1}ª ${mesBR(p.data)}: ${brl(p.valor)}`).join(' · ')}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={enviar} disabled={!produto.trim() || !(v > 0)}>
            Salvar
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
