import { AlertTriangle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Botao, Cabecalho, Campo, Cartao, Entrada } from '../components/ui'
import { brl } from '../lib/clt'
import { lerValor } from '../lib/extenso'
import { salvar, useTabela } from '../lib/store'
import type { ConfigEmpresa } from '../lib/types'

export const configPadrao: ConfigEmpresa = { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, bonusLimiteMes: 4, diasExperiencia: 90, valorAlimentacao: 110, toleranciaJustificativa: 20 }

export function useConfig(): ConfigEmpresa {
  const { rows } = useTabela<ConfigEmpresa>('config')
  return { ...configPadrao, ...rows.find((r) => r.id === 'empresa') }
}

export default function Configuracoes() {
  const atual = useConfig()
  const [c, setC] = useState<ConfigEmpresa>(atual)
  const [valor, setValor] = useState('')
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    setC(atual)
    setValor(brl(atual.valorBonus).replace('R$', '').trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(atual)])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    await salvar('config', { ...c, valorBonus: lerValor(valor) })
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  const num = (s: string) => (s === '' ? undefined : Number(s))

  return (
    <>
      <Cabecalho titulo="Configurações" />
      <form onSubmit={enviar} className="grid max-w-3xl gap-4">
        <Cartao className="space-y-4 p-5">
          <h2 className="font-semibold">Bônus por assiduidade</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor mensal (R$)">
              <Entrada inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
            <Campo rotulo="Período de experiência (dias)" dica="O bônus começa no mês seguinte ao fim da experiência.">
              <Entrada type="number" min={0} value={c.diasExperiencia} onChange={(e) => setC({ ...c, diasExperiencia: Number(e.target.value) })} />
            </Campo>
            <Campo rotulo="Máximo de horas de ausência num único dia">
              <Entrada type="number" min={0} step={0.5} value={c.bonusLimiteDia} onChange={(e) => setC({ ...c, bonusLimiteDia: Number(e.target.value) })} />
            </Campo>
            <Campo rotulo="Máximo de horas de ausência somadas no mês" dica="Atrasos também contam.">
              <Entrada type="number" min={0} step={0.5} value={c.bonusLimiteMes ?? ''} placeholder="A definir" onChange={(e) => setC({ ...c, bonusLimiteMes: num(e.target.value) })} />
            </Campo>
          </div>
          <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <b>Lembrete para conferir:</b> o mês em que termina a experiência já conta para o bônus ou só o seguinte? Hoje o sistema considera só o mês seguinte. Falta confirmar com a pessoa responsável.
            </div>
          </div>
        </Cartao>

        <Cartao className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Cartão benefício</h2>
            <p className="text-sm text-gray-500">
              O bônus por assiduidade é pago como <b>Mobilidade</b> no cartão benefício, fora da folha. Cultura é um valor fixo de cada pessoa, preenchido na ficha.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Auxílio Alimentação (R$ por mês, igual para todos)">
              <Entrada type="number" min={0} step={0.01} value={c.valorAlimentacao ?? ''} onChange={(e) => setC({ ...c, valorAlimentacao: num(e.target.value) })} />
            </Campo>
          </div>
        </Cartao>

        <Cartao className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Representante da empresa</h2>
            <p className="text-sm text-gray-500">Usado em documentos assinados pelo sócio, como o acordo de férias coletivas.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome do sócio-administrador">
              <Entrada value={c.socioNome ?? ''} onChange={(e) => setC({ ...c, socioNome: e.target.value || undefined })} />
            </Campo>
            <Campo rotulo="CPF do sócio-administrador">
              <Entrada value={c.socioCpf ?? ''} onChange={(e) => setC({ ...c, socioCpf: e.target.value || undefined })} />
            </Campo>
          </div>
        </Cartao>

        <div className="flex items-center justify-end gap-3">
          {salvo && <span className="text-sm text-green-700">Salvo!</span>}
          <Botao type="submit">Salvar configurações</Botao>
        </div>
      </form>
    </>
  )
}
