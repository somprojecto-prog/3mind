-- 005: o ficheiro original deixa de ser guardado no servidor; resultados com retenção de 7 dias;
-- limite de documentos por dia; registo do descarregamento obrigatório do resultado.

alter table public.documentos alter column storage_path drop not null;
alter table public.documentos add column if not exists expira_em timestamptz not null default (now() + interval '7 days');
alter table public.documentos add column if not exists descarregado_em timestamptz;
create index if not exists documentos_expira_idx on public.documentos (expira_em);

-- Limite diário (todas as contas, dia de Luanda). Para mudar, altere o número 200.
create or replace function public.limite_diario_documentos() returns trigger
language plpgsql security definer set search_path = public as $$
declare hoje timestamptz := date_trunc('day', now() at time zone 'Africa/Luanda') at time zone 'Africa/Luanda';
begin
  if (select count(*) from public.documentos where criado_em >= hoje) >= 200 then
    raise exception 'Limite diário atingido: só é possível enviar 200 documentos por dia. Tente amanhã.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limite_diario on public.documentos;
create trigger limite_diario before insert on public.documentos for each row execute function public.limite_diario_documentos();

-- Apaga documentos (e, por cascata, dados, validações e fila) depois de expirarem.
create or replace function public.apagar_expirados() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.documentos where expira_em < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.apagar_expirados() from public;
grant execute on function public.apagar_expirados() to authenticated;

-- Marca que o resultado foi descarregado (só o autor ou um administrador/supervisor).
create or replace function public.marcar_descarregado(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.documentos set descarregado_em = now()
  where id = p_id and (enviado_por = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and papel in ('admin','supervisor')));
end $$;
revoke all on function public.marcar_descarregado(uuid) from public;
grant execute on function public.marcar_descarregado(uuid) to authenticated;

-- Limpeza automática de hora a hora, se a extensão pg_cron existir (senão, o site chama apagar_expirados ao abrir).
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('apagar-expirados-3mind', '0 * * * *', 'select public.apagar_expirados()');
  end if;
exception when others then null; end $$;
