import { supabase } from '@/lib/supabase';
import { ESTADOS, ESTADOS_ANALISADOS } from './constantes';
import { chaveDia } from './formatar';

const TAM = 1000;          // linhas por pedido
const MAX_LINHAS = 20000;  // limite de segurança para agregações no navegador

// O esquema não tem views nem funções de agregação, por isso as somas e os agrupamentos
// são feitos aqui, sobre colunas mínimas. Os totais por estado usam contagens exactas do servidor.
// Se `parcial` vier a true, há mais linhas do que MAX_LINHAS (ver nota na entrega: pedir RPC à IA 1).
async function lerTudo(construir) {
  const primeiro = await construir(true).range(0, TAM - 1);
  if (primeiro.error) throw primeiro.error;
  const total = primeiro.count ?? primeiro.data.length;
  const alvo = Math.min(total, MAX_LINHAS);
  const pedidos = [];
  for (let de = TAM; de < alvo; de += TAM) pedidos.push(construir(false).range(de, Math.min(de + TAM, alvo) - 1));
  const restos = await Promise.all(pedidos);
  let linhas = primeiro.data;
  for (const r of restos) {
    if (r.error) throw r.error;
    linhas = linhas.concat(r.data);
  }
  return { linhas, total, parcial: total > MAX_LINHAS };
}

async function contar(consulta) {
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

export function inicioDoPeriodo(dias) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (dias - 1));
  return d;
}

export function agregar({ porEstado, docs, categorias, concluidos, falhas, dias, agora = new Date() }) {
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const inicio = inicioDoPeriodo(dias);

  // Série diária: recebidos (documentos.criado_em) e concluídos (fila.concluido_em).
  const serie = [];
  const indice = new Map();
  for (let i = 0; i < dias; i += 1) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const ponto = { dia: chaveDia(d), data: d, recebidos: 0, concluidos: 0 };
    serie.push(ponto);
    indice.set(ponto.dia, ponto);
  }
  let paginas = 0;
  const contagemCategorias = new Map();
  for (const r of docs.linhas) {
    if (ESTADOS_ANALISADOS.includes(r.estado)) paginas += r.paginas || 0;
    const nome = nomes.get(r.categoria_id) || 'Sem categoria';
    contagemCategorias.set(nome, (contagemCategorias.get(nome) || 0) + 1);
    const p = indice.get(chaveDia(new Date(r.criado_em)));
    if (p) p.recebidos += 1;
  }
  let somaTempo = 0;
  let nTempo = 0;
  for (const r of concluidos.linhas) {
    const p = indice.get(chaveDia(new Date(r.concluido_em)));
    if (p) p.concluidos += 1;
    if (r.iniciado_em) {
      const seg = (new Date(r.concluido_em) - new Date(r.iniciado_em)) / 1000;
      if (seg >= 0) { somaTempo += seg; nTempo += 1; }
    }
  }

  const ordenadas = [...contagemCategorias.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  const topo = ordenadas.slice(0, 6);
  const resto = ordenadas.slice(6).reduce((s, c) => s + c.total, 0);
  if (resto > 0) topo.push({ nome: 'Outras categorias', total: resto });

  const total = ESTADOS.reduce((s, e) => s + (porEstado[e] || 0), 0);
  const nConcluidos = concluidos.total;
  return {
    porEstado,
    total,
    paginas,
    categorias: topo,
    serie,
    hoje: serie[serie.length - 1],
    desempenho: {
      concluidos: nConcluidos,
      falhas,
      taxaSucesso: nConcluidos + falhas > 0 ? nConcluidos / (nConcluidos + falhas) : null,
      tempoMedioSeg: nTempo > 0 ? somaTempo / nTempo : null,
    },
    parcial: docs.parcial || concluidos.parcial,
    actualizadoEm: agora,
  };
}

export async function carregarPainel(dias) {
  const inicio = inicioDoPeriodo(dias).toISOString();

  const [contagens, docs, categorias, concluidos, falhas, trabalhosRes, espera, emCurso, recentesRes] = await Promise.all([
    Promise.all(ESTADOS.map((e) => contar(supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('estado', e)))),
    lerTudo((c) => supabase.from('documentos')
      .select('estado, categoria_id, paginas, criado_em', c ? { count: 'exact' } : undefined)
      .order('criado_em', { ascending: false }).order('id')),
    supabase.from('categorias').select('id, nome'),
    lerTudo((c) => supabase.from('fila_processamento')
      .select('concluido_em, iniciado_em', c ? { count: 'exact' } : undefined)
      .eq('estado', 'concluido').gte('concluido_em', inicio)
      .order('concluido_em', { ascending: false }).order('id')),
    contar(supabase.from('fila_processamento').select('id', { count: 'exact', head: true }).eq('estado', 'falhou').gte('criado_em', inicio)),
    supabase.from('fila_processamento')
      .select('id, estado, progresso, tentativas, iniciado_em, criado_em, documentos(nome_ficheiro, paginas)')
      .in('estado', ['espera', 'em_processamento']).order('criado_em', { ascending: true }).limit(50),
    contar(supabase.from('fila_processamento').select('id', { count: 'exact', head: true }).eq('estado', 'espera')),
    contar(supabase.from('fila_processamento').select('id', { count: 'exact', head: true }).eq('estado', 'em_processamento')),
    supabase.from('documentos')
      .select('id, nome_ficheiro, estado, actualizado_em, categorias(nome)')
      .order('actualizado_em', { ascending: false }).limit(8),
  ]);
  for (const r of [categorias, trabalhosRes, recentesRes]) if (r.error) throw r.error;

  const porEstado = Object.fromEntries(ESTADOS.map((e, i) => [e, contagens[i]]));
  const base = agregar({ porEstado, docs, categorias: categorias.data, concluidos, falhas, dias });
  const trabalhos = [...trabalhosRes.data].sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'em_processamento' ? -1 : 1));
  return { ...base, trabalhos, fila: { espera, emCurso }, recentes: recentesRes.data };
}
