-- 3MIND · Migração 004 · Selecção de documentos e análise adaptativa.
-- JÁ APLICADA no projecto Supabase (versão 20261121000710). Mantida aqui para quem montar o projecto de raiz.
-- Executar depois da 003.

alter table public.documentos add column if not exists tipo_documento text;
alter table public.documentos add column if not exists tipo_analise text not null default 'completa';
alter table public.documentos add column if not exists classificacao jsonb;   -- { tipo, confianca, origem, pendente, alternativas, ocr: { media, paginas[] } }
alter table public.documentos add column if not exists texto_original text;   -- páginas separadas por \f
alter table public.documentos add column if not exists resumo text;
create index if not exists documentos_tipo_idx on public.documentos (tipo_documento);

alter table public.dados_extraidos add column if not exists pagina int;       -- página de origem do campo

-- Limpa a análise anterior (mantém as correcções feitas à mão) antes de voltar a analisar.
create or replace function public.limpar_analise(p_documento uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.documentos d
    where d.id = p_documento
      and (public.papel_actual() in ('admin', 'supervisor')
           or (public.papel_actual() = 'operador' and d.enviado_por = auth.uid()))
  ) then
    raise exception 'sem permissao';
  end if;
  delete from public.dados_extraidos where documento_id = p_documento and corrigido_manual = false;
  update public.validacoes set resolvida = true, resolvida_manual = false
    where documento_id = p_documento and resolvida = false;
end $$;
revoke all on function public.limpar_analise(uuid) from public;
grant execute on function public.limpar_analise(uuid) to authenticated;
