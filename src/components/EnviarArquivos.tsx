import { Camera, Loader2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { cx } from './ui'

/** Fotos e PDFs (viram um PDF só) e também planilhas, Word e outros documentos (guardados como vieram) */
export const ACEITOS = 'image/*,.heic,.heif,application/pdf,.pdf,.xlsx,.xls,.csv,.ods,.doc,.docx,.odt,.txt,.rtf,.zip'

/**
 * Botão que abre a escolha de arquivos (no celular, oferece a câmera).
 * Aceita várias fotos e PDFs de uma vez (viram um único PDF), e também planilhas, Word etc. (guardados como vieram).
 */
export function EnviarArquivos({
  onArquivos,
  children,
  className,
  titulo,
}: {
  onArquivos: (arquivos: File[]) => Promise<void>
  children?: ReactNode
  className?: string
  titulo?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function escolher(lista: FileList | null) {
    const arquivos = lista ? [...lista] : []
    if (!arquivos.length) return
    setEnviando(true)
    setErro(null)
    try {
      await onArquivos(arquivos)
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
    setEnviando(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        title={titulo ?? 'Enviar foto(s), PDF, planilha ou outro documento. Várias fotos viram um PDF só.'}
        disabled={enviando}
        onClick={() => ref.current?.click()}
        className={cx(
          'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50',
          className,
        )}
      >
        {enviando ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {enviando ? 'Enviando…' : (children ?? 'Enviar')}
      </button>
      <input ref={ref} type="file" multiple accept={ACEITOS} className="hidden" onChange={(e) => escolher(e.target.files)} />
      {erro && <span className="mt-1 max-w-48 text-xs text-red-600">{erro}</span>}
    </span>
  )
}
