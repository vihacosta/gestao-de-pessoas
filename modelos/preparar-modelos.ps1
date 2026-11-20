# Converte os documentos padrão (cópias em modelos/originais) em modelos com campos {{...}}.
# Saída: public/modelos/<id>.docx. Usa o Word instalado no computador.
# Os arquivos originais do Google Drive não são alterados.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$orig = Join-Path $PSScriptRoot 'originais'
$saida = Join-Path $raiz 'public\modelos'
New-Item -ItemType Directory -Force $saida | Out-Null

$enderecoNovo = 'Av Arq Nildo Ribeiro da Rocha, 3523 - Jd Higienópolis'
$enderecoAntigo = 'Av Melvin Jones, 1194 Galp 20'
$linhaColetiva = '{{#funcionarios}}{{nome}} - {{cpf}} ____________________________________________{{/funcionarios}}'

# Cada item: arquivo, id, trocas [texto, novo, curinga?], coletivo?
$modelos = @(
  @{ arq = '2-ADMISSAO - RECEBIMENTO DO CÓDIGO DE CULTURA'; id = 'admissao-2-codigo-de-cultura'; trocas = @(
      @('xx de xx de 2025', '{{data_extenso}}'), @('Funcionário:', 'Funcionário: {{nome}}'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '3-ADMISSAO - ACORDO DESCONTO'; id = 'admissao-3-acordo-desconto'; trocas = @(
      @('NOME FUNCIONARIO', '{{nome}}'), @('CTPS nº X - PR', 'CTPS nº {{ctps}}'), @('12 de janeiro de 2021', '{{data_extenso}}'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '4-ADMISSAO - ACORDO BANCO DE HORAS'; id = 'admissao-4-banco-de-horas'; trocas = @(
      @('NOME DO FUNCIONARIO', '{{nome}}'), @('CTPS nº X - PR', 'CTPS nº {{ctps}}'), @('19 de julho de 2023', '{{data_extenso}}'), @('^pNome^p', '^p{{nome}}^p'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '5-ADMISSAO - ACORDO INDIVIDUAL DE COMPENSAÇÃO DE JORNADA'; id = 'admissao-5-compensacao-de-jornada'; trocas = @(
      @('NOME DO FUNCIONARIO', '{{nome}}'), @('CTPS nº X - PR', 'CTPS nº {{ctps}}'), @('12 de janeiro de 2021', '{{data_extenso}}'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '6-ADMISSAO - USO DE IMAGEM'; id = 'admissao-6-uso-de-imagem'; trocas = @(
      @('nome do funcionário', '{{nome}}'), @('Nome do funcionário', '{{nome}}'), @('04 de setembro de 2023', '{{data_extenso}}'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '7-ADMISSAO - TERMO DE COMPROMETIMENTO - USO DOS UNIFORMES'; id = 'admissao-7-uso-de-uniformes'; trocas = @(
      @('Maringá, XXXXXX', 'Maringá, {{data_extenso}}'), @('XXXXX', '{{nome}}'), @('01 unidade', '{{qtd_uniformes}}'), @('Funcionário:', 'Funcionário: {{nome}}'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '8-ADMISSAO - TERMO DE CIENCIA MONITORAMENTO POR CAMERAS'; id = 'admissao-8-monitoramento-cameras'; trocas = @(
      @('NOME DO FUNCIONARIO', '{{nome}}'), @('CTPS nº X - PR', 'CTPS nº {{ctps}}'), @('Maringá, XXXXXX', 'Maringá, {{data_extenso}}'), @('Funcionário:', 'Funcionário: {{nome}}'), @('CPF:', 'CPF: {{cpf}}')) },
  @{ arq = '9-ADMISSAO - TERMO DE BONUS POR ASSIDUIDADE MENSAL'; id = 'admissao-9-bonus-assiduidade'; trocas = @(
      @('09 de setembro de 2024', '{{data_extenso}}'), @('Nome:', 'Nome: {{nome}}'), @('CPF:', 'CPF: {{cpf}}'),
      # Nova regra (novembro/2026), válida para os próximos admitidos
      @('Não ter se ausentado do trabalho em um único dia por mais de 4 horas.', 'Não ter se ausentado do trabalho por 4 (quatro) horas ou mais em um único dia, ainda que essas horas sejam compensadas posteriormente.'),
      @('Não ter se ausentado por mais de 4 horas em um único mês.', 'Não ter somado, no mês, 4 (quatro) horas ou mais de ausências e atrasos que não tenham sido compensados.'),
      @('O colaborador não perderá o benefício se utilizar as horas positivas constante em seu banco de horas.', 'O colaborador não perderá o benefício se a ausência for coberta integralmente por horas positivas que já constavam em seu banco de horas antes da ausência. [[PARCIAL]]'),
      # O Word limita a troca a 255 caracteres, por isso a segunda frase entra separada
      @('[[PARCIAL]]', 'Se o saldo cobrir apenas parte da ausência, ela continuará sendo considerada por inteiro para o critério 2; para o critério 3, serão descontadas somente as horas cobertas pelo saldo.')) },
  @{ arq = 'AQUISIÇÃO DE MERCADORIAS'; id = 'aquisicao-de-mercadorias'; trocas = @(
      @($enderecoAntigo, $enderecoNovo), @('CEP: 87.070-030', 'CEP: 87.060-390'),
      @('Eu _@', 'Eu {{nome}} ', $true),
      @('produto:*\.', 'produto: {{data_aquisicao}}.', $true),
      @('Item(ns):', 'Item(ns): {{itens}}'), @('Valor Total - R$', 'Valor Total - R$ {{valor_total}}'), @('Desconto - R$', 'Desconto - R$ {{desconto}}'),
      @('Forma de pagamento -', 'Forma de pagamento - {{forma_pagamento}}'),
      @('Nome: _@', 'Nome: {{nome}}', $true), @('CPF: _@', 'CPF: {{cpf}}', $true), @('CTPS:_@', 'CTPS: {{ctps}}', $true)) },
  @{ arq = 'AUTORIZAÇÃO DE DESCONTO'; id = 'autorizacao-de-desconto'; trocas = @(
      @($enderecoAntigo, $enderecoNovo), @('CEP: 87.070-030', 'CEP: 87.060-390'),
      @('R$  ( )', 'R$ {{valor}} ({{valor_extenso}})'), @('Novembro/2018', '{{mes_referencia}}'), @('03 de Dezembro de 2018', '{{data_extenso}}'),
      @('Lucinéia Oliveira Souza', '{{nome}}'), @('080.921.779-10', '{{cpf}}'), @('2197637 / 0030 PR', '{{ctps}}')) },
  @{ arq = 'COMPENSAÇÃO DE HORAS EM DIAS NORMAIS'; id = 'coletivo-compensacao-dia-normal'; coletivo = $true; trocas = @(
      @('segunda-feira dia 28 de fevereiro de 2022', '{{data_folga}}'), @('sábado dia 19 de fevereiro de 2022', '{{data_compensacao}}'), @('18 de fevereiro de 2022', '{{data_extenso}}')) },
  @{ arq = 'COMPENSAÇÃO DE HORAS NO FERIADO'; id = 'coletivo-compensacao-feriado'; coletivo = $true; trocas = @(
      @('feriado de Corpus Christi', 'feriado de {{feriado}}'), @('dia 04 de junho de 2026', 'dia {{data_feriado}}'), @('dia 05 de junho de 2026', 'dia {{data_folga}}'), @('03 de junho de 2026', '{{data_extenso}}')) },
  @{ arq = 'FÉRIAS COLETIVAS'; id = 'coletivo-ferias-coletivas'; coletivo = $true; trocas = @(
      @('Helvio Pena Costa', '{{socio_nome}}'), @('479.108.286-91', '{{socio_cpf}}'), @('23/12/2025 a 04/01/2026', '{{inicio}} a {{fim}}'), @('em 05/01/2026', 'em {{retorno}}'), @('19 de novembro de 2025', '{{data_extenso}}')) }
)

function Trocar($doc, $de, $para, $curinga) {
  $n = 0
  foreach ($story in $doc.StoryRanges) {
    $r = $story
    while ($r -ne $null) {
      $f = $r.Find
      $f.ClearFormatting(); $f.Replacement.ClearFormatting()
      # Execute(FindText, MatchCase, MatchWholeWord, MatchWildcards, SoundsLike, AllForms, Forward, Wrap, Format, ReplaceWith, Replace)
      if ($f.Execute($de, $true, $false, [bool]$curinga, $false, $false, $true, 0, $false, $para, 2)) { $n++ }
      $r = $r.NextStoryRange
    }
  }
  return $n
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  foreach ($m in $modelos) {
    $doc = $word.Documents.Open("$orig\$($m.arq).docx", $false, $true)
    foreach ($t in $m.trocas) {
      $ok = Trocar $doc $t[0] $t[1] ($t.Count -gt 2 -and $t[2])
      if (-not $ok) { Write-Output "  ATENCAO [$($m.id)] nao encontrado: $($t[0])" }
    }
    if ($m.coletivo) {
      # Linhas "Nome - CPF ____" viram uma única linha que se repete para cada funcionário
      $linhas = @()
      foreach ($p in $doc.Paragraphs) { if ($p.Range.Text -match '^[^\{\r]+_{8,}') { $linhas += $p } }
      if ($linhas.Count -eq 0) { Write-Output "  ATENCAO [$($m.id)] lista de nomes nao encontrada" }
      for ($i = $linhas.Count - 1; $i -ge 1; $i--) { $linhas[$i].Range.Delete() | Out-Null }
      if ($linhas.Count -ge 1) {
        $r = $linhas[0].Range
        $r.MoveEnd(1, -1) | Out-Null
        $r.Text = $linhaColetiva
      }
    }
    $doc.SaveAs2("$saida\$($m.id).docx", 16)
    $doc.Close(0)
    Write-Output "ok $($m.id)"
  }
} finally { $word.Quit() }
