import { describe, expect, it } from 'vitest'
import { extensao, nomeSeguro, podeVirarPdf } from './documentos'

describe('armazenamento de documentos', () => {
  it('só fotos comuns e PDFs viram um PDF; planilhas, Word e HEIC ficam como vieram', () => {
    expect(podeVirarPdf({ type: 'image/jpeg', name: 'foto.jpg' })).toBe(true)
    expect(podeVirarPdf({ type: 'application/pdf', name: 'a.pdf' })).toBe(true)
    expect(podeVirarPdf({ type: '', name: 'contrato.PDF' })).toBe(true)
    expect(podeVirarPdf({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe(false)
    expect(podeVirarPdf({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'ativos.xlsx' })).toBe(false)
    expect(podeVirarPdf({ type: 'application/msword', name: 'carta.doc' })).toBe(false)
  })

  it('nome seguro para o Supabase e extensão', () => {
    expect(nomeSeguro('Atestado março (Ana).pdf')).toBe('Atestado_marco_Ana_.pdf')
    expect(extensao('RELAÇÃO DE FUNCIONÁRIOS ATIVOS.XLSX')).toBe('xlsx')
    expect(extensao('sem-extensao')).toBe('bin')
  })
})
