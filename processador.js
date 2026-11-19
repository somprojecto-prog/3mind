import { supabase } from '@/lib/supabase';
import { ErroLeitura } from '../ocr/erros';
import { extrairCampos } from '../ocr/extracao';
import { guardarExtracao } from '../documentos/servico';
import { executarValidacao } from '../validacao/servico';

// Processador da fila: corre no navegador do utilizador que enviou os documentos (OCR no cliente).
// Trabalha um documento de cada vez, grava o progresso e um ponto de retoma após cada página.
export const LIMITE_INTERROMPIDO_MS = 2 * 60 * 1000;

let utilizadorId = null;
let aCorrer = false;
let parado = true;
let modoTodos = false; // true = também processa documentos de outros (só por acção explícita de supervisor/administrador)
let temporizador = null;
const ouvintes = new Set();

export const aoMudar = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };
const avisar = (evento) => ouvintes.forEach((f) => f(evento));

export function iniciarProcessador(idUtilizador) {
  if (utilizadorId === idUtilizador && !parado) return;
  utilizadorId = idUtilizador;
  parado = false;
  clearInterval(temporizador);
  recuperarInterrompidos().catch(() => {}).finally(acordar);
  temporizador = setInterval(acordar, 30_000);
}

export function pararProcessador() {
  parado = true;
  clearInterval(temporizador);
  temporizador = null;
}

/** Trabalhos "em processamento" sem sinal há mais de 2 minutos voltam à fila e retomam da última página lida. */
export async function recuperarInterrompidos() {
  if (!utilizadorId) return;
  const limite = new Date(Date.now() - LIMITE_INTERROMPIDO_MS).toISOString();
  const { data, error } = await supabase.from('fila_processamento')
    .select('id, documentos!inner(enviado_por)')
    .eq('estado', 'em_processamento').lt('actualizado_em', limite).eq('documentos.enviado_por', utilizadorId);
  if (error || !data?.length) return;
  await supabase.from('fila_processamento').update({ estado: 'espera' })
    .in('id', data.map((d) => d.id)).eq('estado', 'em_processamento').lt('actualizado_em', limite);
}

export async function acordar({ todos = false } = {}) {
  if (todos) modoTodos = true;
  if (aCorrer || parado || !utilizadorId) return;
  aCorrer = true;
  try {
    for (let i = 0; i < 500 && !parado; i += 1) {
      const item = await reclamarProximo();
      if (!item) break;
      await processar(item);
    }
  } finally {
    aCorrer = false;
    modoTodos = false;
  }
}

async function reclamarProximo() {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    let consulta = supabase.from('fila_processamento')
      .select('id, documento_id, tentativas, progresso, checkpoint, documentos!inner(id, storage_path, mime_type, enviado_por)')
      .eq('estado', 'espera');
    if (!modoTodos) consulta = consulta.eq('documentos.enviado_por', utilizadorId);
    const { data, error } = await consulta.order('criado_em').limit(1);
    if (error || !data?.length) return null;
    const item = data[0];
    // Reclamar de forma atómica: se outro separador chegou primeiro, esta actualização não apanha nenhuma linha.
    const { data: reclamado } = await supabase.from('fila_processamento').update({
      estado: 'em_processamento', tentativas: item.tentativas + 1, iniciado_em: new Date().toISOString(), erro_mensagem: null,
    }).eq('id', item.id).eq('estado', 'espera').select('id').maybeSingle();
    if (reclamado) return item;
  }
  return null;
}

async function processar(item) {
  const docId = item.documento_id;
  let fraccao = 0;
  let ultimo = 0;
  const relatar = (campos) => supabase.from('fila_processamento').update(campos).eq('id', item.id);
  const progresso = (f, checkpoint) => {
    fraccao = f;
    const agora = Date.now();
    if (!checkpoint && agora - ultimo < 1500 && f < 1) return Promise.resolve();
    ultimo = agora;
    return relatar({ progresso: Math.min(95, Math.round(5 + f * 90)), ...(checkpoint ? { checkpoint } : {}) });
  };

  try {
    await supabase.from('documentos').update({ estado: 'em_processamento' }).eq('id', docId);
    avisar({ tipo: 'inicio', documentoId: docId });
    await relatar({ progresso: Math.max(item.progresso || 0, 1) });

    const { data: blob, error: eDown } = await supabase.storage.from('documentos').download(item.documentos.storage_path);
    if (eDown || !blob) throw new Error('Não foi possível obter o ficheiro do armazenamento.');

    const { lerDocumento } = await import('../ocr/leitura'); // carrega PDF.js e Tesseract só quando há trabalho
    const leitura = await lerDocumento(blob, item.documentos.mime_type, {
      checkpoint: item.checkpoint,
      cancelado: () => parado,
      aoProgresso: (f) => { progresso(f).catch(() => {}); },
      aoCheckpoint: (cp) => progresso(fraccao, cp),
    });

    await guardarExtracao(docId, extrairCampos(leitura.texto, leitura.confianca), { paginas: leitura.paginas });
    await executarValidacao(docId);
    await relatar({ estado: 'concluido', progresso: 100, concluido_em: new Date().toISOString(), checkpoint: null, erro_mensagem: null });
    avisar({ tipo: 'fim', documentoId: docId });
  } catch (e) {
    if (e?.interrompido) return; // fica "em processamento"; será retomado mais tarde
    const mensagem = e instanceof ErroLeitura || e?.message?.startsWith('Não foi possível obter')
      ? e.message : 'Falha inesperada ao processar. Pode tentar de novo.';
    await relatar({ estado: 'falhou', erro_mensagem: mensagem });
    await supabase.from('documentos').update({ estado: 'erro' }).eq('id', docId);
    avisar({ tipo: 'erro', documentoId: docId, mensagem });
  }
}

/** Para a página da fila: retomar trabalhos interrompidos ou repetir falhados (mantém as páginas já lidas). */
export async function repetirTrabalho(filaId, documentoId, { todos = false } = {}) {
  const { error } = await supabase.from('fila_processamento')
    .update({ estado: 'espera', erro_mensagem: null }).eq('id', filaId).in('estado', ['falhou', 'em_processamento']);
  if (error) throw error;
  await supabase.from('documentos').update({ estado: 'pendente' }).eq('id', documentoId).in('estado', ['erro', 'em_processamento']);
  acordar({ todos });
}
