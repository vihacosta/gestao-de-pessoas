/**
 * Folha do mês, dentro do Fechamento mensal, com as colunas da aba "FOLHA DE PAGAMENTO" da planilha.
 * SALÁRIO TOTAL segue a fórmula da planilha: bruto + mobilidade + cultura + alimentação − desconto do vale + comissão.
 * Compras, erros, adiantamento, vale transporte e horas aparecem à parte e não mudam esse total, como na planilha.
 */
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay } from 'date-fns'
import { xlsx, linhasCartao } from './beneficios'
import type { MarcaBanco } from './bonus'
import { d, iso, salarioEm } from './clt'
import type { Aquisicao } from './aquisicoes'
import { gruposDeErros, type ErroFuncionario } from './descontoErros'
import { usaValeTransporte } from './documentosPessoais'
import type { Ausencia, CartaoPontoSalvo, ConfigEmpresa, Funcionario } from './types'

/** O que é digitado na folha. Por pessoa: id `${funcionarioId}-${mes}`. Dias úteis do mês: id `dias-${mes}`. */
export interface RegistroFolha {
  id: string
  mes: string
  funcionarioId?: string
  diasUteis?: number
  /** Vazio = recebe se tiver passes cadastrados na ficha */
  recebeVT?: boolean
  descontarHoras?: boolean
  comissao?: number
  adiantamento?: number
  obs?: string
}

/** Desconto do vale alimentação: 20% do valor fixo (R$ 22 sobre R$ 110, como na planilha) */
export const PERCENTUAL_DESCONTO_VA = 0.2

const centavos = (v: number) => Math.round(v * 100) / 100

export const idRegistroFolha = (funcionarioId: string, mes: string) => `${funcionarioId}-${mes}`
export const idDiasUteis = (mes: string) => `dias-${mes}`

/** Segunda a sexta do mês. Feriados e sábados são ajustados à mão na folha. */
export function diasUteisPadrao(mes: string) {
  const ini = d(`${mes}-01`)
  return eachDayOfInterval({ start: ini, end: endOfMonth(ini) }).filter((x) => ![0, 6].includes(getDay(x))).length
}

/** Passes por dia × valor do passe × dias úteis */
export const valorValeTransporte = (f: Pick<Funcionario, 'passesDia' | 'valorPasse'>, dias: number) => centavos((f.passesDia ?? 0) * (f.valorPasse ?? 0) * dias)

/** Minutos → "(04:18)" para horas devidas e "31:43" para horas a mais */
export function textoHoras(min: number) {
  const a = Math.abs(min)
  const t = `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
  return min < 0 ? `(${t})` : t
}

export interface LinhaFolha {
  funcionario: Funcionario
  salario: number
  compras: number
  /** Parcelas de meses anteriores que continuam sem pagar (não somam em `compras`) */
  comprasAtrasadas: number
  erros: number
  /** O valor de erros ainda não foi marcado como descontado */
  errosPendentes: boolean
  /** Sim/Não da ficha (vazio = falta definir) */
  usaVT?: boolean
  /** Usa, tem passe e valor cadastrados */
  temPasse: boolean
  recebeVT: boolean
  valeTransporte: number
  descontoVA: number
  adiantamento: number
  /** Saldo do cartão ponto em minutos (vazio = sem cartão no mês) */
  horas?: number
  descontarHoras: boolean
  comissao: number
  mobilidade: number
  cultura: number
  alimentacao: number
  obs: string
  /** Fórmula da planilha */
  salarioTotal: number
  /** Compras + erros + adiantamento */
  descontos: number
}

export function montarFolha(args: {
  mes: string
  /** Quem trabalhou no mês (sem sócios) */
  ativos: Funcionario[]
  registros: RegistroFolha[]
  erros: ErroFuncionario[]
  aquisicoes: Aquisicao[]
  ausencias: Ausencia[]
  pontos: CartaoPontoSalvo[]
  marcas: MarcaBanco[]
  config: ConfigEmpresa
  hoje: string
}) {
  const { mes, ativos, registros, erros, aquisicoes, ausencias, pontos, marcas, config, hoje } = args
  const fim = iso(endOfMonth(d(`${mes}-01`)))
  const diasGuardado = registros.find((r) => r.id === idDiasUteis(mes))?.diasUteis
  const diasUteis = diasGuardado ?? diasUteisPadrao(mes)
  const cartao = new Map(linhasCartao(ativos, ausencias, pontos, config, mes, marcas).map((l) => [l.funcionario.id, l]))
  // desconto de erro ainda não feito aparece só na folha em aberto, e não nos meses já passados
  const mesEmAberto = format(addMonths(d(hoje), -1), 'yyyy-MM')

  const linhas: LinhaFolha[] = [...ativos]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((f) => {
      const r = registros.find((x) => x.id === idRegistroFolha(f.id, mes))
      const c = cartao.get(f.id)
      const parcelas = aquisicoes.filter((a) => a.funcionarioId === f.id).flatMap((a) => a.parcelas)
      const compras = centavos(parcelas.filter((p) => p.data.slice(0, 7) === mes).reduce((s, p) => s + p.valor, 0))
      const comprasAtrasadas = centavos(parcelas.filter((p) => !p.paga && p.data.slice(0, 7) < mes).reduce((s, p) => s + p.valor, 0))

      const grupos = gruposDeErros(erros.filter((e) => e.funcionarioId === f.id), hoje)
      const pagos = grupos.filter((g) => g.pago && g.descontadoEm?.slice(0, 7) === mes)
      const pendentes = mes >= mesEmAberto ? grupos.filter((g) => !g.pago && g.desconto > 0 && g.erros[g.erros.length - 1].data <= fim) : []
      const valorErros = centavos([...pagos, ...pendentes].reduce((s, g) => s + g.desconto, 0))

      const salario = salarioEm(f, fim)
      const alimentacao = c?.alimentacao ?? 0
      const mobilidade = c?.mobilidade ?? 0
      const cultura = c?.cultura ?? 0
      const descontoVA = alimentacao > 0 ? centavos(alimentacao * PERCENTUAL_DESCONTO_VA) : 0
      const comissao = r?.comissao ?? 0
      const adiantamento = r?.adiantamento ?? 0
      const usaVT = usaValeTransporte(f)
      const temPasse = usaVT === true && (f.passesDia ?? 0) > 0 && (f.valorPasse ?? 0) > 0
      const recebeVT = temPasse && (r?.recebeVT ?? true)

      return {
        funcionario: f,
        salario,
        compras,
        comprasAtrasadas,
        erros: valorErros,
        errosPendentes: pendentes.length > 0,
        usaVT,
        temPasse,
        recebeVT,
        valeTransporte: recebeVT ? valorValeTransporte(f, diasUteis) : 0,
        descontoVA,
        adiantamento,
        horas: pontos.find((p) => p.funcionarioId === f.id && p.mes === mes)?.saldoTotal,
        descontarHoras: !!r?.descontarHoras,
        comissao,
        mobilidade,
        cultura,
        alimentacao,
        obs: r?.obs ?? '',
        salarioTotal: centavos(salario + mobilidade + cultura + alimentacao - descontoVA + comissao),
        descontos: centavos(compras + valorErros + adiantamento),
      }
    })

  return { linhas, diasUteis, diasAjustados: diasGuardado !== undefined }
}

type Somavel = 'salario' | 'compras' | 'erros' | 'valeTransporte' | 'descontoVA' | 'adiantamento' | 'comissao' | 'mobilidade' | 'cultura' | 'alimentacao' | 'salarioTotal' | 'descontos'
export const somaFolha = (linhas: LinhaFolha[], k: Somavel) => centavos(linhas.reduce((s, l) => s + l[k], 0))

const COLUNAS = [
  'FUNCIONÁRIO',
  'SALÁRIO BRUTO',
  'DESCONTO COMPRAS',
  'DESCONTO ERROS',
  'VALE TRANSPORTE',
  'VALOR VALE TRANSPORTE',
  'DESCONTO VALE ALIMENTAÇÃO',
  'ADIANTAMENTO',
  'HORA FALTA / HORA EXTRA',
  'DESCONTAR HORAS?',
  'COMISSÃO',
  'AUXÍLIO MOBILIDADE',
  'AUXÍLIO CULTURA',
  'VALE ALIMENTAÇÃO',
  'SALÁRIO TOTAL',
  'OBS',
]

/** Linhas da planilha da folha, com título, dias úteis e totais */
export function linhasPlanilhaFolha(linhas: LinhaFolha[], tituloMes: string, diasUteis: number): (string | number)[][] {
  const s = (k: Somavel) => somaFolha(linhas, k)
  return [
    [`Folha de pagamento - ${tituloMes}`],
    ['Dias úteis', diasUteis],
    [],
    COLUNAS,
    ...linhas.map((l) => [
      l.funcionario.nome,
      l.salario,
      l.compras,
      l.erros,
      l.recebeVT ? 'SIM' : 'NÃO',
      l.valeTransporte,
      l.descontoVA,
      l.adiantamento,
      l.horas === undefined ? '' : textoHoras(l.horas),
      l.descontarHoras ? 'SIM' : 'NÃO',
      l.comissao,
      l.mobilidade,
      l.cultura,
      l.alimentacao,
      l.salarioTotal,
      l.obs,
    ]),
    ['TOTAL', s('salario'), s('compras'), s('erros'), '', s('valeTransporte'), s('descontoVA'), s('adiantamento'), '', '', s('comissao'), s('mobilidade'), s('cultura'), s('alimentacao'), s('salarioTotal'), ''],
  ]
}

export const planilhaFolha = (linhas: LinhaFolha[], tituloMes: string, diasUteis: number) => xlsx(linhasPlanilhaFolha(linhas, tituloMes, diasUteis), 'Folha')
