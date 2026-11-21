import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'
import { PASTAS, gerarPacote, linhasResumo, montarFechamento, nomeDeArquivo } from './fechamento'
import type { Ausencia, CartaoPontoSalvo, DocumentoGuardado, Funcionario, TipoAusencia } from './types'

const MES = '2026-10'
const func = (id: string, nome: string): Funcionario => ({ id, nome, cpf: '', cargo: 'Teste', tipo: 'clt', dataAdmissao: '2020-01-01', salarios: [] })
const ana = func('a', 'Ana Teste')
const bia = func('b', 'Bia Teste')
const doc = (id: string, funcionarioId: string, categoria: DocumentoGuardado['categoria'], mes = MES): DocumentoGuardado => ({
  id, funcionarioId, categoria, mes, titulo: id, caminho: `documentos/${funcionarioId}/${categoria}/${id}.pdf`, tamanho: 1, enviadoEm: '2026-11-01',
})
const nomesTipo = { atestado: 'Atestado', licenca_paternidade: 'Licença-paternidade' } as Record<TipoAusencia, string>
const montar = (over: Partial<Parameters<typeof montarFechamento>[0]> = {}) =>
  montarFechamento({ mes: MES, ativos: [ana, bia], funcionarios: [ana, bia], documentos: [], ausencias: [], pontos: [], justificativas: [], tolerancia: 20, nomesTipo, ...over })

describe('fechamento mensal', () => {
  it('inclui só os documentos do mês, em pastas, e aponta quem falta', () => {
    const f = montar({ documentos: [doc('1', 'a', 'holerite'), doc('2', 'a', 'ponto_assinado'), doc('3', 'b', 'holerite', '2026-09')] })
    expect(f.itens.map((i) => `${i.pasta}/${i.nome}`)).toEqual([`${PASTAS.holerites}/Ana Teste.pdf`, `${PASTAS.pontos}/Ana Teste.pdf`])
    expect(f.pendencias.map((p) => p.texto)).toEqual(['Bia Teste: falta o holerite assinado', 'Bia Teste: falta o cartão ponto assinado'])
  })

  it('não sobrescreve quando a pessoa tem dois arquivos no mês', () => {
    const f = montar({ documentos: [doc('1', 'a', 'holerite'), doc('2', 'a', 'holerite')] })
    expect(f.itens.map((i) => i.nome)).toEqual(['Ana Teste.pdf', 'Ana Teste (2).pdf'])
  })

  it('atestado que atravessa o mês entra, e sem anexo vira pendência', () => {
    const ausencias: Ausencia[] = [
      { id: 'x', funcionarioId: 'a', tipo: 'atestado', inicio: '2026-09-29', fim: '2026-10-02', anexo: 'ausencias/x.jpg' },
      { id: 'y', funcionarioId: 'b', tipo: 'licenca_paternidade', inicio: '2026-10-05', fim: '2026-10-09' },
      { id: 'z', funcionarioId: 'b', tipo: 'atestado', inicio: '2026-08-01', fim: '2026-08-01', anexo: 'ausencias/z.jpg' },
    ]
    const f = montar({ ausencias })
    expect(f.itens).toEqual([{ pasta: PASTAS.atestados, nome: 'Ana Teste - Atestado 29-09.jpg', caminho: 'ausencias/x.jpg' }])
    expect(f.pendencias.filter((p) => p.grupo === 'comprovante').map((p) => p.funcionarioId)).toEqual(['b'])
  })

  it('avisa do atestado que está só no cartão ponto', () => {
    const dia = { data: '2026-10-07', rotulo: 'Atestado', faltas: 480, extras: 0, batidas: [], cargaHoraria: 480 }
    const pontos = [{ id: 'a-2026-10', funcionarioId: 'a', mes: MES, dias: [dia] }] as unknown as CartaoPontoSalvo[]
    expect(montar({ pontos }).pendencias.find((p) => p.grupo === 'comprovante')?.texto).toContain('07/10')
  })

  it('cobra a folha de justificativas só quando há ocorrência acima da tolerância', () => {
    const atraso = (horas: number): Ausencia[] => [{ id: 'x', funcionarioId: 'a', tipo: 'atraso', inicio: '2026-10-05', fim: '2026-10-05', horas }]
    expect(montar({ ausencias: atraso(0.25) }).pendencias.some((p) => p.grupo === 'justificativas')).toBe(false)
    expect(montar({ ausencias: atraso(1) }).pendencias.some((p) => p.grupo === 'justificativas')).toBe(true)
    expect(montar({ ausencias: atraso(1), documentos: [doc('f', 'coletivo', 'justificativas')] }).pendencias.some((p) => p.grupo === 'justificativas')).toBe(false)
  })

  it('tira do nome o que o Windows não aceita', () => {
    expect(nomeDeArquivo('Ana / Bia: "teste"?')).toBe('Ana - Bia- -teste-')
  })

  it('gera o zip com acentos, e um arquivo com erro não derruba o pacote', async () => {
    const f = montar({ documentos: [doc('1', 'a', 'holerite'), doc('2', 'a', 'ponto_assinado')] })
    const { zip, falhas } = await gerarPacote(f, 'Outubro de 2026', async (c) => {
      if (c.includes('ponto_assinado')) throw new Error('falhou')
      return new Blob(['conteudo'])
    })
    expect(falhas.map((x) => x.pasta)).toEqual([PASTAS.pontos])
    const lido = new PizZip(new Uint8Array(await zip.arrayBuffer()))
    expect(lido.file(`${PASTAS.holerites}/Ana Teste.pdf`)?.asText()).toBe('conteudo')
    expect(lido.file(`${PASTAS.pontos}/Ana Teste.pdf`)).toBeNull()
    expect(lido.file(`Resumo do fechamento ${MES}.xlsx`)).not.toBeNull()
    expect(linhasResumo(f, 'Outubro de 2026', falhas).flat()).toContain(`${PASTAS.pontos}/Ana Teste.pdf`)
  })
})
