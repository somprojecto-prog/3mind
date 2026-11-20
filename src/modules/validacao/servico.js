import { supabase } from '@/lib/supabase';
import { camposPrincipais } from '../ocr/extracao';
import { avaliar, chave } from './regras';

/** Estado do documento conforme os problemas por resolver (erro/aviso → "revisao"). */
export async function recalcularEstado(documentoId) {
  const { count, error } = await supabase.from('validacoes')
    .select('id', { count: 'exact', head: true })
    .eq('documento_id', documentoId).eq('resolvida', false).in('severidade', ['erro', 'aviso']);
  if (error) throw error;
  const estado = count > 0 ? 'revisao' : 'processado';
  const { error: e2 } = await supabase.from('documentos').update({ estado })
    .eq('id', documentoId).in('estado', ['em_processamento', 'processado', 'revisao']);
  if (e2) throw e2;
  return estado;
}

/**
 * Corre as regras sobre os dados actuais do documento, sincroniza os campos principais
 * e actualiza a lista de validações sem apagar nada (o que já não se verifica fica "resolvido").
 */
export async function executarValidacao(documentoId) {
  const { data: dados, error } = await supabase.from('dados_extraidos')
    .select('id, campo, valor, confianca, corrigido_manual').eq('documento_id', documentoId);
  if (error) throw error;

  const principais = camposPrincipais(dados);
  const { error: eDoc } = await supabase.from('documentos').update(principais).eq('id', documentoId);
  if (eDoc) throw eDoc;

  const { data: dup } = await supabase.rpc('contar_duplicados', { p_documento: documentoId });
  const problemas = avaliar({ dados, duplicados: dup?.[0] || {} });

  const { data: existentes, error: eEx } = await supabase.from('validacoes')
    .select('id, tipo, campo, mensagem, resolvida, resolvida_manual').eq('documento_id', documentoId);
  if (eEx) throw eEx;

  const abertas = new Map(existentes.filter((v) => !v.resolvida).map((v) => [chave(v), v.id]));
  const aceites = new Set(existentes.filter((v) => v.resolvida && v.resolvida_manual).map(chave));
  const actuais = new Set(problemas.map(chave));

  const novas = problemas
    .filter((p) => !abertas.has(chave(p)) && !aceites.has(chave(p)))
    .map((p) => ({ ...p, documento_id: documentoId }));
  if (novas.length) {
    const { error: eIns } = await supabase.from('validacoes').insert(novas);
    if (eIns) throw eIns;
  }
  const ultrapassadas = [...abertas].filter(([k]) => !actuais.has(k)).map(([, id]) => id);
  if (ultrapassadas.length) {
    const { error: eUp } = await supabase.from('validacoes').update({ resolvida: true, resolvida_manual: false }).in('id', ultrapassadas);
    if (eUp) throw eUp;
  }
  return recalcularEstado(documentoId);
}

export async function resolverValidacao(id, documentoId) {
  const { error } = await supabase.from('validacoes').update({ resolvida: true, resolvida_manual: true }).eq('id', id);
  if (error) throw error;
  return recalcularEstado(documentoId);
}
