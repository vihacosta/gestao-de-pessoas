import { addMonths, format } from 'date-fns'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { FolhaMes } from '../components/FolhaMes'
import { Botao, Cabecalho, Cartao, Selo, Vazio } from '../components/ui'
import { baixarArquivo, salvarNoComputador } from '../lib/arquivos'
import { d } from '../lib/clt'
import { gerarPacote, montarFechamento, type GrupoPendencia, type ItemPacote } from '../lib/fechamento'
import type { Justificativa } from '../lib/justificativas'
import { useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, DocumentoGuardado, Funcionario } from '../lib/types'
import { nomesTipo } from './Ausencias'
import { useConfig } from './Configuracoes'
import { ativosNoMes, mesAnterior, nomeMes } from './Holerites'

const GRUPOS: { id: GrupoPendencia; rotulo: string; acao: string; link: (mes: string) => string }[] = [
  { id: 'holerite', rotulo: 'Holerites assinados', acao: 'Enviar holerites', link: (m) => `/holerites?mes=${m}` },
  { id: 'ponto', rotulo: 'Cartões ponto assinados', acao: 'Enviar cartões', link: (m) => `/holerites?mes=${m}` },
  { id: 'comprovante', rotulo: 'Atestados e licenças', acao: 'Abrir ausências', link: (m) => `/ausencias?mes=${m}` },
  { id: 'justificativas', rotulo: 'Folha de justificativas', acao: 'Abrir ocorrências', link: (m) => `/ponto/ocorrencias?mes=${m}` },
]

export default function Fechamento() {
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? mesAnterior()
  const mudar = (n: number) => {
    setFalhas([])
    setPronto(false)
    setErro('')
    setParams({ mes: format(addMonths(d(`${mes}-01`), n), 'yyyy-MM') })
  }
  const { rows: funcionarios, carregando } = useTabela<Funcionario>('funcionarios')
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const { rows: justificativas } = useTabela<Justificativa>('justificativas')
  const tolerancia = useConfig().toleranciaJustificativa ?? 0
  const verValores = useAuth().pode('valores')
  const ativos = useMemo(() => ativosNoMes(funcionarios, mes), [funcionarios, mes])

  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null)
  const [falhas, setFalhas] = useState<ItemPacote[]>([])
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')

  const f = useMemo(
    () => montarFechamento({ mes, ativos, funcionarios, documentos, ausencias, pontos, justificativas, tolerancia, nomesTipo }),
    [mes, ativos, funcionarios, documentos, ausencias, pontos, justificativas, tolerancia],
  )
  const total = f.linhas.length
  const contagem: Record<GrupoPendencia, string> = {
    holerite: `${f.linhas.filter((l) => l.holerite).length} de ${total}`,
    ponto: `${f.linhas.filter((l) => l.ponto).length} de ${total}`,
    comprovante: `${f.itens.filter((i) => i.pasta.startsWith('3')).length} no pacote`,
    justificativas: f.folhasJustificativa ? 'Guardada' : f.ocorrencias ? 'Falta' : 'Sem ocorrências',
  }

  async function baixarPacote() {
    setFalhas([])
    setPronto(false)
    setErro('')
    setProgresso({ feitos: 0, total: f.itens.length })
    try {
      const r = await gerarPacote(f, nomeMes(mes), baixarArquivo, (feitos, t) => setProgresso({ feitos, total: t }))
      salvarNoComputador(r.zip, `Fechamento ${mes}.zip`)
      setFalhas(r.falhas)
      setPronto(true)
    } catch (e) {
      setErro(`Não consegui gerar o pacote: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProgresso(null)
    }
  }

  return (
    <>
      <Cabecalho titulo="Fechamento mensal" subtitulo="Confira os documentos e a folha do mês e baixe o pacote para enviar à contabilidade" />

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
        <Botao onClick={baixarPacote} disabled={!!progresso || carregando || f.itens.length === 0}>
          {progresso ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {progresso ? `Preparando ${progresso.feitos} de ${progresso.total}…` : `Baixar pacote (${f.itens.length} ${f.itens.length === 1 ? 'arquivo' : 'arquivos'})`}
        </Botao>
      </div>

      {erro && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}
      {falhas.length > 0 && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">O pacote foi baixado sem {falhas.length === 1 ? 'este arquivo' : `estes ${falhas.length} arquivos`}, que não abriram. Tente de novo antes de enviar:</p>
          <ul className="mt-1 list-inside list-disc">
            {falhas.map((x) => (
              <li key={`${x.pasta}/${x.nome}`}>{x.pasta}: {x.nome}</li>
            ))}
          </ul>
        </div>
      )}
      {pronto && !falhas.length && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} /> Pacote baixado{f.pendencias.length ? ', com as pendências listadas na planilha de resumo.' : ' e completo.'}
        </p>
      )}

      {!carregando && total === 0 ? (
        <Cartao>
          <Vazio>Nenhum funcionário neste mês.</Vazio>
        </Cartao>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {GRUPOS.map((g) => {
            const lista = f.pendencias.filter((p) => p.grupo === g.id)
            return (
              <Cartao key={g.id}>
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                  <span className="font-semibold">{g.rotulo}</span>
                  <Selo cor={lista.length ? 'amarelo' : 'verde'}>{contagem[g.id]}</Selo>
                </div>
                {lista.length === 0 ? (
                  <p className="flex items-center gap-2 px-4 py-3 text-sm text-green-700">
                    <CheckCircle2 size={15} /> Nada pendente
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-100 text-sm">
                      {lista.map((p) => (
                        <li key={p.texto} className="flex items-start gap-2 px-4 py-2 text-gray-700">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                          {p.funcionarioId ? <Link to={`/funcionarios/${p.funcionarioId}`} className="hover:underline">{p.texto}</Link> : p.texto}
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-gray-100 px-4 py-2">
                      <Link to={g.link(mes)} className="text-sm font-medium text-marca-600 hover:underline">
                        {g.acao}
                      </Link>
                    </div>
                  </>
                )}
              </Cartao>
            )
          })}
        </div>
      )}

      {verValores && !carregando && <FolhaMes mes={mes} tituloMes={nomeMes(mes)} ativos={ativos} />}

      <p className="mt-3 text-xs text-gray-500">
        O pacote traz uma pasta para cada tipo de documento e uma planilha de resumo, sem salários. Você pode baixar mesmo com pendências. O envio à contabilidade é feito por você.
      </p>
    </>
  )
}
