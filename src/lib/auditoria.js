import { supabase } from './supabase';

// Regista uma acção feita no ecrã (ex.: "login", "exportar_relatorio").
// Alterações a documentos, dados extraídos e contas são registadas pela própria base de dados.
export async function registarAuditoria(accao, entidade = null, entidadeId = null, detalhes = {}) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return;
  const { error } = await supabase.from('auditoria').insert({
    utilizador_id: data.user.id,
    accao,
    entidade,
    entidade_id: entidadeId ? String(entidadeId) : null,
    detalhes,
  });
  if (error) console.warn('Falha ao registar auditoria:', error.message);
}
