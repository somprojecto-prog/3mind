-- 3MIND · Migração 002 · Suporte ao módulo de documentos, fila e validação.
-- Executar depois da 001.

-- Impressão digital do ficheiro (detecta o mesmo ficheiro enviado duas vezes).
alter table public.documentos add column if not exists hash_sha256 text;
create index if not exists documentos_hash_idx on public.documentos (hash_sha256);
create index if not exists documentos_nif_ref_idx on public.documentos (nif, referencia);

-- Batimento da fila: permite saber se um trabalho "em processamento" foi interrompido.
alter table public.fila_processamento add column if not exists actualizado_em timestamptz not null default now();
drop trigger if exists fila_actualizado on public.fila_processamento;
create trigger fila_actualizado before update on public.fila_processamento
  for each row execute function public.tocar_actualizado_em();

-- Distingue "resolvida por uma pessoa" de "deixou de se verificar".
alter table public.validacoes add column if not exists resolvida_manual boolean not null default false;

-- Categorias iniciais (admin/supervisor podem acrescentar ou apagar).
insert into public.categorias (nome) values ('Facturas'), ('Declarações'), ('Contratos'), ('Outros')
on conflict (nome) do nothing;

-- Conta duplicados sem revelar documentos de outros utilizadores: devolve só números.
create or replace function public.contar_duplicados(p_documento uuid)
returns table (por_ficheiro int, por_referencia int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.documentos o join public.documentos d on d.id = p_documento
      where o.id <> d.id and d.hash_sha256 is not null and o.hash_sha256 = d.hash_sha256),
    (select count(*)::int from public.documentos o join public.documentos d on d.id = p_documento
      where o.id <> d.id and d.nif is not null and d.referencia is not null
        and o.nif = d.nif and o.referencia = d.referencia)
  where public.papel_actual() in ('admin', 'supervisor', 'auditor')
     or exists (select 1 from public.documentos x
                where x.id = p_documento and x.enviado_por = auth.uid() and public.papel_actual() = 'operador');
$$;
revoke all on function public.contar_duplicados(uuid) from public;
grant execute on function public.contar_duplicados(uuid) to authenticated;
