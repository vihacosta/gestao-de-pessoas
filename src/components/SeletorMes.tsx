import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { d } from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { Botao, Selecao } from './ui'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
/** Ano mais antigo com registros da empresa */
const PRIMEIRO_ANO = 2015

/** Escolhe o mês (formato yyyy-MM) pelas setas ou pelas listas de mês e ano. */
export function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (m: string) => void }) {
  const [ano, numero] = mes.split('-')
  const anoAtual = Number(hojeISO().slice(0, 4))
  const de = Math.min(PRIMEIRO_ANO, Number(ano))
  const ate = Math.max(anoAtual + 1, Number(ano))
  const anos = Array.from({ length: ate - de + 1 }, (_, i) => ate - i)
  const mudar = (n: number) => onMudar(format(addMonths(d(`${mes}-01`), n), 'yyyy-MM'))

  return (
    <div className="flex items-center gap-1">
      <Botao variante="fantasma" className="px-2" onClick={() => mudar(-1)} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </Botao>
      <div className="w-36">
        <Selecao aria-label="Mês" value={numero} onChange={(e) => onMudar(`${ano}-${e.target.value}`)}>
          {MESES.map((nome, i) => {
            const valor = String(i + 1).padStart(2, '0')
            return <option key={valor} value={valor}>{nome}</option>
          })}
        </Selecao>
      </div>
      <div className="w-24">
        <Selecao aria-label="Ano" value={ano} onChange={(e) => onMudar(`${e.target.value}-${numero}`)}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </Selecao>
      </div>
      <Botao variante="fantasma" className="px-2" onClick={() => mudar(1)} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </Botao>
    </div>
  )
}
