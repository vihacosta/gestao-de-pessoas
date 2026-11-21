import { describe, expect, it } from 'vitest'
import { conferirAtivos, funcionarioDaPlanilha, linhasDosAtivos } from './aniversarios'
import { linhasCartao } from './beneficios'
import { bonusDoMes } from './bonus'
import { decimoTerceiro, fgtsMensal } from './clt'
import { pendenciasPessoais } from './documentosPessoais'
import { ativosNoMes, pendenciasAssinatura } from '../pages/Holerites'
import type { ConfigEmpresa, Funcionario } from './types'

const func = (p: Partial<Funcionario>): Funcionario => ({
  id: 'x',
  nome: 'Pessoa Teste',
  cpf: '',
  cargo: 'Cargo',
  tipo: 'clt',
  dataAdmissao: '2020-01-01',
  salarios: [{ data: '2020-01-01', valor: 3000 }],
  ...p,
})
const config: ConfigEmpresa = { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, diasExperiencia: 90, valorAlimentacao: 200 }

describe('sócio', () => {
  const socio = func({ id: 's', tipo: 'socio' })
  const clt = func({ id: 'c' })

  it('não tem 13º nem FGTS', () => {
    expect(decimoTerceiro(socio, 2026, '2026-11-21').valor).toBe(0)
    expect(fgtsMensal(socio, '2026-11-21')).toBe(0)
  })
  it('fica fora de holerite e ponto assinados', () => {
    expect(ativosNoMes([socio, clt], '2026-10').map((f) => f.id)).toEqual(['c'])
    expect(pendenciasAssinatura([socio, clt], [], '2026-10').total).toBe(1)
  })
  it('fica fora do bônus e do cartão benefício', () => {
    expect(bonusDoMes(socio, [], '2026-10', config).status).toBe('fora')
    expect(linhasCartao([socio, clt], [], [], config, '2026-10').map((l) => l.funcionario.id)).toEqual(['c'])
  })
  it('não tem documentos pendentes', () => {
    expect(pendenciasPessoais(socio, [])).toEqual([])
    expect(pendenciasPessoais(clt, []).length).toBeGreaterThan(0)
  })
})

describe('número de controle da planilha', () => {
  const abas = [
    {
      aba: 'FUNCIONARIOS ATIVOS',
      linhas: [
        ['', 'NUMERO CONTROLE', 'FUNCIONÁRIO', 'SITUAÇÃO', 'ANIVERSÁRIO', 'DATA ADMISSÃO'],
        ['', 26, 'ANA TESTE', 'ATIVO', '', ''],
        ['', 43, 'ANA TESTE', 'DESLIGADO', '', ''],
        ['', '', 'BIA TESTE', 'ATIVO', '', ''],
      ] as (string | number)[][],
    },
  ]

  it('lê a coluna NUMERO CONTROLE', () => {
    expect(linhasDosAtivos(abas).map((l) => l.numero)).toEqual(['26', '43', undefined])
  })
  it('aponta número diferente usando só a linha ativa', () => {
    const r = conferirAtivos([func({ id: 'a', nome: 'Ana Teste', dataNascimento: '1990-01-01', numeroCadastro: '7' })], linhasDosAtivos(abas))
    expect(r.itens[0].numeroDiferente).toBe(true)
    expect(r.itens[0].planilha?.numero).toBe('26')
  })
  it('linha sem número não apaga o que está no cadastro', () => {
    const r = conferirAtivos([func({ id: 'b', nome: 'Bia Teste', dataNascimento: '1990-01-01', numeroCadastro: '9' })], linhasDosAtivos(abas))
    expect(r.itens).toEqual([])
  })
  it('cadastro novo já vem com o número', () => {
    expect(funcionarioDaPlanilha({ linha: 2, numero: '26', nome: 'ANA TESTE', situacao: 'ATIVO', admissao: '2024-01-01' })?.numeroCadastro).toBe('26')
  })
})
