/**
 * Desligamento: escolhe os documentos pelo motivo e calcula os prazos.
 * - Aviso prévio proporcional (Lei 12.506/2011): 30 dias + 3 por ano completo, até 90. Vale quando a empresa dispensa.
 * - O aviso conta a partir do dia seguinte à comunicação (Súmula 380 do TST).
 * - No aviso trabalhado, a pessoa trabalha 30 dias e os dias proporcionais são indenizados.
 * - Pagamento das verbas: até 10 dias depois do término (CLT, art. 477, § 6º).
 * O valor das verbas e o TRCT continuam com a contabilidade.
 */
import { addDays, differenceInYears } from 'date-fns'
import { d, dataBR, iso } from './clt'
import { dataExtenso } from './extenso'
import type { Funcionario } from './types'

export type MotivoDesligamento =
  | 'dispensa_trabalhado'
  | 'dispensa_indenizado'
  | 'pedido_cumprindo'
  | 'pedido_dispensado'
  | 'acordo'
  | 'fim_experiencia'
  | 'fim_estagio'

export const MOTIVOS: { id: MotivoDesligamento; rotulo: string; modelo: string; tipo: Funcionario['tipo'] }[] = [
  { id: 'dispensa_trabalhado', rotulo: 'Dispensa sem justa causa, aviso trabalhado', modelo: 'demissao-1-aviso-previo-trabalhado', tipo: 'clt' },
  { id: 'dispensa_indenizado', rotulo: 'Dispensa sem justa causa, aviso indenizado', modelo: 'demissao-2-aviso-previo-indenizado', tipo: 'clt' },
  { id: 'pedido_cumprindo', rotulo: 'Pedido de demissão, cumprindo o aviso', modelo: 'demissao-3-pedido-de-demissao', tipo: 'clt' },
  { id: 'pedido_dispensado', rotulo: 'Pedido de demissão, com dispensa do aviso', modelo: 'demissao-3-pedido-de-demissao', tipo: 'clt' },
  { id: 'acordo', rotulo: 'Acordo entre as partes (art. 484-A)', modelo: 'demissao-4-acordo-484a', tipo: 'clt' },
  { id: 'fim_experiencia', rotulo: 'Término do contrato de experiência', modelo: 'demissao-5-termino-experiencia', tipo: 'clt' },
  { id: 'fim_estagio', rotulo: 'Encerramento do estágio', modelo: 'demissao-6-rescisao-estagio', tipo: 'estagio' },
]

export const MODELO_DEVOLUCAO = 'demissao-7-devolucao-materiais'

export const diasAvisoProporcional = (admissao: string, aviso: string) => Math.min(90, 30 + 3 * Math.max(0, differenceInYears(d(aviso), d(admissao))))

/** Último dia da experiência, contando o dia da admissão */
export const fimExperiencia = (admissao: string, diasExperiencia: number) => iso(addDays(d(admissao), diasExperiencia - 1))

export interface ResultadoDesligamento {
  diasAviso: number
  diasTrabalhados: number
  diasIndenizados: number
  ultimoDia: string
  /** Data projetada do contrato com o aviso indenizado */
  projecao?: string
  prazoPagamento?: string
  /** Campos para preencher o modelo */
  extras: Record<string, string>
  /** Impede gerar o documento */
  erro?: string
  avisos: string[]
}

const mais = (data: string, dias: number) => iso(addDays(d(data), dias))
const diasTexto = (n: number) => String(n).replace('.', ',')

export function calcularDesligamento(args: {
  funcionario: Funcionario
  motivo: MotivoDesligamento
  /** Data da comunicação */
  data: string
  /** Último dia, em experiência e estágio */
  ultimoDia?: string
  diasExperiencia: number
  instituicao?: string
}): ResultadoDesligamento {
  const { funcionario: f, motivo, data } = args
  const total = diasAvisoProporcional(f.dataAdmissao, data)
  const avisos: string[] = []
  let erro: string | undefined
  let r: Pick<ResultadoDesligamento, 'diasAviso' | 'diasTrabalhados' | 'diasIndenizados' | 'ultimoDia' | 'projecao'>

  switch (motivo) {
    case 'dispensa_trabalhado':
      r = { diasAviso: total, diasTrabalhados: 30, diasIndenizados: total - 30, ultimoDia: mais(data, 30), projecao: mais(data, total) }
      break
    case 'dispensa_indenizado':
      r = { diasAviso: total, diasTrabalhados: 0, diasIndenizados: total, ultimoDia: data, projecao: mais(data, total) }
      break
    case 'pedido_cumprindo':
      r = { diasAviso: 30, diasTrabalhados: 30, diasIndenizados: 0, ultimoDia: mais(data, 30) }
      break
    case 'pedido_dispensado':
      r = { diasAviso: 0, diasTrabalhados: 0, diasIndenizados: 0, ultimoDia: data }
      break
    case 'acordo':
      r = { diasAviso: total, diasTrabalhados: 0, diasIndenizados: total / 2, ultimoDia: data }
      break
    case 'fim_experiencia': {
      const fim = fimExperiencia(f.dataAdmissao, args.diasExperiencia)
      const ultimoDia = args.ultimoDia || fim
      r = { diasAviso: 0, diasTrabalhados: 0, diasIndenizados: 0, ultimoDia }
      if (ultimoDia > fim) erro = `A experiência terminou em ${dataBR(fim)}. Depois disso o contrato passa a ser por prazo indeterminado: use outro motivo.`
      else if (ultimoDia < fim) avisos.push(`O término é antes do fim da experiência (${dataBR(fim)}). Pode haver indenização (CLT, art. 479): confirme com a contabilidade.`)
      break
    }
    case 'fim_estagio':
      r = { diasAviso: 0, diasTrabalhados: 0, diasIndenizados: 0, ultimoDia: args.ultimoDia || data }
      break
  }

  if (r.ultimoDia < f.dataAdmissao) erro = 'O último dia não pode ser antes da admissão.'
  const prazoPagamento = motivo === 'fim_estagio' ? undefined : mais(r.ultimoDia, 10)

  const texto_aviso =
    motivo === 'pedido_dispensado'
      ? `Solicito a **dispensa do cumprimento do aviso prévio**, sendo ${dataExtenso(r.ultimoDia)} meu último dia de trabalho. Estou ciente de que, se a empresa não concordar, o aviso poderá ser descontado das minhas verbas (CLT, art. 487, § 2º).`
      : `Cumprirei o **aviso prévio de 30 dias**, a partir do dia seguinte a este pedido, sendo ${dataExtenso(r.ultimoDia)} meu último dia de trabalho.`

  const texto_proporcional =
    r.diasIndenizados > 0 && r.projecao
      ? `Os ${r.diasIndenizados} dias restantes do aviso proporcional serão indenizados, com projeção do contrato até ${dataExtenso(r.projecao)}.`
      : ''

  return {
    ...r,
    prazoPagamento,
    avisos,
    erro,
    extras: {
      dias_aviso: String(r.diasAviso),
      dias_trabalhados: String(r.diasTrabalhados),
      dias_indenizados: diasTexto(r.diasIndenizados),
      ultimo_dia: r.ultimoDia,
      projecao: r.projecao ?? '',
      prazo_pagamento: prazoPagamento ?? '',
      texto_proporcional,
      texto_aviso: texto_aviso.replace(/\*\*/g, ''),
      instituicao: args.instituicao?.trim() || '______________________________',
    },
  }
}
