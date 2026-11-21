import { supabase } from '@/lib/supabase';
import { avaliar, chave } from './regras';
import { avaliarPerfil } from '../analise/motor/validar';
import { LIMITE_CONFIANCA } from '../analise/motor/classificar';
import { obterAnalise, obterPerfil, rotuloTipo } from '../analise/perfis';
import { carregarRelacionados } from '../analise/relacionados';
import { principaisDoPerfil } from '../analise/principais';

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

/** Problemas que vêm da classificação do tipo (pouca confiança, ou tipo escolhido diferente do que o texto indica). */
function problemasDeClassificacao(doc) {
  const cl = doc.classificacao || {};
  const out = [];
  if (cl.pendente) {
    out.push({ tipo: 'classificacao', campo: null, severidade: 'aviso',
      mensagem: `Tipo de documento por confirmar: parece ser "${rotuloTipo(cl.tipo)}" (${cl.confianca ?? 0}% de confiança). Confirme ou escolha o tipo certo para a análise continuar.` });
  } else if (cl.divergente) {
    out.push({ tipo: 'classificacao', campo: null, severidade: 'aviso',
      mensagem: `Escolheu "${rotuloTipo(doc.tipo_documento)}", mas o conteúdo parece ser "${rotuloTipo(cl.divergente.tipo)}" (${cl.divergente.confianca}%). Confirme o tipo.` });
  }
  if (cl.multiplo?.length) {
    const partes = cl.multiplo.map((m) => `pág. ${m.pagina}: ${rotuloTipo(m.tipo)}`).join('; ');
    out.push({ tipo: 'classificacao', campo: null, severidade: 'aviso', mensagem: `Este ficheiro parece juntar vários tipos de documento (${partes}). Os dados podem misturar-se; envie cada documento separado.` });
  }
  const media = cl.ocr?.media;
  if (media != null && media < LIMITE_CONFIANCA) {
    out.push({ tipo: 'baixa_confianca', campo: null, severidade: 'aviso', mensagem: `A leitura (OCR) tem confiança média de ${Math.round(media)}%. Reveja os dados contra o documento.` });
  }
  return out;
}

/**
 * Corre as regras do perfil do documento sobre os dados actuais, sincroniza os campos principais
 * e actualiza a lista de validações sem apagar nada (o que já não se verifica fica "resolvido").
 * Se o tipo de análise escolhido não inclui validação, só o pedido explícito (forcar) valida.
 */
export async function executarValidacao(documentoId, { forcar = false } = {}) {
  const [docR, dadosR] = await Promise.all([
    supabase.from('documentos').select('id, tipo_documento, tipo_analise, classificacao').eq('id', documentoId).single(),
    supabase.from('dados_extraidos').select('id, campo, valor, confianca, corrigido_manual, pagina').eq('documento_id', documentoId),
  ]);
  if (docR.error) throw docR.error;
  if (dadosR.error) throw dadosR.error;
  const doc = docR.data; const dados = dadosR.data;
  const perfil = obterPerfil(doc.tipo_documento);

  const { error: eDoc } = await supabase.from('documentos').update(principaisDoPerfil(perfil, dados)).eq('id', documentoId);
  if (eDoc) throw eDoc;

  let problemas = problemasDeClassificacao(doc);
  const validar = forcar || obterAnalise(doc.tipo_analise).etapas.validar;
  if (validar && !doc.classificacao?.pendente) {
    const { data: dup } = await supabase.rpc('contar_duplicados', { p_documento: documentoId });
    if (perfil.generico) problemas = problemas.concat(avaliar({ dados, duplicados: dup?.[0] || {} }));
    else {
      const relacionados = await carregarRelacionados(perfil, dados, documentoId).catch(() => []);
      problemas = problemas.concat(avaliarPerfil({ perfil, dados, duplicados: dup?.[0] || {}, relacionados }));
    }
  }

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
