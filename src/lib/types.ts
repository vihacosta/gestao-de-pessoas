export type TipoContrato = 'clt' | 'estagio'

export interface Salario {
  /** Data a partir da qual o valor vale (yyyy-mm-dd) */
  data: string
  valor: number
  motivo?: string
}

export interface Funcionario {
  id: string
  nome: string
  cpf: string
  rg?: string
  dataNascimento?: string
  email?: string
  telefone?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  cep?: string
  sexo?: string
  estadoCivil?: string
  grauInstrucao?: string
  naturalidade?: string
  nomePai?: string
  nomeMae?: string
  pis?: string
  /** Carteira de trabalho: número */
  ctps?: string
  ctpsSerie?: string
  ctpsUF?: string
  horarioJornada?: string
  dependentes?: string
  contatoEmergencia1?: string
  contatoEmergencia2?: string
  pix?: string
  dadosBancarios?: string
  cargo: string
  tipo: TipoContrato
  dataAdmissao: string
  dataDemissao?: string
  salarios: Salario[]
  /** Valor fixo mensal de Cultura no cartão benefício (só algumas pessoas) */
  beneficioCultura?: number
  /** Não entra na planilha do cartão benefício (ex.: sócias) */
  semCartaoBeneficio?: boolean
  observacoes?: string
  /** Documentos pessoais marcados como "não se aplica" (ex.: não tem filhos, não usa VT) */
  docsNaoAplica?: TipoDocPessoal[]
  /** Última conferência anual dos dados do cadastro (yyyy-mm-dd) */
  dadosConferidosEm?: string
}

export type StatusFerias = 'solicitada' | 'aprovada' | 'recusada'

export interface Ferias {
  id: string
  funcionarioId: string
  /** Início do período aquisitivo ao qual estas férias pertencem (yyyy-mm-dd) */
  periodoInicio: string
  inicio: string
  fim: string
  /** Dias de descanso (corridos) */
  dias: number
  /** Dias vendidos (abono pecuniário) */
  abono: number
  antecipada: boolean
  status: StatusFerias
  observacao?: string
  criadoEm: string
}

export type TipoAusencia =
  | 'falta_injustificada'
  | 'falta_justificada'
  | 'atraso'
  | 'saida_antecipada'
  | 'atestado'
  | 'licenca_maternidade'
  | 'licenca_paternidade'
  | 'casamento'
  | 'falecimento'
  | 'outro'

export interface Ausencia {
  id: string
  funcionarioId: string
  tipo: TipoAusencia
  inicio: string
  fim: string
  /** Horas de ausência no dia (só quando inicio = fim). Vazio = dia inteiro. */
  horas?: number
  /** Horas cobertas por saldo positivo que já existia no banco de horas */
  horasBanco?: number
  /** Horas repostas depois da ausência */
  horasCompensadas?: number
  /** Caminho do atestado ou comprovante no armazenamento */
  anexo?: string
  observacao?: string
}

/** Configurações da empresa (um único registro, id = 'empresa') */
export interface ConfigEmpresa {
  id: 'empresa'
  socioNome?: string
  socioCpf?: string
  /** Valor mensal do bônus por assiduidade */
  valorBonus: number
  /** Máximo de horas de ausência num único dia para manter o bônus */
  bonusLimiteDia: number
  /** Máximo de horas de ausência somadas no mês para manter o bônus */
  bonusLimiteMes?: number
  /** Dias de período de experiência */
  diasExperiencia: number
  /** Valor fixo de Auxílio Alimentação no cartão benefício (igual para todos) */
  valorAlimentacao?: number
  /** Atrasos e saídas de até X minutos no dia não entram na folha de justificativas (faltas sempre entram) */
  toleranciaJustificativa?: number
}

export type GrupoModelo = 'admissao' | 'avulso' | 'coletivo'

export interface ModeloEnviado {
  id: string
  titulo: string
  grupo: GrupoModelo
  /** Caminho do arquivo no armazenamento */
  caminho: string
  criadoEm: string
}

/** Cartão ponto de um funcionário num mês (lido do PDF do sistema de ponto) */
export interface CartaoPontoSalvo {
  /** `${funcionarioId}-${mes}` */
  id: string
  funcionarioId: string
  mes: string // yyyy-MM
  nomeNoCartao: string
  dias: import('./cartaoPonto').DiaPonto[]
  saldoAnterior: number // minutos
  saldoTotal: number // minutos
  /** PDF só com as páginas deste funcionário */
  caminho: string
  /** Foto/PDF do cartão assinado, quando enviado */
  caminhoAssinado?: string
  importadoEm: string
}

export type CategoriaDocumento = 'holerite' | 'holerite_original' | 'ponto_assinado' | 'admissao' | 'demissao' | 'outro' | 'justificativas' | 'pessoal'

/** Documentos pessoais pedidos na admissão (ver lib/documentosPessoais) */
export type TipoDocPessoal =
  | 'foto'
  | 'ctps'
  | 'cnh'
  | 'rg'
  | 'cpf'
  | 'estado_civil'
  | 'certidao_filhos'
  | 'cpf_filhos'
  | 'residencia'
  | 'vale_transporte'

/** Documento assinado guardado (foto ou PDF) */
export interface DocumentoGuardado {
  id: string
  funcionarioId: string
  categoria: CategoriaDocumento
  /** yyyy-MM, para holerite e cartão ponto */
  mes?: string
  titulo: string
  /** Data do documento (yyyy-mm-dd) */
  data?: string
  caminho: string
  tamanho: number
  enviadoEm: string
  /** Dados lidos do holerite da contabilidade (categoria holerite_original) */
  holerite?: Omit<import('./holerite').HoleriteLido, 'paginas' | 'nome' | 'cpf'>
  /** Qual documento pessoal é (categoria pessoal) */
  tipoPessoal?: TipoDocPessoal
}
