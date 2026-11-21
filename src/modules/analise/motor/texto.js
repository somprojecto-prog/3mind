// Utilitários de texto e números partilhados pelo motor de análise (funções puras, sem rede nem base de dados).
import { dataParaISO, numeroDeTexto, nifValido } from '../../ocr/extracao';

export { nifValido, numeroDeTexto };
export const SEPARADOR_PAGINA = '\f';

export const semAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const norm = (s) => semAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim();
export const limpar = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const limitar = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export const dividirPaginas = (texto) => (texto ? String(texto).split(SEPARADOR_PAGINA) : []);
export const juntarPaginas = (paginas) => paginas.join(SEPARADOR_PAGINA);

// ---------- Moeda ----------
const MOEDAS = [
  [/\b(?:aoa|kz|kzs|kwanzas?)\b/i, 'AOA'], [/(?:\busd\b|us\$|\bd[oó]lares?\b)/i, 'USD'], [/(?:\beur\b|€|\beuros?\b)/i, 'EUR'],
  [/\bgbp\b|£/i, 'GBP'], [/\bzar\b|\brand\b/i, 'ZAR'], [/\bcny\b|\brmb\b|\byuan\b/i, 'CNY'], [/\bbrl\b/i, 'BRL'],
];
export function moedaDeTexto(txt) {
  for (const [re, codigo] of MOEDAS) if (re.test(txt)) return codigo;
  return null;
}
export function contarMoedas(texto) {
  const contagem = {};
  for (const [re, codigo] of MOEDAS) {
    const g = new RegExp(re.source, `${re.flags.replace('g', '')}g`);
    const n = (texto.match(g) || []).length;
    if (n) contagem[codigo] = n;
  }
  return contagem;
}

// ---------- Valores e datas ----------
export const MONEY = String.raw`\d{1,3}(?:[. ]\d{3})+,\d{2}|\d+[.,]\d{2}|\d{1,3}(?:[. ]\d{3})+`;

/** Primeiro montante do texto, como string decimal ("1234.50"), ou null. */
export function primeiroValor(txt) {
  const dec = /(?:^|[^\d.,])(\d{1,3}(?:[. ]\d{3})*,\d{2}|\d+[.,]\d{2})(?!\d)/.exec(String(txt));
  if (dec) return numeroDeTexto(dec[1]);
  const m = new RegExp(`(?:^|[^\\d.,])(${MONEY}|\\d+)(?![\\d])`).exec(String(txt));
  if (!m) return null;
  const v = numeroDeTexto(m[1]);
  return v !== '' && Number.isFinite(Number(v)) ? v : null;
}

export function primeiraData(txt) {
  const t = String(txt);
  let m = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/.exec(t);
  if (m) return dataParaISO(m[1], m[2], m[3]);
  m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (m) return dataParaISO(m[3], m[2], m[1]);
  m = /\b(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})\b/iu.exec(t);
  if (m) {
    const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const mes = meses.indexOf(semAcentos(m[2]).toLowerCase()) + 1;
    if (mes) return dataParaISO(m[1], mes, m[3]);
  }
  return null;
}

export function primeiroNif(txt) {
  const m = /(\d{9}[A-Za-z]{2}\d{3}|\d(?: ?\d){9})(?![\d])/.exec(String(txt));
  return m ? m[1].replace(/ /g, '').toUpperCase() : null;
}

/** Compara montantes com tolerância (padrão: 2 cêntimos, ou 0,5 % em valores grandes). */
export function iguais(a, b, tolerancia) {
  const x = Number(a); const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const tol = tolerancia ?? Math.max(0.02, Math.abs(y) * 0.0005);
  return Math.abs(x - y) <= tol;
}

export const formatarMontante = (v, moeda) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  const s = n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moeda ? `${s} ${moeda}` : s;
};

// ---------- Valor por extenso (português) ----------
const UNIDADES = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezasseis: 16, dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezanove: 19, dezenove: 19 };
const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CENTENAS = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };
const MOEDA_PALAVRAS = new Set(['kwanza', 'kwanzas', 'kz', 'aoa', 'dolar', 'dolares', 'euro', 'euros', 'usd', 'eur']);
const CENTIMOS_PALAVRAS = new Set(['centimo', 'centimos', 'cent', 'cents', 'cêntimos']);

/** "mil duzentos e trinta e quatro kwanzas e cinquenta cêntimos" → 1234.5. Devolve null se não reconhecer o texto. */
export function extensoParaNumero(txt) {
  const palavras = norm(txt).replace(/[,.;:()]/g, ' ').split(' ').filter(Boolean);
  if (!palavras.length) return null;
  let total = 0; let actual = 0; let parteInteira = null; let reconheceu = false;
  const fechar = () => { total += actual; actual = 0; };
  for (const p of palavras) {
    if (p === 'e' || p === 'de' || p === 'a' || p === 'sao' || p === 'total') continue;
    if (p in UNIDADES) { actual += UNIDADES[p]; reconheceu = true; }
    else if (p in DEZENAS) { actual += DEZENAS[p]; reconheceu = true; }
    else if (p in CENTENAS) { actual += CENTENAS[p]; reconheceu = true; }
    else if (p === 'mil') { total += (actual || 1) * 1000; actual = 0; reconheceu = true; }
    else if (p === 'milhao' || p === 'milhoes') { total += (actual || 1) * 1e6; actual = 0; reconheceu = true; }
    else if (p === 'bilhao' || p === 'bilhoes') { total += (actual || 1) * 1e9; actual = 0; reconheceu = true; }
    else if (MOEDA_PALAVRAS.has(p)) { fechar(); if (parteInteira == null) { parteInteira = total; total = 0; } }
    else if (CENTIMOS_PALAVRAS.has(p)) { fechar(); const cent = total; total = 0; return reconheceu ? (parteInteira ?? 0) + cent / 100 : null; }
    else return null; // palavra desconhecida: não arriscar
  }
  fechar();
  if (!reconheceu) return null;
  return parteInteira != null ? parteInteira + total / 100 : total;
}
