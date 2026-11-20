# Gestão de Pessoas

Sistema de RH para uso no navegador e no celular: funcionários (CLT e estágio), férias com as regras da CLT, 13º, FGTS e aniversário de empresa.
O escopo completo está em [docs/requisitos.md](docs/requisitos.md).

## Rodar no computador

```bash
npm install
npm run dev
```

Depois abra http://localhost:5173.

Sem o arquivo `.env`, o sistema roda em **modo demonstração**: os dados ficam só naquele navegador e vêm preenchidos com funcionários fictícios.

## Testes das regras da CLT

```bash
npm test
```

## Colocar no ar (Supabase + Vercel)

1. Crie um projeto em https://supabase.com (plano gratuito).
2. No painel do projeto, abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication > Sign In / Providers > Email**, desligue **"Confirm email"** (deixe "Allow new users to sign up" ligado: o banco só aceita cadastro de e-mails liberados).
   Em **Authentication > URL Configuration**, coloque o endereço do site publicado em **Site URL** (usado no link de "Esqueci minha senha").
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ficam em **Project Settings > API**).
5. Gere e publique só a versão pronta (o código e os arquivos com dados reais não saem do computador):

   ```bash
   npm run build
   npx vercel deploy dist --prod
   ```

6. Abra o site, clique em **Primeiro acesso** e crie sua conta: a primeira conta vira administradora. Os outros usuários são cadastrados na tela **Usuários** do sistema.

## Modelos de documentos

Os modelos padrão ficam em `public/modelos/` e são gerados, todos no mesmo visual (cabeçalho com o logo `modelos/logo.jpg`), por `node scripts/gerar-modelos.mjs`. O texto de cada documento fica nesse script: para mudar um documento, edite-o e rode o comando de novo. As cópias dos originais ficam em `modelos/originais/`, que não vai para o Git porque contém dados reais. Novos modelos podem ser enviados pela própria tela de Documentos.

## Estrutura

- `src/lib/clt.ts`: regras e cálculos (férias, 13º, FGTS, aniversário de empresa), testados em `clt.test.ts`
- `src/lib/store.ts`: dados (Supabase ou modo demonstração)
- `src/pages/`: telas
- `src/components/SolicitarFerias.tsx`: tela de solicitação de férias
