import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { conferirAtivos, diaMes, lerDataBR, linhasDosAtivos, type Conferencia, type LinhaAtivos } from '../lib/aniversarios'
import { dataBR } from '../lib/clt'
import { lerXlsx } from '../lib/historicoPlanilha'
import { salvar, useTabela } from '../lib/store'
import type { Funcionario } from '../lib/types'
import { Botao, Entrada, Modal, Selo } from './ui'

/**
 * Confere os ativos do sistema com a planilha "RELAÇÃO DE FUNCIONÁRIOS ATIVOS.xlsx":
 * quem está sem data de nascimento e quem tem admissão diferente. Nada é gravado sem clicar.
 */
export function ConferirPlanilhaAtivos() {
  const [aberto, setAberto] = useState(false)
  const [linhas, setLinhas] = useState<LinhaAtivos[] | null>(null)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')

  async function ler(arquivo?: File) {
    if (!arquivo) return
    setLendo(true)
    setErro(null)
    try {
      const lidas = linhasDosAtivos(lerXlsx(await arquivo.arrayBuffer()))
      if (!lidas.length) throw new Error('Não encontrei a aba FUNCIONARIOS ATIVOS com a coluna FUNCIONÁRIO nesta planilha.')
      setLinhas(lidas)
    } catch (e) {
      setErro(String((e as Error).message ?? e))
    }
    setLendo(false)
    if (ref.current) ref.current.value = ''
  }

  const r = linhas ? conferirAtivos(funcionarios, linhas) : null

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        <FileSpreadsheet size={16} /> Conferir com a planilha
      </Botao>
      <Modal titulo="Conferir com a planilha de ativos" aberto={aberto} onFechar={() => setAberto(false)} largura="max-w-3xl">
        <div className="space-y-4 p-5 text-sm">
          {!r ? (
            <>
              <p className="text-gray-600">
                Envie a planilha <b>RELAÇÃO DE FUNCIONÁRIOS ATIVOS.xlsx</b>. O sistema compara a aba FUNCIONARIOS ATIVOS (ANIVERSÁRIO e DATA ADMISSÃO) com o cadastro e mostra quem está
                sem data de nascimento ou com admissão diferente. Nada muda no cadastro até você clicar em salvar.
              </p>
              <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={(e) => ler(e.target.files?.[0])} />
              <Botao onClick={() => ref.current?.click()} disabled={lendo}>
                {lendo ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Escolher planilha
              </Botao>
              {erro && <p className="text-red-600">{erro}</p>}
            </>
          ) : (
            <>
              {r.itens.length === 0 ? (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-green-800">Tudo certo: todos os ativos têm data de nascimento e a admissão bate com a planilha.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {r.itens.map((c) => (
                    <ItemConferencia key={c.f.id} c={c} />
                  ))}
                </ul>
              )}
              {r.foraDoSistema.length > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  <div className="font-medium">Ativos na planilha que não encontrei no sistema:</div>
                  <ul className="list-inside list-disc">
                    {r.foraDoSistema.map((l) => (
                      <li key={l.linha}>
                        {l.nome}
                        {l.admissao && ` · admissão ${dataBR(l.admissao)}`}
                        {l.aniversario && ` · aniversário ${diaMes(l.aniversario)}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-500">
                A planilha guarda o aniversário só com dia e mês, por isso o ano de nascimento precisa ser completado à mão. As colunas 1/3/5/10/15 ANOS não são usadas: o sistema
                calcula os marcos com presente pela data de admissão.
              </p>
              <div className="flex justify-end">
                <Botao variante="fantasma" onClick={() => setLinhas(null)}>
                  Trocar planilha
                </Botao>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}

function ItemConferencia({ c }: { c: Conferencia }) {
  const { f, planilha } = c
  const sugestao = f.dataNascimento ? dataBR(f.dataNascimento) : planilha?.aniversario ? `${diaMes(planilha.aniversario)}/` : ''
  const [nasc, setNasc] = useState(sugestao)
  const [gravando, setGravando] = useState(false)
  const nascValido = lerDataBR(nasc)

  async function gravar(mudanca: Partial<Funcionario>) {
    setGravando(true)
    try {
      await salvar<Funcionario>('funcionarios', { ...f, ...mudanca })
    } catch (e) {
      alert('Não foi possível salvar: ' + String((e as Error).message ?? e))
    }
    setGravando(false)
  }

  function usarAdmissao() {
    if (!planilha?.admissao) return
    if (confirm(`Trocar a admissão de ${f.nome} de ${dataBR(f.dataAdmissao)} para ${dataBR(planilha.admissao)}? Isso muda férias, 13º e aniversário de empresa.`))
      gravar({ dataAdmissao: planilha.admissao })
  }

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/funcionarios/${f.id}`} className="font-medium hover:underline">
          {f.nome}
        </Link>
        {!planilha && <Selo cor="cinza">não está na planilha</Selo>}
      </div>

      {(c.semNascimento || c.nascimentoDiferente) && (
        <div className="space-y-1">
          <div className="text-gray-600">
            {c.semNascimento ? <Selo cor="amarelo">sem data de nascimento</Selo> : <Selo cor="amarelo">aniversário diferente</Selo>}{' '}
            Sistema: {f.dataNascimento ? dataBR(f.dataNascimento) : '—'} · Planilha: {planilha?.aniversario ? diaMes(planilha.aniversario) : '—'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Entrada value={nasc} onChange={(e) => setNasc(e.target.value)} placeholder="dd/mm/aaaa" inputMode="numeric" className="max-w-40 py-1.5" aria-label="Data de nascimento" />
            <Botao onClick={() => nascValido && gravar({ dataNascimento: nascValido })} disabled={!nascValido || gravando}>
              Salvar nascimento
            </Botao>
            {!nascValido && nasc && <span className="text-xs text-gray-500">complete com o ano (dd/mm/aaaa)</span>}
          </div>
        </div>
      )}

      {c.admissaoDiferente && planilha?.admissao && (
        <div className="flex flex-wrap items-center gap-2 text-gray-600">
          <Selo cor="vermelho">admissão diferente</Selo>
          Sistema: {dataBR(f.dataAdmissao)} · Planilha: {dataBR(planilha.admissao)}
          <Botao variante="secundario" onClick={usarAdmissao} disabled={gravando}>
            Usar a da planilha
          </Botao>
        </div>
      )}
    </li>
  )
}
