import { addDays, differenceInCalendarDays } from 'date-fns'
import { AlertTriangle, Ban, CheckCircle2, FileText, Info } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { d, dataBR, iso } from '../lib/clt'
import { salvarNoComputador } from '../lib/arquivos'
import { fimColetiva, planoColetivo, registrosColetiva, validarColetiva, type PlanoColetivo } from '../lib/feriasColetivas'
import { hojeISO } from '../lib/hoje'
import { modelosPadrao, montarDados, nomeArquivo, preencher } from '../lib/modelos'
import { novoId, salvar, useTabela } from '../lib/store'
import type { Ausencia, ConfigEmpresa, Ferias, Funcionario } from '../lib/types'
import { carregarModelo } from '../pages/Documentos'
import { Botao, Campo, Entrada, Modal, Selo } from './ui'

const MODELO = modelosPadrao.find((m) => m.id === 'coletivo-ferias-coletivas')!

function resumo(p: PlanoColetivo) {
  const partes: string[] = []
  if (p.reiniciaPeriodo) partes.push(`${p.diasDescontados} dias proporcionais`)
  else {
    const normais = p.partes.filter((x) => !x.antecipada).reduce((s, x) => s + x.dias, 0)
    const antecipados = p.partes.filter((x) => x.antecipada).reduce((s, x) => s + x.dias, 0)
    if (normais) partes.push(`${normais} dias do saldo`)
    if (antecipados) partes.push(`${antecipados} antecipados`)
  }
  if (p.licencaRemunerada) partes.push(`${p.licencaRemunerada} de licença remunerada`)
  return partes.join(' + ') || '—'
}

export function FeriasColetivas({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: ferias } = useTabela<Ferias>('ferias')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: configs } = useTabela<ConfigEmpresa>('config')
  const hoje = hojeISO()

  const [inicio, setInicio] = useState('')
  const [dias, setDias] = useState(0)
  const [fora, setFora] = useState<Set<string>>(new Set())
  const [aprovar, setAprovar] = useState(true)
  const [art140, setArt140] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState<{ funcionarios: Funcionario[]; inicio: string; fim: string } | null>(null)
  const [erroDoc, setErroDoc] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setInicio('')
    setDias(0)
    setFora(new Set())
    setFeito(null)
    setErroDoc(null)
  }, [aberto])

  const fim = inicio && dias > 0 ? fimColetiva(inicio, dias) : ''
  const ativos = useMemo(() => funcionarios.filter((f) => !f.dataDemissao).sort((a, b) => a.nome.localeCompare(b.nome)), [funcionarios])
  const planos = useMemo(
    () => (inicio && dias > 0 ? ativos.map((f) => planoColetivo(f, ferias, ausencias, inicio, dias, hoje, art140)) : []),
    [ativos, ferias, ausencias, inicio, dias, hoje, art140],
  )
  const incluidos = planos.filter((p) => !p.conflito && !fora.has(p.funcionario.id))
  const validacao = inicio && dias > 0 ? validarColetiva({ inicio, dias, ferias, hoje }) : null
  const config = configs.find((c) => c.id === 'empresa')

  function alternar(id: string) {
    const s = new Set(fora)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setFora(s)
  }

  async function registrar() {
    if (!incluidos.length || validacao?.erros.length) return
    setSalvando(true)
    const coletivaId = novoId()
    for (const p of incluidos)
      for (const r of registrosColetiva(p, { coletivaId, aprovada: aprovar, hoje, novoId })) await salvar<Ferias>('ferias', r)
    setSalvando(false)
    setFeito({ funcionarios: incluidos.map((p) => p.funcionario), inicio, fim })
  }

  async function gerarAcordo() {
    if (!feito) return
    setErroDoc(null)
    try {
      const buf = await carregarModelo(MODELO)
      const extras = { inicio: feito.inicio, fim: feito.fim, retorno: iso(addDays(d(feito.fim), 1)) }
      const blob = preencher(buf, montarDados(MODELO, { funcionarios: feito.funcionarios, dataDoc: hoje, extras, config }))
      salvarNoComputador(blob, nomeArquivo(MODELO, feito.funcionarios))
    } catch (e) {
      setErroDoc('Não foi possível gerar o acordo: ' + String((e as Error).message ?? e))
    }
  }

  if (feito)
    return (
      <Modal titulo="Férias coletivas" aberto={aberto} onFechar={onFechar}>
        <div className="space-y-4 p-5 text-sm">
          <div className="flex gap-2 text-green-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>
              Férias coletivas de <b>{dataBR(feito.inicio)}</b> a <b>{dataBR(feito.fim)}</b> registradas para {feito.funcionarios.length}{' '}
              {feito.funcionarios.length === 1 ? 'pessoa' : 'pessoas'}.
            </span>
          </div>
          {!(config?.socioNome && config?.socioCpf) && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
              O acordo usa o nome e o CPF do sócio, que ainda não estão em <Link to="/configuracoes" className="underline">Configurações</Link>.
            </p>
          )}
          {erroDoc && <p className="text-red-700">{erroDoc}</p>}
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={onFechar}>Fechar</Botao>
            <Botao onClick={gerarAcordo}>
              <FileText size={16} /> Gerar acordo de férias coletivas
            </Botao>
          </div>
        </div>
      </Modal>
    )

  return (
    <Modal titulo="Férias coletivas" aberto={aberto} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Primeiro dia">
            <Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Último dia">
            <Entrada
              type="date"
              value={fim}
              min={inicio}
              disabled={!inicio}
              onChange={(e) => setDias(e.target.value ? differenceInCalendarDays(d(e.target.value), d(inicio)) + 1 : 0)}
            />
          </Campo>
          <Campo rotulo="Nº de dias">
            <Entrada type="number" min={1} max={30} value={dias || ''} disabled={!inicio} onChange={(e) => setDias(Math.max(0, Number(e.target.value)))} />
          </Campo>
        </div>
        {fim && <p className="text-sm text-gray-600">Retorno ao trabalho em {dataBR(iso(addDays(d(fim), 1)))}.</p>}

        <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
          <Info size={16} className="shrink-0" />
          <div>
            Até 2 períodos por ano, cada um com pelo menos 10 dias. Avise o Ministério do Trabalho e o sindicato com 15 dias de antecedência e
            afixe o aviso na empresa (CLT art. 139). Quem tem menos de 12 meses de casa tem os dias descontados como antecipados, como faz a
            contabilidade.
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5" checked={art140} onChange={(e) => setArt140(e.target.checked)} />
          <span>
            Aplicar o art. 140 da CLT a quem tem menos de 12 meses: férias proporcionais, dias a mais como licença remunerada e novo período
            aquisitivo a partir do primeiro dia das coletivas.
          </span>
        </label>

        {planos.length > 0 && (
          <div className="rounded-xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-sm">
              <span className="font-semibold">Quem entra ({incluidos.length})</span>
              <span className="flex gap-3 text-xs">
                <button type="button" className="text-marca-600 hover:underline" onClick={() => setFora(new Set())}>Marcar todos</button>
                <button type="button" className="text-marca-600 hover:underline" onClick={() => setFora(new Set(ativos.map((f) => f.id)))}>Desmarcar todos</button>
              </span>
            </div>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto text-sm">
              {planos.map((p) => (
                <li key={p.funcionario.id}>
                  <label className={`flex items-start gap-3 px-4 py-2 ${p.conflito ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={!!p.conflito}
                      checked={!p.conflito && !fora.has(p.funcionario.id)}
                      onChange={() => alternar(p.funcionario.id)}
                    />
                    <span className="flex-1">
                      <span className="font-medium">{p.funcionario.nome}</span>
                      <span className="block text-xs text-gray-500">{p.conflito ?? resumo(p)}</span>
                    </span>
                    {p.reiniciaPeriodo && <Selo cor="roxo">Novo período a partir de {dataBR(inicio)}</Selo>}
                    {p.conflito && <Selo cor="amarelo">Fica de fora</Selo>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          Já marcar como aprovadas
        </label>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={registrar} disabled={!incluidos.length || !!validacao?.erros.length || salvando}>
            {salvando ? 'Registrando…' : `Registrar para ${incluidos.length} ${incluidos.length === 1 ? 'pessoa' : 'pessoas'}`}
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
