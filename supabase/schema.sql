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
-- Nome de usuário (opcional) e o que cada pessoa pode fazer em cada módulo: {"ferias":"ver","ponto":"editar"}
alter table public.usuarios add column if not exists usuario text;
alter table public.usuarios add column if not exists permissoes jsonb not null default '{}';
create unique index if not exists usuarios_usuario_unico on public.usuarios (lower(usuario));
alter table public.usuarios drop constraint if exists usuarios_usuario_formato;
alter table public.usuarios add constraint usuarios_usuario_formato check (usuario is null or usuario ~ '^[a-z0-9._-]{3,30}$');

create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where email = lower(auth.jwt() ->> 'email'))
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios where email = lower(auth.jwt() ->> 'email') and admin)
$$;

drop policy if exists "ver usuarios" on public.usuarios;
-- Cada pessoa vê só o próprio registro; o administrador vê todos
create policy "ver usuarios" on public.usuarios for select to authenticated
  using (public.eh_admin() or email = lower(auth.jwt() ->> 'email'));
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
  foreach t in array array['funcionarios', 'ferias', 'ausencias', 'config', 'modelos', 'pontos', 'documentos', 'justificativas', 'erros', 'aquisicoes', 'folha'] loop
    execute format('
      create table if not exists public.%I (
        id text primary key,
        data jsonb not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      )', t);
    execute format('alter table public.%I enable row level security', t);
    -- As regras antigas davam acesso total a todos: as novas, por módulo, estão no fim deste arquivo.
    execute format('drop policy if exists "usuarios logados" on public.%I', t);
    execute format('drop policy if exists "usuarios com acesso" on public.%I', t);
    -- Permissão de uso pelo sistema (as regras no fim do arquivo é que decidem quem vê o quê)
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

-- ---------------------------------------------------------------- permissões por módulo
-- O administrador vê e altera tudo. Os demais só o que foi escolhido na tela Usuários.

create or replace function public.nivel_modulo(m text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when u.admin then 2 when u.permissoes ->> m = 'editar' then 2 when u.permissoes ->> m = 'ver' then 1 else 0 end
    from public.usuarios u where u.email = lower(auth.jwt() ->> 'email')
  ), 0)
$$;

create or replace function public.pode_ver(variadic m text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(m) x where public.nivel_modulo(x) >= 1)
$$;

create or replace function public.pode_editar(variadic m text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(m) x where public.nivel_modulo(x) >= 2)
$$;

-- Documentos guardados: cada tipo pertence a um módulo
create or replace function public.pode_documento(categoria text, editar boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when categoria in ('holerite', 'holerite_original') then
      case when editar then public.pode_editar('holerites') else public.pode_ver('holerites', 'fechamento') end
    when categoria = 'ponto_assinado' then
      case when editar then public.pode_editar('holerites', 'ponto') else public.pode_ver('holerites', 'ponto', 'fechamento') end
    when categoria = 'justificativas' then
      case when editar then public.pode_editar('ponto') else public.pode_ver('ponto', 'fechamento') end
    else
      case when editar then public.pode_editar('funcionarios') else public.pode_ver('funcionarios') end
  end
$$;

-- Arquivos: a pasta diz a quem pertencem
create or replace function public.pode_arquivo(caminho text, editar boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select case split_part(caminho, '/', 1)
    when 'documentos' then public.pode_documento(split_part(caminho, '/', 3), editar)
    when 'ausencias' then case when editar then public.pode_editar('ausencias') else public.pode_ver('ausencias', 'fechamento') end
    when 'ponto' then case when editar then public.pode_editar('ponto', 'holerites') else public.pode_ver('ponto', 'holerites', 'ausencias', 'fechamento', 'funcionarios') end
    when 'modelos' then case when editar then public.pode_editar('documentos') else public.pode_ver('documentos', 'funcionarios') end
    else public.eh_admin()
  end
$$;

-- Tabelas simples: quem lê e quem altera
do $$
declare
  r record;
  p text;
begin
  for r in select * from (values
    ('ferias', '''ferias'', ''funcionarios''', '''ferias'''),
    ('modelos', '''documentos'', ''funcionarios''', '''documentos'''),
    ('pontos', '''ponto'', ''ausencias'', ''holerites'', ''fechamento'', ''funcionarios''', '''ponto'''),
    ('justificativas', '''ponto'', ''fechamento'', ''funcionarios''', '''ponto'''),
    ('erros', '''valores''', '''valores'''),
    ('aquisicoes', '''valores''', '''valores'''),
    ('folha', '''valores''', '''valores''')
  ) as t(tabela, ler, alterar) loop
    foreach p in array array['ler', 'inserir', 'alterar', 'apagar'] loop
      execute format('drop policy if exists %I on public.%I', p, r.tabela);
    end loop;
    execute format('create policy "ler" on public.%I for select to authenticated using (public.pode_ver(%s))', r.tabela, r.ler);
    execute format('create policy "inserir" on public.%I for insert to authenticated with check (public.pode_editar(%s))', r.tabela, r.alterar);
    execute format('create policy "alterar" on public.%I for update to authenticated using (public.pode_editar(%s)) with check (public.pode_editar(%s))', r.tabela, r.alterar, r.alterar);
    execute format('create policy "apagar" on public.%I for delete to authenticated using (public.pode_editar(%s))', r.tabela, r.alterar);
  end loop;

  foreach p in array array['ler', 'inserir', 'alterar', 'apagar'] loop
    execute format('drop policy if exists %I on public.config', p);
    execute format('drop policy if exists %I on public.ausencias', p);
    execute format('drop policy if exists %I on public.documentos', p);
  end loop;
end $$;

-- Configurações: todos com acesso leem (as telas dependem das regras); só o módulo altera
create policy "ler" on public.config for select to authenticated using (public.tem_acesso());
create policy "inserir" on public.config for insert to authenticated with check (public.pode_editar('configuracoes'));
create policy "alterar" on public.config for update to authenticated using (public.pode_editar('configuracoes')) with check (public.pode_editar('configuracoes'));
create policy "apagar" on public.config for delete to authenticated using (public.pode_editar('configuracoes'));

-- Ausências: atestados e licenças (dados de saúde) só para "Faltas e bônus" e "Fechamento"
create policy "ler" on public.ausencias for select to authenticated using (
  public.pode_ver('ausencias', 'fechamento')
  or (data ->> 'tipo' in ('falta_injustificada', 'falta_justificada', 'atraso', 'saida_antecipada') and public.pode_ver('ferias', 'ponto', 'funcionarios'))
);
create policy "inserir" on public.ausencias for insert to authenticated with check (public.pode_editar('ausencias'));
create policy "alterar" on public.ausencias for update to authenticated using (public.pode_editar('ausencias')) with check (public.pode_editar('ausencias'));
create policy "apagar" on public.ausencias for delete to authenticated using (public.pode_editar('ausencias'));

create policy "ler" on public.documentos for select to authenticated using (public.pode_documento(data ->> 'categoria', false));
create policy "inserir" on public.documentos for insert to authenticated with check (public.pode_documento(data ->> 'categoria', true));
create policy "alterar" on public.documentos for update to authenticated
  using (public.pode_documento(data ->> 'categoria', true)) with check (public.pode_documento(data ->> 'categoria', true));
create policy "apagar" on public.documentos for delete to authenticated using (public.pode_documento(data ->> 'categoria', true));

drop policy if exists "arquivos ler" on storage.objects;
drop policy if exists "arquivos inserir" on storage.objects;
drop policy if exists "arquivos alterar" on storage.objects;
drop policy if exists "arquivos apagar" on storage.objects;
create policy "arquivos ler" on storage.objects for select to authenticated using (bucket_id = 'arquivos' and public.pode_arquivo(name, false));
create policy "arquivos inserir" on storage.objects for insert to authenticated with check (bucket_id = 'arquivos' and public.pode_arquivo(name, true));
create policy "arquivos alterar" on storage.objects for update to authenticated
  using (bucket_id = 'arquivos' and public.pode_arquivo(name, true)) with check (bucket_id = 'arquivos' and public.pode_arquivo(name, true));
create policy "arquivos apagar" on storage.objects for delete to authenticated using (bucket_id = 'arquivos' and public.pode_arquivo(name, true));

-- Funcionários: a tabela fica só com o administrador; os demais passam pelas funções abaixo,
-- que entregam apenas os campos permitidos e nunca apagam o que a pessoa não pode ver.
drop policy if exists "admin total" on public.funcionarios;
create policy "admin total" on public.funcionarios for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create or replace function public.filtrar_funcionario(d jsonb, valores boolean, cadastro boolean, cpf boolean) returns jsonb
language sql immutable set search_path = public as $$
  select case when valores then x else (x - array['beneficioCultura', 'pix', 'dadosBancarios', 'passesDia', 'valorPasse']) || '{"salarios": []}'::jsonb end
  from (select case when cadastro then d else (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(d) as e(k, v)
    where k in ('id', 'nome', 'cargo', 'tipo', 'dataAdmissao', 'dataDemissao', 'salarios', 'beneficioCultura', 'passesDia', 'valorPasse', 'semFerias', 'semCartaoBeneficio', 'acertoFerias', 'numeroCadastro')
       or (cpf and k = 'cpf')
  ) || case when cpf then '{}'::jsonb else '{"cpf": ""}'::jsonb end end as x) y
$$;

create or replace function public.funcionarios_visiveis() returns table (id text, data jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  valores boolean := public.pode_ver('valores');
  cadastro boolean := public.pode_ver('funcionarios', 'documentos');
  cpf boolean := public.pode_ver('ponto', 'holerites', 'ausencias', 'fechamento');
begin
  if not public.pode_ver('funcionarios', 'ferias', 'documentos', 'holerites', 'ponto', 'ausencias', 'fechamento', 'configuracoes', 'valores') then
    return;
  end if;
  return query select f.id, public.filtrar_funcionario(f.data, valores, cadastro, cpf) from public.funcionarios f;
end $$;

create or replace function public.salvar_funcionarios(registros jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  sensiveis text[] := array['salarios', 'beneficioCultura', 'pix', 'dadosBancarios', 'passesDia', 'valorPasse'];
  edita_valores boolean := public.pode_editar('valores');
  r jsonb;
  antigo jsonb;
begin
  if not public.pode_editar('funcionarios') then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  for r in select * from jsonb_array_elements(registros) loop
    if coalesce(r ->> 'id', '') = '' then
      raise exception 'Registro sem id';
    end if;
    if not edita_valores then
      select f.data into antigo from public.funcionarios f where f.id = r ->> 'id';
      -- quem não pode alterar valores mantém os que já estavam gravados
      r := (r - sensiveis) || '{"salarios": []}'::jsonb || coalesce((
        select jsonb_object_agg(k, v) from jsonb_each(antigo) as e(k, v) where k = any (sensiveis)
      ), '{}'::jsonb);
    end if;
    insert into public.funcionarios (id, data) values (r ->> 'id', r)
    on conflict (id) do update set data = excluded.data;
  end loop;
end $$;

-- Login por nome de usuário: descobre a conta ligada a ele
create or replace function public.email_para_login(login text) returns text
language sql stable security definer set search_path = public as $$
  select u.email from public.usuarios u where lower(u.usuario) = lower(trim(login)) limit 1
$$;

-- O administrador redefine a senha de quem esqueceu (quem não tem e-mail não recebe link)
create extension if not exists pgcrypto with schema extensions;
create or replace function public.admin_definir_senha(alvo text, nova text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.eh_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  if length(nova) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  update auth.users set encrypted_password = extensions.crypt(nova, extensions.gen_salt('bf')), updated_at = now()
  where lower(email) = lower(alvo);
  if not found then
    raise exception 'Esta pessoa ainda não criou a conta.';
  end if;
end $$;

revoke execute on function public.funcionarios_visiveis() from public, anon;
revoke execute on function public.salvar_funcionarios(jsonb) from public, anon;
revoke execute on function public.admin_definir_senha(text, text) from public, anon;
revoke execute on function public.email_para_login(text) from public;
grant execute on function public.funcionarios_visiveis() to authenticated;
grant execute on function public.salvar_funcionarios(jsonb) to authenticated;
grant execute on function public.admin_definir_senha(text, text) to authenticated;
grant execute on function public.email_para_login(text) to anon, authenticated;
grant execute on function public.nivel_modulo(text) to authenticated;
grant execute on function public.pode_ver(text[]) to authenticated;
grant execute on function public.pode_editar(text[]) to authenticated;
grant execute on function public.pode_documento(text, boolean) to authenticated;
grant execute on function public.pode_arquivo(text, boolean) to authenticated;
