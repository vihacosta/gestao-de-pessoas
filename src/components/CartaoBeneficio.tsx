import { Copy, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { salvarNoComputador } from '../lib/arquivos'
import { linhasCartao, planilhaCartao, textoTabela } from '../lib/beneficios'
import { brl } from '../lib/clt'
import type { Ausencia, CartaoPontoSalvo, ConfigEmpresa, Funcionario } from '../lib/types'
import { Botao, Cartao } from './ui'

/** Prévia e download da planilha do cartão benefício do mês */
export function CartaoBeneficio(props: { funcionarios: Funcionario[]; ausencias: Ausencia[]; pontos: CartaoPontoSalvo[]; config: ConfigEmpresa; mes: string; nomeMes: string }) {
  const { funcionarios, ausencias, pontos, config, mes, nomeMes } = props
  const linhas = useMemo(() => linhasCartao(funcionarios, ausencias, pontos, config, mes), [funcionarios, ausencias, pontos, config, mes])
  const [copiado, setCopiado] = useState(false)
  const soma = (k: 'alimentacao' | 'mobilidade' | 'cultura') => linhas.reduce((s, l) => s + l[k], 0)
  const semCpf = linhas.filter((l) => !l.cpf)

  function copiar() {
    navigator.clipboard.writeText(textoTabela(linhas))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Cartao className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <div className="font-semibold">Planilha do cartão benefício</div>
          <div className="text-xs text-gray-500">Mobilidade = bônus por assiduidade de {nomeMes.toLowerCase()} · mesmo layout da planilha usada hoje</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" className="px-3 py-1" onClick={copiar} disabled={!linhas.length}>
            <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar tabela'}
          </Botao>
          <Botao className="px-3 py-1" onClick={() => salvarNoComputador(planilhaCartao(linhas), `Cartao beneficio ${mes}.xlsx`)} disabled={!linhas.length}>
            <Download size={14} /> Baixar planilha
          </Botao>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 text-right font-medium">Alimentação</th>
              <th className="px-3 py-2 text-right font-medium">Mobilidade</th>
              <th className="px-3 py-2 text-right font-medium">Cultura</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.map((l) => (
              <tr key={l.funcionario.id}>
                <td className="px-4 py-2">
                  <Link to={`/funcionarios/${l.funcionario.id}`} className="hover:underline">
                    {l.funcionario.nome}
                  </Link>
                  {l.bonus.status !== 'recebe' && (
                    <span className="ml-2 text-xs text-gray-500">{l.bonus.status === 'experiencia' ? 'em experiência' : 'perdeu o bônus'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{brl(l.alimentacao)}</td>
                <td className={`px-3 py-2 text-right ${l.mobilidade ? '' : 'text-gray-400'}`}>{brl(l.mobilidade)}</td>
                <td className={`px-3 py-2 text-right ${l.cultura ? '' : 'text-gray-400'}`}>{brl(l.cultura)}</td>
                <td className="px-3 py-2 text-right font-medium">{brl(l.alimentacao + l.mobilidade + l.cultura)}</td>
              </tr>
            ))}
          </tbody>
          {linhas.length > 0 && (
            <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="px-3 py-2 text-right">{brl(soma('alimentacao'))}</td>
                <td className="px-3 py-2 text-right">{brl(soma('mobilidade'))}</td>
                <td className="px-3 py-2 text-right">{brl(soma('cultura'))}</td>
                <td className="px-3 py-2 text-right">{brl(soma('alimentacao') + soma('mobilidade') + soma('cultura'))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {semCpf.length > 0 && <p className="px-4 py-2 text-xs text-amber-700">Sem CPF no cadastro: {semCpf.map((l) => l.funcionario.nome).join(', ')}</p>}
      <p className="px-4 pb-3 pt-1 text-xs text-gray-500">
        Alimentação vem de Configurações; Cultura, da ficha de cada pessoa. Quem não deve entrar (ex.: sócias) é marcado na ficha.
      </p>
    </Cartao>
  )
}
