-- 3MIND · Migração 003 · Registo próprio com aprovação do administrador.
-- Executar depois da 002.

-- "pendente" = pediu registo e ainda não foi aprovada. Distingue de "bloqueada" (activo = false e pendente = false).
alter table public.profiles add column if not exists pendente boolean not null default false;

-- Toda a conta nova nasce BLOQUEADA e PENDENTE, com o papel mais baixo (operador).
-- O papel nunca vem do cliente. Sem aprovação, papel_actual() devolve NULL e todas as políticas (RLS) negam o acesso.
-- Contas criadas pelo administrador (Edge Function) são activadas logo a seguir, pela própria função.
create or replace function public.novo_utilizador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome, activo, pendente)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 120), false, true);
  return new;
end $$;
