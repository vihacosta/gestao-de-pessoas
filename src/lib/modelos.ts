/**
 * Modelos de documentos (.docx com campos {{...}}) e geração dos documentos preenchidos.
 * Os modelos padrão ficam em public/modelos (gerados por scripts/gerar-modelos.mjs).
 */
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { brl, dataBR, salarioEm } from './clt'
import { dataComDiaSemana, dataExtenso, lerValor, mesAno, reaisExtenso } from './extenso'
import type { ConfigEmpresa, Funcionario, GrupoModelo } from './types'

export type TipoCampo = 'texto' | 'data' | 'dataSemana' | 'mes' | 'valor'

export interface CampoExtra {
  chave: string
  rotulo: string
  tipo: TipoCampo
  padrao?: string
  dica?: string
}

export interface Modelo {
  id: string
  titulo: string
  grupo: GrupoModelo
  /** Campos além dos dados do funcionário */
  extras: CampoExtra[]
  /** Arquivo em /public (modelos padrão) */
  url?: string
  /** Caminho no armazenamento (modelos enviados) */
  caminho?: string
}

const padrao = (id: string, titulo: string, grupo: GrupoModelo, extras: CampoExtra[] = []): Modelo => ({
  id,
  titulo,
  grupo,
  extras,
  url: `/modelos/${id}.docx`,
})

export const modelosPadrao: Modelo[] = [
  padrao('admissao-1-ficha-cadastral', 'Ficha cadastral', 'admissao'),
  padrao('admissao-2-codigo-de-cultura', 'Recebimento do Código de Cultura', 'admissao'),
  padrao('admissao-3-acordo-desconto', 'Acordo individual de desconto', 'admissao'),
  padrao('admissao-4-banco-de-horas', 'Acordo de banco de horas', 'admissao'),
  padrao('admissao-5-compensacao-de-jornada', 'Acordo de compensação de jornada', 'admissao'),
  padrao('admissao-6-uso-de-imagem', 'Autorização de uso de imagem', 'admissao'),
  padrao('admissao-7-uso-de-uniformes', 'Termo de uso de uniformes', 'admissao', [
    { chave: 'qtd_uniformes', rotulo: 'Uniformes entregues', tipo: 'texto', padrao: '01 unidade' },
  ]),
  padrao('admissao-8-monitoramento-cameras', 'Ciência de monitoramento por câmeras', 'admissao'),
  padrao('admissao-9-bonus-assiduidade', 'Termo do bônus por assiduidade', 'admissao'),
  padrao('demissao-1-aviso-previo-trabalhado', 'Aviso prévio trabalhado', 'demissao', [
    { chave: 'dias_aviso', rotulo: 'Dias de aviso', tipo: 'texto' },
    { chave: 'dias_trabalhados', rotulo: 'Dias trabalhados', tipo: 'texto' },
    { chave: 'ultimo_dia', rotulo: 'Último dia', tipo: 'data' },
    { chave: 'prazo_pagamento', rotulo: 'Prazo de pagamento', tipo: 'data' },
    { chave: 'texto_proporcional', rotulo: 'Dias proporcionais', tipo: 'texto' },
  ]),
  padrao('demissao-2-aviso-previo-indenizado', 'Aviso prévio indenizado', 'demissao', [
    { chave: 'dias_aviso', rotulo: 'Dias de aviso', tipo: 'texto' },
    { chave: 'projecao', rotulo: 'Projeção do contrato', tipo: 'data' },
    { chave: 'prazo_pagamento', rotulo: 'Prazo de pagamento', tipo: 'data' },
  ]),
  padrao('demissao-3-pedido-de-demissao', 'Pedido de demissão', 'demissao', [{ chave: 'texto_aviso', rotulo: 'Aviso prévio', tipo: 'texto' }]),
  padrao('demissao-4-acordo-484a', 'Termo de rescisão por acordo', 'demissao', [
    { chave: 'ultimo_dia', rotulo: 'Último dia', tipo: 'data' },
    { chave: 'dias_aviso', rotulo: 'Dias de aviso', tipo: 'texto' },
    { chave: 'dias_indenizados', rotulo: 'Dias indenizados', tipo: 'texto' },
    { chave: 'prazo_pagamento', rotulo: 'Prazo de pagamento', tipo: 'data' },
  ]),
  padrao('demissao-5-termino-experiencia', 'Término do contrato de experiência', 'demissao', [
    { chave: 'ultimo_dia', rotulo: 'Último dia', tipo: 'data' },
    { chave: 'prazo_pagamento', rotulo: 'Prazo de pagamento', tipo: 'data' },
  ]),
  padrao('demissao-6-rescisao-estagio', 'Termo de rescisão de estágio', 'demissao', [
    { chave: 'ultimo_dia', rotulo: 'Último dia', tipo: 'data' },
    { chave: 'instituicao', rotulo: 'Instituição de ensino', tipo: 'texto' },
  ]),
  padrao('demissao-7-devolucao-materiais', 'Termo de devolução de materiais', 'demissao'),
  padrao('aquisicao-de-mercadorias', 'Aquisição de mercadorias', 'avulso', [
    { chave: 'data_aquisicao', rotulo: 'Data da aquisição', tipo: 'data' },
    { chave: 'itens', rotulo: 'Itens', tipo: 'texto' },
    { chave: 'valor_total', rotulo: 'Valor total (R$)', tipo: 'valor' },
    { chave: 'desconto', rotulo: 'Desconto (R$)', tipo: 'valor' },
    { chave: 'forma_pagamento', rotulo: 'Forma de pagamento', tipo: 'texto', padrao: 'Desconto em folha' },
  ]),
  padrao('autorizacao-de-desconto', 'Autorização de desconto (prejuízo)', 'avulso', [
    { chave: 'valor', rotulo: 'Valor do desconto (R$)', tipo: 'valor', dica: 'O valor por extenso é preenchido sozinho.' },
    { chave: 'mes_referencia', rotulo: 'Mês da folha', tipo: 'mes' },
  ]),
  padrao('coletivo-compensacao-dia-normal', 'Compensação de horas em dia normal', 'coletivo', [
    { chave: 'data_folga', rotulo: 'Dia da folga', tipo: 'dataSemana' },
    { chave: 'data_compensacao', rotulo: 'Dia em que as horas serão compensadas', tipo: 'dataSemana' },
  ]),
  padrao('coletivo-compensacao-feriado', 'Compensação de trabalho em feriado', 'coletivo', [
    { chave: 'feriado', rotulo: 'Nome do feriado', tipo: 'texto', padrao: 'Corpus Christi' },
    { chave: 'data_feriado', rotulo: 'Data do feriado', tipo: 'data' },
    { chave: 'data_folga', rotulo: 'Dia da folga', tipo: 'data' },
  ]),
  padrao('coletivo-ferias-coletivas', 'Férias coletivas', 'coletivo', [
    { chave: 'inicio', rotulo: 'Início das férias', tipo: 'data' },
    { chave: 'fim', rotulo: 'Último dia de férias', tipo: 'data' },
    { chave: 'retorno', rotulo: 'Data de retorno', tipo: 'data' },
  ]),
]

export const nomesGrupo: Record<GrupoModelo, string> = {
  admissao: 'Admissão',
  demissao: 'Demissão',
  avulso: 'Individuais',
  coletivo: 'Coletivos (vários funcionários)',
}

/** Campos do funcionário disponíveis em qualquer modelo. */
export const camposFuncionario: [string, string][] = [
  ['nome', 'Nome completo'],
  ['cpf', 'CPF'],
  ['rg', 'RG'],
  ['ctps', 'Carteira de trabalho (número / série UF)'],
  ['pis', 'PIS'],
  ['cargo', 'Cargo'],
  ['salario', 'Salário atual (R$)'],
  ['salario_extenso', 'Salário por extenso'],
  ['data_admissao', 'Data de admissão (dd/mm/aaaa)'],
  ['data_admissao_extenso', 'Data de admissão por extenso'],
  ['data_nascimento', 'Data de nascimento'],
  ['endereco', 'Endereço completo'],
  ['horario_jornada', 'Horário da jornada'],
  ['tipo_contrato', 'Tipo de contratação (CLT / Estágio)'],
  ['sexo', 'Sexo'],
  ['estado_civil', 'Estado civil'],
  ['grau_instrucao', 'Grau de instrução'],
  ['naturalidade', 'Naturalidade'],
  ['nome_mae', 'Nome da mãe'],
  ['nome_pai', 'Nome do pai'],
  ['telefone', 'Telefone'],
  ['email', 'E-mail'],
  ['rua', 'Rua e número'],
  ['complemento', 'Complemento'],
  ['bairro', 'Bairro'],
  ['municipio', 'Município'],
  ['cep', 'CEP'],
  ['dependentes', 'Dependentes'],
  ['contato_emergencia_1', 'Contato em caso de necessidade 1'],
  ['contato_emergencia_2', 'Contato em caso de necessidade 2'],
  ['pix', 'Pix'],
  ['dados_bancarios', 'Banco, agência e conta'],
  ['data_extenso', 'Data do documento por extenso'],
  ['data', 'Data do documento (dd/mm/aaaa)'],
]

export function ctpsTexto(f: Funcionario) {
  if (!f.ctps) return ''
  return [f.ctps, f.ctpsSerie].filter(Boolean).join(' / ') + (f.ctpsUF ? ` ${f.ctpsUF}` : '')
}

export function enderecoTexto(f: Funcionario) {
  const linha1 = [f.endereco, f.numero].filter(Boolean).join(', ')
  return [linha1, f.complemento, f.bairro, f.municipio, f.cep && `CEP ${f.cep}`].filter(Boolean).join(' - ')
}

export function dadosFuncionario(f: Funcionario, dataDoc: string): Record<string, string> {
  const sal = salarioEm(f, dataDoc)
  return {
    nome: f.nome,
    cpf: f.cpf,
    rg: f.rg ?? '',
    ctps: ctpsTexto(f),
    pis: f.pis ?? '',
    cargo: f.cargo,
    // sem permissão para ver salários, o campo sai em branco (e não como R$ 0,00)
    salario: f.salarios.length ? brl(sal).replace('R$', '').trim() : '',
    salario_extenso: f.salarios.length ? reaisExtenso(sal) : '',
    data_admissao: dataBR(f.dataAdmissao),
    data_admissao_extenso: dataExtenso(f.dataAdmissao),
    data_nascimento: f.dataNascimento ? dataBR(f.dataNascimento) : '',
    endereco: enderecoTexto(f),
    horario_jornada: f.horarioJornada ?? '',
    tipo_contrato: f.tipo === 'estagio' ? 'Estágio' : 'CLT',
    sexo: f.sexo ?? '',
    estado_civil: f.estadoCivil ?? '',
    grau_instrucao: f.grauInstrucao ?? '',
    naturalidade: f.naturalidade ?? '',
    nome_mae: f.nomeMae ?? '',
    nome_pai: f.nomePai ?? '',
    telefone: f.telefone ?? '',
    email: f.email ?? '',
    rua: [f.endereco, f.numero].filter(Boolean).join(', '),
    complemento: f.complemento ?? '',
    bairro: f.bairro ?? '',
    municipio: f.municipio ?? '',
    cep: f.cep ?? '',
    dependentes: f.dependentes ?? '',
    contato_emergencia_1: f.contatoEmergencia1 ?? '',
    contato_emergencia_2: f.contatoEmergencia2 ?? '',
    pix: f.pix ?? '',
    dados_bancarios: f.dadosBancarios ?? '',
  }
}

export function formatarExtra(c: CampoExtra, valor: string): string {
  if (!valor) return ''
  switch (c.tipo) {
    case 'data':
      return dataExtenso(valor)
    case 'dataSemana':
      return dataComDiaSemana(valor)
    case 'mes':
      return mesAno(valor)
    case 'valor':
      return brl(lerValor(valor)).replace('R$', '').trim()
    default:
      return valor
  }
}

/** Preenche um modelo e devolve o .docx pronto. */
export function preencher(modelo: ArrayBuffer, dados: Record<string, unknown>): Blob {
  const doc = new Docxtemplater(new PizZip(modelo), {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })
  doc.render(dados)
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as Blob
}

/** Lista os campos {{...}} de um modelo (para modelos enviados). */
export function camposDoModelo(modelo: ArrayBuffer): string[] {
  const doc = new Docxtemplater(new PizZip(modelo), {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
  })
  const tags = doc.getFullText().match(/\{\{\s*([^}]+?)\s*\}\}/g) ?? []
  return [...new Set(tags.map((t) => t.replace(/[{}\s]/g, '')))]
}

export interface DadosGeracao {
  funcionarios: Funcionario[]
  dataDoc: string
  extras: Record<string, string>
  config?: ConfigEmpresa
}

export function montarDados(m: Modelo, g: DadosGeracao): Record<string, unknown> {
  const extras: Record<string, string> = {}
  for (const c of m.extras) extras[c.chave] = formatarExtra(c, g.extras[c.chave] ?? c.padrao ?? '')
  // valores derivados
  if ('valor' in extras && g.extras.valor) extras.valor_extenso = reaisExtenso(lerValor(g.extras.valor))
  // campos livres de modelos enviados
  for (const [k, v] of Object.entries(g.extras)) if (!(k in extras)) extras[k] = v

  const base = {
    data_extenso: dataExtenso(g.dataDoc),
    data: dataBR(g.dataDoc),
    socio_nome: g.config?.socioNome ?? '',
    socio_cpf: g.config?.socioCpf ?? '',
    ...extras,
  }
  const lista = g.funcionarios.map((f) => dadosFuncionario(f, g.dataDoc))
  return { ...(lista[0] ?? {}), ...base, funcionarios: lista }
}

export function nomeArquivo(m: Modelo, funcionarios: Funcionario[]) {
  const quem = m.grupo === 'coletivo' || funcionarios.length !== 1 ? '' : ` - ${funcionarios[0].nome}`
  return `${m.titulo}${quem}.docx`.replace(/[\\/:*?"<>|]/g, '-')
}

/** Junta vários arquivos num .zip */
export function zipar(arquivos: { nome: string; conteudo: ArrayBuffer }[]): Blob {
  const zip = new PizZip()
  for (const a of arquivos) zip.file(a.nome, a.conteudo)
  return zip.generate({ type: 'blob', mimeType: 'application/zip' }) as Blob
}
