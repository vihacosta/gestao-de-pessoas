import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight, Eye, FileText, Printer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EnviarArquivos } from '../components/EnviarArquivos'
import { HistoricoOcorrencias, SeletorTolerancia } from '../components/HistoricoOcorrencias'
import { Botao, Cabecalho, Cartao, Entrada, Selo, Vazio, cx } from '../components/ui'
import { d, dataBR } from '../lib/clt'
import { abrirDocumento, excluirDocumento, guardarDocumento, tamanhoTexto } from '../lib/documentos'
import { hhmm, htmlFolha, ocorrenciasDoMes, passaDaTolerancia, textoOcorrencia, type Justificativa, type Ocorrencia } from '../lib/justificativas'
import { remover, salvar, useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, DocumentoGuardado, Funcionario } from '../lib/types'
import { useConfig } from './Configuracoes'
import { mesAnterior, nomeMes } from './Holerites'

/** Documentos coletivos (sem funcionário) usam este id */
export const COLETIVO = 'coletivo'

/** Folha assinada do mês e quantas ocorrências o mês tem */
export function pendenciaJustificativas(funcionarios: Funcionario[], pontos: CartaoPontoSalvo[], ausencias: Ausencia[], documentos: DocumentoGuardado[], mes: string, tolerancia = 0) {
  const ocorrencias = ocorrenciasDoMes(funcionarios, pontos, ausencias, mes).filter((o) => passaDaTolerancia(o, tolerancia)).length
  const assinada = documentos.some((x) => x.categoria === 'justificativas' && x.mes === mes)
  return { ocorrencias, assinada }
}

function Motivo({ o, j }: { o: Ocorrencia; j?: Justificativa }) {
  const atual = j?.motivo ?? o.observacao ?? ''
  const gravar = (texto: string) => {
    const motivo = texto.trim()
    if (motivo === (j?.motivo ?? '')) return
    if (!motivo) return j ? remover('justificativas', j.id) : undefined
    return salvar<Justificativa>('justificativas', { id: o.id, funcionarioId: o.funcionarioId, data: o.data, motivo })
  }
  return (
    <Entrada
      key={atual}
      defaultValue={atual}
      placeholder="Em branco: a pessoa escreve à mão"
      onBlur={(e) => gravar(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="py-1.5 text-sm"
    />
  )
}

export default function Justificativas() {
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? mesAnterior()
  const mudar = (n: number) => setParams({ mes: format(addMonths(d(`${mes}-01`), n), 'yyyy-MM') })
  const { rows: funcionarios, carregando } = useTabela<Funcionario>('funcionarios')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: justificativas } = useTabela<Justificativa>('justificativas')
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')

  const historico = params.get('ver') === 'historico'
  const tolerancia = useConfig().toleranciaJustificativa ?? 0
  const [verMenores, setVerMenores] = useState(false)
  const doMes = useMemo(() => ocorrenciasDoMes(funcionarios, pontos, ausencias, mes), [funcionarios, pontos, ausencias, mes])
  const acima = doMes.filter((o) => passaDaTolerancia(o, tolerancia))
  const menores = doMes.length - acima.length
  const ocorrencias = verMenores ? doMes : acima
  const nome = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? ''
  const just = (o: Ocorrencia) => justificativas.find((j) => j.id === o.id)
  const motivo = (o: Ocorrencia) => just(o)?.motivo ?? o.observacao ?? ''
  const folhas = documentos.filter((x) => x.categoria === 'justificativas' && x.mes === mes).sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm))
  const temCartao = pontos.some((p) => p.mes === mes)
  const comMotivo = ocorrencias.filter((o) => motivo(o)).length

  function imprimir() {
    const html = htmlFolha({ titulo: `Folha de justificativas · ${nomeMes(mes)}`, ocorrencias, nome, motivo })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank')
  }

  const enviarFolha = (arquivos: File[]) =>
    guardarDocumento({
      funcionarioId: COLETIVO,
      categoria: 'justificativas',
      mes,
      arquivos,
      titulo: `Folha de justificativas ${mes.slice(5)}/${mes.slice(0, 4)}${folhas.length ? ` (${folhas.length + 1})` : ''}`,
    }).then(() => {})

  return (
    <>
      <Cabecalho
        titulo="Ocorrências"
        subtitulo="Faltas, atrasos não compensados no dia e saídas antecipadas do mês, para cada pessoa escrever o motivo e assinar"
      />

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {[
          { id: false, rotulo: 'Folha do mês' },
          { id: true, rotulo: 'Histórico por pessoa' },
        ].map((aba) => (
          <button
            key={aba.rotulo}
            onClick={() => setParams(aba.id ? { mes, ver: 'historico' } : { mes })}
            className={cx(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              historico === aba.id ? 'border-marca-600 text-marca-700' : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      {historico ? (
        <>
          <div className="mb-3 flex justify-end">
            <SeletorTolerancia />
          </div>
          <HistoricoOcorrencias />
        </>
      ) : (
      <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Botao variante="fantasma" className="px-2" onClick={() => mudar(-1)} aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </Botao>
          <span className="min-w-40 text-center font-medium">{nomeMes(mes)}</span>
          <Botao variante="fantasma" className="px-2" onClick={() => mudar(1)} aria-label="Próximo mês">
            <ChevronRight size={18} />
          </Botao>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="secundario" onClick={imprimir}>
            <Printer size={16} /> Imprimir folha
          </Botao>
          <EnviarArquivos onArquivos={enviarFolha} className="px-3 py-2 text-sm">
            Enviar folha assinada
          </EnviarArquivos>
        </div>
      </div>

      {!temCartao && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O cartão ponto de {nomeMes(mes).toLowerCase()} ainda não foi importado: a lista mostra só o que foi lançado à mão em{' '}
          <Link to={`/ausencias?mes=${mes}`} className="underline">Faltas e bônus</Link>.{' '}
          <Link to="/ponto" className="underline">Importar cartão ponto</Link>
        </p>
      )}

      <Cartao className="mb-4 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
          Folha assinada
          {folhas.length ? <Selo cor="verde">Guardada</Selo> : <Selo cor={ocorrencias.length ? 'amarelo' : 'cinza'}>Falta</Selo>}
        </div>
        {folhas.length === 0 ? (
          <p className="text-sm text-gray-500">Depois que todos assinarem, tire foto da folha (pode ser mais de uma página) e envie pelo botão acima.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {folhas.map((x) => (
              <li key={x.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <FileText size={15} className="shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">
                  {x.titulo}
                  <span className="ml-2 text-xs text-gray-400">
                    enviada em {dataBR(x.enviadoEm)} · {tamanhoTexto(x.tamanho)}
                  </span>
                </span>
                <Botao variante="fantasma" className="px-1.5 py-1" onClick={() => abrirDocumento(x.caminho, x.nomeArquivo)} title="Ver">
                  <Eye size={15} />
                </Botao>
                <Botao variante="fantasma" className="px-1.5 py-1" aria-label="Excluir" onClick={() => confirm(`Excluir "${x.titulo}"?`) && excluirDocumento(x)}>
                  <Trash2 size={14} />
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <span className="font-semibold">Ocorrências do mês</span>
          <SeletorTolerancia />
        </div>
        {(ocorrencias.length > 0 || menores > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
            <span>
              {ocorrencias.length} ocorrência(s) · {comMotivo} com motivo digitado
            </span>
            {menores > 0 && (
              <button className="text-marca-700 underline" onClick={() => setVerMenores(!verMenores)}>
                {verMenores ? `Esconder as ${menores} de até ${tolerancia} min` : `${menores} atraso(s)/saída(s) de até ${tolerancia} min não aparecem · mostrar`}
              </button>
            )}
          </div>
        )}
        {!carregando && ocorrencias.length === 0 && <Vazio>Nenhuma falta, atraso ou saída antecipada neste mês.</Vazio>}
        <ul className="divide-y divide-gray-100">
          {ocorrencias.map((o) => (
            <li key={o.id} className="grid gap-2 px-4 py-3 md:grid-cols-[4rem_1fr_1fr_1.4fr] md:items-center">
              <span className="text-sm font-medium">{format(d(o.data), 'dd/MM')}</span>
              <Link to={`/funcionarios/${o.funcionarioId}`} className="text-sm font-medium hover:underline">
                {nome(o.funcionarioId)}
              </Link>
              <div className="text-sm">
                {textoOcorrencia(o)}
                <div className="text-xs text-gray-500">
                  {o.batidas?.length ? `Batidas: ${o.batidas.map(hhmm).join(' ')}` : o.origem === 'manual' ? 'Lançada à mão' : ''}
                </div>
              </div>
              <Motivo o={o} j={just(o)} />
            </li>
          ))}
        </ul>
      </Cartao>
      <p className="mt-3 text-xs text-gray-500">
        Os motivos digitados aqui já saem impressos na folha; os que ficarem em branco, a pessoa escreve à mão. Atestados, férias e licenças não entram na folha.
        "Atraso" e "saída antecipada" são deduzidos comparando as batidas com o horário habitual da pessoa no mês.
        Atraso compensado no mesmo dia não aparece; se a compensação foi parcial, aparece só o tempo que ficou faltando.
        Faltas sempre aparecem; atrasos e saídas só quando passam do tempo escolhido (o bônus por assiduidade continua contando tudo).
      </p>
      </>
      )}
    </>
  )
}
