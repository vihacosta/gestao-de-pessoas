import { dataBR } from '../lib/clt'
import { historicoFerias, type ItemHistoricoFerias, type SituacaoHistorico } from '../lib/historicoFerias'
import { hojeISO } from '../lib/hoje'
import type { Ferias, Funcionario } from '../lib/types'
import { Cartao, Selo } from './ui'

const rotulos: Record<SituacaoHistorico, [string, 'amarelo' | 'vermelho' | 'roxo' | 'azul' | 'verde']> = {
  aguardando: ['Aguardando aprovação', 'amarelo'],
  recusada: ['Recusada', 'vermelho'],
  agendada: ['Agendada', 'roxo'],
  em_andamento: ['De férias agora', 'azul'],
  concluida: ['Concluída', 'verde'],
}

function detalhe(x: ItemHistoricoFerias) {
  const partes: string[] = []
  if (x.doSaldo) partes.push(`${x.doSaldo} do saldo`)
  if (x.antecipados) partes.push(`${x.antecipados} antecipados`)
  if (x.licencaRemunerada) partes.push(`${x.licencaRemunerada} de licença remunerada`)
  if (x.abono) partes.push(`${x.abono} vendidos`)
  return partes.join(' + ')
}

export function HistoricoFerias({ funcionario, ferias }: { funcionario: Funcionario; ferias: Ferias[] }) {
  const lista = historicoFerias(ferias, funcionario.id, hojeISO())
  const acerto = funcionario.acertoFerias

  return (
    <Cartao className="lg:col-span-2">
      <h2 className="border-b border-gray-100 p-5 font-semibold">Histórico de férias</h2>
      {lista.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">Nenhuma férias registrada no sistema.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="px-5 py-2 font-medium">Datas</th>
                <th className="px-3 py-2 font-medium">Dias</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Início do período</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((x) => {
                const [rotulo, cor] = rotulos[x.situacao]
                return (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap px-5 py-2">
                      {dataBR(x.inicio)} a {dataBR(x.fim)}
                      {x.observacao && <span className="block text-xs text-gray-500">{x.observacao}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <b>{x.dias}</b>
                      {detalhe(x) && <span className="block text-xs text-gray-500">{detalhe(x)}</span>}
                    </td>
                    <td className="px-3 py-2">{x.coletiva ? 'Coletivas' : 'Individuais'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{x.periodos.map(dataBR).join(' e ')}</td>
                    <td className="px-3 py-2"><Selo cor={cor}>{rotulo}</Selo></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {acerto && (
        <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-500">
          As férias dos períodos antes de {dataBR(acerto.periodoInicio)} foram quitadas com a contabilidade e não têm as datas registradas aqui.
        </p>
      )}
    </Cartao>
  )
}
