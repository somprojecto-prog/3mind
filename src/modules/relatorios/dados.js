import { supabase } from '@/lib/supabase';
import { ROTULO_ESTADO, LIMITE_DOCUMENTOS, construirRelatorio, dataSimples } from './construir';

// O cálculo vive em construir.js (função pura, testável); aqui fica só o acesso aos dados.
export { ESTADOS, ROTULO_ESTADO, SECCOES, dataHora, dataSimples, construirRelatorio } from './construir';

const LOTE = 500;

const aoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function filtrosPadrao() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  return { inicio: aoDia(inicio), fim: aoDia(fim), estado: '', categoria: '' };
}

export function descreverFiltros(f, categorias = []) {
  const cat = f.categoria === 'sem' ? 'Sem categoria' : categorias.find((c) => c.id === f.categoria)?.nome || 'Todas';
  const periodo = `${dataSimples(`${f.inicio}T00:00:00`)} a ${dataSimples(`${f.fim}T00:00:00`)}`;
  return { periodo, estado: f.estado ? ROTULO_ESTADO[f.estado] : 'Todos', categoria: cat };
}

const SELECCAO = [
  'id, nome_ficheiro, estado, tipo_documento, referencia, nif, paginas, criado_em, categoria_id',
  'categorias(nome)',
  'dados_extraidos(campo, valor, valor_original, confianca, corrigido_manual, pagina)',
  'validacoes(tipo, campo, mensagem, severidade, resolvida, resolvida_manual, criado_em)',
  'fila_processamento(estado, erro_mensagem, tentativas, criado_em)',
].join(', ');

function consulta(f, contar) {
  let q = supabase.from('documentos').select(SELECCAO, contar ? { count: 'exact' } : undefined)
    .order('criado_em', { ascending: false }).order('id');
  q = q.gte('criado_em', new Date(`${f.inicio}T00:00:00`).toISOString());
  const depois = new Date(`${f.fim}T00:00:00`);
  depois.setDate(depois.getDate() + 1);
  q = q.lt('criado_em', depois.toISOString());
  if (f.estado) q = q.eq('estado', f.estado);
  if (f.categoria === 'sem') q = q.is('categoria_id', null);
  else if (f.categoria) q = q.eq('categoria_id', f.categoria);
  return q;
}

export async function carregarCategorias() {
  const { data, error } = await supabase.from('categorias').select('id, nome').order('nome');
  if (error) throw error;
  return data;
}

export async function carregarRelatorio(filtros) {
  const primeiro = await consulta(filtros, true).range(0, LOTE - 1);
  if (primeiro.error) throw primeiro.error;
  const total = primeiro.count ?? primeiro.data.length;
  const alvo = Math.min(total, LIMITE_DOCUMENTOS);
  const pedidos = [];
  for (let de = LOTE; de < alvo; de += LOTE) pedidos.push(consulta(filtros, false).range(de, Math.min(de + LOTE, alvo) - 1));
  const restos = await Promise.all(pedidos);
  let documentos = primeiro.data;
  for (const r of restos) {
    if (r.error) throw r.error;
    documentos = documentos.concat(r.data);
  }
  // Se chegaram documentos durante a leitura, a paginação por deslocamento pode repetir linhas: nunca contar duas vezes.
  documentos = [...new Map(documentos.map((d) => [d.id, d])).values()];
  // Incompleto = faltam documentos (limite de 5000, ou o servidor devolveu menos linhas do que o pedido).
  return construirRelatorio(documentos, { total, parcial: documentos.length < total });
}
