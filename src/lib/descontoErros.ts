/**
 * Política de desconto por erros (aba "POLÍTICA DESCONTO POR ERROS" da planilha de funcionários):
 * - Um único erro dentro de 3 meses não é descontado.
 * - Mais de um erro em 3 meses: desconta a soma dos valores dividida pela quantidade de erros.
 * - Se a soma passar de R$ 200, desconta só o que passar de 200, mesmo com um único erro.
 * - Depois que a pessoa paga, a contagem de 3 meses recomeça no próximo erro.
 */
import { addDays, addMonths } from 'date-fns'
import { brl, d, dataBR, iso } from './clt'

/** Quebra ou erro lançado para um funcionário (tabela "erros") */
export interface ErroFuncionario {
  id: string
  funcionarioId: string
  data: string
  descricao: string
  valor: number
  /** Data em que o desconto foi feito (marca o erro como pago) */
  descontadoEm?: string
  /** Quanto foi descontado no total, no grupo de erros pago junto */
  valorDescontado?: number
  /** Identifica os erros pagos juntos (mesmo desconto) */
  pagamentoId?: string
}

export const LIMITE = 200
export const MESES = 3

/**
 * PENDENTE: vários erros em 3 meses somando mais de R$ 200.
 * A política não diz qual regra vale. O próprio exemplo da Maria na planilha (150 + 50 + 25 = 225, acima de 200)
 * desconta a média (R$ 75), e não o que passa de 200 (R$ 25). Até a empresa confirmar, o sistema usa "o maior dos dois",
 * que bate com os dois exemplos da planilha, e mostra o aviso com as duas contas.
 * Quando houver resposta, troque aqui: 'maior' | 'media' | 'excedente' | 'menor'.
 */
export type RegraVariosAcimaDoLimite = 'maior' | 'media' | 'excedente' | 'menor'
export const REGRA_VARIOS_ACIMA_DO_LIMITE: RegraVariosAcimaDoLimite = 'maior'

export interface GrupoErros {
  erros: ErroFuncionario[]
  /** Começo e fim (inclusive) do período de 3 meses que começa no primeiro erro */
  inicio: string
  fim: string
  total: number
  /** Período ainda não terminou: outro erro até `fim` entra neste grupo */
  aberto: boolean
  /** Já descontado (todos os erros marcados como pagos juntos) */
  pago: boolean
  descontadoEm?: string
  /** Valor a descontar (ou descontado, se pago). 0 = não desconta */
  desconto: number
  /** Vários erros somando mais de 200: regra ainda não confirmada pela empresa */
  aConfirmar: boolean
  /** Média dos erros e excedente de 200, para mostrar as duas contas no caso a confirmar */
  media: number
  excedente: number
}

const centavos = (v: number) => Math.round(v * 100) / 100

/** Quanto descontar de um grupo de erros do mesmo período de 3 meses */
export function calcularDesconto(valores: number[], regra: RegraVariosAcimaDoLimite = REGRA_VARIOS_ACIMA_DO_LIMITE) {
  const total = centavos(valores.reduce((s, v) => s + v, 0))
  const qtd = valores.length
  const media = qtd ? centavos(total / qtd) : 0
  const excedente = centavos(Math.max(0, total - LIMITE))
  const varios = qtd > 1
  const acima = total > LIMITE
  let desconto = 0
  if (varios && acima) desconto = { maior: Math.max(media, excedente), media, excedente, menor: Math.min(media, excedente) }[regra]
  else if (acima) desconto = excedente
  else if (varios) desconto = media
  return { total, media, excedente, desconto, aConfirmar: varios && acima }
}

/** Último dia do período de 3 meses que começa em `inicio` (ex.: 10/01 → 09/04) */
export const fimDoPeriodo = (inicio: string) => iso(addDays(addMonths(d(inicio), MESES), -1))

/**
 * Agrupa os erros de uma pessoa em períodos de 3 meses e calcula o desconto de cada um.
 * Erros já pagos ficam no grupo do pagamento; os demais formam períodos a partir do primeiro erro ainda não pago.
 * Mais recentes primeiro.
 */
export function gruposDeErros(erros: ErroFuncionario[], hoje: string, regra: RegraVariosAcimaDoLimite = REGRA_VARIOS_ACIMA_DO_LIMITE): GrupoErros[] {
  const ordenados = [...erros].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
  const grupos: GrupoErros[] = []

  const montar = (lista: ErroFuncionario[], pago: boolean): GrupoErros => {
    const inicio = lista[0].data
    const fim = fimDoPeriodo(inicio)
    const c = calcularDesconto(lista.map((e) => e.valor), regra)
    const descontadoEm = pago ? lista[0].descontadoEm : undefined
    return {
      erros: lista,
      inicio,
      fim,
      total: c.total,
      aberto: !pago && hoje <= fim,
      pago,
      descontadoEm,
      desconto: pago ? lista[0].valorDescontado ?? c.desconto : c.desconto,
      aConfirmar: c.aConfirmar,
      media: c.media,
      excedente: c.excedente,
    }
  }

  // Pagos: um grupo por pagamento
  const pagos = new Map<string, ErroFuncionario[]>()
  for (const e of ordenados) if (e.descontadoEm) {
      const k = e.pagamentoId ?? e.descontadoEm
      pagos.set(k, [...(pagos.get(k) ?? []), e])
    }
  for (const lista of pagos.values()) grupos.push(montar(lista, true))

  // Não pagos: o primeiro erro abre um período de 3 meses; o que cair nele entra no mesmo grupo
  let atual: ErroFuncionario[] = []
  for (const e of ordenados.filter((x) => !x.descontadoEm)) {
    if (atual.length && e.data > fimDoPeriodo(atual[0].data)) {
      grupos.push(montar(atual, false))
      atual = []
    }
    atual.push(e)
  }
  if (atual.length) grupos.push(montar(atual, false))

  return grupos.sort((a, b) => b.inicio.localeCompare(a.inicio))
}

/** Grupo em que um erro caiu */
export const grupoDoErro = (grupos: GrupoErros[], erroId: string) => grupos.find((g) => g.erros.some((e) => e.id === erroId))

/** Aviso curto: "não desconta (1º erro em 3 meses)", "desconta R$ 75,00", "descontado R$ 75,00 em 10/03/2026" */
export function aviso(g: GrupoErros): string {
  if (g.pago) return `descontado ${brl(g.desconto)}${g.descontadoEm ? ` em ${dataBR(g.descontadoEm)}` : ''}`
  if (g.desconto === 0) return g.erros.length === 1 ? 'não desconta (1º erro em 3 meses)' : 'não desconta'
  return `desconta ${brl(g.desconto)}`
}

/** Explicação da conta, em uma frase */
export function explicacao(g: GrupoErros): string {
  const qtd = g.erros.length
  const soma = g.erros.map((e) => brl(e.valor)).join(' + ')
  if (g.aConfirmar && g.pago) return `${qtd} erros: ${soma} = ${brl(g.total)}.`
  if (g.aConfirmar)
    return `${qtd} erros somando ${brl(g.total)}, acima de ${brl(LIMITE)}. Regra ainda a confirmar com a empresa: pela média seriam ${brl(g.media)}; só pelo que passa de ${brl(LIMITE)} seriam ${brl(g.excedente)}. Por enquanto o sistema calcula ${brl(g.desconto)}.`
  if (qtd === 1 && g.total > LIMITE) return `Erro de ${brl(g.total)}, acima de ${brl(LIMITE)}: desconta só o que passa de ${brl(LIMITE)}.`
  if (qtd === 1)
    return g.aberto
      ? `Único erro do período. Se houver outro erro até ${dataBR(g.fim)}, passa a descontar.`
      : `Único erro no período de ${dataBR(g.inicio)} a ${dataBR(g.fim)}: não é descontado.`
  return `${qtd} erros em 3 meses: ${soma} = ${brl(g.total)}, dividido por ${qtd} = ${brl(g.media)}.${g.aberto && !g.pago ? ` O valor muda se houver outro erro até ${dataBR(g.fim)}.` : ''}`
}
