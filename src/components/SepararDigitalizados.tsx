import { Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apagarArquivo, baixarArquivo, enviarArquivo } from '../lib/arquivos'
import { excluirDocumento, guardarDocumento } from '../lib/documentos'
import { caminhoMarcacao, caminhoOriginal, mesesParaSeparar, planoSeparacao, tituloCartaoDigitalizado, type MesParaSeparar } from '../lib/pontoDigitalizado'
import { useTabela } from '../lib/store'
import type { DocumentoGuardado, Funcionario } from '../lib/types'
import { Botao, Cartao, Modal, Selecao, cx } from './ui'

const mesBR = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`

/** Marcação guardada para conferir depois (lista de pessoas de cada página) */
async function lerMarcacao(mes: string, paginas: number): Promise<string[][] | undefined> {
  try {
    const dados: unknown = JSON.parse(await (await baixarArquivo(caminhoMarcacao(mes))).text())
    return Array.isArray(dados) && dados.length === paginas && dados.every((p) => Array.isArray(p)) ? (dados as string[][]) : undefined
  } catch {
    return undefined
  }
}

/** Aviso com os meses de cartões digitalizados que ainda estão com todos juntos, e o botão de separar */
export function SepararDigitalizados() {
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const [aberto, setAberto] = useState<string | null>(null)
  const meses = useMemo(() => mesesParaSeparar(documentos), [documentos])
  const atual = meses.find((m) => m.mes === aberto)
  if (!meses.length) return null

  return (
    <Cartao className="mb-4 border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <Scissors size={16} /> Cartões ponto digitalizados para separar
      </div>
      <p className="mb-3 text-sm text-gray-600">
        Nestes meses o PDF digitalizado traz o cartão de todos os colaboradores juntos e foi guardado inteiro na ficha de cada um. Escolha de quem é cada página para cada
        pessoa ficar só com o seu.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {meses.map((m) => (
          <Botao key={m.mes} variante="secundario" className="px-2.5 py-1 text-xs" onClick={() => setAberto(m.mes)}>
            {mesBR(m.mes)}
          </Botao>
        ))}
      </div>
      {atual && <Separar key={atual.mes} mes={atual} onFechar={() => setAberto(null)} />}
    </Cartao>
  )
}

function Separar({ mes: inicial, onFechar }: { mes: MesParaSeparar; onFechar: () => void }) {
  // as cópias de quando a tela abriu (a lista muda enquanto salva)
  const [mes] = useState(inicial)
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null)
  const [imagens, setImagens] = useState<string[] | null>(null)
  const [donos, setDonos] = useState<string[][]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const comCopia = useMemo(() => mes.copias.map((c) => c.funcionarioId), [mes])
  // quem tem a cópia + quem recebeu alguma página pelo "outra pessoa"
  const pessoas = useMemo(
    () =>
      [...new Set([...comCopia, ...donos.flat()])]
        .map((id) => ({ id, nome: funcionarios.find((f) => f.id === id)?.nome ?? '(sem cadastro)' }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [comCopia, donos, funcionarios],
  )
  const outras = useMemo(
    () => funcionarios.filter((f) => !pessoas.some((p) => p.id === f.id)).sort((a, b) => a.nome.localeCompare(b.nome)),
    [funcionarios, pessoas],
  )
  const nome = (id: string) => pessoas.find((p) => p.id === id)?.nome.split(' ')[0] ?? ''

  const caminho = mes.copias[0].caminho
  const mesId = mes.mes
  const [temMarcacao, setTemMarcacao] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const buf = await (await baixarArquivo(caminho)).arrayBuffer()
        const { imagensDasPaginas } = await import('../lib/pdf')
        const imgs = await imagensDasPaginas(buf)
        const guardada = await lerMarcacao(mesId, imgs.length)
        if (!vivo) return
        setPdf(buf)
        setImagens(imgs)
        setDonos(guardada ?? imgs.map(() => []))
        setTemMarcacao(!!guardada)
      } catch (e) {
        if (vivo) setErro('Não consegui abrir o PDF: ' + String((e as Error).message ?? e))
      }
    })()
    return () => {
      vivo = false
    }
  }, [caminho, mesId])

  async function guardarMarcacao() {
    setErro(null)
    try {
      await enviarArquivo(caminhoMarcacao(mesId), new Blob([JSON.stringify(donos)], { type: 'application/json' }))
      setTemMarcacao(true)
      setAviso('Marcação guardada. Dá para fechar e voltar depois.')
    } catch (e) {
      setErro('Não foi possível guardar a marcação: ' + String((e as Error).message ?? e))
    }
  }

  const alternar = (pagina: number, id: string) =>
    setDonos((d) => d.map((ids, i) => (i !== pagina ? ids : ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])))

  const plano = planoSeparacao(comCopia, donos)

  async function salvar() {
    if (!pdf) return
    const semPagina = plano.semPagina.map((id) => pessoas.find((p) => p.id === id)!.nome)
    if (semPagina.length && !confirm(`Ficaram sem nenhuma página e o cartão de ${mesBR(mes.mes)} sai da ficha delas:\n\n${semPagina.join('\n')}\n\nContinuar?`)) return
    setSalvando(true)
    setErro(null)
    try {
      // o PDF do mês inteiro continua guardado à parte, para não perder nada
      await enviarArquivo(caminhoOriginal(mes.mes), new Blob([pdf], { type: 'application/pdf' }))
      const { separarPaginas } = await import('../lib/pdf')
      for (const copia of mes.copias) {
        const paginas = plano.paginas.get(copia.funcionarioId)
        if (!paginas) {
          await excluirDocumento(copia)
          continue
        }
        const blob = await separarPaginas(pdf, paginas)
        await guardarDocumento({
          funcionarioId: copia.funcionarioId,
          categoria: 'ponto_assinado',
          mes: mes.mes,
          titulo: tituloCartaoDigitalizado(mes.mes),
          arquivos: [new File([blob], `cartao-ponto-${mes.mes}.pdf`, { type: 'application/pdf' })],
          substitui: copia,
        })
      }
      // quem não tinha a cópia mas é dono de alguma página
      for (const [funcionarioId, paginas] of plano.paginas) {
        if (comCopia.includes(funcionarioId)) continue
        await guardarDocumento({
          funcionarioId,
          categoria: 'ponto_assinado',
          mes: mes.mes,
          titulo: tituloCartaoDigitalizado(mes.mes),
          arquivos: [new File([await separarPaginas(pdf, paginas)], `cartao-ponto-${mes.mes}.pdf`, { type: 'application/pdf' })],
        })
      }
      await apagarArquivo(caminhoMarcacao(mes.mes)).catch(() => {})
      onFechar()
    } catch (e) {
      setErro('Não foi possível salvar: ' + String((e as Error).message ?? e))
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Separar cartões de ${mesBR(mes.mes)}`} aberto onFechar={salvando ? () => {} : onFechar} largura="max-w-5xl">
      <div className="p-5">
        {erro && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {!imagens && !erro && <p className="text-sm text-gray-500">Abrindo o PDF…</p>}
        {aviso && <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
        {temMarcacao && !aviso && (
          <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            As páginas já vêm marcadas pelo nome impresso em cada cartão. Confira e clique em <b>Salvar separação</b>.
          </p>
        )}
        {imagens && (
          <>
            <p className="mb-4 text-sm text-gray-600">
              {imagens.length} página(s). Clique no nome de quem é o cartão em cada página (pode marcar mais de uma pessoa se a página tiver vários cartões). Página
              sem ninguém marcado não vai para nenhuma ficha, mas o PDF inteiro continua guardado à parte.
            </p>
            <div className="space-y-6">
              {imagens.map((src, i) => (
                <div key={i} className="grid gap-3 border-b border-gray-100 pb-6 md:grid-cols-[1fr_15rem]">
                  <img src={src} alt={`Página ${i + 1}`} className="w-full rounded border border-gray-200" />
                  <div>
                    <div className="mb-2 text-sm font-medium">Página {i + 1}</div>
                    <div className="flex flex-wrap gap-1.5 md:flex-col">
                      {pessoas.map((p) => {
                        const marcado = donos[i]?.includes(p.id)
                        const outras = (plano.paginas.get(p.id) ?? []).filter((x) => x !== i)
                        return (
                          <button
                            key={p.id}
                            onClick={() => alternar(i, p.id)}
                            className={cx(
                              'rounded-lg border px-2.5 py-1.5 text-left text-xs',
                              marcado ? 'border-marca-600 bg-marca-600 text-white' : 'border-gray-300 bg-white hover:bg-gray-50',
                            )}
                          >
                            {p.nome}
                            {outras.length > 0 && <span className={cx('ml-1', marcado ? 'text-white/80' : 'text-gray-400')}>· pág. {outras.map((x) => x + 1).join(', ')}</span>}
                          </button>
                        )
                      })}
                      <Selecao
                        aria-label={`Outra pessoa na página ${i + 1}`}
                        className="text-xs"
                        value=""
                        onChange={(e) => e.target.value && alternar(i, e.target.value)}
                        title="Para quem não está na lista (ex.: ex-colaborador com a data de saída errada no cadastro)"
                      >
                        <option value="">+ outra pessoa…</option>
                        {outras.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </Selecao>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {imagens && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3 text-sm">
          <span className="text-gray-600">
            {comCopia.length - plano.semPagina.length} de {comCopia.length} pessoas da lista com página
            {plano.semPagina.length > 0 && <> · sem página: {plano.semPagina.map(nome).join(', ')}</>}
          </span>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={guardarMarcacao} disabled={salvando} title="Guarda as marcações sem separar, para conferir depois">
              Guardar marcação
            </Botao>
            <Botao onClick={salvar} disabled={salvando || plano.paginas.size === 0}>
              {salvando ? 'Salvando…' : 'Salvar separação'}
            </Botao>
          </div>
        </div>
      )}
    </Modal>
  )
}
