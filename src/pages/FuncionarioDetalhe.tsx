import { ArrowLeft, Cake, FileDown, FileText, Gift, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SeloStatusFerias, SolicitarFerias } from '../components/SolicitarFerias'
import { Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Selo, Vazio, Oculto } from '../components/ui'
import {
  aniversarioEmpresa,
  brl,
  dataBR,
  decimoTerceiro,
  fgtsAcumuladoEstimado,
  fgtsMensal,
  periodosAquisitivos,
  salarioEm,
  statusFerias,
} from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { aniversarioNascimento, ehMarcoPresente, textoMarco } from '../lib/aniversarios'
import { remover, salvar, useTabela } from '../lib/store'
import { salvarNoComputador } from '../lib/arquivos'
import { ArquivoFuncionario } from '../components/ArquivoFuncionario'
import { DocumentosPessoais } from '../components/DocumentosPessoais'
import { ConferenciaDados } from '../components/ConferenciaDados'
import { HistoricoOcorrencias } from '../components/HistoricoOcorrencias'
import { ErrosFuncionario } from '../components/ErrosFuncionario'
import { AquisicoesFuncionario } from '../components/AquisicoesFuncionario'
import { camposDoModelo, ctpsTexto, enderecoTexto, modelosPadrao, montarDados, nomeArquivo, preencher, zipar } from '../lib/modelos'
import { camposFaltando, carregarModelo } from './Documentos'
import { useConfig } from './Configuracoes'
import type { Ausencia, Ferias, Funcionario } from '../lib/types'

function Info({ rotulo, valor }: { rotulo: string; valor?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="text-sm">{valor || '—'}</div>
    </div>
  )
}

export default function FuncionarioDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const funcs = useTabela<Funcionario>('funcionarios')
  const { rows: ferias } = useTabela<Ferias>('ferias')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const [reajusteAberto, setReajusteAberto] = useState(false)
  const [feriasAberto, setFeriasAberto] = useState(false)
  const [gerandoKit, setGerandoKit] = useState(false)
  const config = useConfig()
  const hoje = hojeISO()

  const f = funcs.rows.find((x) => x.id === id)
  if (funcs.carregando) return null
  if (!f) return <Vazio>Funcionário não encontrado.</Vazio>

  const periodos = periodosAquisitivos(f, ferias, ausencias, hoje)
  const status = statusFerias(periodos, hoje)
  const ano = Number(hoje.slice(0, 4))
  const decimo = decimoTerceiro(f, ano, hoje)
  const aniv = aniversarioEmpresa(f.dataAdmissao, hoje)
  const nasc = f.dataNascimento ? aniversarioNascimento(f.dataNascimento, hoje) : null
  const estagio = f.tipo === 'estagio'

  async function kitAdmissao() {
    if (!f) return
    setGerandoKit(true)
    try {
      const arquivos = []
      const faltando = new Set<string>()
      for (const m of modelosPadrao.filter((x) => x.grupo === 'admissao')) {
        const buf = await carregarModelo(m)
        camposFaltando(camposDoModelo(buf), f, f.dataAdmissao).forEach((c) => faltando.add(c))
        const blob = preencher(buf, montarDados(m, { funcionarios: [f], dataDoc: f.dataAdmissao, extras: {}, config }))
        arquivos.push({ nome: nomeArquivo(m, [f]), conteudo: await blob.arrayBuffer() })
      }
      salvarNoComputador(zipar(arquivos), `Kit de admissão - ${f.nome}.zip`)
      if (faltando.size) alert(`Kit gerado, mas estes dados estão em branco no cadastro: ${[...faltando].join(', ')}.`)
    } catch (e) {
      alert('Não foi possível gerar o kit: ' + String((e as Error).message ?? e))
    }
    setGerandoKit(false)
  }

  async function excluir() {
    if (!f || !confirm(`Excluir ${f.nome} e todos os registros de férias? Isso não pode ser desfeito.`)) return
    for (const x of ferias.filter((x) => x.funcionarioId === f.id)) await remover('ferias', x.id)
    await remover('funcionarios', f.id)
    navegar('/funcionarios')
  }

  return (
    <>
      <Link to="/funcionarios" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Funcionários
      </Link>
      <Cabecalho
        titulo={f.nome}
        subtitulo={`${f.cargo} · ${estagio ? 'Estágio' : 'CLT'}${f.dataDemissao ? ` · desligado em ${dataBR(f.dataDemissao)}` : ''}`}
        acoes={
          <>
            <Botao onClick={kitAdmissao} disabled={gerandoKit} title="Baixa todos os documentos de admissão preenchidos, com a data de admissão">
              <FileDown size={16} /> Kit de admissão
            </Botao>
            <Link to={`/documentos?funcionario=${f.id}`}>
              <Botao variante="secundario">
                <FileText size={16} /> Outro documento
              </Botao>
            </Link>
            <Link to={`/funcionarios/${f.id}/editar`}>
              <Botao variante="secundario">
                <Pencil size={16} /> Editar
              </Botao>
            </Link>
            <Botao variante="perigo" onClick={excluir} aria-label="Excluir">
              <Trash2 size={16} />
            </Botao>
          </>
        }
      />

      <ConferenciaDados f={f} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Dados */}
        <Cartao className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Dados pessoais</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info rotulo="CPF" valor={f.cpf} />
            <Info rotulo="RG" valor={f.rg} />
            <Info rotulo="PIS" valor={f.pis} />
            <Info rotulo="Carteira de trabalho" valor={ctpsTexto(f)} />
            <Info rotulo="Estado civil" valor={f.estadoCivil} />
            <Info rotulo="Grau de instrução" valor={f.grauInstrucao} />
            <Info rotulo="Jornada" valor={f.horarioJornada} />
            <Info rotulo="Nascimento" valor={f.dataNascimento && dataBR(f.dataNascimento)} />
            <Info rotulo="Telefone" valor={f.telefone} />
            <Info rotulo="E-mail" valor={f.email} />
            <Info rotulo="Admissão" valor={dataBR(f.dataAdmissao)} />
            <div className="col-span-2 sm:col-span-3">
              <Info rotulo="Endereço" valor={enderecoTexto(f)} />
            </div>
            <Info rotulo="Mãe" valor={f.nomeMae} />
            <Info rotulo="Pai" valor={f.nomePai} />
            <Info rotulo="Naturalidade" valor={f.naturalidade} />
            <Info rotulo="Contato de emergência" valor={[f.contatoEmergencia1, f.contatoEmergencia2].filter(Boolean).join(' · ')} />
            <Info rotulo="Pix" valor={f.pix} />
            <Info rotulo="Banco" valor={f.dadosBancarios} />
            {f.dependentes && (
              <div className="col-span-2 sm:col-span-3">
                <Info rotulo="Dependentes" valor={f.dependentes} />
              </div>
            )}
            {f.observacoes && (
              <div className="col-span-2 sm:col-span-3">
                <Info rotulo="Observações" valor={f.observacoes} />
              </div>
            )}
          </div>
        </Cartao>

        {/* Cálculos */}
        <Cartao className="p-5">
          <h2 className="mb-4 font-semibold">Resumo</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">{estagio ? 'Bolsa atual' : 'Salário atual'}</dt>
              <dd className="font-semibold"><Oculto>{brl(salarioEm(f, hoje))}</Oculto></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">13º de {ano}</dt>
              <dd>{estagio ? 'Não se aplica' : <><Oculto>{brl(decimo.valor)}</Oculto> ({decimo.avos}/12)</>}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">FGTS mensal (8%)</dt>
              <dd>{estagio ? 'Não se aplica' : <Oculto>{brl(fgtsMensal(f, hoje))}</Oculto>}</dd>
            </div>
            {!estagio && (
              <div className="flex justify-between">
                <dt className="text-gray-500" title="Soma dos depósitos mensais de 8% sobre o salário de cada mês, sem 13º e férias">
                  FGTS depositado (estimativa)
                </dt>
                <dd><Oculto>{brl(fgtsAcumuladoEstimado(f, hoje))}</Oculto></dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Tempo de casa</dt>
              <dd>
                {aniv.anosCompletos} {aniv.anosCompletos === 1 ? 'ano' : 'anos'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Aniversário de empresa</dt>
              <dd className="flex flex-col items-end gap-1 text-right">
                {aniv.diasAte === 0 ? <Selo cor="verde">Hoje! {aniv.anosNoProximo} anos</Selo> : `${dataBR(aniv.proximo)} (${aniv.anosNoProximo} anos)`}
                {!f.dataDemissao && ehMarcoPresente(aniv.anosNoProximo) && (
                  <Selo cor="roxo">
                    <Gift size={12} /> {textoMarco(aniv.anosNoProximo)}
                  </Selo>
                )}
              </dd>
            </div>
            {!f.dataDemissao && (
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Aniversário</dt>
                <dd className="text-right">
                  {!nasc ? (
                    <span className="text-amber-700">sem data de nascimento</span>
                  ) : nasc.diasAte === 0 ? (
                    <Selo cor="verde">
                      <Cake size={12} /> Hoje! {nasc.idade} anos
                    </Selo>
                  ) : (
                    `${dataBR(nasc.proximo).slice(0, 5)} (faz ${nasc.idade}, em ${nasc.diasAte} ${nasc.diasAte === 1 ? 'dia' : 'dias'})`
                  )}
                </dd>
              </div>
            )}
          </dl>
        </Cartao>

        {/* Férias */}
        <Cartao className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">{estagio ? 'Recesso' : 'Férias'}</h2>
              <SeloStatusFerias status={status} />
            </div>
            {!f.dataDemissao && (
              <Botao variante="secundario" onClick={() => setFeriasAberto(true)}>
                <Plus size={16} /> Solicitar
              </Botao>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Período aquisitivo</th>
                  <th className="px-3 py-2 font-medium">Prazo para tirar</th>
                  <th className="px-3 py-2 font-medium">Direito</th>
                  <th className="px-3 py-2 font-medium">Usado</th>
                  <th className="px-3 py-2 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...periodos].reverse().map((p) => (
                  <tr key={p.inicio}>
                    <td className="px-5 py-2">
                      {dataBR(p.inicio)} a {dataBR(p.fim)}
                      {!p.completo && <span className="ml-2 text-xs text-gray-400">(em andamento)</span>}
                    </td>
                    <td className="px-3 py-2">{dataBR(p.concessivoFim)}</td>
                    <td className="px-3 py-2">
                      {p.direito}
                      {!p.completo && <span className="text-xs text-gray-400"> até agora</span>}
                      {p.faltasInjustificadas > 5 && <span className="block text-xs text-red-600">{p.faltasInjustificadas} faltas</span>}
                    </td>
                    <td className="px-3 py-2">{p.usados}</td>
                    <td className="px-3 py-2 font-semibold">{p.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>

        {/* Salários */}
        <Cartao className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Histórico salarial</h2>
            <Botao variante="fantasma" onClick={() => setReajusteAberto(true)} className="px-2">
              <Plus size={16} /> Reajuste
            </Botao>
          </div>
          <ul className="space-y-2 text-sm">
            {[...f.salarios]
              .sort((a, b) => b.data.localeCompare(a.data))
              .map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {dataBR(s.data)}
                    {s.motivo && <span className="text-gray-500"> · {s.motivo}</span>}
                  </span>
                  <span className="font-medium"><Oculto>{brl(s.valor)}</Oculto></span>
                </li>
              ))}
          </ul>
        </Cartao>

        <DocumentosPessoais f={f} />

        <ArquivoFuncionario f={f} />

        <div className="lg:col-span-3">
          <HistoricoOcorrencias funcionarioId={f.id} />
        </div>

        <div className="lg:col-span-3">
          <ErrosFuncionario funcionarioId={f.id} />
        </div>

        <div className="lg:col-span-3">
          <AquisicoesFuncionario funcionarioId={f.id} />
        </div>
      </div>

      <NovoReajuste aberto={reajusteAberto} onFechar={() => setReajusteAberto(false)} funcionario={f} />
      <SolicitarFerias aberto={feriasAberto} onFechar={() => setFeriasAberto(false)} funcionarioId={f.id} />
    </>
  )
}

function NovoReajuste({ aberto, onFechar, funcionario: f }: { aberto: boolean; onFechar: () => void; funcionario: Funcionario }) {
  const [data, setData] = useState(hojeISO())
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('Reajuste')

  async function enviar() {
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!v) return
    await salvar('funcionarios', { ...f, salarios: [...f.salarios, { data, valor: v, motivo }] })
    setValor('')
    onFechar()
  }

  return (
    <Modal titulo="Registrar reajuste" aberto={aberto} onFechar={onFechar}>
      <div className="space-y-4 p-5">
        <Campo rotulo="Vale a partir de">
          <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="Novo valor (R$)">
          <Entrada inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="2.800,00" />
        </Campo>
        <Campo rotulo="Motivo">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={enviar}>Salvar</Botao>
        </div>
      </div>
    </Modal>
  )
}
