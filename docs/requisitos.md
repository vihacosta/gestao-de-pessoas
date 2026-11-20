# Sistema de Gestão de Pessoas — Requisitos

Registrado em: 18/11/2026 · Atualizado em: 19/11/2026
Status: requisitos definidos; falta decidir onde o sistema vai rodar

## Definições

- **Contratação**: CLT e estágio
- **Bonificação**: valor fixo, pago por assiduidade (tempo sem faltas ou atrasos)
- **Uso**: no navegador e no celular
- **Cálculos**: 13º salário, 1/3 de férias, FGTS, aniversário de empresa

## Funcionalidades

### 1. Cadastro de funcionários
- Dados pessoais, data de admissão, cargo, tipo (CLT ou estágio)
- Salário com histórico de reajustes
- Busca por nome ou CPF

### 2. Admissão e documentos-modelo
- Área para subir os **documentos padrão da empresa** (contrato, termos, fichas...)
- Os modelos usam campos como {{nome}}, {{cpf}}, {{cargo}}, {{salario}}, {{data_admissao}}
- Ao admitir alguém, o sistema **gera todos os documentos já preenchidos**, prontos para imprimir e assinar
- O mesmo vale para a demissão (aviso, termo de rescisão etc.)
- Formatos atuais dos modelos: Word, PDF e papel. Plano:
  - **Word**: marcamos os campos ({{nome}} etc.) e o sistema preenche direto
  - **PDF e papel**: na configuração inicial, a usuária manda o arquivo ou uma foto e Claude recria cada um em Word já com os campos marcados (trabalho feito uma única vez)
  - Saída: o documento preenchido sai em Word (para ajustes) e em PDF (para imprimir)

### 3. Arquivo digital por funcionário
- Documentos de admissão e de demissão assinados (foto ou PDF)
- **Holerites assinados**, organizados por mês e ano
- **Folhas de ponto assinadas**, organizadas por mês e ano
- Qualquer outro papel do funcionário (objetivo: eliminar o arquivo de papel)

### 4. Folha de justificativas (coletiva)
- Folha única, de todos os funcionários, onde assinam o motivo de atraso ou falta
- Upload por data (foto ou PDF)
- Registro de atrasos e faltas por funcionário, usado no cálculo da bonificação por assiduidade
- **Feito (tela Justificativas):**
  - lista do mês montada sozinha a partir do cartão ponto importado (dias com faltas, sem atestado, férias ou licença) e das ocorrências lançadas à mão (atraso, saída antecipada, falta);
  - atraso ou saída antecipada é deduzido comparando as batidas com o horário habitual da pessoa no mês;
  - motivo pode ser digitado antes (sai impresso) ou ficar em branco para a pessoa escrever à mão;
  - impressão em A4 deitado, com linhas em branco no fim; foto da folha assinada guardada por mês (várias páginas viram um PDF);
  - aviso no painel quando o mês anterior tem ocorrências e a folha assinada ainda não foi guardada;
  - **tolerância**: atrasos e saídas antecipadas de até X minutos no dia não entram na folha (padrão 20 min, escolhido na própria tela e salvo nas configurações; faltas sempre entram). Não muda o bônus, que continua contando tudo;
  - aba **Histórico por pessoa** (e o mesmo quadro na ficha do funcionário): quantas faltas, atestados, atrasos e saídas cada pessoa teve, por ano, com o motivo de cada uma.
- A decidir: a tolerância será 20, 25 ou 30 minutos.
- **Importar planilha antiga** (botão no Histórico por pessoa): lê o "CONTROLE ATRASOS E FALTAS.xlsx" (todas as abas), a usuária liga cada nome a um funcionário ou cadastra como ex-funcionário (desligado, só com o nome; admissão/desligamento = primeira/última ocorrência). Os registros ficam na tabela de justificativas com `origem: 'planilha'`, só para o histórico: **não entram no bônus nem nas férias**. Importar de novo não duplica.
  - Conferido com a planilha real: 330 linhas → 272 ocorrências (72 saídas antecipadas, 114 atrasos, 16 atrasos no almoço, 33 faltas, 37 atestados). Não entram: problema de ponto (29), hora extra/banco de horas (22, inclui "tirou horas do banco", pela política de mobilidade item 4.2) e lançamentos para "TODAS" (7).
  - "Falta" com a palavra ATESTADO no motivo vira Atestado.

### 5. Gestão de férias (referência: print enviado)
- Lista "Férias a vencer" com status por funcionário: *Aquisitivo incompleto*, *Mais de 90 dias*, *Saldo utilizado* etc.
- Aba "Solicitações e acompanhamento"
- Tela "Solicitar férias" com calendário de início e fim e um painel com: dias descontados, saldo disponível, dias selecionados, dias abonados e saldo restante
- Férias antecipadas (usando o saldo do próximo período)
- Aplicação automática das regras da CLT
- Avisos quando as férias estiverem perto de vencer

### 6. Licenças, atestados e faltas
- Registro de ausências por tipo, conforme a CLT (atestado médico, licença-maternidade/paternidade, falta justificada ou injustificada, nojo, gala etc.)
- Anexo do atestado
- Impacto automático na bonificação e nas férias (faltas injustificadas reduzem os dias de férias, conforme o art. 130 da CLT)

### 7. Fechamento mensal
- Pacote por mês com os documentos da folha (holerites, pontos, atestados, justificativas)
- Exportar/compartilhar com a contabilidade em poucos cliques

### 8. Cálculos e alertas
- Férias + 1/3
- 13º salário (proporcional por meses trabalhados)
- FGTS (8% do salário; estágio não tem FGTS)
- Bonificação por assiduidade
- Aniversário de empresa
- Painel de alertas: férias vencendo, aniversários de empresa, aniversariantes, documentos pendentes do mês

### 9. Aniversários e presentes de tempo de casa
- A empresa comemora o **aniversário de nascimento** de cada funcionário e dá **presente aos 1, 3, 5, 10 e 15 anos de casa**. Antes isso era controlado na planilha "RELAÇÃO DE FUNCIONÁRIOS ATIVOS.xlsx".
- **Feito:**
  - Painel: cartão **Aniversariantes (próximos 30 dias)** dos ativos com data de nascimento, com a idade que a pessoa faz; o dia de hoje fica destacado em verde ("Hoje!") e os próximos 7 dias em amarelo. Avisa quantos ativos estão sem data de nascimento.
  - Painel: no cartão **Aniversários de empresa**, quando o próximo aniversário é um marco, aparece o selo **"5 anos: presente"** (o mesmo para 1, 3, 10 e 15).
  - Painel: faixa **"Hoje tem comemoração!"** no topo quando alguém faz aniversário ou completa tempo de casa no dia.
  - Ficha do funcionário (Resumo): próximo aniversário (data, idade, dias que faltam, ou "Hoje!") e o selo do marco com presente ao lado do aniversário de empresa.
  - Quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos.
  - **Conferir com a planilha** (botão em Funcionários): lê a aba FUNCIONARIOS ATIVOS da planilha e mostra os ativos do sistema **sem data de nascimento**, com **aniversário diferente** ou com **admissão diferente**, além dos ativos da planilha que não estão no sistema. Nada é gravado sem a usuária clicar em "Salvar nascimento" ou "Usar a da planilha" (esta pede confirmação, porque a admissão muda férias, 13º e aniversário de empresa).
- Regras em `src/lib/aniversarios.ts`, com testes em `aniversarios.test.ts`.
- O que a planilha tem (conferido em 19/11/2026):
  - A coluna ANIVERSÁRIO guarda só **dia e mês** (o ano gravado é o de quando foi digitado, 2025), então o ano de nascimento tem que ser completado à mão.
  - As colunas 1/3/5/10/15 ANOS usam sempre o dia 1º do mês e estão erradas para quem entrou em 2025 (10 e 15 anos caem em 1930–1940). O sistema não usa essas colunas: calcula os marcos pela data de admissão exata.
  - Dayane Roberta Batista dos Santos está como ATIVO, mas sem aniversário e sem admissão na planilha.

## Regras CLT de referência

- Período aquisitivo: a cada 12 meses trabalhados, 30 dias de férias
- Período concessivo: tirar as férias nos 12 meses seguintes; se não, pagamento em dobro
- Aviso de férias com no mínimo 30 dias de antecedência
- Férias podem ser divididas em até 3 períodos (um com pelo menos 14 dias e os outros com pelo menos 5)
- Abono pecuniário: vender até 1/3 das férias
- Faltas injustificadas no período aquisitivo: até 5 → 30 dias; 6–14 → 24; 15–23 → 18; 24–32 → 12; mais de 32 → perde o direito
- Estágio (Lei 11.788): recesso de 30 dias por ano, sem 1/3 obrigatório, sem 13º e sem FGTS

## Bônus por assiduidade (termo nº 9, nova regra de novembro/2026)

- Valor fixo mensal: **R$ 100,00** (alterável em Configurações)
- Análise do dia 1º ao último dia do mês, pelo cartão ponto
- Perde o bônus quem:
  1. está no período de experiência (90 dias); o primeiro mês com bônus é o mês seguinte ao fim da experiência
  2. se ausentou por **4 horas ou mais num único dia**, mesmo compensando depois
  3. somou no mês **4 horas ou mais** de ausências e atrasos **não compensados**
- O banco de horas que já existia protege: uma ausência coberta **integralmente** por saldo positivo anterior não faz perder
- Atrasos e saídas antecipadas contam
- Faltas justificadas e atestados também fazem perder; a única exceção é o falecimento (atestado de óbito)
- Pago no cartão de benefícios
- O texto novo já está no modelo do sistema (kit de admissão). O arquivo original no Drive continua com o texto antigo, que vale para quem já assinou.

## Desconto por erros (aba "POLÍTICA DESCONTO POR ERROS" da planilha de funcionários)

- Na ficha do funcionário, quadro **Erros e quebras**: botão "Lançar erro" (data, o que aconteceu, valor). Enquanto se digita, o sistema já mostra o resultado: "não desconta (1º erro em 3 meses)" ou "desconta R$ X", com a conta explicada.
- Regras:
  1. O primeiro erro abre um período de 3 meses (ex.: erro em 10/01 → período até 09/04). Se for o único erro do período, **não desconta**.
  2. Mais de um erro no período: desconta a **soma dividida pela quantidade** de erros (ex.: 100 + 50 + 30 = 180 ÷ 3 = R$ 60).
  3. Se a soma passar de **R$ 200**, desconta só o que passar de 200, mesmo com um único erro (ex.: erro de 350 → desconta 150).
  4. Depois que a pessoa paga, a contagem recomeça no próximo erro.
- Quando há desconto, aparece uma faixa vermelha "Descontar R$ X na folha" com o botão **Marcar como descontado** (pede a data da folha). Enquanto o período está em andamento o valor pode mudar com novos erros, por isso o sistema mostra até quando o período vai. Um desconto marcado por engano pode ser desfeito.
- Os erros ficam na tabela `erros` (no Supabase, rodar de novo o `supabase/schema.sql`). A conta está em `src/lib/descontoErros.ts`.
- **Pendente:** vários erros no período somando mais de R$ 200 (ver Lembretes). Esses casos aparecem com o selo amarelo "regra a confirmar" e as duas contas. Por enquanto o sistema desconta o **maior** dos dois valores (média ou o que passa de 200), porque é o que bate com o exemplo da Maria na própria política (150 + 50 + 25 = 225, desconto de R$ 75, que é a média, e não R$ 25).

## ⚠️ Lembretes para conferir

- [ ] **Bônus x experiência:** o mês em que termina a experiência já conta para o bônus, ou só o mês seguinte? A impressão é que só o seguinte (é o que o sistema usa hoje), mas falta confirmar com a pessoa responsável por essa parte.
  - Na planilha real do cartão benefício, uma funcionária admitida em julho/2026 (experiência até o início de outubro) aparece recebendo Mobilidade. Pela regra atual do sistema ela só receberia a partir do mês seguinte ao fim da experiência: conferir qual mês essa planilha paga e qual regra vale.
- [ ] **Bônus, novo termo:** pedir para a contabilidade ou um advogado revisar o texto novo antes de usar, e decidir se ele vale só para os próximos admitidos (mais seguro, por causa do art. 468 da CLT).
- [ ] **Bônus, quem assinou o termo antigo:** hoje o sistema aplica a regra nova a todos. Pelo termo antigo, exatamente 4h num dia não fazia perder. Decidir se o sistema deve usar a regra antiga para quem assinou antes.
- [ ] **Bônus, estagiários:** confirmar se estagiários também recebem o bônus (hoje o sistema inclui).
- [ ] **Endereço antigo:** os modelos "Aquisição de mercadorias" e "Autorização de desconto" tinham o endereço antigo (Av Melvin Jones) no rodapé. Nos modelos do sistema ele foi trocado pelo endereço atual.
- [ ] **Desconto por erros, vários erros acima de R$ 200:** quando há mais de um erro em 3 meses e a soma passa de R$ 200, desconta a média, só o que passa de 200, ou o maior/menor dos dois? A usuária vai confirmar com a pessoa responsável. Hoje o sistema usa o maior (bate com o exemplo da Maria). Para mudar: `REGRA_VARIOS_ACIMA_DO_LIMITE` em `src/lib/descontoErros.ts`.

## Cartão ponto (importação)

- O PDF mensal do Ponto AtecSoft é enviado na tela **Cartão ponto**. O sistema:
  - lê, dia a dia, as batidas, as faltas/atrasos, as horas extras, os rótulos (Atestado, Falta, Férias, Folga, Licença, Dispensa) e o banco de horas;
  - liga cada cartão ao funcionário pelo CPF (ou pelo nome) e permite cadastrar quem ainda não está no sistema usando os dados do cartão;
  - separa o PDF por funcionário e guarda o cartão de cada um no mês;
  - calcula o bônus do mês a partir do cartão.
- O leitor foi conferido com os cartões de 2024 a 2026 do Drive: a soma das faltas lidas bate com os totais do cartão.
- O saldo do banco num dia específico é **estimado** (saldo anterior + extras − faltas dos dias anteriores do mês). Quando uma ausência de 4h ou mais é salva pelo banco, o sistema avisa para conferir no cartão.
- Atestados contam como ausência e não são cobertos pelo banco. Férias, folga e dispensa não contam. Licenças aparecem como aviso para conferir.
- Cartões antigos (antes de 2023) têm outro formato e não são lidos.

## Holerites e documentos assinados

- Tela **Holerites** (também na barra do celular): por mês, mostra para cada funcionário se o holerite assinado e o cartão ponto assinado já foram guardados, com envio por foto ou PDF.
- Várias fotos (por exemplo, frente e verso) viram um único PDF. As fotos são reduzidas para no máximo 2000 px para economizar espaço.
- A ficha do funcionário tem o **Arquivo digital**: admissão, demissão, outros, holerites e cartões, além dos cartões ponto do sistema.
- O painel avisa quantos holerites e cartões assinados do mês anterior ainda faltam.
- **Holerites da contabilidade (PDF com todos):** na tela Holerites, "Importar o PDF de holerites da contabilidade". Cada página é um funcionário (duas vias; lemos a primeira). O sistema reconhece pelo CPF (ou nome), separa e guarda o PDF de cada um na ficha ("Holerite da contabilidade", sem assinatura), junto com salário, verbas, totais e líquido lidos.
- Na importação, confere com o cadastro: avisa quando o salário do holerite é diferente do cadastro (com botão para registrar o novo salário a partir daquele mês). (O bônus não é comparado: ele é pago no cartão benefício.)
- Testado com o PDF real de outubro/2026 (8 holerites): totais de créditos, débitos e líquido conferem em todos. Nenhum holerite de outubro tem verba de bônus por assiduidade.

## Cartão benefício (fora da folha)

- O bônus por assiduidade **não é pago no holerite**: vai no cartão benefício, como **Mobilidade**.
- A planilha enviada ao cartão tem as colunas: Nome, CPF, Matrícula (opcional), Valor Fixo em Auxílio Alimentação, Mobilidade, Valor Fixo em Mobilidade, Cultura, Valor Fixo em Cultura, Saúde, Valor Fixo em Saúde.
  - Alimentação: fixo para todos (R$ 110, em Configurações).
  - Mobilidade: o bônus por assiduidade do mês (R$ 100 ou 0), calculado pelo sistema.
  - Cultura: valor fixo que algumas pessoas recebem (campo na ficha do funcionário).
  - Saúde e as colunas "Valor Fixo" de Mobilidade e Cultura ficam em branco, como na planilha usada hoje.
- Em Faltas e bônus → Bônus do mês: prévia com totais, "Baixar planilha" (.xlsx no mesmo layout) e "Copiar tabela" (para colar numa planilha existente).
- Quem não entra (ex.: sócias) é marcado na ficha ("Não entra na planilha do cartão benefício").
- A importação de holerites não compara mais o bônus (ele não aparece no holerite).
