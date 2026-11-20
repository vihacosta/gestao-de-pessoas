/**
 * Cartões ponto digitalizados de 2017–2019: o PDF do mês inteiro (todos os funcionários, só imagem)
 * foi guardado inteiro na ficha de cada pessoa. Aqui se escolhe de quem é cada página e cada um
 * fica só com as suas.
 */
import type { DocumentoGuardado } from './types'

/** Final do título dado na importação aos PDFs do mês inteiro */
export const SUFIXO_MES_INTEIRO = 'todos os funcionários (digitalizado)'

export const ehMesInteiro = (d: DocumentoGuardado) => d.categoria === 'ponto_assinado' && !!d.mes && d.titulo.endsWith(SUFIXO_MES_INTEIRO)

export interface MesParaSeparar {
  mes: string
  /** Uma cópia do mesmo PDF na ficha de cada pessoa */
  copias: DocumentoGuardado[]
}

/** Meses com o PDF inteiro guardado em várias fichas, do mais recente para o mais antigo */
export function mesesParaSeparar(documentos: DocumentoGuardado[]): MesParaSeparar[] {
  const porMes = new Map<string, DocumentoGuardado[]>()
  for (const d of documentos.filter(ehMesInteiro)) porMes.set(d.mes!, [...(porMes.get(d.mes!) ?? []), d])
  return [...porMes.entries()].map(([mes, copias]) => ({ mes, copias })).sort((a, b) => b.mes.localeCompare(a.mes))
}

export interface PlanoSeparacao {
  /** Páginas (começando em 0) de cada pessoa, na ordem do PDF */
  paginas: Map<string, number[]>
  /** Pessoas sem nenhuma página: a cópia do mês inteiro sai da ficha delas */
  semPagina: string[]
  /** Páginas que não ficaram com ninguém (capa, página em branco...) */
  paginasSemDono: number[]
}

/**
 * `donos[i]` = pessoas da página i (uma página pode ter o cartão de mais de uma pessoa).
 * `comCopia` = quem tem a cópia do mês inteiro na ficha. Uma página pode ir também para quem não tem
 * (ex-funcionário com a data de saída errada no cadastro): essa pessoa ganha o cartão como documento novo.
 */
export function planoSeparacao(comCopia: string[], donos: string[][]): PlanoSeparacao {
  const paginas = new Map<string, number[]>()
  const paginasSemDono: number[] = []
  donos.forEach((ids, i) => {
    if (!ids.length) paginasSemDono.push(i)
    for (const id of ids) paginas.set(id, [...(paginas.get(id) ?? []), i])
  })
  return { paginas, semPagina: comCopia.filter((id) => !paginas.has(id)), paginasSemDono }
}

export const tituloCartaoDigitalizado = (mes: string) => `Cartão ponto ${mes.slice(5)}/${mes.slice(0, 4)} (digitalizado)`

/** Onde fica guardado o PDF original do mês inteiro, para não perder nada */
export const caminhoOriginal = (mes: string) => `ponto/${mes}/completo-digitalizado.pdf`

/** Marcação feita e guardada para conferir antes de separar */
export const caminhoMarcacao = (mes: string) => `ponto/${mes}/marcacao-digitalizado.json`
