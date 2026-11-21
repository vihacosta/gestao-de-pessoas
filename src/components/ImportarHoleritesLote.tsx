import { CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth'
import { brl, dataBR } from '../lib/clt'
import { guardarDocumento } from '../lib/documentos'
import { lerHolerites, tituloHolerite, type HoleriteLido } from '../lib/holerite'
import { montarLote, salariosComHolerites, salariosNovos, type ArquivoLote, type ItemLote } from '../lib/holeritesLote'
import { lerTextoPdf, separarPaginas } from '../lib/pdf'
import { salvar, useTabela } from '../lib/store'
import type { DocumentoGuardado, Funcionario } from '../lib/types'
import { encontrarFuncionario } from '../pages/CartaoPonto'
import { Botao, Oculto, Selecao } from './ui'

const mesBR = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`

async function resumoDoArquivo(buf: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', buf.slice(0))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Holerites já guardados de uma pessoa, para o histórico salarial considerar todos os meses */
const guardados = (documentos: DocumentoGuardado[], id: string) =>
  documentos.flatMap((x) => (x.funcionarioId === id && x.categoria === 'holerite_original' && x.holerite ? [x.holerite] : []))

export function ImportarHoleritesLote({ arquivos, onFechar }: { arquivos: File[]; onFechar: () => void }) {
  const { pode, podeAlterar } = useAuth()
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const conteudos = useRef<ArrayBuffer[]>([])
  const [lidos, setLidos] = useState<ArquivoLote[] | null>(null)
  const [progresso, setProgresso] = useState('Lendo os arquivos…')
  const [vinculos, setVinculos] = useState<Record<string, string>>({})
  const [atualizarSalarios, setAtualizarSalarios] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<{ holerites: number; salarios: number; falhas: string[] } | null>(null)
  const editaSalarios = pode('valores') && podeAlterar('valores') && podeAlterar('funcionarios')

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const r: ArquivoLote[] = []
      for (const [i, a] of arquivos.entries()) {
        if (cancelado) return
        setProgresso(`Lendo ${i + 1} de ${arquivos.length}: ${a.name}`)
        const buf = await a.arrayBuffer()
        conteudos.current[i] = buf
        const base = { nome: a.name, hash: await resumoDoArquivo(buf), modificadoEm: a.lastModified }
        try {
          r.push({ ...base, holerites: lerHolerites(await lerTextoPdf(buf)) })
        } catch (e) {
          r.push({ ...base, erro: String((e as Error).message ?? e) })
        }
      }
      if (!cancelado) setLidos(r)
    })()
    return () => {
      cancelado = true
    }
  }, [arquivos])

  const plano = useMemo(
    () => (lidos ? montarLote({ arquivos: lidos, funcionarios, documentos, vinculos, encontrar: encontrarFuncionario }) : null),
    [lidos, funcionarios, documentos, vinculos],
  )
  const novos = useMemo(() => plano?.itens.filter((i) => i.funcionarioId && !i.jaImportado) ?? [], [plano])
  const porMes = useMemo(() => {
    const m = new Map<string, { novos: number; ja: number }>()
    for (const i of plano?.itens ?? []) {
      if (!i.funcionarioId) continue
      const x = m.get(i.holerite.mes) ?? { novos: 0, ja: 0 }
      if (i.jaImportado) x.ja++
      else x.novos++
      m.set(i.holerite.mes, x)
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b))
  }, [plano])

  const salarioPlano = (itens: Pick<ItemLote, 'funcionarioId' | 'holerite'>[]) =>
    funcionarios.flatMap((f) => {
      const meus = itens.filter((i) => i.funcionarioId === f.id).map((i) => i.holerite)
      if (!meus.length) return []
      const salarios = salariosComHolerites(f, [...guardados(documentos, f.id), ...meus])
      const novasLinhas = salariosNovos(f.salarios, salarios)
      const mudou = novasLinhas.length > 0 || salarios.length !== f.salarios.length
      return mudou ? [{ f, salarios, novasLinhas }] : []
    })
  const mudancas = plano && editaSalarios ? salarioPlano(plano.itens.filter((i) => i.funcionarioId)) : []

  async function salvarTudo() {
    if (!plano) return
    setSalvando(true)
    const falhas: string[] = []
    const salvos: { funcionarioId: string; holerite: HoleriteLido }[] = []
    for (const [n, item] of novos.entries()) {
      const h = item.holerite
      setProgresso(`Salvando ${n + 1} de ${novos.length}…`)
      try {
        const titulo = tituloHolerite(h)
        const pdf = await separarPaginas(conteudos.current[item.arquivo], h.paginas)
        const { paginas: _p, nome: _n, cpf: _c, ...dados } = h
        await guardarDocumento({
          funcionarioId: item.funcionarioId!,
          categoria: 'holerite_original',
          mes: h.mes,
          titulo,
          arquivos: [new File([pdf], `${titulo}.pdf`, { type: 'application/pdf' })],
          holerite: dados,
        })
        salvos.push({ funcionarioId: item.funcionarioId!, holerite: h })
      } catch (e) {
        falhas.push(`${h.nome} ${mesBR(h.mes)}: ${String((e as Error).message ?? e)}`)
      }
    }

    let salarios = 0
    if (atualizarSalarios && editaSalarios) {
      const jaGuardados = plano.itens.filter((i) => i.funcionarioId && i.jaImportado)
      for (const m of salarioPlano([...jaGuardados.map((i) => ({ funcionarioId: i.funcionarioId, holerite: i.holerite })), ...salvos])) {
        try {
          setProgresso(`Atualizando o histórico salarial de ${m.f.nome}…`)
          await salvar('funcionarios', { ...m.f, salarios: m.salarios })
          salarios++
        } catch (e) {
          falhas.push(`Salário de ${m.f.nome}: ${String((e as Error).message ?? e)}`)
        }
      }
    }
    setResultado({ holerites: salvos.length, salarios, falhas })
    setSalvando(false)
  }

  if (resultado)
    return (
      <div className="mt-4 space-y-2 text-sm">
        <p className="flex items-center gap-2 text-green-700">
          <CheckCircle2 size={16} /> {resultado.holerites} holerite(s) guardado(s)
          {resultado.salarios > 0 && ` e histórico salarial atualizado para ${resultado.salarios} pessoa(s)`}.
        </p>
        {resultado.falhas.length > 0 && (
          <div className="rounded-lg bg-red-50 p-3 text-red-800">
            <p className="font-medium">Não foi possível salvar {resultado.falhas.length} item(ns). Importe de novo: o que já foi salvo é ignorado.</p>
            <ul className="mt-1 list-disc pl-5 text-xs">{resultado.falhas.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        <Botao variante="secundario" onClick={onFechar}>Fechar</Botao>
      </div>
    )

  if (!plano) return <p className="mt-3 text-sm text-gray-600">{progresso}</p>

  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-gray-600">
          {arquivos.length} arquivo(s) · <b>{novos.length}</b> holerite(s) novo(s)
          {plano.repetidos.length > 0 && ` · ${plano.repetidos.length} arquivo(s) repetido(s)`}
        </span>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={onFechar} disabled={salvando}>Cancelar</Botao>
          <Botao onClick={salvarTudo} disabled={salvando || (!novos.length && !(atualizarSalarios && mudancas.length))}>
            {salvando ? progresso : `Salvar ${novos.length} holerite(s)`}
          </Botao>
        </div>
      </div>

      {porMes.length > 0 && (
        <div>
          <div className="mb-1 font-medium">Por mês</div>
          <div className="flex flex-wrap gap-1.5">
            {porMes.map(([mes, x]) => (
              <span key={mes} className={`rounded-md px-2 py-1 text-xs ${x.novos ? 'bg-marca-50 text-gray-800' : 'bg-gray-100 text-gray-500'}`} title={`${x.novos} novo(s), ${x.ja} já guardado(s)`}>
                {mesBR(mes)}: {x.novos ? x.novos : 'já guardado'}
              </span>
            ))}
          </div>
        </div>
      )}

      {plano.semCadastro.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 font-medium text-amber-900">Sem cadastro no sistema ({plano.semCadastro.length}): só serão salvos se você escolher a ficha</div>
          <ul className="space-y-2">
            {plano.semCadastro.map((p) => (
              <li key={p.chave} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {p.nome} <span className="text-xs text-gray-500">· {p.meses.length} {p.meses.length === 1 ? 'mês' : 'meses'}</span>
                </span>
                <div className="w-56">
                  <Selecao aria-label={`Ficha de ${p.nome}`} value={vinculos[p.chave] ?? ''} onChange={(e) => setVinculos({ ...vinculos, [p.chave]: e.target.value })}>
                    <option value="">— não salvar —</option>
                    {[...funcionarios].sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </Selecao>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mudancas.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-3">
          <label className="mb-2 flex items-center gap-2 font-medium">
            <input type="checkbox" checked={atualizarSalarios} onChange={(e) => setAtualizarSalarios(e.target.checked)} />
            Atualizar o histórico salarial ({mudancas.length} {mudancas.length === 1 ? 'pessoa' : 'pessoas'})
          </label>
          {atualizarSalarios && (
            <ul className="space-y-1.5 text-xs">
              {mudancas.map((m) => (
                <li key={m.f.id}>
                  <span className="font-medium">{m.f.nome}:</span>{' '}
                  {m.novasLinhas.map((s, i) => (
                    <span key={s.data} className="whitespace-nowrap">
                      {i > 0 && ' → '}
                      {dataBR(s.data)} <Oculto>{brl(s.valor)}</Oculto>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plano.naoLidos.length > 0 && (
        <div className="text-xs text-gray-600">
          <div className="mb-1 font-medium">Não importados por não serem holerites neste formato:</div>
          <ul className="list-disc pl-5">{plano.naoLidos.map((x) => <li key={x.nome}>{x.nome}</li>)}</ul>
        </div>
      )}
      {plano.repetidos.length > 0 && <p className="text-xs text-gray-500">Repetidos, ignorados: {plano.repetidos.join(', ')}</p>}
    </div>
  )
}
