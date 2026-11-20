import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Botao({
  variante = 'primario',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variante === 'primario' && 'bg-marca-600 text-white hover:bg-marca-700',
        variante === 'secundario' && 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
        variante === 'perigo' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        variante === 'fantasma' && 'text-gray-600 hover:bg-gray-100',
        className,
      )}
    />
  )
}

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-gray-500">{dica}</span>}
    </label>
  )
}

const estiloInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100'

export function Entrada(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(estiloInput, p.className)} />
}

export function Selecao(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(estiloInput, p.className)} />
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-gray-200 bg-white', className)}>{children}</div>
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {subtitulo && <p className="text-sm text-gray-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  )
}

export type CorSelo = 'verde' | 'amarelo' | 'vermelho' | 'cinza' | 'azul' | 'roxo'
export function Selo({ cor = 'cinza', children }: { cor?: CorSelo; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
        cor === 'verde' && 'bg-green-100 text-green-800',
        cor === 'amarelo' && 'bg-amber-100 text-amber-800',
        cor === 'vermelho' && 'bg-red-100 text-red-800',
        cor === 'cinza' && 'bg-gray-100 text-gray-700',
        cor === 'azul' && 'bg-blue-100 text-blue-800',
        cor === 'roxo' && 'bg-violet-100 text-violet-800',
      )}
    >
      {children}
    </span>
  )
}

export function Modal({ titulo, aberto, onFechar, children, largura = 'max-w-lg' }: { titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode; largura?: string }) {
  useEffect(() => {
    if (!aberto) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        className={cx('flex max-h-[95vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', largura)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button onClick={onFechar} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-sm text-gray-500">{children}</div>
}
