import { Eye, FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { dataBR } from '../lib/clt'
import { abrirDocumento, excluirDocumento, guardarDocumento, nomesCategoria, tamanhoTexto } from '../lib/documentos'
import { hojeISO } from '../lib/hoje'
import { useTabela } from '../lib/store'
import type { CategoriaDocumento, DocumentoGuardado, Funcionario } from '../lib/types'
import { EnviarArquivos } from './EnviarArquivos'
import { Botao, Campo, Entrada, Modulo, Selecao, Selo } from './ui'

const ordem: CategoriaDocumento[] = ['admissao', 'demissao', 'holerite', 'ponto_assinado', 'outro']
const mensal = (c: CategoriaDocumento) => c === 'holerite' || c === 'ponto_assinado'
const mesBR = (m?: string) => (m ? `${m.slice(5)}/${m.slice(0, 4)}` : '')

/** Fotos e PDFs dos documentos já assinados. Os documentos para imprimir ficam nos botões do topo da ficha. */
export function ArquivoFuncionario({ f }: { f: Funcionario }) {
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const [categoria, setCategoria] = useState<CategoriaDocumento>('admissao')
  const [titulo, setTitulo] = useState('')
  const [mes, setMes] = useState(hojeISO().slice(0, 7))

  const meus = documentos.filter((x) => x.funcionarioId === f.id && ordem.includes(x.categoria))

  // sócio não assina documentos; só mostra se já houver algo guardado
  if (f.tipo === 'socio' && meus.length === 0) return null

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
      data: ehMensal ? undefined : hojeISO(),
      substitui,
    })
    setTitulo('')
  }

  return (
    <Modulo
      titulo="Documentos assinados"
      className="lg:col-span-3"
      resumo={<Selo cor="cinza">{meus.length === 0 ? 'Nenhum guardado' : `${meus.length} ${meus.length === 1 ? 'guardado' : 'guardados'}`}</Selo>}
    >
      <div className="p-4">
      {/* envio */}
      <div className="mb-5 grid items-end gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-[1fr_2fr_auto]">
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
          <Campo rotulo="Mês">
            <Entrada type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </Campo>
        ) : (
          <Campo rotulo="Nome do documento">
            <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Contrato de trabalho, Aviso prévio…" />
          </Campo>
        )}
        <EnviarArquivos onArquivos={enviar} className="py-2 text-sm">
          Enviar foto/PDF
        </EnviarArquivos>
      </div>

      {meus.length === 0 && <p className="text-sm text-gray-500">Nenhum documento assinado guardado ainda.</p>}

      <div className="grid gap-5 md:grid-cols-2">
        {ordem.map((c) => {
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
                      {mensal(c) ? mesBR(x.mes) : x.titulo}
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
      </div>
      </div>
    </Modulo>
  )
}
