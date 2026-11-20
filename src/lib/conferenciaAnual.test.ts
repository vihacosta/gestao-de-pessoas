import { describe, expect, it } from 'vitest'
import { precisaConferir } from './conferenciaAnual'

describe('conferência anual dos dados', () => {
  it('quem entrou em ano anterior e nunca conferiu precisa conferir', () => {
    expect(precisaConferir({ dataAdmissao: '2025-03-10' }, '2026-01-02')).toBe(true)
  })
  it('quem entrou neste ano não precisa', () => {
    expect(precisaConferir({ dataAdmissao: '2026-01-05' }, '2026-02-01')).toBe(false)
  })
  it('conferido neste ano não precisa; no ano seguinte volta a pedir', () => {
    const f = { dataAdmissao: '2020-01-01', dadosConferidosEm: '2026-01-15' }
    expect(precisaConferir(f, '2026-12-31')).toBe(false)
    expect(precisaConferir(f, '2027-01-01')).toBe(true)
  })
  it('desligado não precisa', () => {
    expect(precisaConferir({ dataAdmissao: '2020-01-01', dataDemissao: '2025-06-01' }, '2026-01-02')).toBe(false)
  })
})
