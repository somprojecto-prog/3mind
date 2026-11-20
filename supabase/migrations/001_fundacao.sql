-- 3MIND · Migração 001 · Fundação (tabelas, RLS, storage, auditoria)
-- Executar no SQL Editor do Supabase, uma única vez, num projecto novo.

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.papel as enum ('admin', 'supervisor', 'operador', 'auditor');
create type public.estado_documento as enum ('pendente', 'em_processamento', 'processado', 'erro', 'revisao');
create type public.estado_fila as enum ('espera', 'em_processamento', 'concluido', 'falhou');
create type public.severidade as enum ('info', 'aviso', 'erro');

-- ---------- Tabelas ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  papel public.papel not null default 'operador',
  activo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  nome_ficheiro text not null,
  storage_path text not null unique,          -- formato: {enviado_por}/{uuid}-{nome}
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  paginas int,
  categoria_id uuid references public.categorias (id) on delete set null,
  estado public.estado_documento not null default 'pendente',
  referencia text,
  nif text,
  data_documento date,
  enviado_por uuid not null references public.profiles (id),
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);
create index on public.documentos (estado);
create index on public.documentos (nif);
create index on public.documentos (enviado_por);
create index on public.documentos (criado_em desc);

create table public.dados_extraidos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  campo text not null,                         -- ex.: nif, nome, data, valor, referencia, numero_factura
  valor text,
  valor_original text,                         -- o que o OCR leu, antes de correcção manual
  confianca numeric(5,2) check (confianca between 0 and 100),
  corrigido_manual boolean not null default false,
  actualizado_por uuid references public.profiles (id),
  actualizado_em timestamptz not null default now()
);
create index on public.dados_extraidos (documento_id);

create table public.validacoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  tipo text not null,                          -- campo_vazio, formato, duplicado, divergencia, inconsistencia
  campo text,
  mensagem text not null,
  severidade public.severidade not null default 'aviso',
  resolvida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on public.validacoes (documento_id);

create table public.fila_processamento (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  estado public.estado_fila not null default 'espera',
  progresso int not null default 0 check (progresso between 0 and 100),
  tentativas int not null default 0,
  checkpoint jsonb,                            -- permite retomar (ex.: última página lida)
  erro_mensagem text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on public.fila_processamento (estado);
create index on public.fila_processamento (documento_id);

create table public.comparacoes (
  id uuid primary key default gen_random_uuid(),
  documento_ids uuid[] not null check (cardinality(documento_ids) >= 2),
  resultado jsonb,
  criado_por uuid not null references public.profiles (id),
  criado_em timestamptz not null default now()
);

create table public.relatorios (
  id uuid primary key default gen_random_uuid(),
  formato text not null check (formato in ('xlsx', 'pdf', 'csv')),
  filtros jsonb not null default '{}'::jsonb,
  criado_por uuid not null references public.profiles (id),
  criado_em timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  utilizador_id uuid references public.profiles (id),
  accao text not null,
  entidade text,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index on public.auditoria (criado_em desc);
create index on public.auditoria (utilizador_id);

-- ---------- Funções auxiliares ----------
-- Devolve o papel do utilizador autenticado, ou NULL se a conta estiver bloqueada.
-- Conta bloqueada = NULL = todas as políticas negam o acesso.
create or replace function public.papel_actual()
returns public.papel
language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid() and activo
$$;
revoke all on function public.papel_actual() from public;
grant execute on function public.papel_actual() to authenticated;

create or replace function public.tocar_actualizado_em()
returns trigger language plpgsql as $$
begin
  new.actualizado_em = now();
  return new;
end $$;
create trigger documentos_actualizado before update on public.documentos
  for each row execute function public.tocar_actualizado_em();

-- Cria o perfil quando nasce uma conta. O papel nunca vem do cliente: começa sempre como "operador".
create or replace function public.novo_utilizador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end $$;
create trigger auth_novo_utilizador after insert on auth.users
  for each row execute function public.novo_utilizador();

-- Auditoria automática das alterações importantes (feita pela base de dados, não pelo ecrã).
create or replace function public.auditar_alteracao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (utilizador_id, accao, entidade, entidade_id, detalhes)
  values (
    auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id)::text,
    case tg_op
      when 'INSERT' then to_jsonb(new)
      when 'DELETE' then to_jsonb(old)
      else jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end $$;
create trigger auditar_documentos after insert or update or delete on public.documentos
  for each row execute function public.auditar_alteracao();
create trigger auditar_dados_extraidos after insert or update or delete on public.dados_extraidos
  for each row execute function public.auditar_alteracao();
create trigger auditar_profiles after update on public.profiles
  for each row execute function public.auditar_alteracao();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.categorias enable row level security;
alter table public.documentos enable row level security;
alter table public.dados_extraidos enable row level security;
alter table public.validacoes enable row level security;
alter table public.fila_processamento enable row level security;
alter table public.comparacoes enable row level security;
alter table public.relatorios enable row level security;
alter table public.auditoria enable row level security;

-- profiles: cada um vê o seu; admin/supervisor/auditor vêem todos; só o admin altera.
create policy profiles_ler on public.profiles for select to authenticated
  using (id = auth.uid() or public.papel_actual() in ('admin', 'supervisor', 'auditor'));
create policy profiles_alterar on public.profiles for update to authenticated
  using (public.papel_actual() = 'admin') with check (public.papel_actual() = 'admin');

-- categorias: todos lêem; admin/supervisor gerem.
create policy categorias_ler on public.categorias for select to authenticated
  using (public.papel_actual() is not null);
create policy categorias_gerir on public.categorias for all to authenticated
  using (public.papel_actual() in ('admin', 'supervisor'))
  with check (public.papel_actual() in ('admin', 'supervisor'));

-- documentos: operador vê os seus; admin/supervisor/auditor vêem todos.
create policy documentos_ler on public.documentos for select to authenticated
  using (
    public.papel_actual() in ('admin', 'supervisor', 'auditor')
    or (public.papel_actual() = 'operador' and enviado_por = auth.uid())
  );
create policy documentos_inserir on public.documentos for insert to authenticated
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador') and enviado_por = auth.uid());
create policy documentos_alterar on public.documentos for update to authenticated
  using (
    public.papel_actual() in ('admin', 'supervisor')
    or (public.papel_actual() = 'operador' and enviado_por = auth.uid())
  )
  with check (
    public.papel_actual() in ('admin', 'supervisor')
    or (public.papel_actual() = 'operador' and enviado_por = auth.uid())
  );
create policy documentos_eliminar on public.documentos for delete to authenticated
  using (public.papel_actual() = 'admin');

-- Tabelas filhas: herdam a visibilidade do documento (a subconsulta já respeita a RLS de documentos).
create policy dados_ler on public.dados_extraidos for select to authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id));
create policy dados_escrever on public.dados_extraidos for insert to authenticated
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador')
    and exists (select 1 from public.documentos d where d.id = documento_id));
create policy dados_alterar on public.dados_extraidos for update to authenticated
  using (public.papel_actual() in ('admin', 'supervisor', 'operador')
    and exists (select 1 from public.documentos d where d.id = documento_id))
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador'));
create policy dados_eliminar on public.dados_extraidos for delete to authenticated
  using (public.papel_actual() in ('admin', 'supervisor')
    and exists (select 1 from public.documentos d where d.id = documento_id));

create policy validacoes_ler on public.validacoes for select to authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id));
create policy validacoes_escrever on public.validacoes for insert to authenticated
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador')
    and exists (select 1 from public.documentos d where d.id = documento_id));
create policy validacoes_alterar on public.validacoes for update to authenticated
  using (public.papel_actual() in ('admin', 'supervisor', 'operador')
    and exists (select 1 from public.documentos d where d.id = documento_id))
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador'));
create policy validacoes_eliminar on public.validacoes for delete to authenticated
  using (public.papel_actual() in ('admin', 'supervisor')
    and exists (select 1 from public.documentos d where d.id = documento_id));

create policy fila_ler on public.fila_processamento for select to authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id));
create policy fila_escrever on public.fila_processamento for insert to authenticated
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador')
    and exists (select 1 from public.documentos d where d.id = documento_id));
create policy fila_alterar on public.fila_processamento for update to authenticated
  using (public.papel_actual() in ('admin', 'supervisor', 'operador')
    and exists (select 1 from public.documentos d where d.id = documento_id))
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador'));
create policy fila_eliminar on public.fila_processamento for delete to authenticated
  using (public.papel_actual() in ('admin', 'supervisor')
    and exists (select 1 from public.documentos d where d.id = documento_id));

-- comparações e relatórios: cada um vê os seus; admin/supervisor/auditor vêem todos.
create policy comparacoes_ler on public.comparacoes for select to authenticated
  using (criado_por = auth.uid() or public.papel_actual() in ('admin', 'supervisor', 'auditor'));
create policy comparacoes_inserir on public.comparacoes for insert to authenticated
  with check (public.papel_actual() in ('admin', 'supervisor', 'operador') and criado_por = auth.uid());

create policy relatorios_ler on public.relatorios for select to authenticated
  using (criado_por = auth.uid() or public.papel_actual() in ('admin', 'supervisor', 'auditor'));
create policy relatorios_inserir on public.relatorios for insert to authenticated
  with check (public.papel_actual() is not null and criado_por = auth.uid());

-- auditoria: só inserir (como o próprio) e só admin/auditor lêem. Sem update nem delete.
create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.papel_actual() in ('admin', 'auditor'));
create policy auditoria_inserir on public.auditoria for insert to authenticated
  with check (public.papel_actual() is not null and utilizador_id = auth.uid());
revoke update, delete, truncate on public.auditoria from authenticated, anon;

-- ---------- Storage (bucket privado) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Convenção de caminho: {id_do_utilizador}/{uuid}-{nome_do_ficheiro}
create policy storage_docs_ler on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos' and public.papel_actual() is not null
    and (public.papel_actual() in ('admin', 'supervisor', 'auditor')
         or (storage.foldername(name))[1] = auth.uid()::text)
  );
create policy storage_docs_enviar on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and public.papel_actual() in ('admin', 'supervisor', 'operador')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy storage_docs_eliminar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.papel_actual() = 'admin');

-- ---------- Realtime (progresso da fila em tempo real) ----------
alter publication supabase_realtime add table public.fila_processamento;
alter publication supabase_realtime add table public.documentos;

-- ---------- Primeiro administrador ----------
-- 1) Crie o utilizador em Authentication > Users.
-- 2) Promova-o (substitua o email):
--    update public.profiles set papel = 'admin' where email = 'o-seu-email@exemplo.ao';
