import { addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Copy, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CartaoBeneficio } from '../components/CartaoBeneficio'
import { Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Selecao, Selo, Vazio, cx, Oculto } from '../components/ui'
import { ACEITOS } from '../components/EnviarArquivos'
import { apagarArquivo, enviarArquivo } from '../lib/arquivos'
import { abrirDocumento, nomeSeguro } from '../lib/documentos'
import { bonusDoMes, horasTexto, JORNADA_DIA, type ResultadoBonus } from '../lib/bonus'
import { brl, d, dataBR } from '../lib/clt'
import { lerValor } from '../lib/extenso'
import { hojeISO } from '../lib/hoje'
import { novoId, remover, salvar, useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, Funcionario, TipoAusencia } from '../lib/types'
import { useConfig } from './Configuracoes'

export const nomesTipo: Record<TipoAusencia, string> = {
  atraso: 'Atraso',
  saida_antecipada: 'Saída antecipada',
  falta_injustificada: 'Falta injustificada',
  falta_justificada: 'Falta justificada',
  atestado: 'Atestado médico',
  licenca_maternidade: 'Licença-maternidade',
  licenca_paternidade: 'Licença-paternidade',
  casamento: 'Casamento (gala)',
  falecimento: 'Falecimento (nojo)',
  outro: 'Outro',
}

const parciais: TipoAusencia[] = ['atraso', 'saida_antecipada']

const mesAtual = () => hojeISO().slice(0, 7)
const nomeMes = (m: string) => { const t = format(d(`${m}-01`), "MMMM 'de' yyyy", { locale: ptBR }); return t[0].toUpperCase() + t.slice(1) }

function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (m: string) => void }) {
  const mudar = (n: number) => onMudar(format(addMonths(d(`${mes}-01`), n), 'yyyy-MM'))
  return (
    <div className="flex items-center gap-1">
      <Botao variante="fantasma" className="px-2" onClick={() => mudar(-1)} aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </Botao>
      <span className="min-w-40 text-center font-medium">{nomeMes(mes)}</span>
      <Botao variante="fantasma" className="px-2" onClick={() => mudar(1)} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </Botao>
    </div>
  )
}

export default function Ausencias() {
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') === 'bonus' ? 'bonus' : 'ocorrencias'
  const [mes, setMes] = useState(params.get('mes') ?? mesAtual())
  const [editando, setEditando] = useState<Ausencia | 'nova' | null>(null)

  return (
    <>
      <Cabecalho
        titulo="Faltas, atrasos e bônus"
        subtitulo="Registre as ocorrências do cartão ponto; o bônus por assiduidade é calculado sozinho"
        acoes={
          <Botao onClick={() => setEditando('nova')}>
            <Plus size={16} /> Nova ocorrência
          </Botao>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
        <div className="flex gap-6 text-sm">
          {(
            [
              ['ocorrencias', 'Ocorrências'],
              ['bonus', 'Bônus do mês'],
            ] as const
          ).map(([k, r]) => (
            <button
              key={k}
              onClick={() => setParams(k === 'ocorrencias' ? {} : { aba: k })}
              className={cx('-mb-px border-b-2 pb-2', aba === k ? 'border-marca-600 font-semibold text-gray-900' : 'border-transparent text-gray-500')}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="pb-1">
          <SeletorMes mes={mes} onMudar={setMes} />
        </div>
      </div>

      {aba === 'ocorrencias' ? <Ocorrencias mes={mes} onEditar={setEditando} /> : <BonusMes mes={mes} />}

      <FormOcorrencia aberto={editando !== null} atual={editando === 'nova' ? null : editando} onFechar={() => setEditando(null)} />
    </>
  )
}

// ---------------------------------------------------------------- lista

function descricaoHoras(a: Ausencia) {
  const partes: string[] = []
  if (a.inicio === a.fim) partes.push(a.horas != null ? horasTexto(a.horas) : 'dia inteiro')
  else partes.push(`${dataBR(a.inicio)} a ${dataBR(a.fim)}`)
  if (a.horasBanco) partes.push(`${horasTexto(a.horasBanco)} do banco`)
  if (a.horasCompensadas) partes.push(`${horasTexto(a.horasCompensadas)} compensadas depois`)
  return partes.join(' · ')
}

function Ocorrencias({ mes, onEditar }: { mes: string; onEditar: (a: Ausencia) => void }) {
  const { rows: ausencias, carregando } = useTabela<Ausencia>('ausencias')
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const nome = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—'

  const lista = ausencias
    .filter((a) => a.inicio.slice(0, 7) <= mes && a.fim.slice(0, 7) >= mes)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))

  async function abrirAnexo(a: Ausencia) {
    if (a.anexo) await abrirDocumento(a.anexo)
  }

  async function excluir(a: Ausencia) {
    if (!confirm(`Excluir a ocorrência de ${nome(a.funcionarioId)} em ${dataBR(a.inicio)}?`)) return
    if (a.anexo) await apagarArquivo(a.anexo).catch(() => {})
    await remover('ausencias', a.id)
  }

  return (
    <Cartao>
      {!carregando && lista.length === 0 && <Vazio>Nenhuma ocorrência neste mês.</Vazio>}
      <ul className="divide-y divide-gray-100">
        {lista.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="w-14 text-center">
              <div className="text-lg font-bold leading-none">{a.inicio.slice(8)}</div>
              <div className="text-[11px] uppercase text-gray-500">{format(d(a.inicio), 'MMM', { locale: ptBR })}</div>
            </div>
            <div className="min-w-48 flex-1">
              <div className="font-medium">{nome(a.funcionarioId)}</div>
              <div className="text-sm text-gray-500">{descricaoHoras(a)}</div>
              {a.observacao && <div className="text-xs text-gray-500">{a.observacao}</div>}
            </div>
            <Selo cor={a.tipo === 'falecimento' ? 'cinza' : a.tipo === 'atraso' || a.tipo === 'saida_antecipada' ? 'amarelo' : 'vermelho'}>{nomesTipo[a.tipo]}</Selo>
            <div className="flex gap-1">
              {a.anexo && (
                <Botao variante="fantasma" className="px-2 py-1" onClick={() => abrirAnexo(a)} title="Ver anexo">
                  <Paperclip size={14} />
                </Botao>
              )}
              <Botao variante="fantasma" className="px-2 py-1" onClick={() => onEditar(a)} aria-label="Editar">
                <Pencil size={14} />
              </Botao>
              <Botao variante="fantasma" className="px-2 py-1" onClick={() => excluir(a)} aria-label="Excluir">
                <Trash2 size={14} />
              </Botao>
            </div>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}

// ---------------------------------------------------------------- bônus

function BonusMes({ mes }: { mes: string }) {
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const config = useConfig()
  const [copiado, setCopiado] = useState(false)
  const temCartao = pontos.some((p) => p.mes === mes)

  const linhas = useMemo(
    () =>
      funcionarios
        .map((f) => ({ f, r: bonusDoMes(f, ausencias, mes, config, pontos.find((p) => p.funcionarioId === f.id && p.mes === mes)) }))
        .filter((x) => x.r.status !== 'fora')
        .sort((a, b) => a.f.nome.localeCompare(b.f.nome)),
    [funcionarios, ausencias, pontos, mes, config],
  )
  const recebem = linhas.filter((x) => x.r.status === 'recebe')
  const total = recebem.reduce((s, x) => s + x.r.valor, 0)

  function copiar() {
    const texto = [`Bônus por assiduidade - ${nomeMes(mes)}`, ...recebem.map((x) => `${x.f.nome}: ${brl(x.r.valor)}`), `Total: ${brl(total)}`].join('\n')
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const selo = (r: ResultadoBonus) =>
    r.status === 'recebe' ? <Selo cor="verde">Recebe <Oculto>{brl(r.valor)}</Oculto></Selo> : r.status === 'experiencia' ? <Selo cor="cinza">Em experiência</Selo> : <Selo cor="vermelho">Não recebe</Selo>

  return (
    <>
      {temCartao ? (
        <p className="mb-3 text-sm text-gray-600">Calculado pelo cartão ponto importado, mais atestados e licenças registrados em Ocorrências.</p>
      ) : (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          O cartão ponto deste mês ainda não foi importado: o cálculo usa só as ocorrências registradas à mão.{' '}
          <Link to="/ponto" className="underline">Importar cartão ponto</Link>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cartao className="p-4">
          <div className="text-sm text-gray-500">Recebem</div>
          <div className="text-2xl font-bold">{recebem.length}</div>
        </Cartao>
        <Cartao className="p-4">
          <div className="text-sm text-gray-500">Não recebem</div>
          <div className="text-2xl font-bold">{linhas.filter((x) => x.r.status === 'perde').length}</div>
        </Cartao>
        <Cartao className="col-span-2 p-4 sm:col-span-1">
          <div className="text-sm text-gray-500">Bônus a pagar (Mobilidade)</div>
          <div className="text-2xl font-bold"><Oculto>{brl(total)}</Oculto></div>
        </Cartao>
      </div>
      <CartaoBeneficio funcionarios={funcionarios} ausencias={ausencias} pontos={pontos} config={config} mes={mes} nomeMes={nomeMes(mes)} />
      <Cartao>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm text-gray-500">
            Valor <Oculto>{brl(config.valorBonus)}</Oculto> · perde com {horasTexto(config.bonusLimiteDia)} ou mais num dia, ou {config.bonusLimiteMes != null ? horasTexto(config.bonusLimiteMes) : '—'} ou mais no mês sem compensar
          </span>
          <Botao variante="secundario" className="px-3 py-1" onClick={copiar}>
            <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar lista'}
          </Botao>
        </div>
        {linhas.length === 0 && <Vazio>Nenhum funcionário neste mês.</Vazio>}
        <ul className="divide-y divide-gray-100">
          {linhas.map(({ f, r }) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-48 flex-1">
                <div className="font-medium">{f.nome}</div>
                {r.motivos.length > 0 && <ul className="text-sm text-gray-500">{r.motivos.map((m) => <li key={m}>{m}</li>)}</ul>}
                {r.avisos.length > 0 && (
                  <ul className="text-sm text-amber-700">
                    {r.avisos.map((m) => (
                      <li key={m}>⚠ {m}</li>
                    ))}
                  </ul>
                )}
                {r.status === 'recebe' && r.horasNaoCompensadas > 0 && (
                  <div className="text-sm text-gray-500">{horasTexto(r.horasNaoCompensadas)} não compensadas no mês</div>
                )}
              </div>
              {selo(r)}
            </li>
          ))}
        </ul>
      </Cartao>
      <p className="mt-3 text-xs text-gray-500">
        Faltas justificadas e atestados também fazem perder o bônus; falecimento (nojo) não conta. Horas cobertas por saldo que já existia no banco de horas não contam.
      </p>
    </>
  )
}

// ---------------------------------------------------------------- formulário

function FormOcorrencia({ aberto, atual, onFechar }: { aberto: boolean; atual: Ausencia | null; onFechar: () => void }) {
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const [a, setA] = useState<Ausencia>(() => nova())
  const [diaInteiro, setDiaInteiro] = useState(true)
  const [horas, setHoras] = useState('')
  const [banco, setBanco] = useState('')
  const [compensadas, setCompensadas] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)

  function nova(): Ausencia {
    return { id: novoId(), funcionarioId: '', tipo: 'atraso', inicio: hojeISO(), fim: hojeISO() }
  }

  useEffect(() => {
    if (!aberto) return
    const x = atual ?? nova()
    setA(x)
    setDiaInteiro(x.horas == null && !parciais.includes(x.tipo))
    setHoras(x.horas != null ? String(x.horas).replace('.', ',') : '')
    setBanco(x.horasBanco ? String(x.horasBanco).replace('.', ',') : '')
    setCompensadas(x.horasCompensadas ? String(x.horasCompensadas).replace('.', ',') : '')
    setArquivo(null)
  }, [aberto, atual])

  const varios = a.inicio !== a.fim
  const parcial = !varios && !diaInteiro

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const reg: Ausencia = {
      ...a,
      fim: a.fim < a.inicio ? a.inicio : a.fim,
      horas: parcial ? lerValor(horas) : undefined,
      horasBanco: lerValor(banco) || undefined,
      horasCompensadas: lerValor(compensadas) || undefined,
      observacao: a.observacao || undefined,
    }
    try {
      if (arquivo) {
        const caminho = `ausencias/${reg.id}-${nomeSeguro(arquivo.name)}`
        await enviarArquivo(caminho, arquivo)
        if (a.anexo && a.anexo !== caminho) await apagarArquivo(a.anexo).catch(() => {})
        reg.anexo = caminho
      }
      await salvar('ausencias', reg)
    } catch (e) {
      setSalvando(false)
      alert('Não foi possível salvar: ' + String((e as Error).message ?? e))
      return
    }
    setSalvando(false)
    onFechar()
  }

  const minutos = (s: string) => {
    const n = lerValor(s)
    return n ? ` (${horasTexto(n)})` : ''
  }

  return (
    <Modal titulo={atual ? 'Editar ocorrência' : 'Nova ocorrência'} aberto={aberto} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4 p-5">
        <Campo rotulo="Funcionário">
          <Selecao required value={a.funcionarioId} onChange={(e) => setA({ ...a, funcionarioId: e.target.value })}>
            <option value="">Escolha…</option>
            {funcionarios
              .filter((f) => !f.dataDemissao || f.id === a.funcionarioId)
              .sort((x, y) => x.nome.localeCompare(y.nome))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Tipo">
          <Selecao
            value={a.tipo}
            onChange={(e) => {
              const tipo = e.target.value as TipoAusencia
              setA({ ...a, tipo })
              setDiaInteiro(!parciais.includes(tipo))
            }}
          >
            {(Object.keys(nomesTipo) as TipoAusencia[]).map((t) => (
              <option key={t} value={t}>
                {nomesTipo[t]}
              </option>
            ))}
          </Selecao>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data (início)">
            <Entrada type="date" required value={a.inicio} onChange={(e) => setA({ ...a, inicio: e.target.value, fim: a.fim < e.target.value || a.fim === a.inicio ? e.target.value : a.fim })} />
          </Campo>
          <Campo rotulo="Até (fim)">
            <Entrada type="date" required min={a.inicio} value={a.fim} onChange={(e) => setA({ ...a, fim: e.target.value })} />
          </Campo>
        </div>
        {!varios && (
          <div className="space-y-3 rounded-lg bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} />
              Dia inteiro
            </label>
            {parcial && (
              <Campo rotulo={`Horas de ausência ou atraso${minutos(horas)}`} dica="Use vírgula para minutos: 0,5 = 30 min; 1,25 = 1h15.">
                <Entrada required inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="0,5" />
              </Campo>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={`Coberto pelo banco de horas${minutos(banco)}`} dica="Saldo que já existia antes do dia da ausência, incluindo horas extras feitas no próprio mês, nos dias anteriores (veja no cartão ponto).">
            <Entrada inputMode="decimal" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="0" />
          </Campo>
          <Campo rotulo={`Compensado depois${minutos(compensadas)}`} dica="Horas repostas após a ausência.">
            <Entrada inputMode="decimal" value={compensadas} onChange={(e) => setCompensadas(e.target.value)} placeholder="0" />
          </Campo>
        </div>
        <Campo rotulo="Observação">
          <Entrada value={a.observacao ?? ''} onChange={(e) => setA({ ...a, observacao: e.target.value })} />
        </Campo>
        <Campo rotulo="Anexo (atestado, comprovante)" dica={a.anexo && !arquivo ? 'Já tem um anexo. Envie outro para substituir.' : 'Foto, PDF ou outro documento.'}>
          <input type="file" accept={ACEITOS} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
        </Campo>
        <p className="text-xs text-gray-500">Dia inteiro conta como {horasTexto(JORNADA_DIA)} (44h semanais).</p>
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
