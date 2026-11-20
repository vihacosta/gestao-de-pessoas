import { CheckCircle2, ClipboardCheck, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dataBR } from '../lib/clt'
import { itensConferencia, precisaConferir } from '../lib/conferenciaAnual'
import { hojeISO } from '../lib/hoje'
import { salvar } from '../lib/store'
import type { Funcionario } from '../lib/types'
import { Botao } from './ui'

/** Aviso na ficha: conferir os dados do cadastro neste ano e marcar que está tudo certo */
export function ConferenciaDados({ f }: { f: Funcionario }) {
  const hoje = hojeISO()
  if (!precisaConferir(f, hoje)) return null
  const ano = hoje.slice(0, 4)

  async function confirmar() {
    if (!confirm(`Confirma que conferiu os dados de ${f.nome} com a pessoa e está tudo certo para ${ano}?`)) return
    await salvar('funcionarios', { ...f, dadosConferidosEm: hoje })
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="flex items-start gap-3">
        <ClipboardCheck size={22} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Conferir os dados de {ano}</div>
          <p className="text-sm">
            Confirme com {f.nome.split(' ')[0]} se os dados do cadastro continuam certos
            {f.dadosConferidosEm ? ` (última conferência em ${dataBR(f.dadosConferidosEm)})` : ''}:
          </p>
          <ul className="mt-1 grid list-disc gap-x-6 pl-5 text-sm sm:grid-cols-2">
            {itensConferencia.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-800">Se mudou de casa ou de estado civil, envie também o novo comprovante em Documentos pessoais.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/funcionarios/${f.id}/editar`}>
              <Botao variante="secundario">
                <Pencil size={16} /> Atualizar dados
              </Botao>
            </Link>
            <Botao onClick={confirmar}>
              <CheckCircle2 size={16} /> Está tudo certo
            </Botao>
          </div>
        </div>
      </div>
    </div>
  )
}
