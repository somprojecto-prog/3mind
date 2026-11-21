import { supabase } from '@/lib/supabase';

// Procura, no próprio 3MIND (e só entre os documentos que o utilizador pode ver, por RLS), os documentos
// que o perfil diz estarem relacionados. Devolve um array paralelo a perfil.ligacoes: [[{ documento, dados }]].
export async function carregarRelacionados(perfil, dados, documentoId) {
  const ligacoes = perfil.ligacoes || [];
  const saida = [];
  for (const lig of ligacoes) {
    let docs = [];
    if (lig.modo === 'movimentos') {
      const r = await supabase.from('documentos').select('id, nome_ficheiro, tipo_documento, referencia').in('tipo_documento', lig.tipos).neq('id', documentoId).limit(300);
      docs = r.data || [];
    } else {
      const chave = dados.find((d) => d.campo === lig.campo && String(d.valor ?? '').trim())?.valor;
      if (chave) {
        const r = await supabase.from('documentos').select('id, nome_ficheiro, tipo_documento, referencia')
          .in('tipo_documento', lig.tipos).ilike('referencia', String(chave).replace(/[%_,()]/g, ' ').trim()).neq('id', documentoId).limit(5);
        docs = r.data || [];
      }
    }
    if (!docs.length) { saida.push([]); continue; }
    const r = await supabase.from('dados_extraidos').select('documento_id, campo, valor, corrigido_manual').in('documento_id', docs.map((d) => d.id));
    saida.push(docs.map((documento) => ({ documento, dados: (r.data || []).filter((x) => x.documento_id === documento.id) })));
  }
  return saida;
}
