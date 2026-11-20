import { supabase } from '@/lib/supabase';

export const ESTADOS = ['pendente', 'em_processamento', 'processado', 'revisao', 'erro'];
export const ROTULO_ESTADO = {
  pendente: 'Pendente', em_processamento: 'Em processamento', processado: 'Processado', revisao: 'Para revisão', erro: 'Com erro',
};
const ROTULO_CAMPO = {
  nif: 'NIF', nome: 'Nome', data: 'Data', valor: 'Valor', referencia: 'Referência', numero_factura: 'Número de factura',
};
const ROTULO_SEVERIDADE = { erro: 'Erro', aviso: 'Aviso', info: 'Informação' };
const ANALISADOS = ['processado', 'revisao'];

const LOTE = 500;
const MAX_DOCUMENTOS = 5000;

// Colunas de cada secção (usadas na pré-visualização e nos três formatos). `peso` = largura relativa.
export const SECCOES = [
  { id: 'estatisticas', titulo: 'Estatísticas', colunas: [
    { chave: 'grupo', titulo: 'Grupo', peso: 18 }, { chave: 'indicador', titulo: 'Indicador', peso: 40 }, { chave: 'valor', titulo: 'Valor', peso: 14 },
  ] },
  { id: 'dados', titulo: 'Dados extraídos', colunas: [
    { chave: 'documento', titulo: 'Documento', peso: 30 }, { chave: 'referencia', titulo: 'Referência', peso: 16 },
    { chave: 'nif', titulo: 'NIF', peso: 14 }, { chave: 'categoria', titulo: 'Categoria', peso: 16 },
    { chave: 'campo', titulo: 'Campo', peso: 16 }, { chave: 'valor', titulo: 'Valor extraído', peso: 22 },
    { chave: 'valorOriginal', titulo: 'Valor lido pelo OCR', peso: 22 }, { chave: 'confianca', titulo: 'Confiança (%)', peso: 11 },
    { chave: 'corrigido', titulo: 'Corrigido à mão', peso: 11 },
  ] },
  { id: 'erros', titulo: 'Erros encontrados', colunas: [
    { chave: 'documento', titulo: 'Documento', peso: 28 }, { chave: 'origem', titulo: 'Origem', peso: 14 },
    { chave: 'tipo', titulo: 'Tipo', peso: 16 }, { chave: 'campo', titulo: 'Campo', peso: 14 },
    { chave: 'mensagem', titulo: 'Mensagem', peso: 40 }, { chave: 'severidade', titulo: 'Severidade', peso: 12 },
    { chave: 'situacao', titulo: 'Situação', peso: 22 }, { chave: 'data', titulo: 'Data', peso: 16 },
  ] },
  { id: 'revisao', titulo: 'Para revisão', colunas: [
    { chave: 'documento', titulo: 'Documento', peso: 30 }, { chave: 'referencia', titulo: 'Referência', peso: 16 },
    { chave: 'nif', titulo: 'NIF', peso: 14 }, { chave: 'categoria', titulo: 'Categoria', peso: 16 },
    { chave: 'estado', titulo: 'Estado', peso: 16 }, { chave: 'motivo', titulo: 'Motivo', peso: 36 },
    { chave: 'porResolver', titulo: 'Validações por resolver', peso: 14 }, { chave: 'enviadoEm', titulo: 'Recebido em', peso: 16 },
  ] },
];

const fDataHora = new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fData = new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const dataHora = (iso) => (iso ? fDataHora.format(new Date(iso)) : '');
export const dataSimples = (iso) => (iso ? fData.format(new Date(iso)) : '');

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
  'id, nome_ficheiro, estado, referencia, nif, paginas, criado_em, categoria_id',
  'categorias(nome)',
  'dados_extraidos(campo, valor, valor_original, confianca, corrigido_manual)',
  'validacoes(tipo, campo, mensagem, severidade, resolvida, criado_em)',
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
  const alvo = Math.min(total, MAX_DOCUMENTOS);
  const pedidos = [];
  for (let de = LOTE; de < alvo; de += LOTE) pedidos.push(consulta(filtros, false).range(de, Math.min(de + LOTE, alvo) - 1));
  const restos = await Promise.all(pedidos);
  let documentos = primeiro.data;
  for (const r of restos) {
    if (r.error) throw r.error;
    documentos = documentos.concat(r.data);
  }
  return construirRelatorio(documentos, { total, truncado: total > MAX_DOCUMENTOS });
}

// Transforma os documentos (com filhos embebidos) nas quatro secções do relatório.
export function construirRelatorio(documentos, meta = {}) {
  const dados = [];
  const erros = [];
  const revisao = [];
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  const porCategoria = new Map();
  const sev = { erro: 0, aviso: 0, info: 0 };
  let paginas = 0, campos = 0, corrigidos = 0, somaConf = 0, nConf = 0, validacoes = 0, porResolverTotal = 0;

  for (const d of documentos) {
    porEstado[d.estado] = (porEstado[d.estado] || 0) + 1;
    const categoria = d.categorias?.nome || 'Sem categoria';
    porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + 1);
    if (ANALISADOS.includes(d.estado)) paginas += d.paginas || 0;

    for (const x of d.dados_extraidos || []) {
      campos += 1;
      if (x.corrigido_manual) corrigidos += 1;
      const conf = x.confianca == null ? null : Number(x.confianca);
      if (conf != null) { somaConf += conf; nConf += 1; }
      dados.push({
        documento: d.nome_ficheiro, referencia: d.referencia || '', nif: d.nif || '', categoria,
        campo: ROTULO_CAMPO[x.campo] || x.campo, valor: x.valor ?? '', valorOriginal: x.valor_original ?? '',
        confianca: conf, corrigido: x.corrigido_manual ? 'Sim' : 'Não',
      });
    }

    let porResolver = 0;
    for (const v of d.validacoes || []) {
      validacoes += 1;
      sev[v.severidade] = (sev[v.severidade] || 0) + 1;
      if (!v.resolvida) porResolverTotal += 1;
      if (!v.resolvida && v.severidade !== 'info') porResolver += 1;
      if (v.severidade !== 'info') {
        erros.push({
          documento: d.nome_ficheiro, origem: 'Validação', tipo: v.tipo, campo: v.campo ? (ROTULO_CAMPO[v.campo] || v.campo) : '',
          mensagem: v.mensagem, severidade: ROTULO_SEVERIDADE[v.severidade] || v.severidade,
          situacao: v.resolvida ? 'Resolvida' : 'Por resolver', data: dataHora(v.criado_em), _ordem: v.severidade === 'erro' ? 0 : 1,
        });
      }
    }
    for (const f of d.fila_processamento || []) {
      if (f.erro_mensagem || f.estado === 'falhou') {
        erros.push({
          documento: d.nome_ficheiro, origem: 'Processamento', tipo: 'falha_processamento', campo: '',
          mensagem: f.erro_mensagem || 'O processamento falhou.', severidade: 'Erro',
          situacao: d.estado === 'erro' ? 'Documento ainda com erro' : 'Documento já não está em erro',
          data: dataHora(f.criado_em), _ordem: 0,
        });
      }
    }

    if (d.estado === 'revisao' || porResolver > 0) {
      const motivos = [];
      if (d.estado === 'revisao') motivos.push('Marcado para revisão');
      if (porResolver > 0) motivos.push(`${porResolver} validação(ões) por resolver`);
      revisao.push({
        documento: d.nome_ficheiro, referencia: d.referencia || '', nif: d.nif || '', categoria,
        estado: ROTULO_ESTADO[d.estado] || d.estado, motivo: motivos.join('; '), porResolver, enviadoEm: dataHora(d.criado_em),
      });
    }
  }
  erros.sort((a, b) => a._ordem - b._ordem);
  erros.forEach((e) => delete e._ordem);

  const total = documentos.length;
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const linha = (grupo, indicador, valor) => ({ grupo, indicador, valor });
  const estatisticas = [
    linha('Resumo', 'Documentos no relatório', total),
    linha('Resumo', 'Páginas analisadas (processados e em revisão)', paginas),
    linha('Resumo', 'Taxa de processamento (%)', total ? Math.round((porEstado.processado / total) * 1000) / 10 : 0),
    linha('Resumo', 'Documentos para revisão', revisao.length),
    ...ESTADOS.map((e) => linha('Por estado', ROTULO_ESTADO[e], porEstado[e] || 0)),
    ...categorias.map(([nome, n]) => linha('Por categoria', nome, n)),
    linha('Extracção', 'Campos extraídos', campos),
    linha('Extracção', 'Confiança média (%)', nConf ? Math.round((somaConf / nConf) * 10) / 10 : 0),
    linha('Extracção', 'Campos corrigidos à mão', corrigidos),
    linha('Validações', 'Total de validações', validacoes),
    linha('Validações', 'Erros', sev.erro),
    linha('Validações', 'Avisos', sev.aviso),
    linha('Validações', 'Informações', sev.info),
    linha('Validações', 'Por resolver', porResolverTotal),
  ];

  return {
    seccoes: { estatisticas, dados, erros, revisao },
    resumo: { total, paginas, porEstado, paraRevisao: revisao.length, erros: erros.length, campos },
    meta: { total: meta.total ?? total, truncado: Boolean(meta.truncado), limite: MAX_DOCUMENTOS },
  };
}
