import { readFileSync } from 'node:fs'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { MODELO_DEVOLUCAO, MOTIVOS, calcularDesligamento, diasAvisoProporcional, fimExperiencia, type MotivoDesligamento } from './demissao'
import { modelosPadrao, montarDados, preencher } from './modelos'
import type { Funcionario } from './types'

const f: Funcionario = { id: '1', nome: 'Maria Teste', cpf: '111.222.333-44', ctps: '123', cargo: 'Vendedora', tipo: 'clt', dataAdmissao: '2020-03-10', salarios: [{ data: '2020-03-10', valor: 2500 }] }
const calc = (motivo: MotivoDesligamento, over: Partial<Parameters<typeof calcularDesligamento>[0]> = {}) =>
  calcularDesligamento({ funcionario: f, motivo, data: '2026-11-21', diasExperiencia: 90, ...over })

describe('desligamento', () => {
  it('aviso proporcional: 30 + 3 por ano completo, até 90', () => {
    expect(diasAvisoProporcional('2026-01-01', '2026-11-21')).toBe(30)
    expect(diasAvisoProporcional('2025-11-21', '2026-11-21')).toBe(33)
    expect(diasAvisoProporcional('2025-11-22', '2026-11-21')).toBe(30)
    expect(diasAvisoProporcional('2020-03-10', '2026-11-21')).toBe(48)
    expect(diasAvisoProporcional('2000-01-01', '2026-11-21')).toBe(90)
  })

  it('aviso trabalhado: 30 dias e o proporcional indenizado', () => {
    const r = calc('dispensa_trabalhado')
    expect([r.diasAviso, r.diasTrabalhados, r.diasIndenizados]).toEqual([48, 30, 18])
    expect(r.ultimoDia).toBe('2026-12-21')
    expect(r.projecao).toBe('2027-01-08')
    expect(r.prazoPagamento).toBe('2026-12-31')
  })

  it('aviso indenizado: sai na data, com projeção', () => {
    const r = calc('dispensa_indenizado')
    expect(r.ultimoDia).toBe('2026-11-21')
    expect(r.projecao).toBe('2027-01-08')
    expect(r.prazoPagamento).toBe('2026-12-01')
  })

  it('pedido de demissão não tem proporcional', () => {
    expect(calc('pedido_cumprindo').diasAviso).toBe(30)
    expect(calc('pedido_cumprindo').ultimoDia).toBe('2026-12-21')
    expect(calc('pedido_dispensado').extras.texto_aviso).toContain('dispensa do cumprimento')
  })

  it('acordo indeniza metade do aviso', () => {
    const impar = calc('acordo', { funcionario: { ...f, dataAdmissao: '2025-01-01' } })
    expect(impar.diasAviso).toBe(33)
    expect(impar.extras.dias_indenizados).toBe('16,5')
  })

  it('experiência: avisa antes do fim e bloqueia depois do fim', () => {
    const novo = { ...f, dataAdmissao: '2026-10-01' }
    const fim = fimExperiencia(novo.dataAdmissao, 90)
    expect(fim).toBe('2026-12-29')
    expect(calc('fim_experiencia', { funcionario: novo }).avisos).toEqual([])
    expect(calc('fim_experiencia', { funcionario: novo, ultimoDia: '2026-12-01' }).avisos).toHaveLength(1)
    expect(calc('fim_experiencia', { funcionario: novo, ultimoDia: '2026-12-30' }).erro).toBeTruthy()
  })

  it('todos os modelos saem preenchidos', async () => {
    for (const id of [...MOTIVOS.map((x) => x.modelo), MODELO_DEVOLUCAO]) {
      const m = modelosPadrao.find((x) => x.id === id)!
      const motivo = MOTIVOS.find((x) => x.modelo === id)?.id ?? 'dispensa_trabalhado'
      const buf = readFileSync(`public/modelos/${id}.docx`)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
      const blob = preencher(ab, montarDados(m, { funcionarios: [f], dataDoc: '2026-11-21', extras: calc(motivo, { instituicao: 'Escola Teste' }).extras }))
      const t = new Docxtemplater(new PizZip(await blob.arrayBuffer()), { delimiters: { start: '{{', end: '}}' }, paragraphLoop: true }).getFullText()
      expect(t, id).toContain('Maria Teste')
      expect(t, id).not.toMatch(/\{\{|undefined|\d{4}-\d{2}-\d{2}/)
    }
  })
})
