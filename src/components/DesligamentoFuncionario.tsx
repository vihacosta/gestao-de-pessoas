import { AlertTriangle, Calculator, Download, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Aquisicao } from '../lib/aquisicoes'
import { salvarNoComputador } from '../lib/arquivos'
import { brl, dataBR } from '../lib/clt'
import { MODELO_DEVOLUCAO, MOTIVOS, calcularDesligamento, fimExperiencia, type MotivoDesligamento } from '../lib/demissao'
import type { ErroFuncionario } from '../lib/descontoErros'
import { lerValor } from '../lib/extenso'
import { hojeISO } from '../lib/hoje'
import { camposDoModelo, modelosPadrao, montarDados, nomeArquivo, preencher, zipar } from '../lib/modelos'
import { calcularRescisao } from '../lib/rescisao'
import { useTabela } from '../lib/store'
import type { Ausencia, ConfigEmpresa, Ferias, Funcionario } from '../lib/types'
import { camposFaltando, carregarModelo } from '../pages/Documentos'
import { Botao, Campo, Entrada, Modal, Selecao } from './ui'

/** Gera os documentos do desligamento. Não altera o cadastro: a data de desligamento é registrada em Editar. */
export function DesligamentoFuncionario({ f, config, aberto, onFechar }: { f: Funcionario; config: ConfigEmpresa; aberto: boolean; onFechar: () => void }) {
  const motivos = MOTIVOS.filter((m) => m.tipo === f.tipo)
  const [motivo, setMotivo] = useState<MotivoDesligamento>(motivos[0].id)
  const [data, setData] = useState(hojeISO())
  const [ultimoDia, setUltimoDia] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [gerando, setGerando] = useState(false)
  const [gerado, setGerado] = useState(false)
  const [erro, setErro] = useState('')
  const [faltando, setFaltando] = useState<string[]>([])
  // Os valores começam escondidos, como no resto do sistema
  const [verEstimativa, setVerEstimativa] = useState(false)
  const [adiantamento, setAdiantamento] = useState('')
  const [saldoFgts, setSaldoFgts] = useState('')
  const { rows: ferias } = useTabela<Ferias>('ferias')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: erros } = useTabela<ErroFuncionario>('erros')
  const { rows: aquisicoes } = useTabela<Aquisicao>('aquisicoes')

  const pedeUltimoDia = motivo === 'fim_experiencia' || motivo === 'fim_estagio'
  const padraoUltimo = motivo === 'fim_experiencia' ? fimExperiencia(f.dataAdmissao, config.diasExperiencia) : data
  const r = useMemo(
    () => calcularDesligamento({ funcionario: f, motivo, data, ultimoDia: pedeUltimoDia ? ultimoDia || padraoUltimo : undefined, diasExperiencia: config.diasExperiencia, instituicao }),
    [f, motivo, data, ultimoDia, pedeUltimoDia, padraoUltimo, config.diasExperiencia, instituicao],
  )

  const estimativa = useMemo(() => {
    const valor = (s: string) => lerValor(s) || 0
    return calcularRescisao({
      funcionario: f,
      motivo,
      desligamento: r,
      ferias,
      ausencias,
      erros,
      aquisicoes,
      adiantamento13: valor(adiantamento),
      saldoFgts: saldoFgts.trim() ? valor(saldoFgts) : undefined,
    })
  }, [f, motivo, r, ferias, ausencias, erros, aquisicoes, adiantamento, saldoFgts])

  function limpar() {
    setGerado(false)
    setErro('')
    setFaltando([])
  }

  async function gerar() {
    limpar()
    setGerando(true)
    try {
      const principal = MOTIVOS.find((x) => x.id === motivo)!.modelo
      const arquivos = []
      const vazios = new Set<string>()
      for (const id of [principal, MODELO_DEVOLUCAO]) {
        const m = modelosPadrao.find((x) => x.id === id)!
        const buf = await carregarModelo(m)
        camposFaltando(camposDoModelo(buf), f, data).forEach((c) => vazios.add(c))
        const blob = preencher(buf, montarDados(m, { funcionarios: [f], dataDoc: data, extras: r.extras, config }))
        arquivos.push({ nome: nomeArquivo(m, [f]), conteudo: await blob.arrayBuffer() })
      }
      salvarNoComputador(zipar(arquivos), `Desligamento - ${f.nome}.zip`.replace(/[\\/:*?"<>|]/g, '-'))
      setFaltando([...vazios])
      setGerado(true)
    } catch (e) {
      setErro('Não foi possível gerar os documentos: ' + String((e as Error).message ?? e))
    }
    setGerando(false)
  }

  const linhas: [string, string][] = [
    ...(r.diasAviso ? ([['Aviso prévio', `${r.diasAviso} dias`]] as [string, string][]) : []),
    ...(r.diasTrabalhados ? ([['Dias a trabalhar', String(r.diasTrabalhados)]] as [string, string][]) : []),
    ...(r.diasIndenizados ? ([['Dias indenizados', r.extras.dias_indenizados]] as [string, string][]) : []),
    ['Último dia', dataBR(r.ultimoDia)],
    ...(r.projecao ? ([['Projeção do contrato', dataBR(r.projecao)]] as [string, string][]) : []),
    ...(r.prazoPagamento ? ([['Pagar as verbas até', dataBR(r.prazoPagamento)]] as [string, string][]) : []),
  ]

  return (
    <Modal titulo={`Desligamento de ${f.nome}`} aberto={aberto} onFechar={onFechar}>
      <div className="space-y-4 p-5">
        <Campo rotulo="Motivo">
          <Selecao
            value={motivo}
            onChange={(e) => {
              limpar()
              setUltimoDia('')
              setMotivo(e.target.value as MotivoDesligamento)
            }}
          >
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.rotulo}
              </option>
            ))}
          </Selecao>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Data da comunicação">
            <Entrada
              type="date"
              required
              value={data}
              onChange={(e) => {
                limpar()
                setData(e.target.value || hojeISO())
              }}
            />
          </Campo>
          {pedeUltimoDia && (
            <Campo rotulo="Último dia">
              <Entrada
                type="date"
                value={ultimoDia || padraoUltimo}
                onChange={(e) => {
                  limpar()
                  setUltimoDia(e.target.value)
                }}
              />
            </Campo>
          )}
          {motivo === 'fim_estagio' && (
            <Campo rotulo="Instituição de ensino" className="sm:col-span-2">
              <Entrada value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
            </Campo>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 text-sm">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs text-gray-500">{rotulo}</dt>
              <dd className="font-medium">{valor}</dd>
            </div>
          ))}
        </dl>

        {!r.erro && (
          <div className="rounded-lg border border-gray-200">
            <button type="button" onClick={() => setVerEstimativa((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold" aria-expanded={verEstimativa}>
              <span className="flex items-center gap-2">
                <Calculator size={16} className="text-gray-500" /> Estimativa da rescisão
              </span>
              {verEstimativa ? <EyeOff size={16} className="text-gray-500" /> : <Eye size={16} className="text-gray-500" />}
            </button>
            {verEstimativa && (
              <div className="space-y-3 border-t border-gray-200 p-3 text-sm">
                {f.tipo === 'clt' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo rotulo="13º já pago este ano (R$)">
                      <Entrada inputMode="decimal" placeholder="0,00" value={adiantamento} onChange={(e) => setAdiantamento(e.target.value)} />
                    </Campo>
                    <Campo rotulo="Saldo do FGTS no extrato (R$)" dica="Em branco: usa uma estimativa.">
                      <Entrada inputMode="decimal" placeholder="0,00" value={saldoFgts} onChange={(e) => setSaldoFgts(e.target.value)} />
                    </Campo>
                  </div>
                )}
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {estimativa.verbas.map((l) => (
                      <tr key={l.rotulo}>
                        <td className="py-1.5 pr-2">
                          {l.rotulo} <span className="block text-xs text-gray-500">{l.detalhe}</span>
                        </td>
                        <td className="whitespace-nowrap py-1.5 text-right">{brl(l.valor)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="py-1.5">Total de verbas</td>
                      <td className="whitespace-nowrap py-1.5 text-right">{brl(estimativa.bruto)}</td>
                    </tr>
                    {estimativa.descontos.map((l) => (
                      <tr key={l.rotulo} className="text-red-700">
                        <td className="py-1.5 pr-2">
                          {l.rotulo} <span className="block text-xs">{l.detalhe}</span>
                        </td>
                        <td className="whitespace-nowrap py-1.5 text-right">− {brl(l.valor)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-2 py-2">
                        A receber, antes de INSS e IRRF
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">{brl(estimativa.liquido)}</td>
                    </tr>
                    {f.tipo === 'clt' && (
                      <>
                        <tr>
                          <td className="py-1.5 pr-2">
                            Depósito do FGTS <span className="block text-xs text-gray-500">8%, recolhido na conta do FGTS</span>
                          </td>
                          <td className="whitespace-nowrap py-1.5 text-right">{brl(estimativa.depositoFgts)}</td>
                        </tr>
                        {estimativa.percentualMulta > 0 && (
                          <tr>
                            <td className="py-1.5 pr-2">
                              Multa do FGTS ({estimativa.percentualMulta * 100}%){' '}
                              <span className="block text-xs text-gray-500">sobre {brl(estimativa.baseMulta)}{estimativa.fgtsInformado ? '' : ' (estimado)'}, recolhida na conta do FGTS</span>
                            </td>
                            <td className="whitespace-nowrap py-1.5 text-right">{brl(estimativa.multaFgts)}</td>
                          </tr>
                        )}
                      </>
                    )}
                    <tr className="font-semibold">
                      <td className="py-1.5">Custo estimado para a empresa <span className="block text-xs font-normal text-gray-500">sem INSS patronal</span></td>
                      <td className="whitespace-nowrap py-1.5 text-right">{brl(estimativa.custoEmpresa)}</td>
                    </tr>
                  </tbody>
                </table>
                {estimativa.avisos.map((a) => (
                  <p key={a} className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {a}
                  </p>
                ))}
                <p className="text-xs text-gray-500">Valor aproximado, para planejamento. Não considera INSS, IRRF, médias de horas extras ou comissões, nem regras da convenção coletiva. O valor oficial é o do TRCT da contabilidade.</p>
              </div>
            )}
          </div>
        )}

        {r.erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{r.erro}</p>}
        {r.avisos.map((a) => (
          <p key={a} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {a}
          </p>
        ))}
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        {gerado && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <p>Documentos baixados. Quando o desligamento acontecer, registre a data em <Link to={`/funcionarios/${f.id}/editar`} className="font-medium underline">Editar</Link>.</p>
            {faltando.length > 0 && <p className="mt-1 text-amber-800">Em branco no cadastro: {faltando.join(', ')}.</p>}
          </div>
        )}

        <p className="text-xs text-gray-500">Vão juntos o documento do motivo e o termo de devolução de materiais. O TRCT e o valor das verbas continuam com a contabilidade.</p>
        <div className="flex justify-end">
          <Botao onClick={gerar} disabled={gerando || !!r.erro}>
            {gerando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Baixar documentos
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
