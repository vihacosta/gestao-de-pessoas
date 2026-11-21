import { addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Download, FileUp, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao, Cabecalho, Cartao, Selecao, Selo, Vazio, Oculto } from '../components/ui'
import { apagarArquivo, baixarArquivo, enviarArquivo, salvarNoComputador } from '../lib/arquivos'
import { bonusDoMes, horasTexto } from '../lib/bonus'
import { lerCartoes, somaExtras, somaFaltas, type ArquivoPontoLido, type CartaoLido } from '../lib/cartaoPonto'
import { brl, d } from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import type { Justificativa } from '../lib/justificativas'
import { lerTextoPdf, separarPaginas } from '../lib/pdf'
import { novoId, remover, salvar, useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, DocumentoGuardado, Funcionario } from '../lib/types'
import { useConfig } from './Configuracoes'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const digitos = (s: string) => s.replace(/\D/g, '')
const nomeMes = (m: string) => {
  const t = format(d(`${m}-01`), "MMMM 'de' yyyy", { locale: ptBR })
  return t[0].toUpperCase() + t.slice(1)
}
const hm = (min: number) => `${min < 0 ? '-' : ''}${horasTexto(Math.abs(min) / 60)}`
const nomeProprio = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((p) => (['da', 'de', 'do', 'das', 'dos', 'e'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
const mascaraCPF = (c: string) => (c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c)

export function encontrarFuncionario(c: { cpf: string; nome: string }, funcionarios: Funcionario[]) {
  if (c.cpf) {
    const porCpf = funcionarios.find((f) => digitos(f.cpf) === c.cpf)
    if (porCpf) return porCpf
  }
  return funcionarios.find((f) => semAcento(f.nome) === semAcento(c.nome))
}

export default function CartaoPontoPage() {
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const { rows: justificativas } = useTabela<Justificativa>('justificativas')
  const config = useConfig()

  const [arquivo, setArquivo] = useState<{ nome: string; buf: ArrayBuffer } | null>(null)
  const [lido, setLido] = useState<ArquivoPontoLido | null>(null)
  const [vinculos, setVinculos] = useState<Record<number, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [salvoMsg, setSalvoMsg] = useState<string | null>(null)

  async function escolher(f: File | null) {
    setErro(null)
    setLido(null)
    setSalvoMsg(null)
    if (!f) return
    setOcupado('Lendo o cartão ponto…')
    try {
      const buf = await f.arrayBuffer()
      const r = lerCartoes(await lerTextoPdf(buf))
      if (!r.cartoes.length) throw new Error('Nenhum funcionário encontrado no arquivo.')
      setArquivo({ nome: f.name, buf })
      setLido(r)
      setVinculos(Object.fromEntries(r.cartoes.map((c, i) => [i, encontrarFuncionario(c, funcionarios)?.id ?? ''])))
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
    setOcupado(null)
  }

  async function cadastrar(i: number, c: CartaoLido) {
    const f: Funcionario = {
      id: novoId(),
      nome: nomeProprio(c.nome),
      cpf: mascaraCPF(c.cpf),
      pis: c.pis,
      ctps: c.ctps,
      cargo: '',
      tipo: 'clt',
      dataAdmissao: c.admissao ?? hojeISO(),
      salarios: [],
      observacoes: 'Cadastrado a partir do cartão ponto: completar cargo, salário e demais dados.',
    }
    await salvar('funcionarios', f)
    setVinculos((v) => ({ ...v, [i]: f.id }))
  }

  async function salvarTudo() {
    if (!lido || !arquivo) return
    setOcupado('Separando e salvando…')
    setErro(null)
    try {
      let n = 0
      for (const [i, c] of lido.cartoes.entries()) {
        const fid = vinculos[i]
        if (!fid) continue
        const caminho = `ponto/${lido.mes}/${fid}.pdf`
        await enviarArquivo(caminho, await separarPaginas(arquivo.buf, c.paginas))
        const anterior = pontos.find((p) => p.id === `${fid}-${lido.mes}`)
        await salvar<CartaoPontoSalvo>('pontos', {
          id: `${fid}-${lido.mes}`,
          funcionarioId: fid,
          mes: lido.mes,
          nomeNoCartao: c.nome,
          dias: c.dias,
          saldoAnterior: c.saldoAnterior,
          saldoTotal: c.saldoTotal,
          caminho,
          caminhoAssinado: anterior?.caminhoAssinado,
          importadoEm: hojeISO(),
        })
        n++
      }
      await enviarArquivo(`ponto/${lido.mes}/completo.pdf`, new Blob([arquivo.buf], { type: 'application/pdf' }))
      setSalvoMsg(`${n} cartões de ${nomeMes(lido.mes)} salvos, um em cada funcionário.`)
      setLido(null)
      setArquivo(null)
    } catch (e) {
      setErro('Não foi possível salvar: ' + String((e as Error).message ?? e))
    }
    setOcupado(null)
  }

  const meses = useMemo(() => [...new Set(pontos.map((p) => p.mes))].sort().reverse(), [pontos])

  return (
    <>
      <Cabecalho titulo="Cartão ponto" subtitulo="Envie o PDF do mês: o sistema separa por funcionário e calcula o bônus por assiduidade" />

      <Cartao className="mb-4 p-5">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-marca-500 hover:bg-marca-50">
          <FileUp className="text-marca-600" />
          <span className="font-medium">Escolher o PDF do cartão ponto</span>
          <span className="text-xs text-gray-500">O arquivo "Cartão Ponto" do mês, exportado do sistema de ponto, com todos os funcionários</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => escolher(e.target.files?.[0] ?? null)} onClick={(e) => ((e.target as HTMLInputElement).value = '')} />
        </label>
        {ocupado && <p className="mt-3 text-sm text-gray-600">{ocupado}</p>}
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        {salvoMsg && <p className="mt-3 text-sm text-green-700">{salvoMsg}</p>}
      </Cartao>

      {lido && (
        <Cartao className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div>
              <div className="font-semibold">{nomeMes(lido.mes)}</div>
              <div className="text-xs text-gray-500">
                {arquivo?.nome} · {lido.cartoes.length} funcionários
              </div>
            </div>
            <Botao onClick={salvarTudo} disabled={!!ocupado || !Object.values(vinculos).some(Boolean)}>
              Salvar e separar por funcionário
            </Botao>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">No cartão</th>
                  <th className="px-3 py-2 font-medium">Funcionário no sistema</th>
                  <th className="px-3 py-2 font-medium">Faltas/atrasos</th>
                  <th className="px-3 py-2 font-medium">Extras</th>
                  <th className="px-3 py-2 font-medium">Banco</th>
                  <th className="px-3 py-2 font-medium">Bônus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lido.cartoes.map((c, i) => {
                  const f = funcionarios.find((x) => x.id === vinculos[i])
                  const jaTem = f && pontos.some((p) => p.id === `${f.id}-${lido.mes}`)
                  const b = f
                    ? bonusDoMes(f, ausencias, lido.mes, config, {
                        id: '',
                        funcionarioId: f.id,
                        mes: lido.mes,
                        nomeNoCartao: c.nome,
                        dias: c.dias,
                        saldoAnterior: c.saldoAnterior,
                        saldoTotal: c.saldoTotal,
                        caminho: '',
                        importadoEm: '',
                      }, justificativas)
                    : null
                  return (
                    <tr key={i} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.nome}</div>
                        <div className="text-xs text-gray-500">{c.cpf ? `CPF ${mascaraCPF(c.cpf)}` : 'sem CPF'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Selecao value={vinculos[i] ?? ''} onChange={(e) => setVinculos({ ...vinculos, [i]: e.target.value })} className="min-w-44">
                          <option value="">— não salvar —</option>
                          {funcionarios
                            .sort((a, b2) => a.nome.localeCompare(b2.nome))
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.nome}
                              </option>
                            ))}
                        </Selecao>
                        {!f && (
                          <button className="mt-1 flex items-center gap-1 text-xs text-marca-600 underline" onClick={() => cadastrar(i, c)}>
                            <UserPlus size={12} /> Cadastrar com os dados do cartão
                          </button>
                        )}
                        {jaTem && <div className="mt-1 text-xs text-amber-700">Já importado neste mês: será substituído</div>}
                      </td>
                      <td className="px-3 py-3">{hm(somaFaltas(c))}</td>
                      <td className="px-3 py-3">{hm(somaExtras(c))}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {hm(c.saldoAnterior)} → <b>{hm(c.saldoTotal)}</b>
                      </td>
                      <td className="px-3 py-3">
                        {!b ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <>
                            {b.status === 'recebe' ? <Selo cor="verde">Recebe <Oculto>{brl(b.valor)}</Oculto></Selo> : b.status === 'experiencia' ? <Selo cor="cinza">Em experiência</Selo> : b.status === 'fora' ? <Selo cor="cinza">Fora do período</Selo> : <Selo cor="vermelho">Não recebe</Selo>}
                            <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                              {b.motivos.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                              {b.avisos.map((m) => (
                                <li key={m} className="flex gap-1 text-amber-700">
                                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                  {m}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      <h2 className="mb-2 font-semibold">Meses importados</h2>
      {meses.length === 0 && (
        <Cartao>
          <Vazio>Nenhum cartão ponto importado ainda.</Vazio>
        </Cartao>
      )}
      <div className="space-y-3">
        {meses.map((m) => (
          <MesImportado key={m} mes={m} pontos={pontos.filter((p) => p.mes === m)} funcionarios={funcionarios} />
        ))}
      </div>
    </>
  )
}

function MesImportado({ mes, pontos, funcionarios }: { mes: string; pontos: CartaoPontoSalvo[]; funcionarios: Funcionario[] }) {
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const assinado = (fid: string) => documentos.some((x) => x.funcionarioId === fid && x.categoria === 'ponto_assinado' && x.mes === mes)
  const nome = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '(funcionário excluído)'
  const proximo = format(addMonths(d(`${mes}-01`), 0), 'yyyy-MM')

  async function baixar(p: CartaoPontoSalvo) {
    salvarNoComputador(await baixarArquivo(p.caminho), `Cartão ponto ${mes} - ${nome(p.funcionarioId)}.pdf`)
  }
  async function excluirMes() {
    if (!confirm(`Excluir os cartões ponto de ${nomeMes(mes)}? O bônus do mês volta a ser calculado pelas ocorrências registradas à mão.`)) return
    for (const p of pontos) {
      await apagarArquivo(p.caminho).catch(() => {})
      await remover('pontos', p.id)
    }
  }

  return (
    <Cartao>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <span className="font-medium">{nomeMes(mes)}</span>
        <div className="flex items-center gap-1">
          <Link to={`/ausencias?aba=bonus&mes=${proximo}`} className="text-sm text-marca-600 underline">
            Ver bônus
          </Link>
          <Botao variante="fantasma" className="px-2 py-1" onClick={excluirMes} aria-label="Excluir mês">
            <Trash2 size={14} />
          </Botao>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {pontos
          .sort((a, b) => nome(a.funcionarioId).localeCompare(nome(b.funcionarioId)))
          .map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="flex-1">{nome(p.funcionarioId)}</span>
              <span className="text-xs text-gray-500">banco {hm(p.saldoTotal)}</span>
              {assinado(p.funcionarioId) ? <Selo cor="verde">assinado</Selo> : <Link to={`/holerites?mes=${mes}`}><Selo cor="amarelo">falta o assinado</Selo></Link>}
              <Botao variante="fantasma" className="px-2 py-1" onClick={() => baixar(p)} title="Baixar o PDF deste funcionário">
                <Download size={14} />
              </Botao>
            </li>
          ))}
      </ul>
    </Cartao>
  )
}
