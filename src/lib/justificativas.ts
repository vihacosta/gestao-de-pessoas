/**
 * Folha de justificativas: lista as faltas, atrasos e saídas antecipadas do mês
 * (do cartão ponto importado e das ocorrências lançadas à mão) para cada pessoa escrever o motivo e assinar.
 */
import { addDays, format } from 'date-fns'
import { d, iso } from './clt'
import type { DiaPonto } from './cartaoPonto'
import type { Ausencia, CartaoPontoSalvo, Funcionario, TipoAusencia } from './types'

/** Motivo escrito para uma ocorrência. id = `${funcionarioId}-${data}` */
export interface Justificativa {
  id: string
  funcionarioId: string
  data: string
  motivo: string
  /** Só nos registros importados da planilha antiga (id começa com "hist-"): Falta, Atestado, Atraso, Atraso no almoço, Saída antecipada */
  descricao?: string
  origem?: 'planilha'
}

export interface Ocorrencia {
  id: string // `${funcionarioId}-${data}`
  funcionarioId: string
  data: string
  descricao: string
  /** Minutos faltando no dia (vazio = dia inteiro, lançado à mão) */
  minutos?: number
  batidas?: number[]
  origem: 'cartao' | 'manual' | 'planilha'
  /** Observação da ocorrência lançada à mão, usada como motivo sugerido */
  observacao?: string
}

const TOLERANCIA = 10 // minutos

/** Tipos lançados à mão que entram na folha (atestado e licenças já têm comprovante) */
export const tiposNaFolha: Partial<Record<TipoAusencia, string>> = {
  atraso: 'Atraso',
  saida_antecipada: 'Saída antecipada',
  falta_injustificada: 'Falta',
  falta_justificada: 'Falta justificada',
}

const mediana = (v: number[]) => {
  if (!v.length) return undefined
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Classifica o dia comparando as batidas com o horário habitual da pessoa naquele mês */
export function descreverDia(dia: DiaPonto, todos: DiaPonto[]): string {
  if (dia.rotulo === 'Falta' || dia.batidas.length === 0) return 'Falta'
  const normais = todos.filter((x) => !x.rotulo && x.faltas === 0 && x.batidas.length >= 2)
  const entrada = mediana(normais.map((x) => x.batidas[0]))
  const saida = mediana(normais.map((x) => x.batidas[x.batidas.length - 1]))
  const atrasou = entrada != null && dia.batidas[0] > entrada + TOLERANCIA
  const saiuCedo = saida != null && dia.batidas.length >= 2 && dia.batidas[dia.batidas.length - 1] < saida - TOLERANCIA
  if (atrasou && saiuCedo) return 'Atraso e saída antecipada'
  if (atrasou) return 'Atraso'
  if (saiuCedo) return 'Saída antecipada'
  return 'Horas faltando'
}

/** Ocorrências do mês, por data e nome */
export function ocorrenciasDoMes(funcionarios: Funcionario[], pontos: CartaoPontoSalvo[], ausencias: Ausencia[], mes: string): Ocorrencia[] {
  const lista: Ocorrencia[] = []
  const ids = new Set(funcionarios.map((f) => f.id))
  const tem = new Set<string>()

  for (const p of pontos) {
    if (p.mes !== mes || !ids.has(p.funcionarioId)) continue
    for (const dia of p.dias) {
      if (dia.faltas <= 0 || (dia.rotulo && dia.rotulo !== 'Falta')) continue
      const id = `${p.funcionarioId}-${dia.data}`
      tem.add(id)
      lista.push({ id, funcionarioId: p.funcionarioId, data: dia.data, descricao: descreverDia(dia, p.dias), minutos: dia.faltas, batidas: dia.batidas, origem: 'cartao' })
    }
  }

  for (const a of ausencias) {
    const desc = tiposNaFolha[a.tipo]
    if (!desc || !ids.has(a.funcionarioId)) continue
    for (let dt = d(a.inicio); iso(dt) <= a.fim; dt = addDays(dt, 1)) {
      const data = iso(dt)
      if (data.slice(0, 7) !== mes) continue
      const id = `${a.funcionarioId}-${data}`
      if (tem.has(id)) continue
      tem.add(id)
      lista.push({
        id,
        funcionarioId: a.funcionarioId,
        data,
        descricao: desc,
        minutos: a.horas != null && a.inicio === a.fim ? Math.round(a.horas * 60) : undefined,
        origem: 'manual',
        observacao: a.observacao,
      })
    }
  }

  const nome = new Map(funcionarios.map((f) => [f.id, f.nome]))
  return lista.sort((a, b) => a.data.localeCompare(b.data) || (nome.get(a.funcionarioId) ?? '').localeCompare(nome.get(b.funcionarioId) ?? ''))
}

/** Falta (ou ocorrência sem minutos, lançada à mão como dia inteiro) sempre entra; atraso/saída só se passar de `tolerancia` minutos */
export const passaDaTolerancia = (o: Ocorrencia, tolerancia: number) =>
  o.minutos == null || o.descricao.startsWith('Falta') || o.minutos > tolerancia

export type Categoria = 'falta' | 'atraso' | 'saida' | 'atestado' | 'outro'

export const nomesCategoria: Record<Categoria, string> = {
  falta: 'Faltas',
  atraso: 'Atrasos',
  saida: 'Saídas antecipadas',
  atestado: 'Atestados',
  outro: 'Horas faltando',
}

/** "Atraso e saída antecipada" conta como atraso */
export function categoria(o: Ocorrencia): Categoria {
  if (o.descricao === 'Atestado') return 'atestado'
  if (o.descricao.startsWith('Falta')) return 'falta'
  if (o.descricao.startsWith('Atraso')) return 'atraso'
  if (o.descricao === 'Saída antecipada') return 'saida'
  return 'outro'
}

/**
 * Histórico de todos os meses: as mesmas ocorrências da folha e também os atestados
 * (do cartão ponto e lançados à mão), para contar quantas vezes cada pessoa faltou.
 */
export function historicoOcorrencias(funcionarios: Funcionario[], pontos: CartaoPontoSalvo[], ausencias: Ausencia[], justificativas: Justificativa[] = []): Ocorrencia[] {
  const meses = new Set<string>(pontos.map((p) => p.mes))
  for (const a of ausencias) for (let dt = d(a.inicio); iso(dt) <= a.fim; dt = addDays(dt, 1)) meses.add(iso(dt).slice(0, 7))
  const lista = [...meses].flatMap((m) => ocorrenciasDoMes(funcionarios, pontos, ausencias, m))
  const tem = new Set(lista.map((o) => o.id))
  const ids = new Set(funcionarios.map((f) => f.id))
  const incluir = (o: Ocorrencia) => {
    if (tem.has(o.id) || !ids.has(o.funcionarioId)) return
    tem.add(o.id)
    lista.push(o)
  }
  for (const p of pontos)
    for (const dia of p.dias)
      if (dia.rotulo === 'Atestado') incluir({ id: `${p.funcionarioId}-${dia.data}`, funcionarioId: p.funcionarioId, data: dia.data, descricao: 'Atestado', origem: 'cartao' })
  for (const a of ausencias) {
    if (a.tipo !== 'atestado') continue
    for (let dt = d(a.inicio); iso(dt) <= a.fim; dt = addDays(dt, 1))
      incluir({ id: `${a.funcionarioId}-${iso(dt)}`, funcionarioId: a.funcionarioId, data: iso(dt), descricao: 'Atestado', origem: 'manual', observacao: a.observacao })
  }
  // Planilha antiga: se o mesmo dia já veio do cartão ou foi lançado à mão, não repete
  const porDia = new Map(lista.map((o) => [`${o.funcionarioId}-${o.data}`, o]))
  for (const j of justificativas) {
    if (j.origem !== 'planilha' || !j.descricao || !ids.has(j.funcionarioId)) continue
    const jaTem = porDia.get(`${j.funcionarioId}-${j.data}`)
    if (jaTem) {
      if (!jaTem.observacao && !justificativas.some((x) => x.id === jaTem.id)) jaTem.observacao = j.motivo
      continue
    }
    lista.push({ id: j.id, funcionarioId: j.funcionarioId, data: j.data, descricao: j.descricao, origem: 'planilha' })
  }
  return lista.sort((a, b) => b.data.localeCompare(a.data))
}

/** Quantas ocorrências de cada tipo */
export function contar(lista: Ocorrencia[]): Record<Categoria, number> {
  const r: Record<Categoria, number> = { falta: 0, atraso: 0, saida: 0, atestado: 0, outro: 0 }
  for (const o of lista) r[categoria(o)]++
  return r
}

export const hhmm = (min: number) => `${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}:${String(Math.abs(min) % 60).padStart(2, '0')}`

/** "Atraso (00:25)"; falta de dia inteiro fica só "Falta" */
export const textoOcorrencia = (o: Ocorrencia) => {
  const diaInteiro = o.descricao === 'Falta' && (o.minutos == null || o.minutos >= 420)
  return o.minutos != null && !diaInteiro ? `${o.descricao} (${hhmm(o.minutos)})` : o.descricao
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** HTML da folha para imprimir: data, nome, ocorrência, motivo e assinatura, com linhas em branco no fim */
export function htmlFolha(args: { titulo: string; ocorrencias: Ocorrencia[]; nome: (id: string) => string; motivo: (o: Ocorrencia) => string; linhasEmBranco?: number }) {
  const linhas = args.ocorrencias
    .map(
      (o) => `<tr><td>${format(d(o.data), 'dd/MM')}</td><td>${esc(args.nome(o.funcionarioId))}</td><td>${esc(textoOcorrencia(o))}${
        o.batidas?.length ? `<div class="bat">${o.batidas.map(hhmm).join(' ')}</div>` : ''
      }</td><td>${esc(args.motivo(o))}</td><td></td></tr>`,
    )
    .join('')
  const brancas = '<tr><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(args.linhasEmBranco ?? 5)
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(args.titulo)}</title><style>
@page { size: A4 landscape; margin: 12mm }
body { font-family: Arial, sans-serif; font-size: 11pt; color: #000 }
h1 { font-size: 15pt; margin: 0 0 4px } p { margin: 0 0 10px; font-size: 9.5pt }
table { width: 100%; border-collapse: collapse } th, td { border: 1px solid #000; padding: 5px 6px; vertical-align: top; text-align: left }
th { background: #eee; font-size: 9.5pt } tr { height: 34px; page-break-inside: avoid }
td:nth-child(1) { width: 48px } td:nth-child(2) { width: 22% } td:nth-child(3) { width: 20% } td:nth-child(5) { width: 25% }
.bat { font-size: 8pt; color: #444; margin-top: 2px }
</style></head><body>
<h1>${esc(args.titulo)}</h1>
<p>Escreva o motivo de cada falta, atraso ou saída antecipada e assine. Ao assinar, declaro que a informação é verdadeira.</p>
<table><thead><tr><th>Data</th><th>Funcionário</th><th>Ocorrência</th><th>Motivo</th><th>Assinatura</th></tr></thead><tbody>${linhas}${brancas}</tbody></table>
<script>window.onload = () => { window.print() }</script>
</body></html>`
}
