// Extracção por regras (não é inteligência artificial): procura NIF, nomes, datas, valores,
// números de factura e referências no texto lido. Todos os valores devem ser confirmados por uma pessoa.
// A "confiança" parte da confiança do OCR na página e sobe ou desce conforme o campo tenha rótulo ("NIF:", "Total:").

export const ROTULO_CAMPO = {
  nif: 'NIF', nome: 'Nome', data: 'Data', valor: 'Valor', referencia: 'Referência', numero_factura: 'N.º de factura',
};
export const CAMPOS = Object.keys(ROTULO_CAMPO);

// Formatos assumidos (confirmar com a AGT): empresa = 10 dígitos; pessoa singular = 9 dígitos + 2 letras + 3 dígitos.
export const nifValido = (v) => /^\d{10}$/.test(v) || /^\d{9}[A-Z]{2}\d{3}$/.test(v);

export function dataParaISO(d, m, a) {
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return { iso, ok: !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso };
}
export const dataValidaISO = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return Boolean(m) && dataParaISO(m[3], m[2], m[1]).ok;
};

const limpar = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const limitar = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

// "1.234.567,89" -> "1234567.89"
export function numeroDeTexto(txt) {
  let t = String(txt).replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  else if (/^\d{1,3}\.\d{3}$/.test(t)) t = t.replace('.', ''); // "238.000" = 238 mil (ponto de milhares)
  return t;
}

function juntar(saida, campo, valor, confianca) {
  const v = limpar(valor);
  if (!v) return;
  const ja = saida.find((x) => x.campo === campo && x.valor === v);
  if (ja) ja.confianca = Math.max(ja.confianca, limitar(confianca));
  else saida.push({ campo, valor: v, confianca: limitar(confianca) });
}

function extrairNifs(texto, base, saida) {
  // Aceita erros típicos do OCR no rótulo ("NlF", "N1F") e dígitos separados por espaços ("5419 876 543").
  const rotulado = /(?:\bN\.?\s?[Il1]\.?\s?F\.?|contribuinte(?:\s+n[.º°o]*)?)\s*(?:do\s+cliente\s*)?[:.\-–]?\s*(?:n[.º°o]+\s*)?(\d{9}[A-Za-z]{2}\d{3}|\d(?:[ ]?\d){9})(?![\d ]?\d)/gi;
  for (const m of texto.matchAll(rotulado)) juntar(saida, 'nif', m[1].replace(/ /g, '').toUpperCase(), base + 5);
  for (const m of texto.matchAll(/\b(\d{9}[A-Za-z]{2}\d{3})\b/g)) juntar(saida, 'nif', m[1].toUpperCase(), base - 10);
}

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function extrairDatas(texto, base, saida) {
  const encontradas = [];
  for (const m of texto.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/g)) encontradas.push(dataParaISO(m[1], m[2], m[3]));
  for (const m of texto.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) encontradas.push(dataParaISO(m[3], m[2], m[1]));
  // Por extenso: "7 de Março de 2026"
  for (const m of texto.matchAll(/\b(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})\b/giu)) {
    const mes = MESES.indexOf(m[2].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')) + 1;
    if (mes) encontradas.push(dataParaISO(m[1], mes, m[3]));
  }
  for (const d of encontradas.slice(0, 12)) juntar(saida, 'data', d.iso, d.ok ? base : base * 0.5);
}

function extrairValores(texto, base, saida) {
  const candidatos = [];
  for (const linha of texto.split(/\n/)) {
    const rotulada = /\b(total|a pagar|montante|subtotal|iva)\b/i.test(linha);
    for (const m of linha.matchAll(/(?:^|[^\d.,])(\d{1,3}(?:[. ]\d{3})+,\d{2}|\d+,\d{2})(?![\d,])/g)) {
      const valor = numeroDeTexto(m[1]);
      if (Number(valor) > 0) candidatos.push({ valor, confianca: base + (rotulada ? 3 : -12) });
    }
  }
  candidatos.sort((a, b) => b.confianca - a.confianca || Number(b.valor) - Number(a.valor));
  for (const c of candidatos.slice(0, 20)) juntar(saida, 'valor', c.valor, c.confianca);
  const valores = saida.filter((x) => x.campo === 'valor');
  for (const extra of valores.slice(8)) saida.splice(saida.indexOf(extra), 1);
}

function extrairFacturas(texto, base, saida) {
  for (const m of texto.matchAll(/\b((?:FT|FR|FS|NC|ND|GT|FA|VD)\s?[A-Z0-9]{1,12}(?:\s?\/\s?[A-Z0-9]{1,12})*\s?[/\-]\s?\d{1,8})\b/gi)) {
    juntar(saida, 'numero_factura', limpar(m[1]).toUpperCase(), base + 3);
  }
  for (const m of texto.matchAll(/f[ac]ctura\s*(?:n[.º°o]*\s*)?[:\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,24})/gi)) {
    if (/\d/.test(m[1])) juntar(saida, 'numero_factura', m[1].toUpperCase().replace(/[.\-/]+$/, ''), base - 2);
  }
}

function extrairReferencias(texto, base, saida) {
  const jaFactura = new Set(saida.filter((x) => x.campo === 'numero_factura').map((x) => x.valor));
  for (const m of texto.matchAll(/(?:refer[eê]ncia|\bref\.?|processo|n[.º°o]\s*(?:do\s*)?(?:documento|doc\.?))\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,24})/gi)) {
    const v = m[1].toUpperCase().replace(/[.\-/]+$/, '');
    if (/\d/.test(v) && !jaFactura.has(v)) juntar(saida, 'referencia', v, base - 2);
  }
}

function extrairNomes(texto, base, saida) {
  const rotulo = /(?:cliente|nome|contribuinte|exm[oa]\(?s?\)?\.?\s*sr\(?a?s?\)?\.?|fornecedor|emitente|designa[cç][aã]o social|raz[aã]o social|adquirente)\s*[:\-]\s*(.{3,80})/i;
  for (const linha of texto.split(/\n/)) {
    const m = rotulo.exec(linha);
    if (!m) continue;
    const nome = limpar(m[1].split(/\bN\.?I\.?F\b|\d{5,}/i)[0]).replace(/[:;,.\-]+$/, '');
    if (nome.split(' ').filter((p) => /\p{L}{2,}/u.test(p)).length >= 2 && /^[\p{L}][\p{L}\s.,'&\-]{4,}$/u.test(nome)) {
      juntar(saida, 'nome', nome, base - 10);
    }
  }
}

export function extrairCampos(texto, confiancaBase = 80) {
  const base = Math.max(0, Math.min(99, Number(confiancaBase) || 0));
  const t = String(texto || '');
  const saida = [];
  extrairNifs(t, base, saida);
  extrairNomes(t, base, saida);
  extrairDatas(t, base, saida);
  extrairFacturas(t, base, saida);
  extrairReferencias(t, base, saida);
  extrairValores(t, base, saida);
  return saida;
}

// Campos "principais" guardados no próprio documento para pesquisa e detecção de duplicados.
export function camposPrincipais(dados) {
  const validos = dados.filter((d) => limpar(d.valor));
  const melhor = (lista) => [...lista].sort((a, b) => (b.confianca ?? 100) - (a.confianca ?? 100))[0]?.valor ?? null;
  const nif = melhor(validos.filter((d) => d.campo === 'nif' && nifValido(limpar(d.valor).toUpperCase())));
  const factura = melhor(validos.filter((d) => d.campo === 'numero_factura'));
  const referencia = factura ?? melhor(validos.filter((d) => d.campo === 'referencia'));
  const data = melhor(validos.filter((d) => d.campo === 'data' && dataValidaISO(limpar(d.valor))));
  return { nif: nif ? limpar(nif).toUpperCase() : null, referencia: referencia ? limpar(referencia) : null, data_documento: data ? limpar(data) : null };
}
