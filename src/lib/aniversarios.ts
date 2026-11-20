/**
 * Aniversários de nascimento, marcos de empresa com presente (1, 3, 5, 10 e 15 anos)
 * e conferência com a planilha "RELAÇÃO DE FUNCIONÁRIOS ATIVOS.xlsx".
 * Datas em yyyy-mm-dd, no fuso local.
 */
import { addYears, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { aniversarioEmpresa } from './clt'
import { dataDaCelula } from './historicoPlanilha'
import type { Funcionario } from './types'

// ---------------------------------------------------------------- marcos com presente

/** Anos de casa em que a empresa dá presente */
export const MARCOS_PRESENTE = [1, 3, 5, 10, 15] as const

export const ehMarcoPresente = (anos: number) => (MARCOS_PRESENTE as readonly number[]).includes(anos)

/** Texto do selo, ex.: "5 anos: presente" */
export const textoMarco = (anos: number) => `${anos} ${anos === 1 ? 'ano' : 'anos'}: presente`

/** Próximo aniversário de empresa, dizendo se é um marco com presente */
export function proximoMarcoEmpresa(dataAdmissao: string, hoje: string) {
  const a = aniversarioEmpresa(dataAdmissao, hoje)
  return { ...a, presente: ehMarcoPresente(a.anosNoProximo) }
}

// ---------------------------------------------------------------- aniversário de nascimento

/**
 * Próximo aniversário (hoje conta como próximo, com diasAte = 0).
 * Quem nasceu em 29/02 comemora em 28/02 nos anos que não são bissextos.
 */
export function aniversarioNascimento(dataNascimento: string, hoje: string) {
  const nasc = parseISO(dataNascimento)
  const h = parseISO(hoje)
  let anos = h.getFullYear() - nasc.getFullYear()
  let proximo = addYears(nasc, anos)
  if (differenceInCalendarDays(proximo, h) < 0) proximo = addYears(nasc, ++anos)
  return { proximo: format(proximo, 'yyyy-MM-dd'), diasAte: differenceInCalendarDays(proximo, h), idade: anos }
}

/** Aniversariantes (ativos, com data de nascimento) dos próximos `dias` dias, do mais próximo ao mais distante */
export function proximosAniversariantes(funcionarios: Funcionario[], hoje: string, dias = 30) {
  return funcionarios
    .filter((f) => !f.dataDemissao && f.dataNascimento)
    .map((f) => ({ f, a: aniversarioNascimento(f.dataNascimento!, hoje) }))
    .filter((x) => x.a.diasAte <= dias)
    .sort((a, b) => a.a.diasAte - b.a.diasAte || a.f.nome.localeCompare(b.f.nome))
}

// ---------------------------------------------------------------- planilha de ativos

export interface LinhaAtivos {
  linha: number
  nome: string
  situacao: string
  /** Só dia e mês: a planilha guarda o aniversário sem o ano de nascimento */
  aniversario?: { dia: number; mes: number }
  admissao?: string
}

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/** Linhas da aba "FUNCIONARIOS ATIVOS" (cabeçalho com FUNCIONÁRIO, SITUAÇÃO, ANIVERSÁRIO e DATA ADMISSÃO) */
export function linhasDosAtivos(abas: { aba: string; linhas: (string | number)[][] }[]): LinhaAtivos[] {
  const aba = abas.find((a) => semAcento(a.aba) === 'FUNCIONARIOS ATIVOS') ?? abas[0]
  if (!aba) return []
  const iCab = aba.linhas.findIndex((l) => l?.some((c) => semAcento(String(c ?? '')) === 'FUNCIONARIO'))
  if (iCab < 0) return []
  const cab = aba.linhas[iCab].map((c) => semAcento(String(c ?? '')))
  const col = (nome: string) => cab.indexOf(nome)
  const [cNome, cSit, cAniv, cAdm] = [col('FUNCIONARIO'), col('SITUACAO'), col('ANIVERSARIO'), col('DATA ADMISSAO')]
  const out: LinhaAtivos[] = []
  for (let i = iCab + 1; i < aba.linhas.length; i++) {
    const l = aba.linhas[i]
    const nome = String(l?.[cNome] ?? '').trim()
    if (!nome || semAcento(nome) === 'DESLIGADO') continue
    const aniv = cAniv >= 0 ? dataDaCelula(l[cAniv]) : undefined
    out.push({
      linha: i + 1,
      nome,
      situacao: semAcento(String(l[cSit] ?? '')),
      aniversario: aniv ? { dia: Number(aniv.slice(8, 10)), mes: Number(aniv.slice(5, 7)) } : undefined,
      admissao: cAdm >= 0 ? dataDaCelula(l[cAdm]) : undefined,
    })
  }
  return out
}

/** Funcionário com o mesmo nome (sem acento/maiúsculas), ou o único com nome começando igual, ou com o mesmo primeiro e último nome */
export function acharFuncionario<T extends { nome: string }>(nome: string, funcionarios: T[]): T | undefined {
  const alvo = semAcento(nome)
  const unico = (lista: T[]) => (lista.length === 1 ? lista[0] : undefined)
  const iguais = funcionarios.filter((f) => semAcento(f.nome) === alvo)
  if (iguais.length) return unico(iguais)
  const comeca = funcionarios.filter((f) => {
    const n = semAcento(f.nome)
    return n && (n.startsWith(alvo + ' ') || alvo.startsWith(n + ' '))
  })
  if (comeca.length) return unico(comeca)
  const pontas = (s: string) => {
    const p = semAcento(s).split(' ')
    return `${p[0]} ${p[p.length - 1]}`
  }
  return unico(funcionarios.filter((f) => pontas(f.nome) === pontas(nome)))
}

export interface Conferencia {
  f: Funcionario
  planilha?: LinhaAtivos
  semNascimento: boolean
  /** Dia/mês do sistema diferente do aniversário da planilha */
  nascimentoDiferente: boolean
  admissaoDiferente: boolean
}

/**
 * Compara os funcionários ativos do sistema com a planilha.
 * Devolve só quem tem algo a corrigir e, à parte, os ativos da planilha que não estão no sistema.
 */
export function conferirAtivos(funcionarios: Funcionario[], linhas: LinhaAtivos[]) {
  const ativosPlanilha = linhas.filter((l) => l.situacao !== 'DESLIGADO')
  const ativos = funcionarios.filter((f) => !f.dataDemissao).sort((a, b) => a.nome.localeCompare(b.nome))
  const achados = new Set<LinhaAtivos>()
  const itens: Conferencia[] = []
  for (const f of ativos) {
    const planilha = acharFuncionario(f.nome, ativosPlanilha)
    if (planilha) achados.add(planilha)
    const nasc = f.dataNascimento
    const c: Conferencia = {
      f,
      planilha,
      semNascimento: !nasc,
      nascimentoDiferente:
        !!nasc && !!planilha?.aniversario && (Number(nasc.slice(8, 10)) !== planilha.aniversario.dia || Number(nasc.slice(5, 7)) !== planilha.aniversario.mes),
      admissaoDiferente: !!planilha?.admissao && planilha.admissao !== f.dataAdmissao,
    }
    if (c.semNascimento || c.nascimentoDiferente || c.admissaoDiferente) itens.push(c)
  }
  return { itens, foraDoSistema: ativosPlanilha.filter((l) => !achados.has(l)) }
}

/** Último salário bruto de cada pessoa na aba "FOLHA DE PAGAMENTO" (nome sem acento → valor e data do pagamento) */
export function salariosDaFolha(abas: { aba: string; linhas: (string | number)[][] }[]) {
  const out = new Map<string, { valor: number; data: string }>()
  const aba = abas.find((a) => semAcento(a.aba) === 'FOLHA DE PAGAMENTO')
  if (!aba) return out
  const iCab = aba.linhas.findIndex((l) => l?.some((c) => semAcento(String(c ?? '')) === 'FUNCIONARIO'))
  if (iCab < 0) return out
  const cab = aba.linhas[iCab].map((c) => semAcento(String(c ?? '')))
  const [cNome, cData, cSal] = [cab.indexOf('FUNCIONARIO'), cab.indexOf('DATA PAGAMENTO DA FOLHA'), cab.indexOf('SALARIO BRUTO')]
  if (cNome < 0 || cSal < 0) return out
  for (const l of aba.linhas.slice(iCab + 1)) {
    const nome = semAcento(String(l?.[cNome] ?? ''))
    const v = l?.[cSal]
    const valor = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    if (!nome || !(valor > 0)) continue
    const data = (cData >= 0 ? dataDaCelula(l[cData]) : undefined) ?? ''
    const atual = out.get(nome)
    if (!atual || data >= atual.data) out.set(nome, { valor, data })
  }
  return out
}

const MINUSCULAS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'])
/** "MARIA DA SILVA" → "Maria da Silva" */
export const nomeProprio = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p.toUpperCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(' ')

/**
 * Cadastro novo a partir de uma linha da planilha de ativos (precisa da data de admissão).
 * CPF, cargo e o ano de nascimento não estão na planilha: ficam para completar no cadastro.
 */
export function funcionarioDaPlanilha(l: LinhaAtivos, salario?: { valor: number }): Funcionario | undefined {
  if (!l.admissao) return undefined
  return {
    id: crypto.randomUUID(),
    nome: nomeProprio(l.nome),
    cpf: '',
    cargo: '',
    tipo: 'clt',
    dataAdmissao: l.admissao,
    salarios: salario ? [{ data: l.admissao, valor: salario.valor, motivo: 'Importado da planilha (último salário da folha)' }] : [],
    observacoes: 'Cadastrado pela planilha de ativos: completar CPF, cargo e data de nascimento.',
  }
}

/** "09/10" */
export const diaMes = (a: { dia: number; mes: number }) => `${String(a.dia).padStart(2, '0')}/${String(a.mes).padStart(2, '0')}`

/** "dd/mm/aaaa" digitado → yyyy-mm-dd (ou undefined se inválido) */
export function lerDataBR(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(ano, mes - 1, dia)
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia || ano < 1900) return undefined
  return format(d, 'yyyy-MM-dd')
}
