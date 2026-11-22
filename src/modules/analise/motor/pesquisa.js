// Pesquisa no texto lido: ignora acentos e maiúsculas, aceita várias palavras e "frases entre aspas",
// e encontra números escritos de outra forma ("1500" encontra "1.500,00"). Funções puras (sem rede).
import { dividirPaginas, norm, semAcentos } from './texto';

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CLASSES = { a: 'aàáâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ' };

/** Divide a consulta em termos: "frase exacta" fica junta; o resto separa-se por espaços. */
export function termosDaConsulta(consulta) {
  const out = [];
  String(consulta || '').replace(/"([^"]+)"|(\S+)/g, (_, frase, palavra) => { const t = (frase || palavra).trim(); if (t.length >= 2 || /\d/.test(t)) out.push(t); return ''; });
  return out;
}

/** Expressão regular (com grupo) que encontra o termo no texto original, sem olhar a acentos nem a separadores de números. */
export function regexDoTermo(termo) {
  const t = semAcentos(termo).toLowerCase();
  if (/^\d+([.,]\d+)?$/.test(t)) {
    // número: dígitos podem vir separados por ponto/espaço de milhares; decimais opcionais
    const [inteiro, dec] = t.split(/[.,]/);
    const digs = inteiro.split('').map(escapar).join('[. ]?');
    return new RegExp(`(?<!\\d)(${digs}(?:[.,]${dec ? escapar(dec) : '\\d{1,2}'})?)(?!\\d)`, 'giu');
  }
  const corpo = [...t].map((ch) => (/\s/.test(ch) ? '\\s+' : CLASSES[ch] ? `[${CLASSES[ch]}]` : escapar(ch))).join('');
  return new RegExp(`(${corpo})`, 'giu');
}

const casa = (re, linha) => { re.lastIndex = 0; return re.test(linha); };

/**
 * Procura a consulta, linha a linha. Primeiro as linhas com TODOS os termos (o que foi pedido);
 * se não houver, mostra as linhas com algum dos termos, marcadas como "parcial".
 * Devolve { termos, exactos, parciais, sugestoes }.
 */
export function pesquisar(textoOriginal, consulta, { maximo = 100 } = {}) {
  const termos = termosDaConsulta(consulta);
  const vazio = { termos, exactos: [], parciais: [], sugestoes: [] };
  if (!termos.length) return vazio;
  const regs = termos.map(regexDoTermo);
  const exactos = []; const parciais = [];
  dividirPaginas(textoOriginal).forEach((p, i) => p.split('\n').forEach((l, n) => {
    const linha = l.trim();
    if (!linha) return;
    const hits = regs.filter((re) => casa(re, linha)).length;
    if (!hits) return;
    const r = { pagina: i + 1, linhaN: n + 1, linha: linha.slice(0, 240), acertos: hits };
    (hits === regs.length ? exactos : parciais).push(r);
  }));
  parciais.sort((a, b) => b.acertos - a.acertos);
  const sugestoes = exactos.length ? [] : sugerirPalavras(textoOriginal, termos);
  return { termos, exactos: exactos.slice(0, maximo), parciais: parciais.slice(0, maximo), sugestoes };
}

// Distância de edição curta (para "Quis dizer…?" quando não há resultados exactos).
function distancia(a, b) {
  const m = a.length; const n = b.length;
  if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Palavras do documento parecidas com os termos sem resultado (erros de escrita ou de OCR). */
export function sugerirPalavras(textoOriginal, termos) {
  const palavras = new Map();
  for (const w of String(textoOriginal || '').split(/[^\p{L}\d-]+/u)) if (w.length >= 3) { const k = norm(w); if (!palavras.has(k)) palavras.set(k, w); }
  const out = new Set();
  for (const t of termos) {
    const k = norm(t);
    if (k.length < 3 || /^\d/.test(k)) continue;
    if ([...palavras.keys()].some((p) => p.includes(k))) continue;
    const limite = k.length <= 5 ? 1 : 2;
    [...palavras.entries()].map(([p, orig]) => [distancia(k, p), orig]).filter(([d]) => d <= limite).sort((a, b) => a[0] - b[0]).slice(0, 3).forEach(([, o]) => out.add(o));
  }
  return [...out].slice(0, 5);
}

/** Corta a linha em partes para marcar os termos encontrados: [{ texto, marcado }]. */
export function marcarTermos(linha, termos) {
  const regs = termos.map(regexDoTermo);
  if (!regs.length) return [{ texto: linha, marcado: false }];
  const re = new RegExp(regs.map((r) => r.source).join('|'), 'giu');
  const out = []; let ultimo = 0;
  for (const m of String(linha).matchAll(re)) {
    if (!m[0]) continue;
    if (m.index > ultimo) out.push({ texto: linha.slice(ultimo, m.index), marcado: false });
    out.push({ texto: m[0], marcado: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) out.push({ texto: linha.slice(ultimo), marcado: false });
  return out;
}
