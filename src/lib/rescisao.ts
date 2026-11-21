/**
 * Estimativa da rescisão, para planejar o custo. O valor oficial é o do TRCT da contabilidade.
 * Não inclui INSS, IRRF, médias de horas extras ou comissões, nem regras da convenção coletiva.
 * - O aviso indenizado projeta o contrato para 13º e férias (CLT, art. 487, § 1º).
 * - Compensações na rescisão ficam limitadas a um mês de remuneração (CLT, art. 477, § 5º).
 */
import { addDays, endOfMonth } from 'date-fns'
import { pendenteAquisicao, type Aquisicao } from './aquisicoes'
import { ALIQUOTA_FGTS, avos, brl, d, decimoTerceiro, fgtsAcumuladoEstimado, iso, periodosAquisitivos, salarioEm, valoresFerias } from './clt'
import type { MotivoDesligamento, ResultadoDesligamento } from './demissao'
import { gruposDeErros, type ErroFuncionario } from './descontoErros'
import type { Ausencia, Ferias, Funcionario } from './types'

export interface LinhaRescisao {
  rotulo: string
  detalhe: string
  valor: number
}

export interface EstimativaRescisao {
  verbas: LinhaRescisao[]
  descontos: LinhaRescisao[]
  bruto: number
  totalDescontos: number
  /** Bruto menos descontos, antes de INSS e IRRF */
  liquido: number
  depositoFgts: number
  multaFgts: number
  percentualMulta: number
  baseMulta: number
  /** O saldo do FGTS veio do extrato (true) ou é estimado (false) */
  fgtsInformado: boolean
  /** Verbas + depósito do FGTS + multa, sem INSS patronal */
  custoEmpresa: number
  avisos: string[]
}

const cent = (v: number) => Math.round(v * 100) / 100
const dias = (n: number) => `${String(cent(n)).replace('.', ',')} ${n === 1 ? 'dia' : 'dias'}`

/** Dias do último mês, no mês comercial de 30 dias */
export function diasSaldoSalario(admissao: string, ultimoDia: string) {
  const fim = d(ultimoDia)
  const inicio = admissao.slice(0, 7) === ultimoDia.slice(0, 7) ? d(admissao).getDate() : 1
  if (iso(endOfMonth(fim)) === ultimoDia) return 30 - inicio + 1
  return Math.min(30, fim.getDate() - inicio + 1)
}

const PERCENTUAL_MULTA: Partial<Record<MotivoDesligamento, number>> = { dispensa_trabalhado: 0.4, dispensa_indenizado: 0.4, acordo: 0.2 }

export function calcularRescisao(args: {
  funcionario: Funcionario
  motivo: MotivoDesligamento
  desligamento: ResultadoDesligamento
  ferias: Ferias[]
  ausencias: Ausencia[]
  erros: ErroFuncionario[]
  aquisicoes: Aquisicao[]
  /** 13º já pago neste ano */
  adiantamento13?: number
  /** Saldo do extrato do FGTS */
  saldoFgts?: number
}): EstimativaRescisao {
  const { motivo, desligamento: r } = args
  // Cálculo como se a pessoa ainda estivesse ativa até a data do desligamento
  const f: Funcionario = { ...args.funcionario, dataDemissao: undefined }
  const clt = f.tipo === 'clt'
  const salario = salarioEm(f, r.ultimoDia)
  const diaria = salario / 30
  const avisos: string[] = []
  const verbas: LinhaRescisao[] = []
  const incluir = (lista: LinhaRescisao[], rotulo: string, detalhe: string, valor: number) => {
    if (valor > 0) lista.push({ rotulo, detalhe, valor: cent(valor) })
  }

  const fimProjetado = r.projecao ?? iso(addDays(d(r.ultimoDia), Math.floor(r.diasIndenizados)))

  const nSaldo = diasSaldoSalario(f.dataAdmissao, r.ultimoDia)
  const saldo = diaria * nSaldo
  incluir(verbas, clt ? 'Saldo de salário' : 'Saldo da bolsa', dias(nSaldo), saldo)

  const aviso = diaria * r.diasIndenizados
  incluir(verbas, 'Aviso prévio indenizado', dias(r.diasIndenizados), aviso)

  // 13º: se a projeção passar da virada do ano, conta os dois anos
  let decimo = 0
  if (clt) {
    const partes: string[] = []
    for (let ano = Number(r.ultimoDia.slice(0, 4)); ano <= Number(fimProjetado.slice(0, 4)); ano++) {
      const x = decimoTerceiro({ ...f, dataDemissao: fimProjetado }, ano, r.ultimoDia)
      if (x.avos > 0) {
        decimo += x.valor
        partes.push(`${x.avos}/12 de ${ano}`)
      }
    }
    incluir(verbas, '13º salário proporcional', partes.join(' + '), decimo)
  }

  // Férias marcadas para depois do último dia não chegam a ser gozadas
  const gozadas = args.ferias.filter((x) => x.inicio <= r.ultimoDia)
  const periodos = periodosAquisitivos(f, gozadas, args.ausencias, fimProjetado)
  let diasSimples = 0
  let diasDobro = 0
  let diasProporcionais = 0
  for (const p of periodos) {
    if (p.completo) {
      const resto = Math.max(0, p.saldo)
      if (clt && p.concessivoFim < r.ultimoDia) diasDobro += resto
      else diasSimples += resto
    } else {
      const direito = (p.direitoTotal * avos(p.inicio, fimProjetado)) / 12
      diasProporcionais += Math.max(0, direito - p.usados)
      if (p.usados > direito) avisos.push('Há férias antecipadas além do direito proporcional. O sistema não desconta esses dias: confira com a contabilidade.')
    }
  }
  const [vencidas, proporcionais] = clt ? ['Férias vencidas + 1/3', 'Férias proporcionais + 1/3'] : ['Recesso vencido', 'Recesso proporcional']
  incluir(verbas, vencidas, dias(diasSimples), valoresFerias(salario, diasSimples, 0, f.tipo).total)
  incluir(verbas, 'Férias vencidas em dobro + 1/3', `${dias(diasDobro)}, fora do prazo`, valoresFerias(salario, diasDobro, 0, f.tipo).total * 2)
  incluir(verbas, proporcionais, dias(diasProporcionais), valoresFerias(salario, diasProporcionais, 0, f.tipo).total)

  const bruto = cent(verbas.reduce((s, l) => s + l.valor, 0))

  // Descontos
  const descontos: LinhaRescisao[] = []
  const adiantamento = Math.min(args.adiantamento13 ?? 0, decimo)
  incluir(descontos, 'Adiantamento de 13º', 'informado', adiantamento)
  const aquisicoes = args.aquisicoes.filter((a) => a.funcionarioId === f.id).reduce((s, a) => s + pendenteAquisicao(a), 0)
  const gruposPendentes = gruposDeErros(args.erros.filter((e) => e.funcionarioId === f.id), r.ultimoDia).filter((g) => !g.pago && g.desconto > 0)
  const erros = gruposPendentes.reduce((s, g) => s + g.desconto, 0)
  if (gruposPendentes.some((g) => g.aConfirmar)) avisos.push('Há erros acima de R$ 200 com a regra de desconto ainda a confirmar.')
  const compensar = aquisicoes + erros
  const limite = Math.min(compensar, salario)
  const fatorLimite = compensar > 0 ? limite / compensar : 0
  incluir(descontos, 'Aquisições pendentes', 'parcelas em aberto', aquisicoes * fatorLimite)
  incluir(descontos, 'Erros e quebras', 'descontos pendentes', erros * fatorLimite)
  if (compensar > salario)
    avisos.push(`Os descontos pendentes (${brl(compensar)}) passam de um mês de remuneração. Na rescisão, a compensação fica limitada a ${brl(salario)} (CLT, art. 477, § 5º).`)
  const totalDescontos = cent(descontos.reduce((s, l) => s + l.valor, 0))
  if (totalDescontos > bruto) avisos.push('Os descontos são maiores que as verbas: confira com a contabilidade como acertar a diferença.')

  // FGTS: recolhido na conta da pessoa, não entra no valor pago diretamente
  const depositoFgts = clt ? cent((saldo + aviso + decimo) * ALIQUOTA_FGTS) : 0
  const percentualMulta = PERCENTUAL_MULTA[motivo] ?? 0
  const fgtsInformado = args.saldoFgts != null
  const saldoBase = args.saldoFgts ?? fgtsAcumuladoEstimado(f, r.ultimoDia)
  const baseMulta = clt ? cent(saldoBase + depositoFgts) : 0
  const multaFgts = cent(baseMulta * percentualMulta)
  if (percentualMulta > 0 && !fgtsInformado)
    avisos.push('A multa usa um saldo de FGTS estimado, sem 13º, férias, juros e saques anteriores. Informe o saldo do extrato para chegar mais perto.')
  if (clt && !args.adiantamento13 && Number(r.ultimoDia.slice(5, 7)) >= 11)
    avisos.push('Se a 1ª ou a 2ª parcela do 13º já foi paga este ano, informe o valor para não contar duas vezes.')

  return {
    verbas,
    descontos,
    bruto,
    totalDescontos,
    liquido: cent(Math.max(0, bruto - totalDescontos)),
    depositoFgts,
    multaFgts,
    percentualMulta,
    baseMulta,
    fgtsInformado,
    custoEmpresa: cent(bruto + depositoFgts + multaFgts),
    avisos,
  }
}
