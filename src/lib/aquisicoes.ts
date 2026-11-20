/**
 * Aquisição de mercadorias pelos funcionários (compras descontadas em folha, em parcelas).
 * Também lê a planilha "CONTROLE DE DESCONTOS EM FOLHA.xlsx" (linhas AQUISIÇÃO).
 */
import { addMonths, format, parseISO } from 'date-fns'
import { dataDaCelula } from './historicoPlanilha'

export interface Parcela {
  /** Data do desconto na folha (yyyy-mm-dd) */
  data: string
  valor: number
  paga: boolean
}

export interface Aquisicao {
  id: string
  funcionarioId: string
  /** Data da compra */
  data: string
  produto: string
  parcelas: Parcela[]
  observacao?: string
}

const centavos = (n: number) => Math.round(n * 100)

export const totalAquisicao = (a: Pick<Aquisicao, 'parcelas'>) => a.parcelas.reduce((s, p) => s + centavos(p.valor), 0) / 100
export const pendenteAquisicao = (a: Pick<Aquisicao, 'parcelas'>) => a.parcelas.filter((p) => !p.paga).reduce((s, p) => s + centavos(p.valor), 0) / 100
export const quitada = (a: Pick<Aquisicao, 'parcelas'>) => a.parcelas.every((p) => p.paga)

/** Divide o valor em parcelas mensais (os centavos que sobram vão na primeira) */
export function criarParcelas(valor: number, quantidade: number, primeiroDesconto: string): Parcela[] {
  const n = Math.max(1, Math.floor(quantidade))
  const total = centavos(valor)
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => ({
    data: format(addMonths(parseISO(primeiroDesconto), i), 'yyyy-MM-dd'),
    valor: (base + (i === 0 ? total - base * n : 0)) / 100,
    paga: false,
  }))
}

/** Parcelas ainda não pagas com desconto até o fim do mês (yyyy-MM) */
export function parcelasDoMes(aquisicoes: Aquisicao[], mes: string) {
  return aquisicoes.flatMap((a) => a.parcelas.map((p, i) => ({ a, p, i }))).filter(({ p }) => !p.paga && p.data.slice(0, 7) <= mes)
}

// ---------------------------------------------------------------- planilha antiga

export interface AquisicaoLida {
  aba: string
  /** Nome da pessoa tirado do nome da aba */
  pessoa: string
  data: string
  produto: string
  parcelas: Parcela[]
}

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

const valorNumero = (v: string | number | undefined) => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
  return n > 0 ? n : 0
}

/**
 * Linhas AQUISIÇÃO da planilha de descontos, agrupadas por compra (data + produto).
 * Abas antigas ("CONTROLE ULTRAMARINE AQUISIÇÃO", sem coluna TIPO) têm só DATA (do desconto) | VALOR | PARCELA | PRODUTO | STATUS.
 */
export function aquisicoesDaPlanilha(abas: { aba: string; linhas: (string | number)[][] }[]): AquisicaoLida[] {
  const out: AquisicaoLida[] = []
  for (const a of abas) {
    const iCab = a.linhas.findIndex((l) => l?.some((c) => semAcento(String(c ?? '')) === 'DATA'))
    if (iCab < 0) continue
    const cab = a.linhas[iCab].map((c) => semAcento(String(c ?? '')))
    const col = (re: RegExp) => cab.findIndex((c) => re.test(c))
    const [cData, cTipo, cProd, cPg, cValor, cStatus] = [col(/^DATA$/), col(/^TIPO$/), col(/^PRODUTO/), col(/^DATA DE PG/), col(/^VALOR/), col(/^STATUS/)]
    const antiga = cTipo < 0
    const pessoa = semAcento(a.aba).replace(/^X INATIVO\s*-\s*/, '').replace(/\s*-\s*\d{4}$/, '').trim()
    const grupos = new Map<string, AquisicaoLida>()
    for (const l of a.linhas.slice(iCab + 1)) {
      if (!l) continue
      if (!antiga && !semAcento(String(l[cTipo] ?? '')).startsWith('AQUISI')) continue
      const valor = valorNumero(l[cValor])
      const desconto = dataDaCelula(antiga ? l[cData] : l[cPg])
      const dataCompra = antiga ? undefined : dataDaCelula(l[cData])
      const compra = dataCompra ?? desconto
      if (!valor || !compra) continue
      const produto = String(l[cProd] ?? '').trim() || 'Mercadoria'
      // sem data da compra, as parcelas da mesma compra se juntam pelo produto e pelo total de parcelas ("1/4")
      const totalParcelas = /\/\s*(\d+)/.exec(String(l[col(/^PARCELA/)] ?? ''))?.[1] ?? '1'
      const chave = dataCompra ? `${dataCompra}|${produto}` : `sem-data|${produto}|${totalParcelas}`
      const g = grupos.get(chave) ?? { aba: a.aba, pessoa, data: compra, produto, parcelas: [] }
      if (compra < g.data) g.data = compra
      g.parcelas.push({ data: desconto ?? compra, valor: Math.round(valor * 100) / 100, paga: /QUITAD/.test(semAcento(String(l[cStatus] ?? ''))) })
      grupos.set(chave, g)
    }
    for (const g of grupos.values()) g.parcelas.sort((x, y) => x.data.localeCompare(y.data))
    out.push(...grupos.values())
  }
  return out
}
