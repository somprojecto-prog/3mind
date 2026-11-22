import { formatarMontante } from './texto';

const dataPT = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : iso);

/** Resumo automático, escrito por regras a partir dos campos lidos (não inventa nada que não esteja nos dados). */
export function resumir(perfil, dados, paginas = [], { multiplo } = {}) {
  const act = dados.filter((d) => !(d.corrigido_manual && !String(d.valor ?? '').trim()) && String(d.valor ?? '').trim());
  const v = (k) => act.find((d) => d.campo === k)?.valor;
  const m = (k) => (v(k) ? formatarMontante(v(k), v('moeda')) : null);
  const junta = (...p) => p.filter(Boolean).join(' ');
  const n = perfil.rotulo.replace(/s$/, '').toLowerCase();
  const frases = [];
  switch (perfil.id) {
    case 'factura': case 'factura_recibo':
      frases.push(junta(`${perfil.id === 'factura' ? 'Factura' : 'Factura-recibo'}`, v('numero'), v('data') && `emitida em ${dataPT(v('data'))}`, v('fornecedor') && `por ${v('fornecedor')}`, v('nif_fornecedor') && `(NIF ${v('nif_fornecedor')})`, v('cliente') && `para ${v('cliente')}`, m('total') && `, no total de ${m('total')}`) + '.');
      if (v('vencimento')) frases.push(`Vence em ${dataPT(v('vencimento'))}.`);
      { const k = act.filter((d) => d.campo === 'item').length; if (k) frases.push(`Contém ${k} linha(s) de itens.`); }
      break;
    case 'recibo': frases.push(junta('Recibo', v('numero'), v('data') && `de ${dataPT(v('data'))}`, v('pagador') && `pago por ${v('pagador')}`, v('beneficiario') && `a ${v('beneficiario')}`, m('valor') && `no valor de ${m('valor')}`) + '.');
      if (v('factura_associada')) frases.push(`Refere-se à factura ${v('factura_associada')}.`); break;
    case 'nota_credito': case 'nota_debito': frases.push(junta(perfil.id === 'nota_credito' ? 'Nota de crédito' : 'Nota de débito', v('numero'), v('data') && `de ${dataPT(v('data'))}`, v('factura_original') && `sobre a factura ${v('factura_original')}`, m('total') && `, no valor de ${m('total')}`) + '.');
      if (v('motivo')) frases.push(`Motivo indicado: ${v('motivo')}.`); break;
    case 'du': frases.push(junta('Documento Único', v('numero'), v('data') && `de ${dataPT(v('data'))}`, v('importador') && `do importador ${v('importador')}`, v('pais_origem') && `com origem em ${v('pais_origem')}`) + '.');
      if (m('valor_aduaneiro')) frases.push(`Valor aduaneiro: ${m('valor_aduaneiro')}.`); break;
    case 'extracto_bancario': { const k = act.filter((d) => d.campo === 'movimento').length;
      frases.push(junta('Extracto', v('banco') && `do ${v('banco')}`, v('titular') && `de ${v('titular')}`, v('periodo') && `(${v('periodo')})`) + `. ${k} movimento(s) lido(s).`);
      if (v('saldo_inicial') || v('saldo_final')) frases.push(`Saldo inicial ${m('saldo_inicial') ?? '—'}; saldo final ${m('saldo_final') ?? '—'}.`); break; }
    case 'contrato': frases.push(junta('Contrato', v('titulo') && `"${v('titulo')}"`, v('parte_a') && `entre ${v('parte_a')}`, v('parte_b') && `e ${v('parte_b')}`) + '.');
      if (v('objecto')) frases.push(`Objecto: ${v('objecto')}.`);
      if (v('data_inicio') || v('data_fim')) frases.push(`Vigência: ${dataPT(v('data_inicio')) ?? '—'} a ${dataPT(v('data_fim')) ?? '—'}.`);
      if (m('valor')) frases.push(`Valor: ${m('valor')}.`);
      { const k = act.filter((d) => d.campo === 'clausula').length; if (k) frases.push(`${k} cláusula(s) relevante(s) assinalada(s).`); } break;
    case 'declaracao_fiscal': case 'comprovativo_imposto':
      frases.push(junta(perfil.id === 'declaracao_fiscal' ? 'Declaração' : 'Comprovativo de pagamento', v('tipo_imposto') && `de ${v('tipo_imposto')}`, v('periodo_fiscal') && `(período ${v('periodo_fiscal')})`, v('contribuinte') && `do contribuinte ${v('contribuinte')}`, v('nif_contribuinte') && `NIF ${v('nif_contribuinte')}`, (m('valor') || m('valor_imposto')) && `, valor ${m('valor') || m('valor_imposto')}`) + '.'); break;
    default:
      if (['oficio', 'requerimento', 'certidao'].includes(perfil.id)) {
        frases.push(junta(perfil.rotulo.replace(/s$/, '').replace('Ofício', 'Ofício'), v('numero'), v('data') && `de ${dataPT(v('data'))}`, v('remetente') && `de ${v('remetente')}`, v('destinatario') && `para ${v('destinatario')}`) + '.');
        if (v('assunto')) frases.push(`Assunto: ${v('assunto')}.`);
        if (v('pedido')) frases.push(`Pedido: ${v('pedido')}.`);
        if (v('prazo')) frases.push(`Prazo: ${dataPT(v('prazo'))}.`);
      } else if (['transporte', 'packing_list', 'guia_remessa', 'factura_comercial'].includes(perfil.id)) {
        frases.push(junta(perfil.rotulo.replace(/s$/, ''), v('numero'), v('data') && `de ${dataPT(v('data'))}`, (v('remetente') || v('exportador')) && `de ${v('remetente') || v('exportador')}`, (v('destinatario') || v('importador')) && `para ${v('destinatario') || v('importador')}`) + '.');
        if (v('peso_bruto')) frases.push(`Peso bruto: ${v('peso_bruto')}.`);
        if (m('total')) frases.push(`Total: ${m('total')}.`);
      } else {
        const linhas = (paginas[0] || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 3).slice(0, 3);
        frases.push(`Documento sem perfil específico (${paginas.length || 1} página(s)). Primeiras linhas: ${linhas.join(' / ') || 'sem texto legível'}.`);
        const dd = act.map((d) => `${d.campo}: ${d.valor}`).slice(0, 6);
        if (dd.length) frases.push(`Dados lidos: ${dd.join('; ')}.`);
      }
  }
  void n;
  // Pontos de atenção: o que o tipo exige e não foi lido, e ficheiros que juntam vários documentos.
  const faltam = (perfil.campos || []).filter((c) => c.obrigatorio && !v(c.chave) && !(c.alternativas || []).some((a) => v(a))).map((c) => c.rotulo);
  if (faltam.length) frases.push(`Não foi possível ler: ${faltam.join(', ')}.`);
  const baixa = act.filter((d) => Number(d.confianca) < 60 && !['item', 'movimento', 'clausula'].includes(d.campo)).length;
  if (baixa) frases.push(`${baixa} valor(es) lido(s) com pouca confiança; confirme-os.`);
  if (multiplo?.length > 1) frases.push(`O ficheiro parece juntar ${new Set(multiplo.map((m) => m.tipo)).size} tipos de documento em ${multiplo.length} página(s).`);
  return frases.filter(Boolean).join(' ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
}
