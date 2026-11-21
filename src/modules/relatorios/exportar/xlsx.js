import { SECCOES } from '../dados';

// Folha de cálculo com uma folha por secção. Texto vai sempre como texto (nunca como fórmula).
export async function blobXLSX(relatorio, { descricao, geradoPor, geradoEm }) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = '3MIND';
  wb.created = geradoEm;

  for (const sec of SECCOES) {
    const ws = wb.addWorksheet(sec.titulo);
    const linhas = relatorio.seccoes[sec.id];
    const topo = [
      [`3MIND · ${sec.titulo}`],
      [`Período: ${descricao.periodo} · Estado: ${descricao.estado} · Categoria: ${descricao.categoria}`],
      [`Gerado em ${geradoEm.toLocaleString('pt-AO')} por ${geradoPor}`],
      relatorio.meta.truncado
        ? [`ATENÇÃO - relatório incompleto: existem ${relatorio.meta.total} documentos nestes filtros, mas só ${relatorio.meta.incluidos} estão incluídos.`]
        : [],
    ];
    topo.forEach((l) => ws.addRow(l));
    ws.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0A2540' } };
    ws.getRow(2).font = { color: { argb: 'FF5B6B80' } };
    ws.getRow(3).font = { color: { argb: 'FF5B6B80' } };
    if (relatorio.meta.truncado) ws.getRow(4).font = { bold: true, color: { argb: 'FFB3261E' } };

    const cabecalho = ws.addRow(sec.colunas.map((c) => c.titulo));
    cabecalho.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    linhas.forEach((l) => ws.addRow(sec.colunas.map((c) => l[c.chave] ?? '')));

    sec.colunas.forEach((c, i) => {
      ws.getColumn(i + 1).width = Math.max(10, c.peso);
      ws.getColumn(i + 1).alignment = { vertical: 'top', wrapText: true };
    });
    ws.views = [{ state: 'frozen', ySplit: 5 }];
    if (linhas.length > 0) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + linhas.length, column: sec.colunas.length } };
    if (linhas.length === 0) ws.addRow(['Sem registos para os filtros escolhidos.']);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
