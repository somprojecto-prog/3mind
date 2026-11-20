import { supabase } from '@/lib/supabase';

const MAXIMO = 5000; // documentos considerados (os mais recentes)
const BLOCO = 1000;  // o Supabase devolve no máximo 1000 linhas por pedido

async function buscarTudo(construir) {
  const linhas = [];
  for (let de = 0; de < MAXIMO; de += BLOCO) {
    const { data, error } = await construir().range(de, de + BLOCO - 1);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < BLOCO) break;
  }
  return linhas;
}

/** Agrupa por NIF os documentos que o utilizador pode ver (a RLS decide o que aparece). */
export async function listarClientes() {
  const [docs, nomes] = await Promise.all([
    buscarTudo(() => supabase.from('documentos')
      .select('id, nome_ficheiro, estado, nif, referencia, data_documento, criado_em')
      .not('nif', 'is', null).order('criado_em', { ascending: false })),
    buscarTudo(() => supabase.from('dados_extraidos')
      .select('documento_id, valor, confianca, corrigido_manual')
      .eq('campo', 'nome').not('valor', 'is', null).order('actualizado_em', { ascending: false })),
  ]);

  const nifDoDoc = new Map(docs.map((d) => [d.id, d.nif]));
  const melhorNome = new Map(); // nif -> { valor, pontos }
  for (const n of nomes) {
    const nif = nifDoDoc.get(n.documento_id);
    if (!nif || !n.valor.trim()) continue;
    const pontos = (n.corrigido_manual ? 1000 : 0) + Number(n.confianca ?? 0);
    const actual = melhorNome.get(nif);
    if (!actual || pontos > actual.pontos) melhorNome.set(nif, { valor: n.valor.trim(), pontos });
  }

  const clientes = new Map();
  for (const d of docs) {
    let c = clientes.get(d.nif);
    if (!c) { c = { nif: d.nif, nome: melhorNome.get(d.nif)?.valor ?? '', documentos: [], porRever: 0 }; clientes.set(d.nif, c); }
    c.documentos.push(d);
    if (d.estado === 'revisao' || d.estado === 'erro') c.porRever += 1;
  }
  return { clientes: [...clientes.values()], cortado: docs.length >= MAXIMO };
}
