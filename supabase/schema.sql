-- Estrutura do banco no Supabase.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode rodar de novo sempre que este arquivo mudar: nada é apagado.

-- ---------------------------------------------------------------- usuários
-- Quem pode usar o sistema. Os usuários são cadastrados na tela "Usuários" do próprio sistema.
-- Um e-mail que não está nesta lista não consegue nem criar conta.
create table if not exists public.usuarios (
  email text primary key,
  nome text,
  admin boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.usuarios enable row level security;

create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where email = lower(auth.jwt() ->> 'email'))
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where email = lower(auth.jwt() ->> 'email') and admin)
$$;

drop policy if exists "ver usuarios" on public.usuarios;
create policy "ver usuarios" on public.usuarios for select to authenticated using (public.tem_acesso());
drop policy if exists "admin gerencia usuarios" on public.usuarios;
create policy "admin gerencia usuarios" on public.usuarios for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Barra o cadastro de quem não está na lista. A primeira conta criada vira administradora.
create or replace function public.checar_cadastro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.usuarios) then
    insert into public.usuarios (email, nome, admin)
    values (lower(new.email), coalesce(new.raw_user_meta_data ->> 'nome', ''), true);
  elsif not exists (select 1 from public.usuarios where email = lower(new.email)) then
    raise exception 'EMAIL_SEM_ACESSO';
  end if;
  return new;
end $$;
-- Permissões de uso pelo sistema (as regras acima é que decidem quem vê o quê)
grant select, insert, update, delete on public.usuarios to authenticated;
grant execute on function public.tem_acesso() to authenticated;
grant execute on function public.eh_admin() to authenticated;

drop trigger if exists checar_cadastro on auth.users;
create trigger checar_cadastro before insert on auth.users
  for each row execute function public.checar_cadastro();

-- ---------------------------------------------------------------- dados

create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['funcionarios', 'ferias', 'ausencias', 'config', 'modelos', 'pontos', 'documentos', 'justificativas', 'erros', 'aquisicoes'] loop
    execute format('
      create table if not exists public.%I (
        id text primary key,
        data jsonb not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      )', t);
    execute format('alter table public.%I enable row level security', t);
    -- Só quem está na lista de usuários acessa.
    execute format('drop policy if exists "usuarios logados" on public.%I', t);
    execute format('drop policy if exists "usuarios com acesso" on public.%I', t);
    execute format('create policy "usuarios com acesso" on public.%I
      for all to authenticated using (public.tem_acesso()) with check (public.tem_acesso())', t);
    -- Permissão de uso pelo sistema (as regras acima é que decidem quem vê o quê)
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists tocar on public.%I', t);
    execute format('create trigger tocar before update on public.%I
      for each row execute function public.tocar_atualizado_em()', t);
  end loop;
end $$;

-- Configuração inicial da empresa (valor do bônus etc.). Pode ser alterada no sistema.
insert into public.config (id, data)
values ('empresa', '{"id":"empresa","valorBonus":100,"bonusLimiteDia":4,"bonusLimiteMes":4,"diasExperiencia":90,"valorAlimentacao":110}')
on conflict (id) do nothing;

-- Armazenamento de arquivos (modelos enviados, documentos assinados, holerites...), privado.
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;
drop policy if exists "arquivos usuarios logados" on storage.objects;
drop policy if exists "arquivos usuarios com acesso" on storage.objects;
create policy "arquivos usuarios com acesso" on storage.objects
  for all to authenticated using (bucket_id = 'arquivos' and public.tem_acesso())
  with check (bucket_id = 'arquivos' and public.tem_acesso());
