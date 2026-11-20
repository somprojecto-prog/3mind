import { supabase } from '@/lib/supabase';
import { TAMANHO_MAXIMO, TIPOS_ACEITES } from '../ocr/config';

export const POR_PAGINA = 20;

// Erro com mensagem já própria para o utilizador.
export class ErroUtilizador extends Error {}

// ---------- Validação do ficheiro antes do envio (tipo, tamanho e conteúdo real) ----------
const ASSINATURA = {
  'application/pdf': (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

/** Devolve uma mensagem de erro, ou null se o ficheiro é aceitável. */
export async function validarFicheiro(ficheiro) {
  if (!TIPOS_ACEITES[ficheiro.type]) return 'Tipo não aceite. Envie PDF, PNG, JPEG ou WebP.';
  if (ficheiro.size === 0) return 'O ficheiro está vazio.';
  if (ficheiro.size > TAMANHO_MAXIMO) return `O ficheiro tem ${(ficheiro.size / 1048576).toFixed(1)} MB; o máximo é ${TAMANHO_MAXIMO / 1048576} MB.`;
  const inicio = new Uint8Array(await ficheiro.slice(0, 12).arrayBuffer());
  if (!ASSINATURA[ficheiro.type](inicio)) return 'O conteúdo do ficheiro não corresponde ao tipo indicado.';
  return null;
}

async function sha256(ficheiro) {
  const h = await crypto.subtle.digest('SHA-256', await ficheiro.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const nomeSeguro = (nome) =>
  nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_').slice(-100);

/** Envia para o bucket privado, regista o documento e põe-no na fila. Devolve o id do documento. */
export async function enviarDocumento(ficheiro, utilizadorId, categoriaId = null) {
  const erro = await validarFicheiro(ficheiro);
  if (erro) throw new ErroUtilizador(erro);
  const hash = await sha256(ficheiro);
  const caminho = `${utilizadorId}/${crypto.randomUUID()}-${nomeSeguro(ficheiro.name)}`;

  const { error: eUp } = await supabase.storage.from('documentos').upload(caminho, ficheiro, { contentType: ficheiro.type, upsert: false });
  if (eUp) throw eUp;

  const { data: doc, error: eDoc } = await supabase.from('documentos').insert({
    nome_ficheiro: ficheiro.name.slice(0, 200),
    storage_path: caminho,
    mime_type: ficheiro.type,
    tamanho_bytes: ficheiro.size,
    categoria_id: categoriaId || null,
    enviado_por: utilizadorId,
    hash_sha256: hash,
  }).select('id').single();
  if (eDoc) { await supabase.storage.from('documentos').remove([caminho]); throw eDoc; } // só o administrador consegue remover; sem efeito para os restantes

  const { error: eFila } = await supabase.from('fila_processamento').insert({ documento_id: doc.id });
  if (eFila) throw eFila;
  return doc.id;
}

// ---------- Listagem e pesquisa ----------
function limparBusca(q) { return String(q || '').replace(/[,()%*\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); }

export async function listarDocumentos({ q, estado, categoria, de, ate, pagina = 0 }) {
  let query = supabase.from('documentos')
    .select('id, nome_ficheiro, estado, nif, referencia, data_documento, paginas, criado_em, categorias(nome), profiles(nome)', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

  const busca = limparBusca(q);
  if (busca) {
    const partes = [`nome_ficheiro.ilike.%${busca}%`, `nif.ilike.%${busca}%`, `referencia.ilike.%${busca}%`];
    const dma = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(busca);
    if (dma) partes.push(`data_documento.eq.${dma[3]}-${dma[2].padStart(2, '0')}-${dma[1].padStart(2, '0')}`);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(busca)) partes.push(`data_documento.eq.${busca}`);
    query = query.or(partes.join(','));
  }
  if (estado) query = query.eq('estado', estado);
  if (categoria === 'sem') query = query.is('categoria_id', null);
  else if (categoria) query = query.eq('categoria_id', categoria);
  if (de) query = query.gte('criado_em', new Date(`${de}T00:00:00`).toISOString());
  if (ate) { const d = new Date(`${ate}T00:00:00`); d.setDate(d.getDate() + 1); query = query.lt('criado_em', d.toISOString()); }

  const { data, count, error } = await query;
  if (error) throw error;
  return { linhas: data, total: count ?? 0 };
}

// ---------- Categorias ----------
export async function listarCategorias() {
  const { data, error } = await supabase.from('categorias').select('id, nome').order('nome');
  if (error) throw error;
  return data;
}
export async function criarCategoria(nome) {
  const { error } = await supabase.from('categorias').insert({ nome: nome.trim().slice(0, 60) });
  if (error) throw error;
}
export async function apagarCategoria(id) {
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Detalhe ----------
export async function carregarDetalhe(id) {
  const [doc, dados, validacoes, fila] = await Promise.all([
    supabase.from('documentos').select('*, categorias(nome), profiles(nome, email)').eq('id', id).single(),
    supabase.from('dados_extraidos').select('*').eq('documento_id', id).order('campo'),
    supabase.from('validacoes').select('*').eq('documento_id', id).order('criado_em', { ascending: false }),
    supabase.from('fila_processamento').select('id, estado, progresso, tentativas, erro_mensagem, iniciado_em, concluido_em, criado_em').eq('documento_id', id).order('criado_em', { ascending: false }),
  ]);
  for (const r of [doc, dados, validacoes, fila]) if (r.error) throw r.error;
  return { documento: doc.data, dados: dados.data, validacoes: validacoes.data, fila: fila.data };
}

export async function descarregarFicheiro(caminho) {
  const { data, error } = await supabase.storage.from('documentos').download(caminho);
  if (error || !data) throw error || new Error('Ficheiro não encontrado.');
  return data;
}

export async function carregarAuditoriaDoDocumento(id) {
  const { data, error } = await supabase.from('auditoria')
    .select('id, accao, entidade, criado_em, profiles(nome, email)')
    .eq('entidade_id', id).order('criado_em', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

// ---------- Alterações ----------
export async function guardarExtracao(documentoId, campos, { paginas } = {}) {
  const { count, error } = await supabase.from('dados_extraidos').select('id', { count: 'exact', head: true }).eq('documento_id', documentoId);
  if (error) throw error;
  if (!count && campos.length) { // se já houver dados (retoma após falha), não duplicar
    const { error: eIns } = await supabase.from('dados_extraidos').insert(
      campos.map((c) => ({ documento_id: documentoId, campo: c.campo, valor: c.valor, valor_original: c.valor, confianca: c.confianca })),
    );
    if (eIns) throw eIns;
  }
  if (paginas) {
    const { error: eP } = await supabase.from('documentos').update({ paginas }).eq('id', documentoId);
    if (eP) throw eP;
  }
}

export async function corrigirDado(id, valor, utilizadorId) {
  const { error } = await supabase.from('dados_extraidos').update({
    valor: String(valor).trim(), corrigido_manual: true, actualizado_por: utilizadorId, actualizado_em: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function acrescentarDado(documentoId, campo, valor, utilizadorId) {
  const { error } = await supabase.from('dados_extraidos').insert({
    documento_id: documentoId, campo, valor: String(valor).trim(), valor_original: null, confianca: null, corrigido_manual: true, actualizado_por: utilizadorId,
  });
  if (error) throw error;
}

export async function definirCategoria(documentoId, categoriaId) {
  const { error } = await supabase.from('documentos').update({ categoria_id: categoriaId || null }).eq('id', documentoId);
  if (error) throw error;
}

/** Só supervisor/administrador (a base de dados recusa os outros). Apaga os dados lidos e volta a pôr na fila. */
export async function reprocessarDocumento(documentoId) {
  const passos = [
    supabase.from('dados_extraidos').delete().eq('documento_id', documentoId),
    supabase.from('validacoes').delete().eq('documento_id', documentoId),
  ];
  for (const p of passos) { const { error } = await p; if (error) throw error; }
  const { error: eDoc } = await supabase.from('documentos').update({ estado: 'pendente', nif: null, referencia: null, data_documento: null }).eq('id', documentoId);
  if (eDoc) throw eDoc;
  const { error: eF } = await supabase.from('fila_processamento').insert({ documento_id: documentoId });
  if (eF) throw eF;
}

/** Só administrador. */
export async function eliminarDocumento(documento) {
  const { error: eS } = await supabase.storage.from('documentos').remove([documento.storage_path]);
  if (eS) throw eS;
  const { error } = await supabase.from('documentos').delete().eq('id', documento.id);
  if (error) throw error;
}
