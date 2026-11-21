import { SECCOES } from '../dados';

const MAX_LINHAS_PDF = 1000;
const AZUL_900 = [10, 37, 64];
const AZUL_300 = [127, 178, 229];
const AZUL_600 = [37, 99, 168];
const AZUL_50 = [244, 248, 252];

// O PDF usa a fonte padrão (Latin-1): mantém acentos portugueses e troca o que ela não desenha.
function limpar(v) {
  return String(v ?? '')
    .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...').replace(/\u2022/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '?');
}

export async function blobPDF(relatorio, { descricao, geradoPor, geradoEm }) {
  const [{ jsPDF }, tabelaMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = tabelaMod.default ?? tabelaMod.autoTable;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 14;
  const util = largura - margem * 2;

  // Cabeçalho institucional
  doc.setFillColor(...AZUL_900);
  doc.rect(0, 0, largura, 24, 'F');
  doc.setFillColor(...AZUL_300); doc.roundedRect(margem, 6, 12, 2.4, 1.2, 1.2, 'F');
  doc.setFillColor(255, 255, 255); doc.roundedRect(margem, 10.8, 8.5, 2.4, 1.2, 1.2, 'F');
  doc.setFillColor(...AZUL_600); doc.roundedRect(margem, 15.6, 5, 2.4, 1.2, 1.2, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
  doc.text('3MIND', margem + 17, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Relatório de processamento documental', margem + 17, 19);

  doc.setTextColor(...AZUL_900); doc.setFontSize(10);
  doc.text(limpar(`Período: ${descricao.periodo}   |   Estado: ${descricao.estado}   |   Categoria: ${descricao.categoria}`), margem, 32);
  doc.setTextColor(91, 107, 128); doc.setFontSize(9);
  doc.text(limpar(`Gerado em ${geradoEm.toLocaleString('pt-AO')} por ${geradoPor}`), margem, 37);
  let y = 42;
  if (relatorio.meta.truncado) {
    doc.setTextColor(179, 38, 30);
    doc.text(limpar(`ATENÇÃO - relatório incompleto: existem ${relatorio.meta.total} documentos nestes filtros, mas só ${relatorio.meta.incluidos} estão incluídos.`), margem, y);
    y += 5;
  }

  const pesoTotal = (cols) => cols.reduce((s, c) => s + c.peso, 0);
  for (const sec of SECCOES) {
    const linhas = relatorio.seccoes[sec.id];
    const mostrar = linhas.slice(0, MAX_LINHAS_PDF);
    const inicioSeccao = sec.id === 'estatisticas' ? y : null;
    if (inicioSeccao == null) { doc.addPage(); y = 18; }
    doc.setTextColor(...AZUL_900); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(`${sec.titulo} (${linhas.length})`, margem, y + 4);
    const colunas = {};
    sec.colunas.forEach((c, i) => { colunas[i] = { cellWidth: (c.peso / pesoTotal(sec.colunas)) * util }; });
    autoTable(doc, {
      startY: y + 7,
      head: [sec.colunas.map((c) => limpar(c.titulo))],
      body: mostrar.length ? mostrar.map((l) => sec.colunas.map((c) => limpar(l[c.chave] ?? ''))) : [[{ content: 'Sem registos para os filtros escolhidos.', colSpan: sec.colunas.length }]],
      margin: { left: margem, right: margem, top: 16 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, overflow: 'linebreak', textColor: [20, 35, 58] },
      headStyles: { fillColor: AZUL_900, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: AZUL_50 },
      columnStyles: colunas,
      tableWidth: util,
    });
    y = doc.lastAutoTable.finalY + 4;
    if (linhas.length > MAX_LINHAS_PDF) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(91, 107, 128);
      doc.text(`Mostradas as primeiras ${MAX_LINHAS_PDF} de ${linhas.length} linhas. O ficheiro XLSX inclui todas.`, margem, y + 3);
    }
  }

  // Rodapé com numeração em todas as páginas
  const n = doc.internal.getNumberOfPages();
  const alto = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(213, 224, 236); doc.line(margem, alto - 10, largura - margem, alto - 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(91, 107, 128);
    doc.text('3MIND · Relatório', margem, alto - 5.5);
    doc.text(`Página ${i} de ${n}`, largura - margem, alto - 5.5, { align: 'right' });
  }
  return doc.output('blob');
}
