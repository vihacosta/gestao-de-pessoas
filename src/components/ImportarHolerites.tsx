import { endOfMonth } from 'date-fns'
import { AlertTriangle, FileUp } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../auth'
import { brl, d, iso, salarioEm } from '../lib/clt'
import { guardarDocumento } from '../lib/documentos'
import { lerHolerites, type HoleriteLido } from '../lib/holerite'
import { lerTextoPdf, separarPaginas } from '../lib/pdf'
import { salvar, useTabela } from '../lib/store'
import type { DocumentoGuardado, Funcionario } from '../lib/types'
import { encontrarFuncionario } from '../pages/CartaoPonto'
import { Botao, Cartao, Selecao, Oculto } from './ui'

const mesBR = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`
const tituloDe = (h: HoleriteLido) => `Holerite ${h.tipo.toLowerCase() === 'mensal' ? '' : h.tipo.toLowerCase() + ' '}${mesBR(h.mes)}`

/**
 * Importa o PDF de holerites da contabilidade: separa por funcionário (pelo CPF),
 * guarda cada um na ficha e confere o salário com o cadastro.
 */
export function ImportarHolerites({ onMes }: { onMes: (mes: string) => void }) {
  const { pode, podeAlterar } = useAuth()
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const [arquivo, setArquivo] = useState<{ nome: string; buf: ArrayBuffer } | null>(null)
  const [lidos, setLidos] = useState<HoleriteLido[] | null>(null)
  const [vinculos, setVinculos] = useState<Record<number, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function escolher(f: File | null) {
    setErro(null)
    setMsg(null)
    setLidos(null)
    if (!f) return
    setOcupado('Lendo os holerites…')
    try {
      const buf = await f.arrayBuffer()
      const r = lerHolerites(await lerTextoPdf(buf))
      setArquivo({ nome: f.name, buf })
      setLidos(r)
      setVinculos(Object.fromEntries(r.map((h, i) => [i, encontrarFuncionario(h, funcionarios)?.id ?? ''])))
      onMes(r[0].mes)
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
    setOcupado(null)
  }

  async function atualizarSalario(f: Funcionario, h: HoleriteLido) {
    if (h.salario == null) return
    if (!confirm(`Registrar salário de ${brl(h.salario)} para ${f.nome} a partir de ${mesBR(h.mes)}?`)) return
    const salarios = [...f.salarios.filter((s) => s.data !== `${h.mes}-01`), { data: `${h.mes}-01`, valor: h.salario, motivo: `Conforme holerite de ${mesBR(h.mes)}` }]
    await salvar('funcionarios', { ...f, salarios: salarios.sort((a, b) => a.data.localeCompare(b.data)) })
  }

  async function salvarTudo() {
    if (!lidos || !arquivo) return
    setOcupado('Separando e salvando…')
    setErro(null)
    try {
      let n = 0
      for (const [i, h] of lidos.entries()) {
        const fid = vinculos[i]
        if (!fid) continue
        const titulo = tituloDe(h)
        const pdf = await separarPaginas(arquivo.buf, h.paginas)
        const substitui = documentos.find((x) => x.funcionarioId === fid && x.categoria === 'holerite_original' && x.mes === h.mes && x.titulo === titulo)
        const { paginas: _p, nome: _n, cpf: _c, ...dados } = h
        await guardarDocumento({
          funcionarioId: fid,
          categoria: 'holerite_original',
          mes: h.mes,
          titulo,
          arquivos: [new File([pdf], `${titulo}.pdf`, { type: 'application/pdf' })],
          substitui,
          holerite: dados,
        })
        n++
      }
      setMsg(`${n} holerite(s) guardado(s), um na ficha de cada colaborador.`)
      setLidos(null)
      setArquivo(null)
    } catch (e) {
      setErro('Não foi possível salvar: ' + String((e as Error).message ?? e))
    }
    setOcupado(null)
  }

  return (
    <Cartao className="mb-4 p-4">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-4 hover:border-marca-500 hover:bg-marca-50">
        <FileUp className="shrink-0 text-marca-600" />
        <span>
          <span className="block font-medium">Importar o PDF de holerites da contabilidade</span>
          <span className="text-xs text-gray-500">Separa por colaborador pelo CPF, guarda na ficha de cada um e confere o salário com o cadastro</span>
        </span>
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => escolher(e.target.files?.[0] ?? null)} onClick={(e) => ((e.target as HTMLInputElement).value = '')} />
      </label>
      {ocupado && <p className="mt-3 text-sm text-gray-600">{ocupado}</p>}
      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}

      {lidos && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-600">
              {arquivo?.nome} · {lidos.length} holerite(s) de {mesBR(lidos[0].mes)}
            </span>
            <Botao onClick={salvarTudo} disabled={!!ocupado || !Object.values(vinculos).some(Boolean)}>
              Salvar e separar por colaborador
            </Botao>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">No holerite</th>
                  <th className="px-3 py-2 font-medium">Colaborador no sistema</th>
                  <th className="px-3 py-2 font-medium">Salário</th>
                  <th className="px-3 py-2 font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lidos.map((h, i) => {
                  const f = funcionarios.find((x) => x.id === vinculos[i])
                  const fimMes = iso(endOfMonth(d(`${h.mes}-01`)))
                  const noCadastro = f ? salarioEm(f, fimMes) : 0
                  // Sem acesso a valores o cadastro vem sem salário: não dá para comparar
                  const salarioDifere = f && pode('valores') && h.salario != null && Math.abs(noCadastro - h.salario) > 0.009
                  const jaTem = f && documentos.some((x) => x.funcionarioId === f.id && x.categoria === 'holerite_original' && x.mes === h.mes && x.titulo === tituloDe(h))
                  return (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{h.nome}</div>
                        <div className="text-xs text-gray-500">{h.tipo}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Selecao value={vinculos[i] ?? ''} onChange={(e) => setVinculos({ ...vinculos, [i]: e.target.value })} className="min-w-44">
                          <option value="">— não salvar —</option>
                          {[...funcionarios]
                            .sort((a, b) => a.nome.localeCompare(b.nome))
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.nome}
                              </option>
                            ))}
                        </Selecao>
                        {!f && <div className="mt-1 text-xs text-gray-500">Não encontrado no cadastro (pelo CPF ou nome)</div>}
                        {jaTem && <div className="mt-1 text-xs text-amber-700">Já importado neste mês: será substituído</div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {h.salario != null ? <Oculto>{brl(h.salario)}</Oculto> : '—'}
                        {salarioDifere && (
                          <div className="mt-1 flex flex-col gap-0.5 text-xs text-amber-700">
                            <span className="flex items-center gap-1">
                              <AlertTriangle size={12} /> cadastro: {noCadastro ? <Oculto>{brl(noCadastro)}</Oculto> : 'sem salário'}
                            </span>
                            {podeAlterar('valores') && podeAlterar('funcionarios') && (
                              <button className="text-left text-marca-600 underline" onClick={() => atualizarSalario(f!, h)}>
                                Atualizar cadastro
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.liquido != null ? <Oculto>{brl(h.liquido)}</Oculto> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Cartao>
  )
}
