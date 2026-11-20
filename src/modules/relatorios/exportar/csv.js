// CSV com ponto e vírgula e BOM UTF-8: abre correctamente no Excel em português, com acentos.
// Como os valores vêm de OCR (conteúdo não confiável), células que começam por = + - @ são neutralizadas
// para não serem interpretadas como fórmulas ao abrir no Excel (injecção de fórmulas).
const NUMERICO = /^[+-]?\d[\d\s.,]*$/;

function celula(v) {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !NUMERICO.test(s)) s = `'${s}`;
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function gerarCSV(colunas, linhas) {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(';');
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c.chave])).join(';'));
  return `\uFEFF${[cabecalho, ...corpo].join('\r\n')}`;
}

export function blobCSV(colunas, linhas) {
  return new Blob([gerarCSV(colunas, linhas)], { type: 'text/csv;charset=utf-8' });
}
