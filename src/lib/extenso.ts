/** Datas e valores por extenso, em português. */
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { d } from './clt'

/** 2026-11-19 → "19 de novembro de 2026" */
export const dataExtenso = (s: string) => format(d(s), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

/** 2022-02-28 → "segunda-feira dia 28 de fevereiro de 2022" */
export const dataComDiaSemana = (s: string) => format(d(s), "EEEE 'dia' dd 'de' MMMM 'de' yyyy", { locale: ptBR })

/** 2018-11 → "Novembro/2018" */
export const mesAno = (s: string) => {
  const t = format(d(s.length === 7 ? s + '-01' : s), 'MMMM/yyyy', { locale: ptBR })
  return t[0].toUpperCase() + t.slice(1)
}

const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(centenas[c])
  if (r < 20) {
    if (r) partes.push(unidades[r])
  } else {
    const dz = Math.floor(r / 10)
    const u = r % 10
    partes.push(u ? `${dezenas[dz]} e ${unidades[u]}` : dezenas[dz])
  }
  return partes.join(' e ')
}

function inteiroExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`)
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`)
  if (resto) partes.push(ate999(resto))
  if (partes.length === 1) return partes[0]
  // "e" antes do último grupo quando ele é < 100 ou centena exata
  const ultimo = partes.pop()!
  const usaE = resto && (resto < 100 || resto % 100 === 0)
  return partes.join(' ') + (usaE ? ' e ' : ' ') + ultimo
}

/** 150.5 → "cento e cinquenta reais e cinquenta centavos" */
export function reaisExtenso(valor: number): string {
  const centavosTotal = Math.round(valor * 100)
  const reais = Math.floor(centavosTotal / 100)
  const centavos = centavosTotal % 100
  const partes: string[] = []
  if (reais) {
    const ext = inteiroExtenso(reais)
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? ' de' : ''
    partes.push(`${ext}${de} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos) partes.push(`${inteiroExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.join(' e ') || 'zero reais'
}

/** Converte "1.234,56" ou "1234.56" em número. */
export function lerValor(s: string): number {
  const t = s.trim()
  if (!t) return 0
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t)
  return Number.isFinite(n) ? n : 0
}
