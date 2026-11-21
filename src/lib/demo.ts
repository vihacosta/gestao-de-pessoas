/** Dados fictícios para o modo demonstração (datas relativas a hoje). */
import { addDays, addMonths, addYears } from 'date-fns'
import { iso } from './clt'
import type { Ausencia, ConfigEmpresa, Ferias, Funcionario, ModeloEnviado } from './types'

const hoje = new Date()
const antes = (anos: number, meses: number) => iso(addMonths(addYears(hoje, -anos), -meses))

const f = (id: string, nome: string, cargo: string, adm: string, salario: number, extra: Partial<Funcionario> = {}): Funcionario => ({
  id,
  nome,
  cpf: '000.000.000-' + id.slice(-1).padStart(2, '0'),
  ctps: '0000000',
  ctpsSerie: '0000',
  ctpsUF: 'PR',
  cargo,
  tipo: 'clt',
  dataAdmissao: adm,
  salarios: [{ data: adm, valor: salario, motivo: 'Admissão' }],
  ...extra,
})

const funcionarios: Funcionario[] = [
  f('demo-1', 'Mariana Souza', 'Vendedora', antes(1, 10), 2400),
  f('demo-2', 'Juliana Pereira', 'Caixa', antes(1, 2), 2100),
  f('demo-3', 'Carla Mendes', 'Auxiliar de estoque', antes(0, 5), 1900),
  f('demo-4', 'Patrícia Lima', 'Gerente', antes(2, 6), 4500, {
    salarios: [
      { data: antes(2, 6), valor: 3800, motivo: 'Admissão' },
      { data: antes(1, 0), valor: 4500, motivo: 'Promoção' },
    ],
  }),
  f('demo-5', 'Beatriz Rocha', 'Estagiária de marketing', antes(0, 8), 1200, { tipo: 'estagio' }),
  f('demo-6', 'Fernanda Alves', 'Vendedora', antes(2, 2), 2400),
]

const p4 = (anos: number) => iso(addYears(new Date(antes(2, 6) + 'T00:00'), anos))
const ferias: Ferias[] = [
  {
    id: 'demo-f1', funcionarioId: 'demo-4', periodoInicio: p4(0),
    inicio: iso(addMonths(new Date(p4(1) + 'T00:00'), 2)), fim: iso(addDays(addMonths(new Date(p4(1) + 'T00:00'), 2), 29)),
    dias: 30, abono: 0, antecipada: false, status: 'aprovada', criadoEm: p4(1),
  },
  {
    id: 'demo-f2', funcionarioId: 'demo-4', periodoInicio: p4(1),
    inicio: iso(addMonths(new Date(p4(2) + 'T00:00'), 1)), fim: iso(addDays(addMonths(new Date(p4(2) + 'T00:00'), 1), 19)),
    dias: 20, abono: 10, antecipada: false, status: 'aprovada', criadoEm: p4(2),
  },
  {
    id: 'demo-f3', funcionarioId: 'demo-2', periodoInicio: antes(1, 2),
    inicio: iso(addDays(hoje, 45)), fim: iso(addDays(hoje, 45 + 19)),
    dias: 20, abono: 0, antecipada: false, status: 'solicitada', criadoEm: iso(hoje),
  },
]

// Ocorrências do mês passado, para o bônus de exemplo
const mp = (dia: number) => iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, dia))
const ausencias: Ausencia[] = [
  { id: 'demo-a1', funcionarioId: 'demo-1', tipo: 'atraso', inicio: mp(6), fim: mp(6), horas: 0.5 },
  { id: 'demo-a2', funcionarioId: 'demo-1', tipo: 'atraso', inicio: mp(13), fim: mp(13), horas: 0.25 },
  { id: 'demo-a3', funcionarioId: 'demo-2', tipo: 'falta_injustificada', inicio: mp(9), fim: mp(9), horas: 4, horasCompensadas: 1, observacao: 'Faltou meio período' },
  { id: 'demo-a4', funcionarioId: 'demo-6', tipo: 'falta_justificada', inicio: mp(15), fim: mp(15), horas: 4, horasBanco: 4, observacao: 'Usou o banco de horas' },
  { id: 'demo-a5', funcionarioId: 'demo-4', tipo: 'atraso', inicio: mp(3), fim: mp(3), horas: 2 },
  { id: 'demo-a6', funcionarioId: 'demo-4', tipo: 'saida_antecipada', inicio: mp(20), fim: mp(20), horas: 2.5 },
]

const config: ConfigEmpresa[] = [{ id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, bonusLimiteMes: 4, diasExperiencia: 90, valorAlimentacao: 110 }]
const modelos: ModeloEnviado[] = []

export const dadosDemo = { funcionarios, ferias, ausencias, config, modelos, pontos: [], documentos: [], justificativas: [], erros: [], aquisicoes: [], folha: [] }
