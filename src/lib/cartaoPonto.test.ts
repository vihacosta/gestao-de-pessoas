import { readFileSync } from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { analisarCartao, bonusDoMes } from './bonus'
import { lerCartoes, somaExtras, somaFaltas, type TextoPosicionado } from './cartaoPonto'
import type { CartaoPontoSalvo, ConfigEmpresa, Funcionario } from './types'

const cfg: ConfigEmpresa = { id: 'empresa', valorBonus: 100, bonusLimiteDia: 4, bonusLimiteMes: 4, diasExperiencia: 90 }

async function lerExemplo() {
  const data = new Uint8Array(readFileSync('docs/exemplos/EXEMPLO - cartão ponto outubro 2026.pdf'))
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise
  const paginas: TextoPosicionado[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    paginas.push((tc.items as { str: string; transform: number[] }[]).map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str })))
  }
  return lerCartoes(paginas)
}

const salvo = (c: Awaited<ReturnType<typeof lerExemplo>>['cartoes'][number]): CartaoPontoSalvo => ({
  id: 'x',
  funcionarioId: 'x',
  mes: '2026-10',
  nomeNoCartao: c.nome,
  dias: c.dias,
  saldoAnterior: c.saldoAnterior,
  saldoTotal: c.saldoTotal,
  caminho: '',
  importadoEm: '',
})

describe('cartão ponto', () => {
  it('lê período, funcionários, dias e banco de horas', async () => {
    const r = await lerExemplo()
    expect(r.mes).toBe('2026-10')
    expect(r.cartoes.map((c) => c.nome)).toEqual(['BEATRIZ ROCHA', 'CARLA MENDES', 'FERNANDA ALVES', 'JULIANA PEREIRA', 'MARIANA SOUZA', 'PATRÍCIA LIMA'])
    for (const c of r.cartoes) {
      expect(c.dias).toHaveLength(31)
      expect(c.saldoTotal).toBe(c.saldoAnterior + somaExtras(c) - somaFaltas(c))
    }
    const fer = r.cartoes.find((c) => c.nome.startsWith('FERNANDA'))!
    expect(fer.cpf).toBe('00000000006')
    expect(fer.admissao).toBe('2024-09-19')
    expect(fer.saldoAnterior).toBe(120)
    expect(fer.dias.find((d) => d.data === '2026-10-15')).toMatchObject({ faltas: 240, cargaHoraria: 540 })
    expect(r.cartoes[1].dias.find((d) => d.data === '2026-10-20')?.rotulo).toBe('Atestado')
    expect(r.cartoes[0].dias.filter((d) => d.rotulo === 'Férias')).toHaveLength(9)
  })

  it('aplica as regras do bônus', async () => {
    const r = await lerExemplo()
    const res = Object.fromEntries(r.cartoes.map((c) => [c.nome.split(' ')[0], analisarCartao(salvo(c), cfg)]))
    expect(res.BEATRIZ.motivos).toEqual([]) // férias não contam
    expect(res.CARLA.motivos[0]).toMatch(/Atestado/)
    expect(res.FERNANDA.motivos).toEqual([]) // meio período coberto pelo banco que já existia
    expect(res.FERNANDA.avisos[0]).toMatch(/coberta pelo banco/)
    expect(res.JULIANA.motivos[0]).toMatch(/Ausência de 4h em 09\/10/) // compensou depois, mas perde
    expect(res.MARIANA.motivos).toEqual([])
    expect(res.PATRÍCIA.naoCompensadas).toBe(270) // 4h30 de atrasos sem compensar
  })

  it('bônus do mês usa o cartão e a regra mensal', async () => {
    const r = await lerExemplo()
    const pat = r.cartoes.find((c) => c.nome.startsWith('PATR'))!
    const f: Funcionario = { id: 'x', nome: 'Patrícia', cpf: '', cargo: '', tipo: 'clt', dataAdmissao: '2024-05-19', salarios: [] }
    const b = bonusDoMes(f, [], '2026-10', cfg, salvo(pat))
    expect(b.status).toBe('perde')
    expect(b.motivos[0]).toMatch(/4h30/)
    expect(b.usouCartao).toBe(true)
  })
})
