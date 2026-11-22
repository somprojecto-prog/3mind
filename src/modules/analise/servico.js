import { supabase } from '@/lib/supabase';
import { registarAuditoria } from '@/lib/auditoria';
import { extrairCampos } from '../ocr/extracao';
import { executarValidacao } from '../validacao/servico';
import { classificar, LIMITE_CONFIANCA } from './motor/classificar';
import { extrairPorPerfil } from './motor/campos';
import { resumir } from './motor/resumir';
import { pesquisar } from './motor/pesquisa';
import { dividirPaginas, juntarPaginas } from './motor/texto';
import { AUTO, PERFIS, obterAnalise, obterPerfil } from './perfis';

/** Guarda o texto lido (páginas separadas) e a confiança do OCR. A análise corre a seguir, sobre este texto. */
export async function gravarLeitura(documentoId, leitura) {
  const { data: doc, error } = await supabase.from('documentos').select('classificacao').eq('id', documentoId).single();
  if (error) throw error;
  const classificacao = { ...(doc.classificacao || {}), ocr: { media: Math.round(leitura.confianca * 10) / 10, paginas: leitura.confiancasPaginas || [] } };
  const { error: e2 } = await supabase.from('documentos').update({ paginas: leitura.paginas, texto_original: juntarPaginas(leitura.paginasTexto || [leitura.texto]), classificacao }).eq('id', documentoId);
  if (e2) throw e2;
}

// Extracção geral (perfil "Outros"): usa as regras antigas, página a página, para também guardar a página de origem.
function extrairGenerico(paginas, confs) {
  const mapa = new Map();
  paginas.forEach((t, i) => {
    for (const c of extrairCampos(t, confs[i] ?? 80)) {
      const k = `${c.campo}|${c.valor}`;
      if (!mapa.has(k)) mapa.set(k, { ...c, pagina: i + 1 });
    }
  });
  return [...mapa.values()];
}

/**
 * Corre o pipeline sobre o texto já guardado: classificar (se preciso) → extrair → resumir → validar.
 * Com tipo automático e pouca confiança, pára e deixa o documento "para revisão" à espera de confirmação.
 * { tipo } = tipo confirmado/escolhido pelo utilizador (volta a analisar sem repetir o OCR).
 */
export async function analisarDocumento(documentoId, { tipo, origem } = {}) {
  const { data: doc, error } = await supabase.from('documentos').select('id, tipo_documento, tipo_analise, texto_original, classificacao').eq('id', documentoId).single();
  if (error) throw error;
  const paginas = dividirPaginas(doc.texto_original);
  const confs = doc.classificacao?.ocr?.paginas || [];
  let tipoDoc = tipo || doc.tipo_documento;
  let cl = { ...(doc.classificacao || {}) };
  delete cl.pendente; delete cl.divergente;

  const sugestao = classificar(paginas.join('\n'), PERFIS.filter((p) => !p.generico));
  if (!tipoDoc || tipoDoc === AUTO) {
    tipoDoc = sugestao.tipo;
    cl = { ...cl, tipo: sugestao.tipo, confianca: sugestao.confianca, origem: 'auto', alternativas: sugestao.alternativas };
    // Pouca confiança: analisa já com o tipo mais provável (mostra resultados) e deixa as outras opções para confirmar.
    if (sugestao.confianca < LIMITE_CONFIANCA) cl.pendente = true;
  } else {
    cl = { ...cl, tipo: tipoDoc, confianca: origem === 'confirmado' ? 100 : cl.confianca ?? 100, origem: origem || cl.origem || 'manual', alternativas: sugestao.alternativas };
    if (origem !== 'confirmado' && sugestao.tipo !== tipoDoc && sugestao.confianca >= 75 && sugestao.tipo !== 'outros') cl.divergente = { tipo: sugestao.tipo, confianca: sugestao.confianca };
  }

  // Um PDF pode juntar vários documentos (ex.: factura + recibo + extracto). Avisa-se, em vez de misturar tudo num só perfil.
  delete cl.multiplo;
  if (paginas.length > 1) {
    const porPagina = paginas.map((t, i) => ({ pagina: i + 1, ...classificar(t, PERFIS.filter((p) => !p.generico)) })).filter((p) => p.confianca >= 55 && p.tipo !== 'outros');
    if (new Set(porPagina.map((p) => p.tipo)).size > 1) cl.multiplo = porPagina.map((p) => ({ pagina: p.pagina, tipo: p.tipo, confianca: p.confianca }));
  }

  const perfil = obterPerfil(tipoDoc);
  const analise = obterAnalise(doc.tipo_analise);
  const { error: eL } = await supabase.rpc('limpar_analise', { p_documento: documentoId });
  if (eL) throw eL;

  const { data: manuais } = await supabase.from('dados_extraidos').select('campo').eq('documento_id', documentoId).eq('corrigido_manual', true);
  const jaManuais = new Set((manuais || []).map((m) => m.campo));
  const campos = (perfil.generico ? extrairGenerico(paginas, confs) : extrairPorPerfil(perfil, paginas, confs)).filter((c) => !jaManuais.has(c.campo));
  if (campos.length) {
    const { error: eI } = await supabase.from('dados_extraidos').insert(campos.map((c) => ({ documento_id: documentoId, campo: c.campo, valor: c.valor, valor_original: c.valor, confianca: c.confianca, pagina: c.pagina })));
    if (eI) throw eI;
  }
  const resumo = analise.etapas.resumir ? resumir(perfil, campos, paginas, { multiplo: cl.multiplo }) : null;
  const { error: eD } = await supabase.from('documentos').update({ tipo_documento: tipoDoc, classificacao: cl, resumo }).eq('id', documentoId);
  if (eD) throw eD;

  const estado = await executarValidacao(documentoId);
  registarAuditoria('analisar_documento', 'documentos', documentoId, { tipo: tipoDoc, analise: doc.tipo_analise, campos: campos.length, estado }).catch(() => {});
  return { pendente: false, tipo: tipoDoc, campos: campos.length, estado };
}

/** O utilizador confirma (ou corrige) o tipo e a análise é refeita a partir do texto já lido. */
export async function confirmarTipo(documentoId, tipo) {
  registarAuditoria('seleccionar_tipo_documento', 'documentos', documentoId, { tipo }).catch(() => {});
  const { error } = await supabase.from('documentos').update({ tipo_documento: tipo }).eq('id', documentoId);
  if (error) throw error;
  return analisarDocumento(documentoId, { tipo, origem: 'confirmado' });
}

/** Pesquisa no texto original (análise "Pesquisa de informações"): exactos primeiro, depois parciais. */
export function pesquisarNoTexto(textoOriginal, termo) {
  const r = pesquisar(textoOriginal, termo);
  return [...r.exactos, ...r.parciais.map((x) => ({ ...x, parcial: true }))].slice(0, 100);
}
