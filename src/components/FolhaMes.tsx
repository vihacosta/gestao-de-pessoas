import { Download, Eye, EyeOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { salvarNoComputador } from '../lib/arquivos'
import type { Aquisicao } from '../lib/aquisicoes'
import { brl } from '../lib/clt'
import type { ErroFuncionario } from '../lib/descontoErros'
import { lerValor } from '../lib/extenso'
import { diasUteisPadrao, idDiasUteis, idRegistroFolha, montarFolha, planilhaFolha, somaFolha, textoHoras, type LinhaFolha, type RegistroFolha } from '../lib/folha'
import { hojeISO } from '../lib/hoje'
import type { Justificativa } from '../lib/justificativas'
import { remover, salvar, useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, Funcionario } from '../lib/types'
import { useConfig } from '../pages/Configuracoes'
import { Botao, Cartao, Entrada, SimNao, Vazio, cx } from './ui'

const paraTexto = (v?: number) => (v ? v.toFixed(2).replace('.', ',') : '')

/** Valor em reais que grava ao sair do campo */
function CampoValor({ valor, onSalvar, disabled, rotulo }: { valor: number; onSalvar: (v: number | undefined) => void; disabled?: boolean; rotulo: string }) {
  const [texto, setTexto] = useState(paraTexto(valor))
  useEffect(() => setTexto(paraTexto(valor)), [valor])
  function sair() {
    const n = lerValor(texto)
    // texto que não é um valor volta ao que estava, em vez de virar zero
    if (n < 0 || (texto.trim() && !/^[\d.,\s]+$/.test(texto.trim()))) return setTexto(paraTexto(valor))
    if (n !== valor) onSalvar(n || undefined)
  }
  return (
    <div className="ml-auto w-28">
      <Entrada aria-label={rotulo} disabled={disabled} inputMode="decimal" placeholder="0,00" value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={sair} className="px-2 py-1 text-right" />
    </div>
  )
}

function CampoObs({ valor, onSalvar, disabled, rotulo }: { valor: string; onSalvar: (v: string | undefined) => void; disabled?: boolean; rotulo: string }) {
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  return (
    <div className="w-48">
      <Entrada aria-label={rotulo} disabled={disabled} value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => texto.trim() !== valor && onSalvar(texto.trim() || undefined)} className="px-2 py-1" />
    </div>
  )
}

/** Folha de pagamento do mês, com as colunas da planilha */
export function FolhaMes({ mes, tituloMes, ativos }: { mes: string; tituloMes: string; ativos: Funcionario[] }) {
  const { podeAlterar } = useAuth()
  const edita = podeAlterar('valores')
  const editaCadastro = podeAlterar('funcionarios')
  const config = useConfig()
  const { rows: registros, erro } = useTabela<RegistroFolha>('folha')
  const { rows: erros } = useTabela<ErroFuncionario>('erros')
  const { rows: aquisicoes } = useTabela<Aquisicao>('aquisicoes')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const { rows: marcas } = useTabela<Justificativa>('justificativas')
  const [mostrar, setMostrar] = useState(false)
  const [falha, setFalha] = useState('')
  const hoje = hojeISO()

  const { linhas, diasUteis, diasAjustados } = useMemo(
    () => montarFolha({ mes, ativos, registros, erros, aquisicoes, ausencias, pontos, marcas, config, hoje }),
    [mes, ativos, registros, erros, aquisicoes, ausencias, pontos, marcas, config, hoje],
  )
  const podeEditar = edita && !erro

  async function gravar(acao: () => Promise<void>) {
    setFalha('')
    try {
      await acao()
    } catch (e) {
      setFalha(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const atualizar = (f: Funcionario, mudanca: Partial<RegistroFolha>) =>
    gravar(() => {
      const id = idRegistroFolha(f.id, mes)
      const atual = registros.find((r) => r.id === id) ?? { id, mes, funcionarioId: f.id }
      return salvar<RegistroFolha>('folha', { ...atual, ...mudanca })
    })

  function mudarDias(texto: string) {
    const n = Math.floor(Number(texto))
    if (texto === '' || n === diasUteisPadrao(mes)) {
      if (diasAjustados) gravar(() => remover('folha', idDiasUteis(mes)))
      return
    }
    if (n >= 0 && n <= 31) gravar(() => salvar<RegistroFolha>('folha', { id: idDiasUteis(mes), mes, diasUteis: n }))
  }

  const din = (v: number) => (mostrar ? brl(v) : '•••••')
  const cel = (v: number, destaque = false) => <td className={cx('whitespace-nowrap px-2 py-2 text-right', !v && 'text-gray-400', destaque && 'font-semibold')}>{din(v)}</td>
  const total = (k: Parameters<typeof somaFolha>[1]) => <td className="whitespace-nowrap px-2 py-2 text-right">{din(somaFolha(linhas, k))}</td>
  const valorDigitado = (l: LinhaFolha, k: 'comissao' | 'adiantamento', rotulo: string) => (
    <td className="px-2 py-1.5 text-right">
      {mostrar ? <CampoValor rotulo={`${rotulo} de ${l.funcionario.nome}`} valor={l[k]} disabled={!podeEditar} onSalvar={(v) => atualizar(l.funcionario, { [k]: v })} /> : <span className={cx(!l[k] && 'text-gray-400')}>•••••</span>}
    </td>
  )

  return (
    <Cartao className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="font-semibold">Folha de pagamento</h2>
          <p className="text-xs text-gray-500">Salário total = bruto + mobilidade + cultura + alimentação − desconto do vale + comissão, como na planilha.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700" title="Segunda a sexta. Ajuste se houver feriado ou sábado trabalhado.">
            Dias úteis
            <span className="block w-20">
              <Entrada key={`${mes}-${diasUteis}`} type="number" min={0} max={31} disabled={!podeEditar} defaultValue={diasUteis} onBlur={(e) => Number(e.target.value) !== diasUteis && mudarDias(e.target.value)} className="px-2 py-1.5" />
            </span>
          </label>
          <Botao variante="secundario" className="px-3 py-1.5" onClick={() => setMostrar(!mostrar)}>
            {mostrar ? <EyeOff size={15} /> : <Eye size={15} />} {mostrar ? 'Esconder valores' : 'Mostrar valores'}
          </Botao>
          <Botao className="px-3 py-1.5" disabled={!linhas.length} onClick={() => salvarNoComputador(planilhaFolha(linhas, tituloMes, diasUteis), `Folha de pagamento ${mes}.xlsx`)}>
            <Download size={15} /> Baixar Excel
          </Botao>
        </div>
      </div>

      {erro && <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900">A folha ainda não pode ser salva: falta rodar a atualização do banco de dados (supabase/schema.sql).</p>}
      {falha && <p className="bg-red-50 px-4 py-2 text-sm text-red-800">{falha}</p>}

      {linhas.length === 0 ? (
        <Vazio>Nenhum colaborador neste mês.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-2 text-left font-medium">Colaborador</th>
                <th className="px-2 py-2 font-medium">Salário bruto</th>
                <th className="px-2 py-2 font-medium">Compras</th>
                <th className="px-2 py-2 font-medium">Erros</th>
                <th className="px-2 py-2 text-center font-medium">Vale transporte</th>
                <th className="px-2 py-2 font-medium">Desc. vale alim.</th>
                <th className="px-2 py-2 font-medium">Adiantamento</th>
                <th className="px-2 py-2 text-center font-medium">Horas: descontar?</th>
                <th className="px-2 py-2 font-medium">Comissão</th>
                <th className="px-2 py-2 font-medium">Mobilidade</th>
                <th className="px-2 py-2 font-medium">Cultura</th>
                <th className="px-2 py-2 font-medium">Vale alim.</th>
                <th className="px-2 py-2 font-medium text-gray-700">Salário total</th>
                <th className="px-2 py-2 text-left font-medium">Obs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((l) => {
                const f = l.funcionario
                return (
                  <tr key={f.id}>
                    <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2">
                      <Link to={`/funcionarios/${f.id}`} className="font-medium hover:underline">
                        {f.nome}
                      </Link>
                    </td>
                    {cel(l.salario)}
                    <td className={cx('whitespace-nowrap px-2 py-2 text-right', !l.compras && 'text-gray-400')}>
                      {din(l.compras)}
                      {l.comprasAtrasadas > 0 && <span className="block text-xs text-amber-700">+ {din(l.comprasAtrasadas)} atrasado</span>}
                    </td>
                    <td className={cx('whitespace-nowrap px-2 py-2 text-right', !l.erros && 'text-gray-400')}>
                      {din(l.erros)}
                      {l.errosPendentes && <span className="block text-xs text-red-700">a descontar</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      {l.usaVT === false ? (
                        <span className="text-xs text-gray-400">Não usa</span>
                      ) : !l.temPasse ? (
                        editaCadastro ? (
                          <Link to={`/funcionarios/${f.id}/editar`} className="text-xs text-amber-700 underline">
                            {l.usaVT ? 'cadastrar passe' : 'definir'}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">{l.usaVT ? 'sem passe' : 'não definido'}</span>
                        )
                      ) : (
                        <>
                          <SimNao rotulo={`Vale transporte de ${f.nome}`} valor={l.recebeVT} disabled={!podeEditar} onMudar={(v) => atualizar(f, { recebeVT: v })} />
                          {l.recebeVT && <span className="block text-xs text-gray-600">{din(l.valeTransporte)}</span>}
                        </>
                      )}
                    </td>
                    {cel(l.descontoVA)}
                    {valorDigitado(l, 'adiantamento', 'Adiantamento')}
                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      {l.horas === undefined ? (
                        <span className="text-xs text-gray-400">sem cartão</span>
                      ) : (
                        <>
                          <span className={cx('block text-xs', l.horas < 0 ? 'font-medium text-red-700' : 'text-gray-600')}>{textoHoras(l.horas)}</span>
                          {l.horas < 0 && <SimNao rotulo={`Descontar horas de ${f.nome}`} valor={l.descontarHoras} disabled={!podeEditar} onMudar={(v) => atualizar(f, { descontarHoras: v })} />}
                        </>
                      )}
                    </td>
                    {valorDigitado(l, 'comissao', 'Comissão')}
                    {cel(l.mobilidade)}
                    {cel(l.cultura)}
                    {cel(l.alimentacao)}
                    {cel(l.salarioTotal, true)}
                    <td className="px-2 py-1.5">
                      <CampoObs rotulo={`Observação de ${f.nome}`} valor={l.obs} disabled={!podeEditar} onSalvar={(v) => atualizar(f, { obs: v })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="sticky left-0 bg-gray-50 px-4 py-2">Total</td>
                {total('salario')}
                {total('compras')}
                {total('erros')}
                <td className="whitespace-nowrap px-2 py-2 text-center">{din(somaFolha(linhas, 'valeTransporte'))}</td>
                {total('descontoVA')}
                {total('adiantamento')}
                <td />
                {total('comissao')}
                {total('mobilidade')}
                {total('cultura')}
                {total('alimentacao')}
                {total('salarioTotal')}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-4 py-2 text-xs text-gray-500">
        Compras, erros, adiantamento, vale transporte e horas ficam à parte e não mudam o salário total, igual à planilha. Para ver Adiantamento e Comissão como campos, clique em Mostrar valores.
      </p>
    </Cartao>
  )
}
