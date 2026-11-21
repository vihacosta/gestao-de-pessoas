/**
 * Fechamento mensal: junta num .zip os documentos do mês para a contabilidade
 * (holerites e cartões assinados, atestados e licenças, folha de justificativas)
 * e aponta o que ainda falta. Não leva valores de salário nem CPF no resumo.
 */
import { addDays } from 'date-fns'
import PizZip from 'pizzip'
import { xlsx } from './beneficios'
import { d, dataBR, iso } from './clt'
import { extensao } from './documentos'
import { ocorrenciasDoMes, passaDaTolerancia, type Justificativa } from './justificativas'
import type { Ausencia, CartaoPontoSalvo, CategoriaDocumento, DocumentoGuardado, Funcionario, TipoAusencia } from './types'

export const PASTAS = {
  holerites: '1 - Holerites assinados',
  pontos: '2 - Cartões ponto assinados',
  atestados: '3 - Atestados e licenças',
  justificativas: '4 - Folha de justificativas',
} as const

/** Ausências que têm comprovante em papel */
const TIPOS_COM_COMPROVANTE: TipoAusencia[] = ['atestado', 'licenca_maternidade', 'licenca_paternidade', 'casamento', 'falecimento']

export type GrupoPendencia = 'holerite' | 'ponto' | 'comprovante' | 'justificativas'

export interface Pendencia {
  grupo: GrupoPendencia
  texto: string
  funcionarioId?: string
}

export interface ItemPacote {
  pasta: string
  /** Nome do arquivo dentro da pasta, já sem repetição */
  nome: string
  caminho: string
}

export interface LinhaFechamento {
  funcionario: Funcionario
  holerite: boolean
  ponto: boolean
  comprovantes: number
}

export interface Fechamento {
  mes: string
  linhas: LinhaFechamento[]
  itens: ItemPacote[]
  pendencias: Pendencia[]
  ocorrencias: number
  folhasJustificativa: number
}

/** Tira os caracteres que o Windows não aceita em nome de arquivo */
export const nomeDeArquivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'arquivo'

const ddmm = (data: string) => `${data.slice(8, 10)}-${data.slice(5, 7)}`

function diasNoMes(a: Pick<Ausencia, 'inicio' | 'fim'>, mes: string) {
  const dias: string[] = []
  for (let dt = d(a.inicio); iso(dt) <= a.fim; dt = addDays(dt, 1)) if (iso(dt).slice(0, 7) === mes) dias.push(iso(dt))
  return dias
}

export function montarFechamento(args: {
  mes: string
  /** Quem trabalhou em algum dia do mês */
  ativos: Funcionario[]
  funcionarios: Funcionario[]
  documentos: DocumentoGuardado[]
  ausencias: Ausencia[]
  pontos: CartaoPontoSalvo[]
  justificativas: Justificativa[]
  tolerancia: number
  nomesTipo: Record<TipoAusencia, string>
}): Fechamento {
  const { mes, documentos, ausencias, pontos, justificativas, tolerancia, nomesTipo } = args
  const ativos = [...args.ativos].sort((a, b) => a.nome.localeCompare(b.nome))
  const nomes = new Map(args.funcionarios.map((f) => [f.id, f.nome]))
  const itens: ItemPacote[] = []
  const usados = new Set<string>()
  const pendencias: Pendencia[] = []

  /** Mesmo nome na mesma pasta ganha (2), (3)... */
  function incluir(pasta: string, base: string, caminho: string) {
    const ext = extensao(caminho)
    const limpo = nomeDeArquivo(base)
    let nome = `${limpo}.${ext}`
    for (let n = 2; usados.has(`${pasta}/${nome}`.toLowerCase()); n++) nome = `${limpo} (${n}).${ext}`
    usados.add(`${pasta}/${nome}`.toLowerCase())
    itens.push({ pasta, nome, caminho })
  }

  const docs = (fid: string, cat: CategoriaDocumento) => documentos.filter((x) => x.funcionarioId === fid && x.categoria === cat && x.mes === mes)

  const comprovantesDoMes = ausencias.filter((a) => TIPOS_COM_COMPROVANTE.includes(a.tipo) && diasNoMes(a, mes).length > 0)

  const linhas = ativos.map((f) => {
    const holerites = docs(f.id, 'holerite')
    const cartoes = docs(f.id, 'ponto_assinado')
    holerites.forEach((x) => incluir(PASTAS.holerites, f.nome, x.caminho))
    cartoes.forEach((x) => incluir(PASTAS.pontos, f.nome, x.caminho))
    if (!holerites.length) pendencias.push({ grupo: 'holerite', texto: `${f.nome}: falta o holerite assinado`, funcionarioId: f.id })
    if (!cartoes.length) pendencias.push({ grupo: 'ponto', texto: `${f.nome}: falta o cartão ponto assinado`, funcionarioId: f.id })
    return { funcionario: f, holerite: holerites.length > 0, ponto: cartoes.length > 0, comprovantes: comprovantesDoMes.filter((a) => a.funcionarioId === f.id && a.anexo).length }
  })

  // Atestados e licenças lançados: vão no pacote ou entram como pendência
  for (const a of comprovantesDoMes) {
    const nome = nomes.get(a.funcionarioId)
    if (!nome) continue
    const quando = a.inicio === a.fim ? dataBR(a.inicio) : `${dataBR(a.inicio)} a ${dataBR(a.fim)}`
    if (a.anexo) incluir(PASTAS.atestados, `${nome} - ${nomesTipo[a.tipo]} ${ddmm(a.inicio)}`, a.anexo)
    else pendencias.push({ grupo: 'comprovante', texto: `${nome}: ${nomesTipo[a.tipo].toLowerCase()} de ${quando} sem comprovante anexado`, funcionarioId: a.funcionarioId })
  }

  // Atestado que aparece no cartão ponto e não tem comprovante lançado naquele dia
  for (const p of pontos) {
    const nome = nomes.get(p.funcionarioId)
    if (p.mes !== mes || !nome) continue
    const semAnexo = p.dias
      .filter((dia) => dia.rotulo === 'Atestado')
      .map((dia) => dia.data)
      .filter((data) => !ausencias.some((a) => a.funcionarioId === p.funcionarioId && a.tipo === 'atestado' && a.inicio <= data && a.fim >= data))
    if (semAnexo.length)
      pendencias.push({
        grupo: 'comprovante',
        texto: `${nome}: atestado no cartão ponto (${semAnexo.map((x) => dataBR(x).slice(0, 5)).join(', ')}) sem comprovante lançado`,
        funcionarioId: p.funcionarioId,
      })
  }

  const folhas = documentos.filter((x) => x.categoria === 'justificativas' && x.mes === mes).sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm))
  folhas.forEach((x) => incluir(PASTAS.justificativas, `Folha de justificativas ${mes.slice(5)}-${mes.slice(0, 4)}`, x.caminho))
  const ocorrencias = ocorrenciasDoMes(args.funcionarios, pontos, ausencias, mes, justificativas).filter((o) => !o.usoBanco && passaDaTolerancia(o, tolerancia)).length
  if (ocorrencias > 0 && !folhas.length)
    pendencias.push({ grupo: 'justificativas', texto: `Falta a folha de justificativas assinada (${ocorrencias} ${ocorrencias === 1 ? 'ocorrência' : 'ocorrências'} no mês)` })

  return { mes, linhas, itens, pendencias, ocorrencias, folhasJustificativa: folhas.length }
}

/** Linhas da planilha de resumo que vai dentro do pacote */
export function linhasResumo(f: Fechamento, tituloMes: string, falhas: ItemPacote[] = []): (string | number)[][] {
  const r: (string | number)[][] = [
    [`Fechamento mensal - ${tituloMes}`],
    [],
    ['Colaborador', 'Holerite assinado', 'Cartão ponto assinado', 'Atestados e licenças'],
    ...f.linhas.map((l) => [l.funcionario.nome, l.holerite ? 'Sim' : 'Falta', l.ponto ? 'Sim' : 'Falta', l.comprovantes]),
    [],
    ['Folha de justificativas', f.folhasJustificativa ? 'Sim' : f.ocorrencias ? 'Falta' : 'Sem ocorrências no mês'],
  ]
  if (f.pendencias.length) r.push([], ['Pendências'], ...f.pendencias.map((p) => [p.texto]))
  if (falhas.length) r.push([], ['Arquivos que não puderam ser incluídos'], ...falhas.map((x) => [`${x.pasta}/${x.nome}`]))
  return r
}

/** Baixa os arquivos e monta o .zip. Um arquivo que falhar não trava o pacote: volta em `falhas` e aparece no resumo. */
export async function gerarPacote(
  f: Fechamento,
  tituloMes: string,
  baixar: (caminho: string) => Promise<Blob>,
  aoAvancar?: (feitos: number, total: number) => void,
): Promise<{ zip: Blob; falhas: ItemPacote[] }> {
  const zip = new PizZip()
  const falhas: ItemPacote[] = []
  let feitos = 0
  for (const item of f.itens) {
    try {
      const bytes = new Uint8Array(await (await baixar(item.caminho)).arrayBuffer())
      zip.file(`${item.pasta}/${item.nome}`, bytes, { binary: true })
    } catch {
      falhas.push(item)
    }
    aoAvancar?.(++feitos, f.itens.length)
  }
  const resumo = xlsx(linhasResumo(f, tituloMes, falhas), 'Resumo')
  zip.file(`Resumo do fechamento ${f.mes}.xlsx`, new Uint8Array(await resumo.arrayBuffer()), { binary: true })
  return { zip: zip.generate({ type: 'blob', mimeType: 'application/zip', compression: 'STORE' }), falhas }
}
