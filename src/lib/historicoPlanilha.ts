/**
 * Importação da planilha antiga "CONTROLE ATRASOS E FALTAS.xlsx"
 * (colunas: DATA | NOME | FALTA / ATRASO / PONTO / EXTRA | ANOTAÇÕES | OCORRÊNCIA).
 * Cada linha vira um registro de histórico guardado na tabela de justificativas.
 */
import PizZip from 'pizzip'
import { addDays, format } from 'date-fns'
import type { Justificativa } from './justificativas'

export interface LinhaPlanilha {
  aba: string
  linha: number
  data?: string // yyyy-mm-dd
  nome: string
  tipo: string
  detalhe: string
  motivo: string
}

// ---------------------------------------------------------------- leitura do .xlsx

const texto = (el: Element | null | undefined) => el?.textContent ?? ''
const colunaDe = (ref: string) => {
  const letras = ref.replace(/\d+/g, '')
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/** Data do Excel (número de série) ou texto dd/mm/aaaa → yyyy-mm-dd */
export function dataDaCelula(v: string | number | undefined): string | undefined {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN
  if (!Number.isNaN(n)) return n > 20000 && n < 80000 ? format(addDays(new Date(1899, 11, 30), Math.floor(n)), 'yyyy-MM-dd') : undefined
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return undefined
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** Lê todas as abas: nome da aba → linhas (cada célula como texto ou número) */
export function lerXlsx(buf: ArrayBuffer): { aba: string; linhas: (string | number)[][] }[] {
  const zip = new PizZip(buf)
  const xml = (caminho: string) => {
    const f = zip.file(caminho)
    return f ? new DOMParser().parseFromString(f.asText(), 'application/xml') : null
  }
  const compartilhados = [...(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? [])].map((si) =>
    [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''),
  )
  const rels = new Map(
    [...(xml('xl/_rels/workbook.xml.rels')?.getElementsByTagName('Relationship') ?? [])].map((r) => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']),
  )
  const abas = [...(xml('xl/workbook.xml')?.getElementsByTagName('sheet') ?? [])]
  return abas.map((s) => {
    const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    const alvo = (rels.get(rid) ?? '').replace(/^\/?(xl\/)?/, '')
    const doc = xml(`xl/${alvo}`)
    const linhas: (string | number)[][] = []
    for (const row of [...(doc?.getElementsByTagName('row') ?? [])]) {
      const r = Number(row.getAttribute('r')) - 1
      const cel: (string | number)[] = []
      for (const c of [...row.getElementsByTagName('c')]) {
        const t = c.getAttribute('t')
        const v = texto(c.getElementsByTagName('v')[0])
        const valor = t === 's' ? compartilhados[Number(v)] ?? '' : t === 'inlineStr' ? texto(c.getElementsByTagName('is')[0]) : t === 'str' || t === 'b' || t === 'e' ? v : v === '' ? '' : Number(v)
        cel[colunaDe(c.getAttribute('r') ?? 'A')] = valor
      }
      linhas[r] = cel
    }
    return { aba: s.getAttribute('name') ?? '', linhas }
  })
}

/** Linhas da planilha de atrasos e faltas (todas as abas com o cabeçalho DATA | NOME) */
export function linhasDaPlanilha(abas: { aba: string; linhas: (string | number)[][] }[]): LinhaPlanilha[] {
  const out: LinhaPlanilha[] = []
  const s = (v: unknown) => String(v ?? '').trim()
  for (const { aba, linhas } of abas) {
    const iCab = linhas.findIndex((l) => l && s(l[0]).toUpperCase() === 'DATA' && s(l[1]).toUpperCase() === 'NOME')
    if (iCab < 0) continue
    for (let i = iCab + 1; i < linhas.length; i++) {
      const l = linhas[i]
      if (!l || !s(l[1])) continue
      out.push({ aba, linha: i + 1, data: dataDaCelula(l[0]), nome: s(l[1]).toUpperCase(), tipo: s(l[2]).toUpperCase(), detalhe: s(l[3]), motivo: s(l[4]) })
    }
  }
  return out
}

// ---------------------------------------------------------------- classificação

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/** Detalhes que são só o tipo escrito por extenso (não precisam ir para o motivo) */
const detalhesPadrao = new Set(['CHEGOU ATRASADA', 'CHEGOU ATRASADO', 'SAIU MAIS CEDO', 'SAIRAM MAIS CEDO', 'NAO VEIO', 'ATRASOU NO ALMOCO'])

/**
 * Descrição usada no sistema (Falta, Atestado, Atraso, Atraso no almoço, Saída antecipada)
 * ou o motivo de não importar (ponto, hora extra e banco de horas não são faltas nem atrasos).
 */
export function classificar(l: LinhaPlanilha): { descricao: string } | { ignorar: string } {
  if (!l.data) return { ignorar: 'sem data' }
  if (l.nome === 'TODAS' || l.nome === 'TODOS') return { ignorar: 'lançamento para todos' }
  const det = semAcento(l.detalhe)
  const tipo = semAcento(l.tipo)
  const motivo = semAcento(l.motivo)
  const atestado = /ATESTADO/.test(motivo)
  // Uso do banco de horas não é falta (política de mobilidade, item 4.2)
  if (tipo === 'EXTRA' || tipo === 'BANCO DE HORAS' || /BANCO DE HORAS|HORA EXTRA/.test(det) || /BANCO DE HORAS/.test(motivo))
    return { ignorar: 'hora extra / banco de horas' }
  if (/NAO VEIO|VEIO E FOI EMBORA/.test(det)) return { descricao: atestado ? 'Atestado' : 'Falta' }
  if (/ALMOCO/.test(det) && /ATRAS/.test(det)) return { descricao: 'Atraso no almoço' }
  if (/CHEGOU|ATRASAD/.test(det) && !/PONTO/.test(det)) return { descricao: 'Atraso' }
  if (/SAIU|SAIRAM|SAIDA|EMBORA/.test(det)) return { descricao: 'Saída antecipada' }
  if (tipo === 'FALTA') return { descricao: atestado ? 'Atestado' : 'Falta' }
  if (tipo === 'ATRASO') return { descricao: 'Atraso' }
  return { ignorar: 'problema de ponto' }
}

/** Motivo guardado: a ocorrência e, quando a anotação traz algo além do tipo (ex.: "FER SAIU AS 16:30"), ela entre parênteses */
export function motivoDaLinha(l: LinhaPlanilha) {
  const det = l.detalhe && !detalhesPadrao.has(semAcento(l.detalhe)) ? ` (${l.detalhe})` : ''
  return `${l.motivo}${det}`.trim()
}

/** Registros de histórico para as linhas cujo nome foi ligado a um funcionário */
export function registrosDoHistorico(linhas: LinhaPlanilha[], vinculo: Map<string, string>): Justificativa[] {
  const out: Justificativa[] = []
  const porDia = new Map<string, number>()
  for (const l of linhas) {
    const c = classificar(l)
    const funcionarioId = vinculo.get(l.nome)
    if ('ignorar' in c || !funcionarioId || !l.data) continue
    const chave = `${funcionarioId}-${l.data}`
    const n = (porDia.get(chave) ?? 0) + 1
    porDia.set(chave, n)
    // id fixo: importar de novo substitui em vez de duplicar
    out.push({ id: `hist-${chave}-${n}`, funcionarioId, data: l.data, motivo: motivoDaLinha(l), descricao: c.descricao, origem: 'planilha' })
  }
  return out
}

/** Sugestão de vínculo: primeiro nome igual (ou nome completo começando igual) a um único funcionário */
export function sugerirVinculo(nomePlanilha: string, funcionarios: { id: string; nome: string }[]): string | undefined {
  const alvo = semAcento(nomePlanilha).trim()
  const iguais = funcionarios.filter((f) => {
    const n = semAcento(f.nome).trim()
    return n === alvo || n.startsWith(alvo + ' ')
  })
  return iguais.length === 1 ? iguais[0].id : undefined
}
