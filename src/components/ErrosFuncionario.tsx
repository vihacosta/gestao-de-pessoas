import { AlertTriangle, FileDown, Plus, Trash2, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { brl, dataBR } from '../lib/clt'
import { salvarNoComputador } from '../lib/arquivos'
import { aviso, explicacao, grupoDoErro, gruposDeErros, LIMITE, situacaoErro, type ErroFuncionario, type GrupoErros } from '../lib/descontoErros'
import { hojeISO } from '../lib/hoje'
import { camposDoModelo, modelosPadrao, montarDados, nomeArquivo, preencher } from '../lib/modelos'
import { novoId, remover, salvar, salvarVarios, useTabela } from '../lib/store'
import type { Funcionario } from '../lib/types'
import { useConfig } from '../pages/Configuracoes'
import { camposFaltando, carregarModelo } from '../pages/Documentos'
import { Botao, Campo, Entrada, Modal, Modulo, Selo, Vazio, type CorSelo, Oculto } from './ui'

/** "1.250,50", "150", "40.5" → número (ponto com 1 ou 2 casas no fim conta como centavos) */
const numero = (s: string) => {
  const t = s.replace(/[R$\s]/g, '')
  return Number(/^\d+\.\d{1,2}$/.test(t) ? t : t.replace(/\./g, '').replace(',', '.'))
}

const corDoGrupo = (g: GrupoErros): CorSelo => (g.pago ? 'cinza' : g.desconto > 0 ? 'vermelho' : 'verde')

/**
 * Quebras e erros de uma pessoa, com a política de desconto por erros:
 * mostra quando desconta e quanto, e permite marcar o desconto como feito.
 */
export function ErrosFuncionario({ f }: { f: Funcionario }) {
  const funcionarioId = f.id
  const config = useConfig()
  const { rows } = useTabela<ErroFuncionario>('erros')
  const [lancando, setLancando] = useState(false)
  const [descontando, setDescontando] = useState<GrupoErros | null>(null)
  const hoje = hojeISO()
  const [mesFolha, setMesFolha] = useState(hoje.slice(0, 7))

  const erros = useMemo(() => rows.filter((e) => e.funcionarioId === funcionarioId), [rows, funcionarioId])
  const grupos = useMemo(() => gruposDeErros(erros, hoje), [erros, hoje])
  const pendentes = grupos.filter((g) => !g.pago && g.desconto > 0)
  const aDescontar = pendentes.reduce((s, g) => s + g.desconto, 0)

  /** Baixa a autorização de desconto já preenchida com o valor e o mês da folha */
  async function baixarAutorizacao(g: GrupoErros, mes: string) {
    if (!g.pago && g.aConfirmar && !confirm(`A regra deste caso ainda está a confirmar com a empresa. ${explicacao(g)} Baixar o documento com ${brl(g.desconto)}?`)) return
    const m = modelosPadrao.find((x) => x.id === 'autorizacao-de-desconto')!
    try {
      const buf = await carregarModelo(m)
      const faltando = camposFaltando(camposDoModelo(buf), f, hoje).filter((c) => !/valor|m[eê]s/i.test(c))
      const extras = { valor: g.desconto.toFixed(2).replace('.', ','), mes_referencia: mes }
      salvarNoComputador(preencher(buf, montarDados(m, { funcionarios: [f], dataDoc: hoje, extras, config })), nomeArquivo(m, [f]))
      if (faltando.length) alert(`Documento gerado, mas estes dados estão em branco no cadastro: ${faltando.join(', ')}.`)
    } catch (e) {
      alert('Não foi possível gerar o documento: ' + String((e as Error).message ?? e))
    }
  }

  async function excluir(e: ErroFuncionario) {
    if (!confirm(`Excluir o erro de ${dataBR(e.data)} (${e.descricao}, ${brl(e.valor)})?`)) return
    await remover('erros', e.id)
  }

  async function desfazer(g: GrupoErros) {
    if (!confirm('Desfazer o desconto? Os erros voltam a contar como não pagos.')) return
    await salvarVarios(
      'erros',
      g.erros.map(({ descontadoEm: _a, valorDescontado: _b, pagamentoId: _c, ...e }) => e),
    )
  }

  const resumo =
    pendentes.length > 0 ? (
      <Selo cor="vermelho">Descontar <Oculto>{brl(aDescontar)}</Oculto></Selo>
    ) : grupos.length > 0 ? (
      <Selo cor="verde">Nada a descontar</Selo>
    ) : (
      <Selo cor="cinza">Nenhum erro</Selo>
    )

  return (
    <Modulo titulo="Erros e quebras" resumo={resumo}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-xs text-gray-500">
            1 erro em 3 meses não desconta. Mais de um: desconta a soma dividida pela quantidade. Acima de <Oculto>{brl(LIMITE)}</Oculto>: desconta o que passar.
          </p>
        </div>
        <Botao variante="secundario" onClick={() => setLancando(true)}>
          <Plus size={16} /> Lançar erro
        </Botao>
      </div>

      {pendentes.map((g) => (
        <div key={g.inicio} className="flex flex-wrap items-center gap-3 border-b border-red-100 bg-red-50 px-4 py-3 text-sm">
          <span className="mr-auto">
            <strong>Descontar <Oculto>{brl(g.desconto)}</Oculto></strong> na folha ({g.erros.length} {g.erros.length === 1 ? 'erro' : 'erros'} desde {dataBR(g.inicio)})
          </span>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            Folha de
            <Entrada type="month" value={mesFolha} onChange={(e) => setMesFolha(e.target.value)} className="w-40 py-1.5" />
          </label>
          <Botao variante="secundario" disabled={!mesFolha} onClick={() => baixarAutorizacao(g, mesFolha)} title="Baixa a autorização de desconto preenchida, para a pessoa assinar">
            <FileDown size={16} /> Baixar autorização
          </Botao>
          <Botao onClick={() => setDescontando(g)}>Marcar como descontado</Botao>
        </div>
      ))}

      {grupos.length === 0 && <Vazio>Nenhum erro lançado.</Vazio>}
      <ul className="divide-y divide-gray-100">
        {grupos.map((g) => (
          <li key={`${g.pago}-${g.inicio}`} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {dataBR(g.inicio)} a {dataBR(g.fim)}
                {g.aberto && <span className="ml-1 text-xs font-normal text-gray-500">(período em andamento)</span>}
              </span>
              <Selo cor={corDoGrupo(g)}>{aviso(g)}</Selo>
              {g.aConfirmar && !g.pago && (
                <Selo cor="amarelo">
                  <AlertTriangle size={12} /> regra a confirmar
                </Selo>
              )}
              {g.pago && (
                <span className="ml-auto flex gap-1">
                  <Botao variante="fantasma" className="px-2 py-1" onClick={() => baixarAutorizacao(g, (g.descontadoEm ?? hoje).slice(0, 7))} title="Baixar a autorização deste desconto">
                    <FileDown size={14} /> Autorização
                  </Botao>
                  <Botao variante="fantasma" className="px-2 py-1" onClick={() => desfazer(g)} title="Desfazer o desconto">
                    <Undo2 size={14} /> Desfazer
                  </Botao>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">{explicacao(g)}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {g.erros.map((e) => {
                const s = situacaoErro(g, e, erros)
                return (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-gray-500">{dataBR(e.data)}</span>
                  <span className="min-w-0 flex-1">
                    {e.descricao || '—'}
                    <span className={s.desconta ? 'block text-xs font-medium text-red-700' : 'block text-xs text-gray-500'}>{s.texto}</span>
                  </span>
                  <span className="font-medium"><Oculto>{brl(e.valor)}</Oculto></span>
                  <button onClick={() => excluir(e)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600" aria-label="Excluir erro">
                    <Trash2 size={14} />
                  </button>
                </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>

      <LancarErro aberto={lancando} onFechar={() => setLancando(false)} funcionarioId={funcionarioId} erros={erros} />
      <MarcarDescontado grupo={descontando} onFechar={() => setDescontando(null)} />
    </Modulo>
  )
}

function LancarErro({ aberto, onFechar, funcionarioId, erros }: { aberto: boolean; onFechar: () => void; funcionarioId: string; erros: ErroFuncionario[] }) {
  const [data, setData] = useState(hojeISO())
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [id] = useState(novoId)

  const v = numero(valor)
  const rascunho: ErroFuncionario = { id, funcionarioId, data, descricao: descricao.trim(), valor: v }
  const previa = v > 0 && data ? grupoDoErro(gruposDeErros([...erros, rascunho], hojeISO()), id) : undefined

  async function enviar() {
    if (!(v > 0) || !data) return alert('Informe a data e o valor do erro.')
    await salvar('erros', { ...rascunho, id: novoId() })
    setDescricao('')
    setValor('')
    onFechar()
  }

  return (
    <Modal titulo="Lançar erro ou quebra" aberto={aberto} onFechar={onFechar}>
      <div className="space-y-4 p-5">
        <Campo rotulo="Data">
          <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="O que aconteceu">
          <Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quebrou um vaso no estoque" />
        </Campo>
        <Campo rotulo="Valor (R$)">
          <Entrada inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="150,00" />
        </Campo>
        {previa && (
          <div className={previa.desconto > 0 ? 'rounded-lg bg-red-50 p-3 text-sm' : 'rounded-lg bg-green-50 p-3 text-sm'}>
            <div className="font-semibold">Com este erro: {aviso(previa)}</div>
            <div className="mt-1 text-xs font-medium">{situacaoErro(previa, rascunho, [...erros, rascunho]).texto}</div>
            <div className="mt-1 text-xs text-gray-600">{explicacao(previa)}</div>
          </div>
        )}
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

function MarcarDescontado({ grupo, onFechar }: { grupo: GrupoErros | null; onFechar: () => void }) {
  const [data, setData] = useState(hojeISO())
  if (!grupo) return null

  async function enviar() {
    if (!grupo || !data) return
    const pagamentoId = novoId()
    await salvarVarios(
      'erros',
      grupo.erros.map((e) => ({ ...e, descontadoEm: data, valorDescontado: grupo.desconto, pagamentoId })),
    )
    onFechar()
  }

  return (
    <Modal titulo="Marcar desconto como feito" aberto onFechar={onFechar}>
      <div className="space-y-4 p-5 text-sm">
        <p>
          Desconto de <strong><Oculto>{brl(grupo.desconto)}</Oculto></strong> referente a {grupo.erros.length} {grupo.erros.length === 1 ? 'erro' : 'erros'} desde {dataBR(grupo.inicio)}.
          Depois disso, a contagem de 3 meses recomeça no próximo erro.
        </p>
        {grupo.aConfirmar && (
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
            <AlertTriangle size={14} className="mr-1 inline" />
            {explicacao(grupo)}
          </p>
        )}
        <Campo rotulo="Descontado em (data da folha)">
          <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao onClick={enviar}>Confirmar</Botao>
        </div>
      </div>
    </Modal>
  )
}
