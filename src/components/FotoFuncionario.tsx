import { Camera, RefreshCw, Smile, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { baixarArquivo } from '../lib/arquivos'
import { excluirDocumento } from '../lib/documentos'
import { fotoDeArquivo, fotoQuadrada, guardarFoto } from '../lib/fotoFuncionario'
import { useTabela } from '../lib/store'
import type { DocumentoGuardado, Funcionario } from '../lib/types'
import { Botao, Modal } from './ui'

function useFotoAtual(funcionarioId: string) {
  const { rows } = useTabela<DocumentoGuardado>('documentos')
  return rows.find((d) => d.funcionarioId === funcionarioId && d.categoria === 'pessoal' && d.tipoPessoal === 'foto')
}

/** Endereço da imagem para mostrar; foto antiga guardada em PDF mostra a primeira página */
function useImagem(doc?: DocumentoGuardado) {
  const caminho = doc?.caminho
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    setUrl(undefined)
    if (!caminho) return
    let vivo = true
    let criada: string | undefined
    ;(async () => {
      const blob = await baixarArquivo(caminho)
      if (caminho.toLowerCase().endsWith('.pdf')) {
        const { imagensDasPaginas } = await import('../lib/pdf')
        const [primeira] = await imagensDasPaginas(await blob.arrayBuffer(), 500)
        if (vivo) setUrl(primeira)
      } else {
        criada = URL.createObjectURL(blob)
        if (vivo) setUrl(criada)
      }
    })().catch(() => {})
    return () => {
      vivo = false
      if (criada) URL.revokeObjectURL(criada)
    }
  }, [caminho])
  return url
}

/** Quadro com a foto na ficha; clicar abre para ver, tirar ou trocar */
export function FotoFuncionario({ f }: { f: Funcionario }) {
  const atual = useFotoAtual(f.id)
  const url = useImagem(atual)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title={atual ? 'Ver ou trocar a foto' : 'Tirar foto'}
        aria-label={atual ? `Ver ou trocar a foto de ${f.nome}` : `Tirar foto de ${f.nome}`}
        className="group relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100 text-gray-400 hover:border-gray-400"
      >
        {url ? (
          <img src={url} alt={`Foto de ${f.nome}`} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs">
            <Smile size={40} strokeWidth={1.5} />
            {!atual && 'Tirar foto'}
          </span>
        )}
      </button>
      {aberto && <ModalFoto f={f} atual={atual} url={url} onFechar={() => setAberto(false)} />}
    </>
  )
}

/** Botão do item "Foto" na lista de documentos pessoais */
export function BotaoFoto({ f, atual }: { f: Funcionario; atual?: DocumentoGuardado }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Botao variante="secundario" className="px-3 py-1.5 text-xs" onClick={() => setAberto(true)}>
        <Camera size={14} /> {atual ? 'Trocar foto' : 'Tirar foto'}
      </Botao>
      {aberto && <ModalFoto f={f} atual={atual} onFechar={() => setAberto(false)} abrirCamera />}
    </>
  )
}

function ModalFoto({ f, atual, url, onFechar, abrirCamera }: { f: Funcionario; atual?: DocumentoGuardado; url?: string; onFechar: () => void; abrirCamera?: boolean }) {
  const [camera, setCamera] = useState(abrirCamera || !atual)
  const [previa, setPrevia] = useState<{ blob: Blob; url: string } | null>(null)
  const [frontal, setFrontal] = useState(false)
  const [pronta, setPronta] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const ligada = camera && !previa

  useEffect(() => {
    if (!ligada) return
    let vivo = true
    let stream: MediaStream | undefined
    setPronta(false)
    setErro(null)
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('', 'NotFoundError')
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: frontal ? 'user' : 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        })
        if (!vivo) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) {
          video.current.srcObject = s
          await video.current.play()
          if (vivo) setPronta(true)
        }
      } catch (e) {
        if (!vivo) return
        const nome = (e as DOMException).name
        setErro(
          nome === 'NotAllowedError'
            ? 'O navegador não liberou a câmera. Permita o acesso à câmera para este site e tente de novo, ou envie uma foto.'
            : nome === 'NotFoundError'
              ? 'Não encontrei câmera neste aparelho. Você pode enviar uma foto.'
              : 'Não consegui abrir a câmera. Veja se outro programa está usando ou envie uma foto.',
        )
      }
    })()
    return () => {
      vivo = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [ligada, frontal])

  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa.url)
  }, [previa])

  const mostrar = (blob: Blob) => setPrevia({ blob, url: URL.createObjectURL(blob) })

  async function capturar() {
    const v = video.current
    if (!v?.videoWidth) return
    try {
      mostrar(await fotoQuadrada(v, v.videoWidth, v.videoHeight))
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
  }

  async function escolher(arquivo?: File) {
    if (!arquivo) return
    setErro(null)
    try {
      setCamera(true)
      mostrar(await fotoDeArquivo(arquivo))
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
  }

  async function usar() {
    if (!previa) return
    setSalvando(true)
    setErro(null)
    try {
      await guardarFoto(f.id, previa.blob, atual)
      onFechar()
    } catch (e) {
      setErro('Não foi possível guardar a foto: ' + String((e as Error).message ?? e))
      setSalvando(false)
    }
  }

  async function removerFoto() {
    if (!atual || !confirm(`Excluir a foto de ${f.nome}?`)) return
    await excluirDocumento(atual)
    onFechar()
  }

  const enviar = (
    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
      <Upload size={16} /> Enviar foto
      <input type="file" accept="image/*" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
    </label>
  )

  return (
    <Modal titulo={`Foto de ${f.nome}`} aberto onFechar={salvando ? () => {} : onFechar} largura="max-w-md">
      <div className="p-5">
        {erro && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <div className="relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-xl bg-gray-100">
          {previa ? (
            <img src={previa.url} alt="Foto tirada" className="h-full w-full object-cover" />
          ) : camera ? (
            <video ref={video} muted playsInline className="h-full w-full object-cover" />
          ) : url ? (
            <img src={url} alt={`Foto de ${f.nome}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Abrindo a foto…</div>
          )}
          {ligada && !pronta && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 text-sm text-gray-500">
              <Smile size={72} strokeWidth={1.25} className="text-gray-400" />
              {!erro && 'Abrindo a câmera…'}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {previa ? (
            <>
              <Botao variante="secundario" onClick={() => setPrevia(null)} disabled={salvando}>
                <RefreshCw size={16} /> Tirar outra
              </Botao>
              <Botao onClick={usar} disabled={salvando}>
                {salvando ? 'Guardando…' : 'Usar esta foto'}
              </Botao>
            </>
          ) : camera ? (
            <>
              <Botao onClick={capturar} disabled={!pronta}>
                <Camera size={16} /> Tirar foto
              </Botao>
              <Botao variante="secundario" onClick={() => setFrontal((x) => !x)} title="Alternar entre a câmera da frente e a de trás" aria-label="Trocar de câmera">
                <RefreshCw size={16} />
              </Botao>
              {enviar}
            </>
          ) : (
            <>
              <Botao onClick={() => setCamera(true)}>
                <Camera size={16} /> Tirar outra foto
              </Botao>
              {enviar}
              <Botao variante="perigo" onClick={removerFoto} aria-label="Excluir foto">
                <Trash2 size={16} />
              </Botao>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
