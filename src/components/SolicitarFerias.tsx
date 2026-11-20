import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Ban, CalendarDays, ChevronLeft, ChevronRight, Coins, Hourglass, Info, User, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  brl,
  d,
  dataBR,
  iso,
  periodosAquisitivos,
  salarioEm,
  validarSolicitacao,
  valoresFerias,
  type StatusFeriasFuncionario,
} from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { novoId, salvar, useTabela } from '../lib/store'
import type { Ausencia, Ferias, Funcionario } from '../lib/types'
import { Botao, Campo, Entrada, Modal, Selecao, Selo, cx, type CorSelo, Oculto } from './ui'

const coresStatus: Record<StatusFeriasFuncionario['codigo'], CorSelo> = {
  vencida: 'vermelho',
  vence_em_breve: 'amarelo',
  mais_de_90: 'verde',
  aquisitivo_incompleto: 'cinza',
  saldo_utilizado: 'azul',
}

export function SeloStatusFerias({ status }: { status: StatusFeriasFuncionario }) {
  return <Selo cor={coresStatus[status.codigo]}>{status.rotulo}</Selo>
}

// ---------------------------------------------------------------- calendário

function Mes({ mes, inicio, fim, onClicar }: { mes: Date; inicio?: string; fim?: string; onClicar: (dia: string) => void }) {
  const dias = eachDayOfInterval({ start: startOfWeek(startOfMonth(mes)), end: endOfWeek(endOfMonth(mes)) })
  const hoje = hojeISO()
  return (
    <div className="flex-1">
      <div className="mb-2 text-center text-sm font-medium capitalize">{format(mes, 'MMMM yyyy', { locale: ptBR })}</div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-500">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((x) => (
          <div key={x} className="py-1">
            {x}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-xs">
        {dias.map((dia) => {
          const s = iso(dia)
          if (!isSameMonth(dia, mes)) return <div key={s} />
          const ehInicio = s === inicio
          const ehFim = s === fim
          const dentro = inicio && fim && s > inicio && s < fim
          return (
            <button
              type="button"
              key={s}
              onClick={() => onClicar(s)}
              className={cx(
                'm-0.5 rounded-md py-1.5',
                (ehInicio || ehFim) && 'bg-marca-600 font-semibold text-white',
                dentro && 'bg-marca-100 text-marca-700',
                !ehInicio && !ehFim && !dentro && 'hover:bg-gray-100',
                s === hoje && !ehInicio && !ehFim && 'font-bold text-marca-600',
              )}
            >
              {dia.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- modal

function Linha({ icone, cor, rotulo, valor, dica }: { icone: ReactNode; cor: string; rotulo: string; valor: ReactNode; dica?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-medium text-gray-600" title={dica}>
        {rotulo}
        {dica && <Info size={12} className="text-gray-400" />}
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
        <span className={cx('flex h-6 w-6 items-center justify-center rounded-md', cor)}>{icone}</span>
        {valor}
      </div>
    </div>
  )
}

export function SolicitarFerias({ aberto, onFechar, funcionarioId }: { aberto: boolean; onFechar: () => void; funcionarioId?: string }) {
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: ferias } = useTabela<Ferias>('ferias')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const hoje = hojeISO()

  const [fid, setFid] = useState(funcionarioId ?? '')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [inicio, setInicio] = useState<string>()
  const [fim, setFim] = useState<string>()
  const [abono, setAbono] = useState(0)
  const [aprovar, setAprovar] = useState(true)
  // Lançamento livre: para acertar férias antigas sem as travas de saldo e regras (fica lembrado)
  const [livre, setLivreState] = useState(() => localStorage.getItem('gp:feriasLivre') !== '0')
  const setLivre = (v: boolean) => {
    localStorage.setItem('gp:feriasLivre', v ? '1' : '0')
    setLivreState(v)
  }
  const [observacao, setObservacao] = useState('')
  const [mes, setMes] = useState(startOfMonth(addMonths(new Date(), 1)))
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setFid(funcionarioId ?? '')
    setInicio(undefined)
    setFim(undefined)
    setAbono(0)
    setObservacao('')
    setPeriodoInicio('')
  }, [aberto, funcionarioId])

  const f = funcionarios.find((x) => x.id === fid)
  const periodos = useMemo(() => (f ? periodosAquisitivos(f, ferias, ausencias, hoje) : []), [f, ferias, ausencias, hoje])
  const comSaldo = periodos.filter((p) => p.direitoTotal - p.usados > 0)
  const opcoes = livre ? periodos : comSaldo

  // período padrão: o mais antigo com saldo
  useEffect(() => {
    if (opcoes.length && !opcoes.some((p) => p.inicio === periodoInicio)) setPeriodoInicio((comSaldo[0] ?? opcoes[0]).inicio)
  }, [opcoes, comSaldo, periodoInicio])

  const p = periodos.find((x) => x.inicio === periodoInicio)
  const dias = inicio && fim ? differenceInCalendarDays(d(fim), d(inicio)) + 1 : inicio ? 1 : 0
  const saldoDisponivel = p ? p.direitoTotal - p.usados : 0
  const regras = f && p && inicio ? validarSolicitacao({ funcionario: f, periodo: p, inicio, dias, abono, hoje }) : null
  // no lançamento livre os erros viram só avisos (exceto não ter escolhido as datas)
  const validacao =
    regras && livre
      ? { erros: regras.erros.filter((e) => e.startsWith('Selecione')), avisos: [...regras.erros.filter((e) => !e.startsWith('Selecione')), ...regras.avisos] }
      : regras
  const valores = f ? valoresFerias(salarioEm(f, inicio ?? hoje), dias, abono, f.tipo) : null
  const estagio = f?.tipo === 'estagio'

  function clicarDia(s: string) {
    if (!inicio || (inicio && fim)) {
      setInicio(s)
      setFim(undefined)
    } else if (s < inicio) {
      setInicio(s)
    } else {
      setFim(s)
    }
  }

  function digitarDias(n: number) {
    if (!inicio || !n) return
    setFim(iso(addDays(d(inicio), n - 1)))
  }

  async function enviar() {
    if (!f || !p || !inicio || validacao?.erros.length) return
    setSalvando(true)
    await salvar<Ferias>('ferias', {
      id: novoId(),
      funcionarioId: f.id,
      periodoInicio: p.inicio,
      inicio,
      fim: fim ?? inicio,
      dias,
      abono,
      antecipada: !p.completo,
      status: aprovar ? 'aprovada' : 'solicitada',
      observacao: observacao || undefined,
      criadoEm: hoje,
    })
    setSalvando(false)
    onFechar()
  }

  return (
    <Modal titulo={estagio ? 'Registrar recesso' : 'Solicitar férias para colaborador'} aberto={aberto} onFechar={onFechar} largura="max-w-4xl">
      <div className="flex flex-col md:flex-row">
        {/* Esquerda */}
        <div className="flex-1 space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <User size={18} />
            </div>
            {funcionarioId && f ? (
              <div>
                <div className="font-medium">{f.nome}</div>
                <div className="text-xs text-gray-500">
                  {f.cargo} · admissão {dataBR(f.dataAdmissao)}
                </div>
              </div>
            ) : (
              <Selecao value={fid} onChange={(e) => setFid(e.target.value)} className="flex-1">
                <option value="">Escolha o colaborador…</option>
                {funcionarios
                  .filter((x) => !x.dataDemissao && !x.semFerias)
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
              </Selecao>
            )}
          </div>

          {f && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={livre} onChange={(e) => setLivre(e.target.checked)} />
              <span>
                <b>Lançamento livre</b> — para registrar férias antigas e acertar o histórico. Mostra todos os períodos e não bloqueia por saldo ou
                regras (elas aparecem só como aviso).
              </span>
            </label>
          )}

          {f && opcoes.length === 0 && (
            <p className="text-sm text-gray-500">
              {periodos.length ? 'Este colaborador não tem saldo de férias. Marque "Lançamento livre" para registrar mesmo assim.' : 'A data de admissão ainda não chegou.'}
            </p>
          )}

          {f && opcoes.length > 0 && (
            <>
              <Campo rotulo="Período aquisitivo">
                <Selecao value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)}>
                  {opcoes.map((x) => (
                    <option key={x.inicio} value={x.inicio}>
                      {dataBR(x.inicio)} a {dataBR(x.fim)} · saldo {x.direitoTotal - x.usados} dias{!x.completo ? ' (antecipadas)' : ''}
                    </option>
                  ))}
                </Selecao>
              </Campo>

              <div>
                <div className="text-sm font-semibold">Período</div>
                <div className="mb-2 text-xs text-gray-500">Clique no dia de início e depois no dia de término.</div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <Entrada type="date" value={inicio ?? ''} onChange={(e) => { setInicio(e.target.value || undefined); setFim(undefined) }} aria-label="Início" />
                  <Entrada type="date" value={fim ?? ''} min={inicio} onChange={(e) => setFim(e.target.value || undefined)} aria-label="Término" />
                  <Entrada type="number" min={1} max={30} placeholder="Nº de dias" value={dias || ''} onChange={(e) => digitarDias(Number(e.target.value))} aria-label="Número de dias" />
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="mb-1 flex justify-between">
                    <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => setMes(addMonths(mes, -1))} aria-label="Mês anterior">
                      <ChevronLeft size={18} />
                    </button>
                    <button type="button" className="rounded p-1 hover:bg-gray-100" onClick={() => setMes(addMonths(mes, 1))} aria-label="Próximo mês">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Mes mes={mes} inicio={inicio} fim={fim} onClicar={clicarDia} />
                    <div className="hidden w-px bg-gray-200 sm:block" />
                    <div className="hidden flex-1 sm:block">
                      <Mes mes={addMonths(mes, 1)} inicio={inicio} fim={fim} onClicar={clicarDia} />
                    </div>
                  </div>
                </div>
              </div>

              {!estagio && (
                <Campo rotulo="Vender dias (abono pecuniário)" dica={`Até ${Math.floor((p?.direitoTotal ?? 30) / 3)} dias.`}>
                  <Entrada type="number" min={0} max={10} value={abono} onChange={(e) => setAbono(Math.max(0, Number(e.target.value)))} className="max-w-32" />
                </Campo>
              )}
              <Campo rotulo="Observação">
                <Entrada value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </Campo>
            </>
          )}
        </div>

        {/* Direita: detalhes */}
        <aside className="space-y-4 border-t border-gray-200 bg-gray-50/60 p-5 md:w-64 md:border-l md:border-t-0">
          {p && !p.completo && <Selo cor="roxo">« Férias antecipadas</Selo>}
          <div className="text-sm font-semibold">Detalhes da seleção</div>
          <Linha icone={<Ban size={14} />} cor="bg-orange-100 text-orange-700" rotulo="Dias descontados" valor={p ? 30 - p.direitoTotal : 0} dica="Dias perdidos por faltas injustificadas (CLT art. 130)" />
          <Linha icone={<CalendarDays size={14} />} cor="bg-green-100 text-green-700" rotulo="Saldo disponível" valor={saldoDisponivel} />
          <Linha icone={<CalendarDays size={14} />} cor="bg-violet-100 text-violet-700" rotulo="Dias selecionados" valor={dias} />
          {!estagio && <Linha icone={<Coins size={14} />} cor="bg-gray-200 text-gray-700" rotulo="Dias abonados" valor={abono} dica="Dias vendidos" />}
          <Linha icone={<Hourglass size={14} />} cor="bg-amber-100 text-amber-700" rotulo="Saldo restante" valor={saldoDisponivel - dias - abono} />

          {p && (
            <div className="border-t border-gray-200 pt-3 text-xs text-gray-600">
              <div className="font-semibold text-gray-700">Período aquisitivo</div>
              {dataBR(p.inicio)} a {dataBR(p.fim)}
              <div className="mt-1">Tirar até {dataBR(p.concessivoFim)}</div>
            </div>
          )}

          {valores && dias > 0 && (
            <div className="space-y-1 border-t border-gray-200 pt-3 text-xs">
              <div className="flex items-center gap-1 font-semibold text-gray-700">
                <Wallet size={13} /> Valores estimados
              </div>
              <div className="flex justify-between"><span>{estagio ? 'Recesso' : 'Férias'}</span><span><Oculto>{brl(valores.ferias)}</Oculto></span></div>
              {!estagio && <div className="flex justify-between"><span>1/3 constitucional</span><span><Oculto>{brl(valores.terco)}</Oculto></span></div>}
              {abono > 0 && <div className="flex justify-between"><span>Abono + 1/3</span><span><Oculto>{brl(valores.abono + valores.tercoAbono)}</Oculto></span></div>}
              <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold"><span>Total bruto</span><span><Oculto>{brl(valores.total)}</Oculto></span></div>
              <div className="text-gray-500">Sem descontos de INSS e IR. Pagar até 2 dias antes do início.</div>
            </div>
          )}
        </aside>
      </div>

      {validacao && (validacao.erros.length > 0 || validacao.avisos.length > 0) && (
        <div className="space-y-2 border-t border-gray-200 px-5 py-3 text-sm">
          {validacao.erros.map((e) => (
            <div key={e} className="flex gap-2 text-red-700"><Ban size={16} className="mt-0.5 shrink-0" />{e}</div>
          ))}
          {validacao.avisos.map((e) => (
            <div key={e} className="flex gap-2 text-amber-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{e}</div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={aprovar} onChange={(e) => setAprovar(e.target.checked)} />
          Já marcar como aprovada
        </label>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={enviar} disabled={!p || !inicio || !!validacao?.erros.length || salvando}>
            {aprovar ? 'Registrar férias' : 'Registrar solicitação'}
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
