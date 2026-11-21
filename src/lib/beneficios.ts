/**
 * Planilha do cartão benefício (fora da folha), no mesmo layout que a empresa envia hoje:
 * Alimentação fixa para todos, Mobilidade = bônus por assiduidade do mês, Cultura = valor fixo de cada pessoa.
 */
import { endOfMonth } from 'date-fns'
import PizZip from 'pizzip'
import { bonusDoMes, type MarcaBanco, type ResultadoBonus } from './bonus'
import { d, iso } from './clt'
import type { Ausencia, CartaoPontoSalvo, ConfigEmpresa, Funcionario } from './types'

export const COLUNAS_CARTAO = [
  'Nome',
  'CPF',
  'Matricula (opcional)',
  'Valor Fixo em Auxilio Alimentacao',
  'Mobilidade',
  'Valor Fixo em Mobilidade',
  'Cultura',
  'Valor Fixo em Cultura',
  'Saude',
  'Valor Fixo em Saude',
] as const

export interface LinhaCartao {
  funcionario: Funcionario
  nome: string
  cpf: string
  alimentacao: number
  mobilidade: number
  cultura: number
  bonus: ResultadoBonus
}

const maiusculoSemAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

/** Uma linha por pessoa ativa no mês (menos quem está marcado para não entrar), em ordem de nome */
export function linhasCartao(funcionarios: Funcionario[], ausencias: Ausencia[], pontos: CartaoPontoSalvo[], c: ConfigEmpresa, mes: string, marcas: MarcaBanco[] = []): LinhaCartao[] {
  const ini = `${mes}-01`
  const fim = iso(endOfMonth(d(ini)))
  return funcionarios
    .filter((f) => f.tipo !== 'socio' && !f.semCartaoBeneficio && f.dataAdmissao <= fim && (!f.dataDemissao || f.dataDemissao >= ini))
    .map((f) => {
      const bonus = bonusDoMes(f, ausencias, mes, c, pontos.find((p) => p.funcionarioId === f.id && p.mes === mes), marcas)
      return {
        funcionario: f,
        nome: maiusculoSemAcento(f.nome),
        cpf: f.cpf,
        alimentacao: c.valorAlimentacao ?? 0,
        mobilidade: bonus.status === 'recebe' ? bonus.valor : 0,
        cultura: f.beneficioCultura ?? 0,
        bonus,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/** Valores na ordem das colunas (vazio = célula em branco) */
export const valoresLinha = (l: LinhaCartao): (string | number)[] => [l.nome, l.cpf, '', l.alimentacao, l.mobilidade, '', l.cultura, '', '', '']

/** Texto com tabulação, para colar direto na planilha */
export const textoTabela = (linhas: LinhaCartao[]) => [COLUNAS_CARTAO.join('\t'), ...linhas.map((l) => valoresLinha(l).join('\t'))].join('\n')

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const coluna = (i: number) => String.fromCharCode(65 + i)

/** Gera um .xlsx simples (uma aba) sem depender de biblioteca de planilhas */
export function xlsx(linhas: (string | number)[][], aba = 'Planilha1'): Blob {
  const celula = (v: string | number, ref: string) =>
    v === '' ? '' : typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
  const linhasXml = linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => celula(v, `${coluna(c)}${r + 1}`)).join('')}</row>`).join('')
  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  )
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(aba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  )
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhasXml}</sheetData></worksheet>`,
  )
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export const planilhaCartao = (linhas: LinhaCartao[]) => xlsx([[...COLUNAS_CARTAO], ...linhas.map(valoresLinha)])
