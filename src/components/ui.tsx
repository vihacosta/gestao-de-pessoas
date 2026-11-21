import { ChevronDown, Eye, EyeOff, X } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useAuth } from '../auth'

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

/** Botão duplo Sim/Não. Sem valor, nenhum dos dois fica marcado. */
export function SimNao({ valor, onMudar, disabled, rotulo }: { valor?: boolean; onMudar: (v: boolean) => void; disabled?: boolean; rotulo: string }) {
  const opcao = (v: boolean, texto: string) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={valor === v}
      aria-label={`${rotulo}: ${texto}`}
      onClick={() => valor !== v && onMudar(v)}
      className={cx('px-2 py-0.5 text-xs font-medium disabled:cursor-not-allowed', valor === v ? (v ? 'bg-marca-600 text-white' : 'bg-gray-200 text-gray-700') : 'bg-white text-gray-500 hover:bg-gray-50')}
    >
      {texto}
    </button>
  )
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-gray-300">
      {opcao(true, 'Sim')}
      {opcao(false, 'Não')}
    </span>
  )
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-gray-200 bg-white', className)}>{children}</div>
}

/** Cartão que abre fechado: mostra só o título, um resumo curto e o botão para abrir */
export function Modulo({ titulo, resumo, children, className }: { titulo: string; resumo?: ReactNode; children: ReactNode; className?: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <Cartao className={className}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setAberto(!aberto)} className="mr-auto text-left font-semibold">
          {titulo}
        </button>
        {resumo}
        <Botao variante="secundario" className="px-3 py-1.5" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          {aberto ? 'Fechar' : 'Abrir'}
          <ChevronDown size={15} className={cx('transition', aberto && 'rotate-180')} />
        </Botao>
      </div>
      {aberto && <div className="border-t border-gray-100">{children}</div>}
    </Cartao>
  )
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {subtitulo && <p className="text-sm text-gray-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
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

/** Valor em dinheiro que começa escondido; o olhinho ao lado mostra ou esconde. */
export function Oculto({ children }: { children: ReactNode }) {
  const [visivel, setVisivel] = useState(false)
  const { pode } = useAuth()
  // Sem a permissão de valores, o banco nem entrega os dados: não mostra um R$ 0,00 enganoso
  if (!pode('valores')) return <span className="whitespace-nowrap text-xs font-normal text-gray-400">sem acesso</span>
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className={visivel ? undefined : 'select-none tracking-wider'}>{visivel ? children : 'R$ •••••'}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setVisivel((v) => !v)
        }}
        className="rounded p-0.5 text-current opacity-50 hover:bg-black/5 hover:opacity-100"
        aria-label={visivel ? 'Esconder valor' : 'Mostrar valor'}
        title={visivel ? 'Esconder valor' : 'Mostrar valor'}
      >
        {visivel ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  )
}
