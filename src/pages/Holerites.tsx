import { addMonths, endOfMonth, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Eye, FileText, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EnviarArquivos } from '../components/EnviarArquivos'
import { ImportarHolerites } from '../components/ImportarHolerites'
import { SepararDigitalizados } from '../components/SepararDigitalizados'
import { Botao, Cabecalho, Cartao, Selo, Vazio } from '../components/ui'
import { d, iso } from '../lib/clt'
import { abrirDocumento, excluirDocumento, guardarDocumento, nomesCategoria } from '../lib/documentos'
import { hojeISO } from '../lib/hoje'
import { useTabela } from '../lib/store'
import type { CartaoPontoSalvo, CategoriaDocumento, DocumentoGuardado, Funcionario } from '../lib/types'

export const nomeMes = (m: string) => {
  const t = format(d(`${m}-01`), "MMMM 'de' yyyy", { locale: ptBR })
  return t[0].toUpperCase() + t.slice(1)
}

/** Mês anterior ao atual: é o mês dos holerites e pontos que estão sendo assinados agora */
export const mesAnterior = () => format(addMonths(d(hojeISO()), -1), 'yyyy-MM')

/** Funcionários que trabalharam em algum dia do mês e têm holerite e ponto (sócios não têm) */
export function ativosNoMes(funcionarios: Funcionario[], mes: string) {
  const ini = `${mes}-01`
  const fim = iso(endOfMonth(d(ini)))
  return funcionarios.filter((f) => f.tipo !== 'socio' && f.dataAdmissao <= fim && (!f.dataDemissao || f.dataDemissao >= ini))
}

/** Quantos holerites/pontos assinados faltam no mês */
export function pendenciasAssinatura(funcionarios: Funcionario[], documentos: DocumentoGuardado[], mes: string) {
  const ativos = ativosNoMes(funcionarios, mes)
  const tem = (fid: string, cat: CategoriaDocumento) => documentos.some((x) => x.funcionarioId === fid && x.categoria === cat && x.mes === mes)
  return {
    holerites: ativos.filter((f) => !tem(f.id, 'holerite')).length,
    pontos: ativos.filter((f) => !tem(f.id, 'ponto_assinado')).length,
    total: ativos.length,
  }
}

function Celula({ f, mes, categoria, doc }: { f: Funcionario; mes: string; categoria: CategoriaDocumento; doc?: DocumentoGuardado }) {
  const enviar = (arquivos: File[]) =>
    guardarDocumento({ funcionarioId: f.id, categoria, mes, arquivos, titulo: `${nomesCategoria[categoria]} ${mes.slice(5)}/${mes.slice(0, 4)}`, substitui: doc }).then(() => {})

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {doc ? (
        <>
          <Selo cor="verde">Guardado</Selo>
          <Botao variante="fantasma" className="px-1.5 py-1" onClick={() => abrirDocumento(doc.caminho, doc.nomeArquivo)} title="Ver">
            <Eye size={15} />
          </Botao>
          <EnviarArquivos onArquivos={enviar} titulo="Substituir por outro arquivo">
            Trocar
          </EnviarArquivos>
          <Botao
            variante="fantasma"
            className="px-1.5 py-1"
            aria-label="Excluir"
            onClick={() => confirm(`Excluir o ${nomesCategoria[categoria].toLowerCase()} de ${f.nome}?`) && excluirDocumento(doc)}
          >
            <Trash2 size={14} />
          </Botao>
        </>
      ) : (
        <>
          <Selo cor="amarelo">Falta</Selo>
          <EnviarArquivos onArquivos={enviar}>Enviar</EnviarArquivos>
        </>
      )}
    </div>
  )
}

export default function Holerites() {
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? mesAnterior()
  const setMes = (m: string) => setParams({ mes: m })
  const { rows: funcionarios, carregando } = useTabela<Funcionario>('funcionarios')
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')

  const lista = useMemo(() => ativosNoMes(funcionarios, mes).sort((a, b) => a.nome.localeCompare(b.nome)), [funcionarios, mes])
  const doc = (fid: string, cat: CategoriaDocumento) => documentos.find((x) => x.funcionarioId === fid && x.categoria === cat && x.mes === mes)
  const pend = pendenciasAssinatura(funcionarios, documentos, mes)
  const mudar = (n: number) => setMes(format(addMonths(d(`${mes}-01`), n), 'yyyy-MM'))

  return (
    <>
      <Cabecalho titulo="Holerites e cartões assinados" subtitulo="Guarde a foto ou o PDF de cada documento assinado, por funcionário e por mês" />

      <ImportarHolerites onMes={setMes} />
      <SepararDigitalizados />

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
        <div className="flex gap-2 text-sm">
          <Selo cor={pend.holerites ? 'amarelo' : 'verde'}>
            Holerites: {pend.total - pend.holerites}/{pend.total}
          </Selo>
          <Selo cor={pend.pontos ? 'amarelo' : 'verde'}>
            Cartões ponto: {pend.total - pend.pontos}/{pend.total}
          </Selo>
        </div>
      </div>

      <Cartao>
        {!carregando && lista.length === 0 && <Vazio>Nenhum funcionário neste mês.</Vazio>}
        {/* computador: tabela */}
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Funcionário</th>
              <th className="px-3 py-2 font-medium">Holerite assinado</th>
              <th className="px-3 py-2 font-medium">Cartão ponto assinado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map((f) => {
              const ponto = pontos.find((p) => p.funcionarioId === f.id && p.mes === mes)
              return (
                <tr key={f.id}>
                  <td className="px-4 py-3">
                    <Link to={`/funcionarios/${f.id}`} className="font-medium hover:underline">
                      {f.nome}
                    </Link>
                    {documentos
                      .filter((x) => x.funcionarioId === f.id && x.categoria === 'holerite_original' && x.mes === mes)
                      .map((x) => (
                        <button key={x.id} className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 hover:underline" onClick={() => abrirDocumento(x.caminho, x.nomeArquivo)}>
                          <FileText size={12} /> {x.titulo.toLowerCase()} da contabilidade (sem assinatura)
                        </button>
                      ))}
                    {ponto && (
                      <button className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 hover:underline" onClick={() => abrirDocumento(ponto.caminho)}>
                        <FileText size={12} /> cartão do sistema (sem assinatura)
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Celula f={f} mes={mes} categoria="holerite" doc={doc(f.id, 'holerite')} />
                  </td>
                  <td className="px-3 py-3">
                    <Celula f={f} mes={mes} categoria="ponto_assinado" doc={doc(f.id, 'ponto_assinado')} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* celular: cartões */}
        <ul className="divide-y divide-gray-100 md:hidden">
          {lista.map((f) => (
            <li key={f.id} className="space-y-2 px-4 py-3">
              <Link to={`/funcionarios/${f.id}`} className="font-medium">
                {f.nome}
              </Link>
              {documentos
                .filter((x) => x.funcionarioId === f.id && x.categoria === 'holerite_original' && x.mes === mes)
                .map((x) => (
                  <button key={x.id} className="flex items-center gap-1 text-xs text-gray-500 underline" onClick={() => abrirDocumento(x.caminho, x.nomeArquivo)}>
                    <FileText size={12} /> {x.titulo} da contabilidade
                  </button>
                ))}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-600">Holerite</span>
                <Celula f={f} mes={mes} categoria="holerite" doc={doc(f.id, 'holerite')} />
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-600">Cartão ponto</span>
                <Celula f={f} mes={mes} categoria="ponto_assinado" doc={doc(f.id, 'ponto_assinado')} />
              </div>
            </li>
          ))}
        </ul>
      </Cartao>
      <p className="mt-3 text-xs text-gray-500">
        Pode enviar várias fotos de uma vez (por exemplo, frente e verso): elas são juntadas num único PDF. No celular, o botão abre a câmera.
      </p>
    </>
  )
}
