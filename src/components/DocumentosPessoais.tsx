import { CheckCircle2, Circle, Eye, MinusCircle, Trash2 } from 'lucide-react'
import { abrirDocumento, excluirDocumento, guardarDocumento, tamanhoTexto } from '../lib/documentos'
import { itensPessoais, pendenciasPessoais, situacaoPessoal, type ItemPessoal } from '../lib/documentosPessoais'
import { salvar, useTabela } from '../lib/store'
import type { DocumentoGuardado, Funcionario, TipoDocPessoal } from '../lib/types'
import { EnviarArquivos } from './EnviarArquivos'
import { BotaoFoto } from './FotoFuncionario'
import { Botao, Modulo, Selo, cx } from './ui'

/** Checklist dos documentos pessoais pedidos na admissão, com envio de foto/PDF de cada um */
export function DocumentosPessoais({ f }: { f: Funcionario }) {
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const meus = documentos.filter((d) => d.funcionarioId === f.id && d.categoria === 'pessoal')
  const situacao = situacaoPessoal(f, meus)
  const faltam = pendenciasPessoais(f, meus)
  const socio = f.tipo === 'socio'

  async function enviar(item: ItemPessoal, arquivos: File[]) {
    const atual = meus.find((d) => d.tipoPessoal === item.tipo)
    const substitui = !item.varios ? atual : undefined
    if (substitui && !confirm(`Já existe ${item.nome}. Substituir pelo novo arquivo?`)) return
    const numero = Math.max(0, ...meus.filter((d) => d.tipoPessoal === item.tipo).map((d) => Number(/((d+))$/.exec(d.titulo)?.[1] ?? 0))) + 1
    await guardarDocumento({
      funcionarioId: f.id,
      categoria: 'pessoal',
      tipoPessoal: item.tipo,
      arquivos,
      titulo: item.varios ? `${item.nome} (${numero})` : item.nome,
      substitui,
    })
    // se estava marcado como "não se aplica", deixa de estar
    if (f.docsNaoAplica?.includes(item.tipo)) await salvar('funcionarios', { ...f, docsNaoAplica: f.docsNaoAplica.filter((t) => t !== item.tipo) })
  }

  async function alternarNaoAplica(tipo: TipoDocPessoal) {
    const lista = new Set(f.docsNaoAplica ?? [])
    if (lista.has(tipo)) lista.delete(tipo)
    else lista.add(tipo)
    await salvar('funcionarios', { ...f, docsNaoAplica: [...lista] })
  }

  // sócio não tem checklist de admissão; só mostra se já houver algo guardado
  if (socio && meus.length === 0) return null

  return (
    <Modulo
      titulo="Documentos pessoais"
      className="lg:col-span-3"
      resumo={
        socio ? undefined : faltam.length === 0 ? (
          <Selo cor="verde">
            <CheckCircle2 size={13} /> Todos entregues
          </Selo>
        ) : (
          <Selo cor="amarelo">
            {faltam.length} pendente{faltam.length > 1 ? 's' : ''}
          </Selo>
        )
      }
    >
      <div className="p-4">
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {itensPessoais.map((item) => {
          const s = situacao[item.tipo]
          const arquivos = meus.filter((d) => d.tipoPessoal === item.tipo).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }))
          const apagado = s === 'nao_se_aplica' || s === 'dispensado'
          return (
            <li key={item.tipo} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm">
              {s === 'enviado' ? (
                <CheckCircle2 size={18} className="shrink-0 text-green-600" />
              ) : apagado ? (
                <MinusCircle size={18} className="shrink-0 text-gray-300" />
              ) : (
                <Circle size={18} className="shrink-0 text-amber-500" />
              )}

              <div className={cx('min-w-48 flex-1', apagado && 'text-gray-400')}>
                <div className={cx('font-medium', apagado && 'line-through decoration-gray-300')}>{item.nome}</div>
                <div className="text-xs text-gray-500">
                  {s === 'dispensado' ? (item.tipo === 'cnh' ? 'Dispensada: já tem RG e CPF' : 'Dispensado: já tem CNH') : s === 'nao_se_aplica' ? 'Não se aplica' : item.dica}
                </div>
              </div>

              {arquivos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {arquivos.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 pl-2 text-xs">
                      {item.varios ? d.titulo.replace(/^.*\((\d+)\)$/, 'Arquivo $1') : 'Arquivo'}
                      <span className="ml-1 text-gray-400">{tamanhoTexto(d.tamanho)}</span>
                      <Botao variante="fantasma" className="px-1.5 py-1" title="Ver" onClick={() => abrirDocumento(d.caminho, d.nomeArquivo)}>
                        <Eye size={14} />
                      </Botao>
                      <Botao variante="fantasma" className="px-1.5 py-1" aria-label="Excluir" onClick={() => confirm(`Excluir "${d.titulo}"?`) && excluirDocumento(d)}>
                        <Trash2 size={13} />
                      </Botao>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                {item.podeNaoAplicar && arquivos.length === 0 && (
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={s === 'nao_se_aplica'} onChange={() => alternarNaoAplica(item.tipo)} />
                    Não se aplica
                  </label>
                )}
                {item.tipo === 'foto' && <BotaoFoto f={f} atual={arquivos[0]} />}
                {s !== 'nao_se_aplica' && item.tipo !== 'foto' && (
                  <EnviarArquivos onArquivos={(a) => enviar(item, a)}>
                    {arquivos.length === 0 ? 'Enviar' : item.varios ? 'Adicionar' : 'Substituir'}
                  </EnviarArquivos>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-500">Pode enviar foto (frente e verso juntas) ou PDF. Várias fotos de uma vez viram um PDF só.</p>
      </div>
    </Modulo>
  )
}
