/**
 * Gera os modelos de documentos padrão (public/modelos/<id>.docx) num visual único:
 * cabeçalho com logo e dados da empresa, título, texto justificado e assinaturas alinhadas.
 * Os campos {{...}} são preenchidos pelo sistema (src/lib/modelos.ts).
 *
 *   node scripts/gerar-modelos.mjs
 *
 * Para mudar o texto de um documento, edite a lista DOCUMENTOS abaixo e rode de novo.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const saida = join(raiz, 'public', 'modelos')
const logo = readFileSync(join(raiz, 'modelos', 'logo.jpg'))

// ---------------------------------------------------------------- empresa

const EMPRESA = 'ULTRAMARINE IMPORTAÇÃO E EXPORTAÇÃO LTDA.'
const EMPRESA_CURTO = 'Ultramarine Importação e Exportação Ltda.'
const CNPJ = '05.156.946/0001-65'
const RUA = 'Av. Arquiteto Nildo Ribeiro da Rocha, 3523 – Jardim Higienópolis'
const CIDADE = 'Maringá/PR – CEP 87060-390'
const ENDERECO = `${RUA} – ${CIDADE}`
const FONE = '(44) 3031-8260'
/** CNPJ que não quebra no hífen (para o meio do texto) */
const CNPJ_TEXTO = CNPJ.replace('-', '‑')
const QUALIFICACAO = `**${EMPRESA}**, com sede na ${ENDERECO}, inscrita no CNPJ sob o nº ${CNPJ_TEXTO}`

// ---------------------------------------------------------------- visual

const COR = '7A4B26' // marrom do logo
const CINZA = '6B6B6B'
const FONTE = 'Arial'

// ---------------------------------------------------------------- OOXML

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Texto com **negrito** e _itálico_ em runs (os campos {{...}} ficam inteiros num run). */
function runs(texto, base = {}) {
  const partes = texto.split(/(\*\*[^*]+\*\*|__[^_]+__)/).filter(Boolean)
  return partes
    .map((t) => {
      if (t.startsWith('**')) return run(t.slice(2, -2), { ...base, b: true })
      if (t.startsWith('__')) return run(t.slice(2, -2), { ...base, i: true })
      return run(t, base)
    })
    .join('')
}

function run(t, { b, i, sz, cor, caps } = {}) {
  const rPr =
    (b ? '<w:b/><w:bCs/>' : '') +
    (i ? '<w:i/><w:iCs/>' : '') +
    (caps ? '<w:caps/>' : '') +
    (cor ? `<w:color w:val="${cor}"/>` : '') +
    (sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : '')
  const corpo = t
    .split('\t')
    .map((x) => (x ? x.split('‑').map((y) => (y ? `<w:t xml:space="preserve">${esc(y)}</w:t>` : '')).join('<w:noBreakHyphen/>') : ''))
    .join('<w:tab/>')
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${corpo}</w:r>`
}

function par(conteudo, { jc = 'both', antes = 0, depois = 160, ind, juntoProximo, bordaTopo, bordaBaixo, linha } = {}) {
  const pPr =
    (juntoProximo ? '<w:keepNext/><w:keepLines/>' : '') +
    (bordaTopo || bordaBaixo
      ? `<w:pBdr>${bordaTopo ? `<w:top w:val="single" w:sz="6" w:space="4" w:color="${bordaTopo}"/>` : ''}${bordaBaixo ? `<w:bottom w:val="single" w:sz="8" w:space="6" w:color="${bordaBaixo}"/>` : ''}</w:pBdr>`
      : '') +
    `<w:spacing w:before="${antes}" w:after="${depois}"${linha ? ` w:line="${linha}" w:lineRule="auto"` : ''}/>` +
    (ind ? `<w:ind ${ind}/>` : '') +
    `<w:jc w:val="${jc}"/>`
  return `<w:p><w:pPr>${pPr}</w:pPr>${conteudo}</w:p>`
}

const semBordas = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'

function tabela(larguras, linhas, { bordas = semBordas, jc = 'center' } = {}) {
  const total = larguras.reduce((a, b) => a + b, 0)
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="${jc}"/>${bordas}<w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${larguras.map((l) => `<w:gridCol w:w="${l}"/>`).join('')}</w:tblGrid>` +
    linhas.join('') +
    '</w:tbl>'
  )
}

function linhaTabela(celulas, larguras, { cabecalho, altura, fundo, alinhar = 'top' } = {}) {
  const trPr = `<w:trPr><w:cantSplit/>${cabecalho ? '<w:tblHeader/>' : ''}${altura ? `<w:trHeight w:val="${altura}"/>` : ''}</w:trPr>`
  return (
    `<w:tr>${trPr}` +
    celulas
      .map(
        (c, i) =>
          `<w:tc><w:tcPr><w:tcW w:w="${larguras[i]}" w:type="dxa"/>${fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${fundo}"/>` : ''}<w:vAlign w:val="${cabecalho ? 'center' : alinhar}"/></w:tcPr>${c}</w:tc>`,
      )
      .join('') +
    '</w:tr>'
  )
}

// ---------------------------------------------------------------- blocos de conteúdo

const LARGURA = 9070 // A4 menos margens de 2,5 cm (twips)

const b = {
  titulo: (t) => par(run(t, { b: true, sz: 28, cor: COR, caps: true }), { jc: 'center', antes: 120, depois: 360 }),
  p: (t) => par(runs(t), { linha: 300 }),
  /** Parágrafo que fica na mesma página da assinatura */
  final: (t) => par(runs(t), { linha: 300, juntoProximo: true }),
  clausula: (rotulo, t) => par(runs(`**${rotulo}:** ${t}`), { linha: 300 }),
  /** Citação de lei, recuada e em itálico */
  citacao: (t) => par(runs(t, { i: true, sz: 20 }), { ind: 'w:left="709" w:right="709"', linha: 276 }),
  /** Lista com marcador */
  lista: (itens) => itens.map((t) => par(runs(`•\t${t}`), { ind: 'w:left="567" w:hanging="283"', depois: 100, linha: 300 })).join(''),
  /** Lista numerada (o número faz parte do texto, para os documentos citarem "critério 2") */
  numerada: (itens) => itens.map((t, i) => par(runs(`${i + 1}.\t${t}`), { ind: 'w:left="567" w:hanging="283"', depois: 100, linha: 300 })).join(''),
  /** Pares rótulo/valor (ex.: dados da compra) */
  campos: (pares) =>
    tabela(
      [2800, LARGURA - 2800],
      pares.map(([r, v]) =>
        linhaTabela([par(run(r, { b: true }), { jc: 'left', depois: 60 }), par(runs(v), { jc: 'left', depois: 60 })], [2800, LARGURA - 2800], { altura: 420, alinhar: 'center' }),
      ),
      {
        bordas: `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>`,
        jc: 'left',
      },
    ) + par('', { depois: 120 }),
  local: () => par(run('Maringá, {{data_extenso}}.'), { jc: 'right', antes: 360, depois: 0, juntoProximo: true }),
  /**
   * Assinaturas lado a lado. Cada uma: [linha principal, ...linhas menores]
   */
  assinaturas: (...pessoas) => {
    const n = pessoas.length
    const larg = n === 1 ? [5200] : Array(n).fill(Math.floor(LARGURA / n))
    const celulas = pessoas.map(([nome, ...extras]) =>
      [
        par('', { antes: 900, depois: 60, bordaBaixo: '404040', ind: 'w:left="240" w:right="240"', juntoProximo: true }),
        par(runs(`**${nome}**`, { sz: 20 }), { jc: 'center', depois: 0, juntoProximo: true }),
        ...extras.map((e) => par(runs(e, { sz: 18, cor: CINZA }), { jc: 'center', depois: 0, juntoProximo: true })),
      ].join(''),
    )
    return tabela(larg, [linhaTabela(celulas, larg)])
  },
  /** Tabela de adesão dos funcionários (uma linha por pessoa) */
  listaColetiva: () => {
    const larg = [4100, 1900, LARGURA - 6000]
    const cab = ['Funcionário', 'CPF', 'Assinatura'].map((t) => par(run(t, { b: true, sz: 18, cor: 'FFFFFF' }), { jc: 'left', depois: 0 }))
    const linha = [
      par(run('{{#funcionarios}}{{nome}}', { sz: 20 }), { jc: 'left', depois: 40 }),
      par(run('{{cpf}}', { sz: 20 }), { jc: 'left', depois: 40 }),
      par(run('{{/funcionarios}}'), { jc: 'left', depois: 40 }),
    ]
    return (
      tabela(larg, [linhaTabela(cab, larg, { cabecalho: true, altura: 400, fundo: COR }), linhaTabela(linha, larg, { altura: 680, alinhar: 'center' })], {
        bordas: `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/></w:tblBorders>`,
      }) + par('', { depois: 0 })
    )
  },
  espaco: () => par('', { depois: 120 }),
  /** Título de seção (ficha cadastral) */
  secao: (t) => par(run(t, { b: true, sz: 19, cor: COR, caps: true }), { jc: 'left', antes: 200, depois: 80, juntoProximo: true }),
  /**
   * Grade de dados com duas colunas de rótulo/valor. Cada linha: [[rótulo, valor], [rótulo, valor]]
   * ou [[rótulo, valor]] (ocupa a largura toda).
   */
  grade: (linhas) => {
    const meia = LARGURA / 2
    const L = [1750, meia - 1750, 1750, meia - 1750]
    const cel = (w, conteudo, { span, fundo } = {}) =>
      `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span ? `<w:gridSpan w:val="${span}"/>` : ''}${fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${fundo}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${conteudo}</w:tc>`
    const rot = (w, r) => cel(w, par(run(r, { b: true, sz: 17, cor: '5A5A5A' }), { jc: 'left', depois: 0 }), { fundo: 'F6F1EC' })
    const val = (v) => par(runs(v, { sz: 20 }), { jc: 'left', depois: 0 })
    const linhas_ = linhas.map((l) => {
      const cels =
        l.length === 1
          ? rot(L[0], l[0][0]) + cel(L[1] + L[2] + L[3], val(l[0][1]), { span: 3 })
          : l.map(([r, v], i) => rot(L[2 * i], r) + cel(L[2 * i + 1], val(v))).join('')
      return `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="400"/></w:trPr>${cels}</w:tr>`
    })
    const borda = (lado) => `<w:${lado} w:val="single" w:sz="4" w:color="D9D9D9"/>`
    return tabela(L, linhas_, { bordas: `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borda).join('')}</w:tblBorders>`, jc: 'left' })
  },
}

const funcionario = (...extras) => ['{{nome}}', 'CPF: {{cpf}}', ...extras]
const empresa = [EMPRESA_CURTO, `CNPJ: ${CNPJ}`]

const CITACAO_462 =
  '“§ 1º – Em caso de dano causado pelo empregado, o desconto será lícito, desde que esta possibilidade tenha sido acordada ou na ocorrência de dolo do empregado.” (CLT, art. 462, parágrafo único renumerado pelo Decreto-Lei nº 229, de 28/02/1967)'

const preambuloAcordo = `Pelo presente instrumento particular, ${QUALIFICACAO}, com atividade principal no comércio atacadista de artigos de uso pessoal e doméstico, doravante denominada **EMPREGADORA**, e, de outro lado, **{{nome}}**, portador(a) da CTPS nº {{ctps}}, doravante denominado(a) **EMPREGADO(A)**, ajustam o seguinte:`

const preambuloColetivo = `Termo de acordo que celebram, de um lado, ${QUALIFICACAO}, por meio de seu representante legal, e, de outro lado, os funcionários abaixo indicados, mediante as condições a seguir:`

const dadosDesligamento = [
  ['Funcionário(a)', '**{{nome}}**'],
  ['CPF', '{{cpf}}'],
  ['CTPS', '{{ctps}}'],
  ['Cargo', '{{cargo}}'],
  ['Admissão', '{{data_admissao}}'],
]

// ---------------------------------------------------------------- documentos

const DOCUMENTOS = [
  {
    id: 'admissao-1-ficha-cadastral',
    titulo: 'Ficha cadastral do funcionário',
    corpo: [
      b.secao('Dados pessoais'),
      b.grade([
        [['Nome completo', '**{{nome}}**']],
        [['Nascimento', '{{data_nascimento}}'], ['Sexo', '{{sexo}}']],
        [['Estado civil', '{{estado_civil}}'], ['Instrução', '{{grau_instrucao}}']],
        [['Naturalidade', '{{naturalidade}}'], ['Telefone', '{{telefone}}']],
        [['E-mail', '{{email}}']],
        [['Nome da mãe', '{{nome_mae}}']],
        [['Nome do pai', '{{nome_pai}}']],
      ]),
      b.secao('Documentos'),
      b.grade([
        [['CPF', '{{cpf}}'], ['RG', '{{rg}}']],
        [['PIS', '{{pis}}'], ['CTPS', '{{ctps}}']],
      ]),
      b.secao('Endereço'),
      b.grade([
        [['Rua e número', '{{rua}}']],
        [['Complemento', '{{complemento}}'], ['Bairro', '{{bairro}}']],
        [['Município', '{{municipio}}'], ['CEP', '{{cep}}']],
      ]),
      b.secao('Contrato'),
      b.grade([
        [['Cargo', '{{cargo}}'], ['Contratação', '{{tipo_contrato}}']],
        [['Admissão', '{{data_admissao}}'], ['Remuneração', 'R$ {{salario}}']],
        [['Jornada', '{{horario_jornada}}']],
      ]),
      b.secao('Família e contatos'),
      b.grade([
        [['Dependentes', '{{dependentes}}']],
        [['Contato 1', '{{contato_emergencia_1}}']],
        [['Contato 2', '{{contato_emergencia_2}}']],
      ]),
      b.secao('Dados bancários'),
      b.grade([[['Pix', '{{pix}}']], [['Banco / conta', '{{dados_bancarios}}']]]),
    ],
  },
  {
    id: 'admissao-2-codigo-de-cultura',
    titulo: 'Termo de recebimento do Código de Cultura',
    corpo: [
      b.p('Declaro que recebi e li a cópia integral do **Código de Cultura da Ultramarine**, que contém a política da empresa, e que estou ciente de que deverei adotá-lo como conduta profissional durante todo o tempo em que trabalhar na empresa.'),
      b.local(),
      b.assinaturas(funcionario()),
    ],
  },
  {
    id: 'admissao-3-acordo-desconto',
    titulo: 'Acordo individual de desconto',
    corpo: [
      b.p(preambuloAcordo),
      b.clausula('CLÁUSULA PRIMEIRA', 'As partes estabelecem que o EMPREGADO indenizará a EMPREGADORA por todos e quaisquer danos causados ao patrimônio dela ou de terceiros, por conduta dolosa ou culposa, conforme autoriza o § 1º do artigo 462 da CLT:'),
      b.citacao(CITACAO_462),
      b.clausula('CLÁUSULA SEGUNDA', 'As indenizações previstas na cláusula anterior serão feitas por desconto na folha de pagamento ou, em caso de rescisão contratual, de uma só vez ou de forma parcelada, conforme combinado entre as partes.'),
      b.clausula('CLÁUSULA TERCEIRA', 'A cobrança será feita somente quando ocorrer mais de 1 (uma) quebra ou 1 (um) erro dentro de um período de 3 (três) meses, contado a partir da primeira quebra ou erro. Uma única quebra ou erro no período não será descontado, ressalvado o disposto na Cláusula Quinta.'),
      b.clausula('CLÁUSULA QUARTA', 'Ocorrendo 2 (duas) ou mais quebras ou erros dentro do referido período, o valor a ser descontado será calculado somando os valores das quebras ou erros e dividindo o total pelo número de ocorrências. Exemplo: quebras de R$ 150,00, R$ 50,00 e R$ 25,00 somam R$ 225,00 que, divididos por 3 (três), resultam no desconto de R$ 75,00.'),
      b.clausula('CLÁUSULA QUINTA', 'Caso uma única quebra ou erro tenha valor superior a R$ 200,00 (duzentos reais), o EMPREGADO será responsável apenas pela diferença entre esse valor e os R$ 200,00, mesmo que o período de 3 (três) meses não tenha sido completado. Exemplo: em um erro de R$ 350,00, o desconto será de R$ 150,00.'),
      b.clausula('Parágrafo único', 'Ocorrendo mais de uma quebra ou erro no período e sendo a soma superior a R$ 200,00 (duzentos reais), será descontado o maior valor entre o resultado da divisão prevista na Cláusula Quarta e a diferença entre a soma e os R$ 200,00.'),
      b.clausula('CLÁUSULA SEXTA', 'A partir do momento em que o EMPREGADO paga por uma quebra ou erro, o período de 3 (três) meses é reiniciado e volta a contar da quebra ou erro seguinte. O mesmo ocorre quando o período de 3 (três) meses termina sem desconto.'),
      b.local(),
      b.assinaturas(funcionario(), empresa),
    ],
  },
  {
    id: 'admissao-4-banco-de-horas',
    titulo: 'Acordo individual de banco de horas',
    corpo: [
      b.p(preambuloAcordo),
      b.clausula('CLÁUSULA PRIMEIRA', 'As partes estabelecem acordo de banco de horas, nos termos do artigo 59, § 2º, da CLT, com redação dada pela Lei 5.452/43, e de acordo com o permissivo convencional, combinando que as horas de trabalho executadas em excesso não serão pagas se compensadas, hora por hora, pela diminuição ou exclusão total do trabalho em outro dia.'),
      b.clausula('Parágrafo único', 'Para verificar o horário de trabalho do empregado, para os efeitos acima, será usado o controle de fechamento do ponto, no qual serão registrados, dia a dia, o início e o término da jornada e os intervalos usufruídos.'),
      b.clausula('CLÁUSULA SEGUNDA', 'O banco de horas será composto apenas por horas positivas decorrentes de horas extras realizadas em dias anteriores.'),
      b.clausula('CLÁUSULA TERCEIRA', 'Se o controle de ponto fechar com saldo de horas negativas e não houver saldo positivo no banco de horas do colaborador que permita compensá-las, o saldo negativo será descontado na folha de pagamento.'),
      b.clausula('CLÁUSULA QUARTA', 'Em caso de faltas injustificadas, não havendo saldo positivo suficiente no banco de horas para compensar o dia faltado, haverá, de acordo com o art. 6º da Lei 605/49, o desconto integral do dia de trabalho e do descanso semanal remunerado da semana da falta.'),
      b.clausula('CLÁUSULA QUINTA', 'O saldo de horas positivas não compensadas nos meses anteriores será fechado em duas datas por ano, 30/06 (trinta de junho) e 31/12 (trinta e um de dezembro), e as horas extras correspondentes serão pagas na folha de julho e de janeiro, respectivamente. Após cada uma dessas datas, o banco de horas ficará zerado.'),
      b.clausula('CLÁUSULA SEXTA', 'O pagamento de horas extras em determinado mês ou período não invalida nem torna nulo este acordo. E, por estarem certas e ajustadas, as partes firmam o presente, para que produza os efeitos legais.'),
      b.clausula('CLÁUSULA SÉTIMA', 'O empregado aceita e se obriga a prestar serviço em horário noturno ou diurno, em qualquer turno, conforme as necessidades da empresa, observados os preceitos legais.'),
      b.clausula('CLÁUSULA OITAVA', 'A realização de horas extras dependerá da necessidade de serviço da empresa e/ou de seus clientes e de autorização prévia do diretor, gerente, supervisor ou responsável pelo departamento do empregado. Trabalhar em horas extras sem a autorização correspondente constitui falta grave, exceto em caso de urgência ou outra situação devidamente justificada.'),
      b.clausula('CLÁUSULA NONA', 'O saldo credor do banco de horas poderá ser gozado pelo empregado em folga coletiva ou individual. A folga individual será negociada de comum acordo entre o empregado e a empresa e deverá ser solicitada com no mínimo 24 horas de antecedência.'),
      b.p('O presente acordo vigorará durante todo o contrato de trabalho do empregado.'),
      b.final('O funcionário abaixo assinado declara estar ciente e de acordo com o sistema de compensação de horas.'),
      b.local(),
      b.assinaturas(funcionario(), empresa),
    ],
  },
  {
    id: 'admissao-5-compensacao-de-jornada',
    titulo: 'Acordo individual de compensação de jornada',
    corpo: [
      b.p(preambuloAcordo),
      b.clausula('CLÁUSULA PRIMEIRA', 'As partes estabelecem acordo de compensação de horas, nos termos do artigo 59, § 2º, da CLT, com redação dada pela Lei 9.601/98, e de acordo com o permissivo convencional, combinando que o excesso de horas trabalhadas num dia não será pago se compensado pela diminuição ou exclusão total do trabalho em outro dia, de modo que, no fechamento mensal do cartão de ponto, não se exceda a soma das jornadas semanais de 44 horas.'),
      b.clausula('CLÁUSULA SEGUNDA', 'Pelo presente acordo, as partes concordam em suprimir as horas de trabalho no sábado, compensando-as durante a semana da seguinte forma: de segunda a quinta-feira, das 08:00 às 18:00; às sextas-feiras, das 08:00 às 17:00; sempre com 1 (uma) hora de intervalo para refeição e descanso, totalizando 44 horas semanais.'),
      b.clausula('CLÁUSULA TERCEIRA', 'Havendo necessidade de trabalho aos sábados, as horas trabalhadas serão computadas no banco de horas do colaborador.'),
      b.final('O funcionário abaixo assinado declara estar ciente e de acordo com o sistema de compensação de horas.'),
      b.local(),
      b.assinaturas(funcionario(), empresa),
    ],
  },
  {
    id: 'admissao-6-uso-de-imagem',
    titulo: 'Termo de autorização de uso de imagem',
    corpo: [
      b.campos([
        ['Empregador', `${EMPRESA_CURTO} – CNPJ ${CNPJ_TEXTO}`],
        ['Colaborador(a)', '{{nome}}'],
      ]),
      b.p('Eu, **{{nome}}**, na qualidade de colaborador(a) da empresa Ultramarine, autorizo a utilização da minha imagem nos seguintes termos:'),
      b.clausula('Objetivo', 'Autorizo a empresa Ultramarine a utilizar minha imagem, gravada em fotos ou vídeos, em materiais institucionais, promocionais e publicitários, impressos ou digitais, para divulgação da empresa e de suas atividades, sem qualquer ônus financeiro para a empresa.'),
      b.clausula('Prazo', 'Esta autorização é concedida por tempo indeterminado.'),
      b.clausula('Abrangência', 'A autorização inclui o uso da minha imagem em mídias sociais, site da empresa, material de marketing, apresentações, palestras, eventos, feiras, jornais, revistas, televisão e qualquer outro meio de comunicação, sempre relacionados aos interesses da empresa.'),
      b.clausula('Compromisso de uso ético', 'A empresa Ultramarine se compromete a utilizar minha imagem de maneira ética e respeitosa, sem expor minha privacidade de forma indevida.'),
      b.local(),
      b.assinaturas(funcionario()),
    ],
  },
  {
    id: 'admissao-7-uso-de-uniformes',
    titulo: 'Termo de comprometimento – uso de uniformes',
    corpo: [
      b.campos([
        ['Empregador', EMPRESA_CURTO],
        ['Colaborador(a)', '{{nome}}'],
        ['Uniformes entregues', '{{qtd_uniformes}}'],
      ]),
      b.p('Declaro-me ciente e de acordo com os termos abaixo e comprometo-me a seguir as regras de uso dos uniformes corporativos:'),
      b.lista([
        'O uniforme não é de uso obrigatório na empresa.',
        'Os uniformes não poderão ser cedidos ou emprestados a terceiros, nem usados em festas ou reuniões não autorizadas pela direção.',
        'Os uniformes deverão ser devolvidos à empresa limpos e em bom estado de conservação em caso de rescisão do contrato de trabalho ou quando tiverem de ser substituídos.',
        'Eventuais danos por uso indevido ou mau uso dos uniformes serão cobrados do responsável.',
      ]),
      b.local(),
      b.assinaturas(funcionario()),
    ],
  },
  {
    id: 'admissao-8-monitoramento-cameras',
    titulo: 'Termo de ciência de monitoramento por câmeras',
    corpo: [
      b.p('Pelo presente instrumento particular, eu, **{{nome}}**, portador(a) da CTPS nº {{ctps}}, declaro que:'),
      b.p(`É de meu conhecimento que minha empregadora, ${QUALIFICACAO}, utiliza sistema de monitoramento interno e externo, com gravação de imagens, dentro de suas dependências.`),
      b.p('Declaro que tenho conhecimento de onde as câmeras estão posicionadas e autorizo a utilização das imagens para fins lícitos de segurança da empresa e dos funcionários.'),
      b.local(),
      b.assinaturas(funcionario()),
    ],
  },
  {
    id: 'admissao-9-bonus-assiduidade',
    titulo: 'Política de prêmio por assiduidade total mensal',
    corpo: [
      b.p('O presente documento estabelece as diretrizes para a concessão de um bônus por assiduidade total aos colaboradores da Ultramarine, concedido de forma espontânea pela empresa.'),
      b.clausula('1º Parágrafo', 'O período de análise para a concessão do bônus é mensal: os 3 (três) critérios de elegibilidade descritos neste documento são verificados do dia 1º até o último dia de cada mês.'),
      b.clausula('2º Parágrafo', 'Para ser elegível ao bônus por assiduidade total, o colaborador deve cumprir todos os 3 (três) critérios abaixo dentro do período analisado:'),
      b.numerada([
        'Estar efetivado na empresa, ou seja, não estar em período de experiência.',
        'Não ter se ausentado do trabalho por 4 (quatro) horas ou mais em um único dia, ainda que essas horas sejam compensadas posteriormente.',
        'Não ter somado, no mês, 4 (quatro) horas ou mais de ausências e atrasos que não tenham sido compensados.',
      ]),
      b.clausula('3º Parágrafo', 'O controle dos horários será feito pelo cartão ponto que os colaboradores assinam mensalmente.'),
      b.clausula('4º Parágrafo', 'As faltas justificadas, conforme a CLT, também descaracterizam a assiduidade total, e o colaborador perde o bônus mesmo com a justificativa legal.'),
      b.clausula('5º Parágrafo', 'O colaborador não perderá o benefício se a ausência for coberta integralmente por horas positivas que já constavam em seu banco de horas antes da ausência. Se o saldo cobrir apenas parte da ausência, ela continuará sendo considerada por inteiro para o critério 2; para o critério 3, serão descontadas somente as horas cobertas pelo saldo.'),
      b.clausula('6º Parágrafo', 'O bônus será concedido por meio do cartão de benefícios.'),
      b.clausula('7º Parágrafo', 'Ausências por falecimento (atestado de óbito) serão desconsideradas para fins de cálculo, sendo esta a única exceção prevista neste termo.'),
      b.clausula('8º Parágrafo', 'A decisão do departamento de Recursos Humanos sobre a elegibilidade para o bônus por assiduidade é final e não está sujeita a recurso.'),
      b.clausula('9º Parágrafo', 'A empresa reserva-se o direito de alterar ou encerrar este programa de bônus por assiduidade a qualquer momento, a seu critério.'),
      b.final('Ao assinar abaixo, declaro que li, compreendi e concordo com as regras acima e que desejo participar do programa de bônus por assiduidade total.'),
      b.local(),
      b.assinaturas(funcionario()),
    ],
  },
  {
    id: 'aquisicao-de-mercadorias',
    titulo: 'Aquisição de mercadorias',
    corpo: [
      b.p(`Eu, **{{nome}}**, autorizo o desconto em meu pagamento referente ao(s) item(ns) adquirido(s) na empresa Ultramarine, inscrita no CNPJ sob o nº ${CNPJ_TEXTO}, conforme a descrição abaixo:`),
      b.campos([
        ['Data da aquisição', '{{data_aquisicao}}'],
        ['Item(ns)', '{{itens}}'],
        ['Valor total', 'R$ {{valor_total}}'],
        ['Desconto', 'R$ {{desconto}}'],
        ['Forma de pagamento', '{{forma_pagamento}}'],
      ]),
      b.local(),
      b.assinaturas(funcionario('CTPS: {{ctps}}')),
    ],
  },
  {
    id: 'autorizacao-de-desconto',
    titulo: 'Autorização de desconto',
    corpo: [
      b.p('Autorizo o desconto de **R$ {{valor}} ({{valor_extenso}})** em minha folha de pagamento do mês de **{{mes_referencia}}**, referente ao prejuízo causado à empresa pelo não cumprimento das determinações próprias da minha função.'),
      b.p('Declaro-me ciente de que o desconto foi previamente acordado e comunicado e de que está de acordo com o § 1º do artigo 462 da CLT:'),
      b.citacao(CITACAO_462),
      b.local(),
      b.assinaturas(funcionario('CTPS: {{ctps}}')),
    ],
  },
  {
    id: 'coletivo-compensacao-dia-normal',
    titulo: 'Acordo de compensação de horas',
    corpo: [
      b.p(preambuloColetivo),
      b.p('As partes estabelecem a folga no dia normal de trabalho de **{{data_folga}}**, com compensação do horário no **{{data_compensacao}}**. A compensação será integral, sem qualquer prejuízo aos funcionários pela celebração do presente acordo.'),
      b.p('O trabalho no dia indicado não configura horas extras, uma vez que haverá a respectiva compensação, na forma legal, conforme indicado.'),
      b.final('Segue a lista de assinaturas de adesão dos funcionários da empresa, que expressam sua livre concordância com este acordo de compensação de horas de trabalho.'),
      b.local(),
      b.espaco(),
      b.listaColetiva(),
      b.assinaturas(empresa),
    ],
  },
  {
    id: 'coletivo-compensacao-feriado',
    titulo: 'Acordo de compensação de trabalho em feriado',
    corpo: [
      b.p(preambuloColetivo),
      b.p('As partes estabelecem a troca do descanso do feriado de **{{feriado}}**, que ocorrerá no dia **{{data_feriado}}**, para o dia **{{data_folga}}**. Assim, os empregados trabalharão normalmente no dia do feriado e, em contrapartida, terão folga no dia indicado. Trata-se de uma compensação pontual e específica, que não altera definitivamente as condições de trabalho e não traz qualquer prejuízo aos funcionários.'),
      b.p('O trabalho no dia indicado não configura horas extras, uma vez que haverá a respectiva compensação de todo o período, na forma legal, conforme indicado.'),
      b.final('Segue a lista de assinaturas de adesão dos funcionários, que expressam sua livre concordância com este acordo de compensação de horas de trabalho em feriado.'),
      b.local(),
      b.espaco(),
      b.listaColetiva(),
      b.assinaturas(empresa),
    ],
  },
  {
    id: 'coletivo-ferias-coletivas',
    titulo: 'Acordo para concessão de férias coletivas',
    corpo: [
      b.p(`Pelo presente Comunicado Coletivo de Trabalho para Gozo de Férias Coletivas, de um lado, como empregador, ${QUALIFICACAO}, pessoa jurídica de direito privado, neste ato representada por seu sócio-administrador **{{socio_nome}}**, inscrito no CPF sob o nº {{socio_cpf}}, e, de outro lado, os empregados abaixo assinados, representados pelo SINCOMAR – Atacado, resolvem firmar o presente acordo.`),
      b.p('Por conveniência técnica, administrativa e econômica do empregador, e tendo em vista a ciência e a concordância dos empregados signatários, fica estabelecido o gozo de férias coletivas no período de **{{inicio}} a {{fim}}**, devendo os empregados retornar às suas atividades em **{{retorno}}**.'),
      b.local(),
      b.espaco(),
      b.listaColetiva(),
      b.assinaturas(['{{socio_nome}}', 'Sócio-administrador', EMPRESA_CURTO]),
    ],
  },
  {
    id: 'demissao-1-aviso-previo-trabalhado',
    titulo: 'Aviso prévio trabalhado',
    corpo: [
      b.campos(dadosDesligamento),
      b.p('Comunicamos que, a partir desta data, seu contrato de trabalho será rescindido **sem justa causa**, por iniciativa da empresa, com aviso prévio de **{{dias_aviso}} dias**, contados a partir do dia seguinte ao recebimento deste comunicado.'),
      b.p('Você deverá trabalhar **{{dias_trabalhados}} dias**, sendo seu último dia de trabalho **{{ultimo_dia}}**. {{texto_proporcional}}'),
      b.p('Conforme o artigo 488 da CLT, escolha como deseja cumprir a redução da jornada durante o aviso, sem prejuízo do salário:'),
      b.lista(['(   ) Sair **2 (duas) horas antes** ou entrar 2 (duas) horas depois, todos os dias.', '(   ) Deixar de trabalhar nos **últimos 7 (sete) dias corridos** do aviso.']),
      b.final('As verbas rescisórias serão pagas até **{{prazo_pagamento}}**, conforme o § 6º do artigo 477 da CLT.'),
      b.local(),
      b.assinaturas(empresa, funcionario('Ciente em ____/____/________')),
    ],
  },
  {
    id: 'demissao-2-aviso-previo-indenizado',
    titulo: 'Aviso prévio indenizado',
    corpo: [
      b.campos(dadosDesligamento),
      b.p('Comunicamos que seu contrato de trabalho está sendo rescindido **sem justa causa**, por iniciativa da empresa, **nesta data**, com dispensa do cumprimento do aviso prévio.'),
      b.p('O aviso prévio de **{{dias_aviso}} dias** será pago de forma indenizada e integra seu tempo de serviço, com projeção do contrato até **{{projecao}}**, conforme o § 1º do artigo 487 da CLT e a Lei nº 12.506/2011.'),
      b.final('As verbas rescisórias serão pagas até **{{prazo_pagamento}}**, conforme o § 6º do artigo 477 da CLT.'),
      b.local(),
      b.assinaturas(empresa, funcionario('Ciente em ____/____/________')),
    ],
  },
  {
    id: 'demissao-3-pedido-de-demissao',
    titulo: 'Pedido de demissão',
    corpo: [
      b.p(`Eu, **{{nome}}**, CPF nº {{cpf}}, CTPS nº {{ctps}}, ocupante do cargo de {{cargo}}, admitido(a) em {{data_admissao}}, comunico à **${EMPRESA}**, de minha livre e espontânea vontade, que não desejo continuar no emprego e peço a rescisão do meu contrato de trabalho.`),
      b.p('{{texto_aviso}}'),
      b.final('Declaro que este pedido foi feito sem qualquer coação ou pressão.'),
      b.local(),
      b.assinaturas(funcionario('CTPS: {{ctps}}'), empresa),
    ],
  },
  {
    id: 'demissao-4-acordo-484a',
    titulo: 'Termo de rescisão por acordo',
    corpo: [
      b.p(`Pelo presente instrumento, ${QUALIFICACAO}, doravante denominada **EMPREGADORA**, e **{{nome}}**, CPF nº {{cpf}}, CTPS nº {{ctps}}, ocupante do cargo de {{cargo}}, admitido(a) em {{data_admissao}}, doravante denominado(a) **EMPREGADO(A)**, de comum acordo e por livre vontade, resolvem extinguir o contrato de trabalho na forma do **artigo 484-A da CLT**, com último dia em **{{ultimo_dia}}**.`),
      b.p('Conforme a lei, nesta modalidade:'),
      b.lista([
        'o aviso prévio indenizado é pago pela **metade**: {{dias_indenizados}} dos {{dias_aviso}} dias;',
        'a indenização sobre o saldo do FGTS é de **20%**;',
        'as demais verbas trabalhistas são pagas **integralmente**;',
        'o(a) empregado(a) pode sacar até **80%** do saldo do FGTS;',
        'o(a) empregado(a) **não tem direito ao seguro-desemprego**.',
      ]),
      b.final('As verbas rescisórias serão pagas até **{{prazo_pagamento}}**, conforme o § 6º do artigo 477 da CLT.'),
      b.local(),
      b.assinaturas(empresa, funcionario()),
    ],
  },
  {
    id: 'demissao-5-termino-experiencia',
    titulo: 'Término do contrato de experiência',
    corpo: [
      b.campos(dadosDesligamento),
      b.p('Comunicamos que seu contrato de experiência **não será prorrogado nem convertido** em contrato por prazo indeterminado, encerrando-se em **{{ultimo_dia}}**, que será seu último dia de trabalho.'),
      b.final('As verbas rescisórias serão pagas até **{{prazo_pagamento}}**, conforme o § 6º do artigo 477 da CLT.'),
      b.local(),
      b.assinaturas(empresa, funcionario('Ciente em ____/____/________')),
    ],
  },
  {
    id: 'demissao-6-rescisao-estagio',
    titulo: 'Termo de rescisão de estágio',
    corpo: [
      b.p(`Pelo presente termo, ${QUALIFICACAO}, na condição de **PARTE CONCEDENTE**, e **{{nome}}**, CPF nº {{cpf}}, na condição de **ESTAGIÁRIO(A)**, vinculado(a) à instituição de ensino **{{instituicao}}**, encerram o Termo de Compromisso de Estágio, nos termos da Lei nº 11.788/2008, com último dia em **{{ultimo_dia}}**.`),
      b.p('O encerramento do estágio não gera vínculo empregatício. Serão pagos a bolsa e o recesso proporcional eventualmente devidos até essa data.'),
      b.final('A instituição de ensino deverá ser informada deste encerramento.'),
      b.local(),
      b.assinaturas(empresa, funcionario()),
      b.assinaturas(['{{instituicao}}', 'Instituição de ensino']),
    ],
  },
  {
    id: 'demissao-7-devolucao-materiais',
    titulo: 'Termo de devolução de materiais',
    corpo: [
      b.campos(dadosDesligamento),
      b.p('Declaramos que, no desligamento do(a) funcionário(a) acima, foram conferidos os itens abaixo:'),
      b.lista([
        '(   ) Uniformes  –  quantidade: ______',
        '(   ) Crachá',
        '(   ) Chaves  –  quais: ______________________',
        '(   ) Celular, computador ou outros equipamentos: ______________________',
        '(   ) Outros: ______________________',
        '(   ) Nenhum item a devolver',
      ]),
      b.final('Observações: ____________________________________________________________'),
      b.local(),
      b.assinaturas(empresa, funcionario()),
    ],
  },
]

// ---------------------------------------------------------------- pacote .docx

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

function tamanhoJpeg(buf) {
  let i = 2
  while (i < buf.length) {
    const marca = buf[i + 1]
    const tam = buf.readUInt16BE(i + 2)
    if (marca >= 0xc0 && marca <= 0xc3) return { altura: buf.readUInt16BE(i + 5), largura: buf.readUInt16BE(i + 7) }
    i += 2 + tam
  }
  throw new Error('JPEG inválido')
}

function cabecalho() {
  const { largura, altura } = tamanhoJpeg(logo)
  const cy = Math.round(1.25 * 360000) // 1,25 cm de altura
  const cx = Math.round((cy * largura) / altura)
  const img = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  const larg = [3000, LARGURA - 3000]
  const dados = [
    par(run(EMPRESA, { b: true, sz: 18, cor: COR }), { jc: 'right', depois: 20 }),
    par(run(RUA, { sz: 15, cor: CINZA }), { jc: 'right', depois: 20 }),
    par(run(`${CIDADE}  ·  Fone ${FONE}`, { sz: 15, cor: CINZA }), { jc: 'right', depois: 20 }),
    par(run(`CNPJ ${CNPJ}`, { sz: 15, cor: CINZA }), { jc: 'right', depois: 0 }),
  ].join('')
  const corpo =
    tabela(larg, [`<w:tr>${[par(img, { jc: 'left', depois: 0 }), dados].map((c, i) => `<w:tc><w:tcPr><w:tcW w:w="${larg[i]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${c}</w:tc>`).join('')}</w:tr>`]) +
    par('', { depois: 0, bordaBaixo: COR })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${corpo}</w:hdr>`
}

const campo = (instr) =>
  `<w:r><w:rPr><w:color w:val="9A9A9A"/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="9A9A9A"/><w:sz w:val="15"/></w:rPr><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:rPr><w:color w:val="9A9A9A"/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="9A9A9A"/><w:sz w:val="15"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="9A9A9A"/><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`

function rodape(titulo) {
  const t = (x) => run(x, { sz: 15, cor: '9A9A9A' })
  const conteudo = t(`${titulo}  ·  Página `) + campo('PAGE') + t(' de ') + campo('NUMPAGES')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${par(conteudo, { jc: 'center', depois: 0, bordaTopo: 'D9D9D9' })}</w:ftr>`
}

const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONTE}" w:hAnsi="${FONTE}" w:eastAsia="${FONTE}" w:cs="${FONTE}"/><w:color w:val="262626"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`

function documento(d) {
  const sect =
    '<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2268" w:right="1418" w:bottom="1418" w:left="1418" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${b.titulo(d.titulo)}${d.corpo.join('')}${sect}</w:body></w:document>`
}

const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`

const relsRaiz = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`

const relsDoc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`

const relsCabecalho = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpg"/>
</Relationships>`

const configuracoes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`

const propriedades = (titulo) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(titulo)}</dc:title><dc:creator>${esc(EMPRESA_CURTO)}</dc:creator></cp:coreProperties>`

mkdirSync(saida, { recursive: true })
const hdr = cabecalho()
// node scripts/gerar-modelos.mjs demissao → gera só os modelos cujo id começa com "demissao"
const filtro = process.argv[2] ?? ''
for (const d of DOCUMENTOS.filter((x) => x.id.startsWith(filtro))) {
  const zip = new PizZip()
  zip.file('[Content_Types].xml', tipos)
  zip.file('_rels/.rels', relsRaiz)
  zip.file('docProps/core.xml', propriedades(d.titulo))
  zip.file('word/document.xml', documento(d))
  zip.file('word/styles.xml', estilos)
  zip.file('word/settings.xml', configuracoes)
  zip.file('word/header1.xml', hdr)
  zip.file('word/footer1.xml', rodape(d.titulo))
  zip.file('word/_rels/document.xml.rels', relsDoc)
  zip.file('word/_rels/header1.xml.rels', relsCabecalho)
  zip.file('word/media/logo.jpg', logo)
  writeFileSync(join(saida, `${d.id}.docx`), zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
  console.log('ok', d.id)
}
