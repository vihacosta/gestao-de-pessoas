import { Eye, FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dataBR } from '../lib/clt'
import { abrirDocumento, excluirDocumento, guardarDocumento, nomesCategoria, tamanhoTexto } from '../lib/documentos'
import { hojeISO } from '../lib/hoje'
import { useTabela } from '../lib/store'
import type { CartaoPontoSalvo, CategoriaDocumento, DocumentoGuardado, Funcionario } from '../lib/types'
import { EnviarArquivos } from './EnviarArquivos'
import { Botao, Campo, Cartao, Entrada, Selecao } from './ui'

const ordem: CategoriaDocumento[] = ['admissao', 'demissao', 'holerite', 'ponto_assinado', 'outro']
/** O que aparece na lista (inclui os holerites importados da contabilidade) */
const ordemLista: CategoriaDocumento[] = ['admissao', 'demissao', 'holerite', 'holerite_original', 'ponto_assinado', 'outro']
const mensal = (c: CategoriaDocumento) => c === 'holerite' || c === 'ponto_assinado' || c === 'holerite_original'
const mesBR = (m?: string) => (m ? `${m.slice(5)}/${m.slice(0, 4)}` : '')

/** Arquivo digital do funcionário: documentos assinados e cartões ponto */
export function ArquivoFuncionario({ f }: { f: Funcionario }) {
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const [categoria, setCategoria] = useState<CategoriaDocumento>('admissao')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeISO())
  const [mes, setMes] = useState(hojeISO().slice(0, 7))

  const meus = documentos.filter((x) => x.funcionarioId === f.id)
  const meusPontos = pontos.filter((p) => p.funcionarioId === f.id).sort((a, b) => b.mes.localeCompare(a.mes))

  async function enviar(arquivos: File[]) {
    const ehMensal = mensal(categoria)
    const substitui = ehMensal ? meus.find((x) => x.categoria === categoria && x.mes === mes) : undefined
    if (substitui && !confirm(`Já existe ${nomesCategoria[categoria].toLowerCase()} de ${mesBR(mes)}. Substituir?`)) return
    await guardarDocumento({
      funcionarioId: f.id,
      categoria,
      arquivos,
      titulo: ehMensal ? `${nomesCategoria[categoria]} ${mesBR(mes)}` : titulo || (arquivos.length === 1 ? arquivos[0].name.replace(/\.[^.]+$/, '') : nomesCategoria[categoria]),
      mes: ehMensal ? mes : undefined,
      data: ehMensal ? undefined : data,
      substitui,
    })
    setTitulo('')
  }

  return (
    <Cartao className="p-5 lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Arquivo digital</h2>
        <Link to="/holerites" className="text-sm text-marca-600 underline">
          Holerites e cartões do mês
        </Link>
      </div>

      {/* envio */}
      <div className="mb-5 grid items-end gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-[1fr_1.5fr_1fr_auto]">
        <Campo rotulo="Tipo">
          <Selecao value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}>
            {ordem.map((c) => (
              <option key={c} value={c}>
                {nomesCategoria[c]}
              </option>
            ))}
          </Selecao>
        </Campo>
        {mensal(categoria) ? (
          <Campo rotulo="Mês" className="sm:col-span-2">
            <Entrada type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </Campo>
        ) : (
          <>
            <Campo rotulo="Nome do documento">
              <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Contrato de trabalho, Aviso prévio…" />
            </Campo>
            <Campo rotulo="Data">
              <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </>
        )}
        <EnviarArquivos onArquivos={enviar} className="py-2 text-sm">
          Enviar foto/PDF
        </EnviarArquivos>
      </div>

      {meus.length === 0 && meusPontos.length === 0 && <p className="text-sm text-gray-500">Nenhum documento guardado ainda.</p>}

      <div className="grid gap-5 md:grid-cols-2">
        {ordemLista.map((c) => {
          const lista = meus
            .filter((x) => x.categoria === c)
            .sort((a, b) => (b.mes ?? b.data ?? b.enviadoEm).localeCompare(a.mes ?? a.data ?? a.enviadoEm))
          if (!lista.length) return null
          return (
            <div key={c}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{nomesCategoria[c]}</div>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {lista.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <FileText size={15} className="shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate">
                      {c === 'holerite_original' ? x.titulo : mensal(c) ? mesBR(x.mes) : x.titulo}
                      <span className="ml-2 text-xs text-gray-400">
                        {!mensal(c) && x.data ? `${dataBR(x.data)} · ` : ''}
                        {tamanhoTexto(x.tamanho)}
                      </span>
                    </span>
                    <Botao variante="fantasma" className="px-1.5 py-1" onClick={() => abrirDocumento(x.caminho, x.nomeArquivo)} title="Ver">
                      <Eye size={15} />
                    </Botao>
                    <Botao variante="fantasma" className="px-1.5 py-1" aria-label="Excluir" onClick={() => confirm(`Excluir "${x.titulo}"?`) && excluirDocumento(x)}>
                      <Trash2 size={14} />
                    </Botao>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}

        {meusPontos.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Cartões ponto do sistema (sem assinatura)</div>
            <div className="flex flex-wrap gap-2">
              {meusPontos.map((p) => (
                <Botao key={p.id} variante="secundario" className="px-3 py-1 text-xs" onClick={() => abrirDocumento(p.caminho)}>
                  <Eye size={13} /> {mesBR(p.mes)}
                </Botao>
              ))}
            </div>
          </div>
        )}
      </div>
    </Cartao>
  )
}
