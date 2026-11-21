import { campo as c, obrig as o, MOEDA, REFERENCIA } from './base';

const DATA = o('data', 'Data', 'data', ['Data de emissão', 'Data da factura', 'Data do documento', 'Emitida em', 'Data'], { fallback: 'primeira' });
const ITENS = c('item', 'Itens (descrição | qtd | preço | total)', 'itens', []);
const FIN = [
  c('desconto', 'Descontos', 'valor', ['Desconto total', 'Total de descontos', 'Descontos', 'Desconto']),
  c('subtotal', 'Subtotal', 'valor', ['Subtotal', 'Sub-total', 'Total sem IVA', 'Valor ilíquido', 'Total ilíquido']),
  c('imposto', 'Impostos (IVA)', 'valor', ['Total IVA', 'Total de IVA', 'IVA', 'Imposto']),
  o('total', 'Total', 'valor', ['Total a pagar', 'Total da factura', 'Total da nota', 'Valor total', 'Total geral', 'Total'], { ultimo: true }),
  c('total_extenso', 'Total por extenso', 'texto', ['Total por extenso', 'Valor por extenso', 'Por extenso', 'Extenso']),
  MOEDA,
];
const NUMERO = o('numero', 'Número', 'docnum', ['Factura-recibo n.º', 'Factura-recibo', 'Factura n.º', 'Factura', 'Documento n.º', 'Número do documento', 'N.º do documento']);

export const FACTURAS = {
  id: 'factura', rotulo: 'Facturas', icone: 'FileText', descricao: 'Facturas de venda ou de serviços, com itens, impostos e total.',
  termos: [['factura', 3], ['fatura', 3], ['subtotal', 1], ['iva', 1], ['vencimento', 1.5], ['a pagar', 1], ['nif do cliente', 1]],
  campos: [NUMERO, DATA, c('vencimento', 'Vencimento', 'data', ['Data de vencimento', 'Vencimento', 'Vence em', 'Pagar até']),
    c('fornecedor', 'Fornecedor', 'texto', ['Fornecedor', 'Emitente', 'Vendedor', 'Razão social'], { deduzir: 'empresa' }),
    o('nif_fornecedor', 'NIF do fornecedor', 'nif', ['NIF do fornecedor', 'NIF fornecedor', 'NIF do emitente', 'NIF', 'N.I.F', 'Contribuinte n.º', 'Contribuinte']),
    c('cliente', 'Cliente', 'texto', ['Cliente', 'Exmo(s). Sr(s).', 'Exmo. Sr.', 'Adquirente']),
    c('nif_cliente', 'NIF do cliente', 'nif', ['NIF do cliente', 'NIF cliente', 'Contribuinte do cliente', 'NIF do adquirente']),
    ITENS, ...FIN, REFERENCIA],
  principais: { nif: 'nif_fornecedor', referencia: 'numero', data: 'data' },
  regras: ['aritmetica', 'datas', 'extenso', 'moeda_unica'],
};
export const FACTURA_RECIBO = {
  ...FACTURAS, id: 'factura_recibo', rotulo: 'Facturas-recibo', icone: 'Receipt',
  descricao: 'Factura que já inclui a prova de pagamento.',
  termos: [['factura-recibo', 8], ['factura recibo', 8], ['fatura-recibo', 8], ['recibo', 1.5], ['factura', 1]],
};
export const RECIBOS = {
  id: 'recibo', rotulo: 'Recibos', icone: 'ReceiptText', descricao: 'Comprovativo de pagamento ligado a uma factura.',
  termos: [['recibo', 4], ['recebemos de', 3], ['importancia', 1.5], ['pagamento', 1], ['quitacao', 2]],
  campos: [o('numero', 'Número', 'docnum', ['Recibo n.º', 'Recibo', 'Documento n.º']), DATA,
    c('pagador', 'Pagador', 'texto', ['Pagador', 'Recebemos de', 'Cliente']), c('nif_pagador', 'NIF do pagador', 'nif', ['NIF do pagador', 'NIF do cliente']),
    c('beneficiario', 'Beneficiário', 'texto', ['Beneficiário', 'Emitente', 'Recebedor'], { deduzir: 'empresa' }),
    c('nif_beneficiario', 'NIF do beneficiário', 'nif', ['NIF do beneficiário', 'NIF do emitente', 'NIF', 'Contribuinte']),
    o('valor', 'Valor', 'valor', ['Valor recebido', 'Valor pago', 'Importância', 'Valor'], { ultimo: true }),
    c('total_extenso', 'Valor por extenso', 'texto', ['Valor por extenso', 'Por extenso', 'Extenso']), MOEDA,
    c('metodo_pagamento', 'Método de pagamento', 'texto', ['Método de pagamento', 'Forma de pagamento', 'Meio de pagamento', 'Forma']),
    REFERENCIA, o('factura_associada', 'Factura associada', 'docnum', ['Factura associada', 'Referente à factura', 'Referente a factura', 'Liquidação da factura', 'Factura n.º', 'Factura']),
    c('saldo', 'Saldo em dívida', 'valor', ['Saldo em dívida', 'Saldo', 'Valor em falta'])],
  principais: { nif: 'nif_beneficiario', referencia: 'numero', data: 'data' },
  regras: ['datas', 'extenso', 'moeda_unica', 'correspondencias'],
  ligacoes: [{ campo: 'factura_associada', tipos: ['factura', 'factura_recibo'], relacao: 'pagamento', rotulo: 'factura',
    comparar: [['valor', 'total', 'valor'], ['nif_beneficiario', 'nif_fornecedor', 'nif'], ['nif_pagador', 'nif_cliente', 'nif'], ['moeda', 'moeda', 'texto']] }],
};
const NOTA = (id, rotulo, termos, sinal) => ({
  id, rotulo, icone: sinal < 0 ? 'FileMinus' : 'FilePlus', descricao: sinal < 0 ? 'Corrige uma factura para menos (devolução, desconto).' : 'Corrige uma factura para mais (encargos adicionais).',
  termos, sinal,
  campos: [o('numero', 'Número', 'docnum', ['Nota de crédito n.º', 'Nota de débito n.º', 'Nota de crédito', 'Nota de débito', 'Documento n.º', 'Nota']), DATA,
    c('emitente', 'Emitente', 'texto', ['Emitente', 'Fornecedor'], { deduzir: 'empresa' }), c('nif_emitente', 'NIF do emitente', 'nif', ['NIF do emitente', 'NIF', 'Contribuinte']),
    c('destinatario', 'Destinatário', 'texto', ['Destinatário', 'Cliente', 'Exmo(s). Sr(s).']), c('nif_destinatario', 'NIF do destinatário', 'nif', ['NIF do destinatário', 'NIF do cliente']),
    o('factura_original', 'Factura original', 'docnum', ['Factura de origem', 'Factura original', 'Referente à factura', 'Factura n.º', 'Factura']),
    c('motivo', 'Motivo', 'texto', ['Motivo', 'Motivo da emissão', 'Razão'], { bloco: true }),
    c('valor_original', 'Valor original', 'valor', ['Valor original', 'Valor da factura']), c('valor_corrigido', 'Valor corrigido', 'valor', ['Valor corrigido', 'Valor após correcção']),
    ...FIN.filter((f) => f.chave !== 'desconto'), REFERENCIA],
  principais: { nif: 'nif_emitente', referencia: 'numero', data: 'data' },
  regras: ['aritmetica', 'datas', 'extenso', 'moeda_unica', 'correspondencias'],
  ligacoes: [{ campo: 'factura_original', tipos: ['factura', 'factura_recibo'], relacao: 'nota', rotulo: 'factura original',
    comparar: [['nif_emitente', 'nif_fornecedor', 'nif'], ['nif_destinatario', 'nif_cliente', 'nif'], ['moeda', 'moeda', 'texto']] }],
});
export const NOTA_CREDITO = NOTA('nota_credito', 'Notas de crédito', [['nota de credito', 8], ['credito', 1], ['devolucao', 1]], -1);
export const NOTA_DEBITO = NOTA('nota_debito', 'Notas de débito', [['nota de debito', 8], ['debito', 1]], 1);

const FISCAL_BASE = [
  o('nif_contribuinte', 'NIF do contribuinte', 'nif', ['NIF do contribuinte', 'NIF', 'Contribuinte n.º', 'Contribuinte']),
  c('contribuinte', 'Contribuinte', 'texto', ['Nome do contribuinte', 'Sujeito passivo', 'Nome']),
  o('tipo_imposto', 'Tipo de imposto', 'texto', ['Tipo de imposto', 'Imposto', 'Modelo'], { estrito: true, deduzir: 'imposto' }),
  o('periodo_fiscal', 'Período fiscal', 'texto', ['Período fiscal', 'Período de tributação', 'Período', 'Ano fiscal', 'Exercício']), MOEDA,
];
export const DECLARACAO_FISCAL = {
  id: 'declaracao_fiscal', rotulo: 'Declarações fiscais', icone: 'Landmark', descricao: 'Declarações entregues à administração tributária.',
  termos: [['declaracao', 3], ['administracao geral tributaria', 4], ['agt', 2], ['sujeito passivo', 2], ['materia colectavel', 3], ['imposto apurado', 3]],
  campos: [...FISCAL_BASE, c('valor_base', 'Base tributável', 'valor', ['Matéria colectável', 'Base tributável', 'Base de incidência']),
    c('valor_imposto', 'Imposto apurado', 'valor', ['Imposto apurado', 'Valor do imposto', 'Imposto a pagar', 'Total a pagar', 'Valor a pagar', 'IVA de cenário', 'IVA'], { ultimo: true }),
    c('saldo', 'Saldo', 'valor', ['Saldo de teste', 'Saldo a pagar', 'Saldo'], { ultimo: true }),
    c('data', 'Data', 'data', ['Data de entrega', 'Data de submissão', 'Data de apresentação', 'Data'], { fallback: 'primeira' }), c('referencia', 'N.º da declaração', 'ref', ['N.º da declaração', 'Número de submissão', 'Referência', 'Ref.'])],
  principais: { nif: 'nif_contribuinte', referencia: 'referencia', data: 'data' },
  regras: ['datas', 'moeda_unica'],
  alertas: ['O 3MIND só lê e compara valores; não toma decisões fiscais. Confirme sempre no sistema oficial da AGT.'],
};
export const COMPROVATIVO_IMPOSTO = {
  id: 'comprovativo_imposto', rotulo: 'Comprovativos de pagamento de impostos', icone: 'BadgeCheck', descricao: 'Comprovativo de pagamento de um imposto.',
  termos: [['comprovativo de pagamento', 6], ['comprovativo', 2], ['documento de arrecadacao', 5], ['dar', 1], ['imposto', 1.5], ['referencia de pagamento', 3]],
  campos: [...FISCAL_BASE, o('valor', 'Valor pago', 'valor', ['Valor pago', 'Valor', 'Montante'], { ultimo: true }), DATA,
    o('referencia', 'Referência de pagamento', 'ref', ['Referência de pagamento', 'Documento de cobrança', 'N.º do DAR', 'Referência']),
    c('banco', 'Banco', 'texto', ['Banco', 'Instituição bancária', 'Entidade bancária']),
    c('operacao', 'Identificação da operação', 'ref', ['Identificação da operação', 'N.º da operação', 'ID da operação', 'Transacção'])],
  principais: { nif: 'nif_contribuinte', referencia: 'referencia', data: 'data' },
  regras: ['datas', 'moeda_unica', 'correspondencias'],
  ligacoes: [{ campo: 'referencia', tipos: ['declaracao_fiscal'], relacao: 'igual', rotulo: 'declaração',
    comparar: [['valor', 'valor_imposto', 'valor'], ['nif_contribuinte', 'nif_contribuinte', 'nif'], ['periodo_fiscal', 'periodo_fiscal', 'texto'], ['tipo_imposto', 'tipo_imposto', 'texto']] }],
  alertas: ['Este comprovativo não prova, por si só, que o pagamento foi recebido. O 3MIND não confirma pagamentos sem acesso a uma fonte oficial.'],
};

const ADUANA_VALORES = [
  c('valor_factura', 'Valor da factura / mercadoria', 'valor', ['Valor da factura', 'Valor facturado', 'Valor da mercadoria', 'Valor mercadoria', 'Valor FOB', 'FOB']), c('frete', 'Frete', 'valor', ['Frete', 'Transporte internacional']),
  c('seguro', 'Seguro', 'valor', ['Seguro']), MOEDA,
];
export const DU = {
  id: 'du', rotulo: 'Documentos Únicos (DU)', icone: 'Stamp', descricao: 'Declaração aduaneira de importação ou exportação.',
  termos: [['documento unico', 8], ['documento aduaneiro', 8], ['declaracao de importacao', 8], ['d.u.', 2], ['alfandega', 3], ['valor aduaneiro', 5], ['codigo pautal', 4], ['codigo hs', 3], ['importador', 2], ['direitos aduaneiros', 4]],
  campos: [o('numero', 'N.º do DU / referência', 'ref', ['N.º do DU', 'DU n.º', 'Documento Único n.º', 'Documento Único', 'D.U.', 'Referência', 'Ref.']), DATA,
    o('importador', 'Importador', 'texto', ['Importador', 'Consignatário']), o('nif_importador', 'NIF do importador', 'nif', ['NIF do importador', 'NIF', 'Contribuinte']),
    c('exportador', 'Exportador', 'texto', ['Exportador', 'Expedidor']), c('pais_origem', 'País de origem', 'texto', ['País de origem', 'Origem simulada', 'Origem']),
    c('procedencia', 'Procedência', 'texto', ['País de procedência', 'Procedência']), c('mercadorias', 'Mercadorias', 'texto', ['Descrição das mercadorias', 'Mercadoria', 'Designação comercial'], { multiplo: true, estrito: true }),
    c('codigo_pautal', 'Código pautal', 'ref', ['Código pautal', 'Código HS', 'Posição pautal', 'Pauta', 'NCM'], { multiplo: true }),
    c('quantidade', 'Quantidade', 'numero', ['Quantidade', 'Qtd.']), c('peso_bruto', 'Peso bruto', 'numero', ['Peso bruto']), c('peso_liquido', 'Peso líquido', 'numero', ['Peso líquido']),
    ...ADUANA_VALORES, o('valor_aduaneiro', 'Valor aduaneiro', 'valor', ['Valor aduaneiro', 'Valor em alfândega', 'Valor CIF', 'Total comercial'], { alternativas: ['valor_factura'] }),
    c('direitos', 'Direitos', 'valor', ['Direitos aduaneiros', 'Direitos de importação', 'Direitos']), c('impostos', 'Impostos', 'valor', ['Imposto de consumo', 'Impostos']),
    c('total_a_pagar', 'Total a pagar', 'valor', ['Total a pagar', 'Total das imposições', 'Total de encargos'], { ultimo: true }),
    c('processo', 'Processo', 'ref', ['Processo n.º', 'Processo']), c('ref_factura', 'Factura comercial', 'docnum', ['Factura comercial n.º', 'Factura comercial']), c('ref_packing', 'Packing List', 'ref', ['Packing List n.º', 'Packing List']),
    c('ref_transporte', 'Documento de transporte', 'ref', ['Conhecimento de embarque', 'B/L', 'AWB', 'CMR', 'Documento de transporte'])],
  principais: { nif: 'nif_importador', referencia: 'numero', data: 'data' },
  regras: ['aritmetica_du', 'datas', 'moeda_unica', 'correspondencias'],
  ligacoes: [
    { campo: 'ref_factura', tipos: ['factura_comercial'], relacao: 'igual', rotulo: 'factura comercial', comparar: [['valor_factura', 'total', 'valor'], ['moeda', 'moeda', 'texto'], ['nif_importador', 'nif_importador', 'nif'], ['pais_origem', 'pais_origem', 'texto'], ['frete', 'frete', 'valor'], ['seguro', 'seguro', 'valor']] },
    { campo: 'ref_packing', tipos: ['packing_list'], relacao: 'igual', rotulo: 'Packing List', comparar: [['peso_bruto', 'peso_bruto', 'numero'], ['peso_liquido', 'peso_liquido', 'numero'], ['quantidade', 'quantidade', 'numero']] },
    { campo: 'ref_transporte', tipos: ['transporte'], relacao: 'igual', rotulo: 'documento de transporte', comparar: [['peso_bruto', 'peso_bruto', 'numero']] },
  ],
};
export const FACTURA_COMERCIAL = {
  id: 'factura_comercial', rotulo: 'Facturas comerciais de importação', icone: 'Globe', descricao: 'Commercial invoice do fornecedor estrangeiro.',
  termos: [['factura comercial', 8], ['commercial invoice', 8], ['incoterm', 4], ['fob', 2], ['cif', 2], ['exportador', 2], ['pais de origem', 2]],
  campos: [o('numero', 'Número', 'docnum', ['Factura comercial n.º', 'Commercial Invoice n.º', 'Invoice No', 'Factura n.º', 'Factura']), DATA,
    o('exportador', 'Exportador', 'texto', ['Exportador', 'Exporter', 'Vendedor']), o('importador', 'Importador', 'texto', ['Importador', 'Importer', 'Comprador']),
    c('nif_importador', 'NIF do importador', 'nif', ['NIF do importador', 'NIF']), ITENS, c('quantidade', 'Quantidade', 'numero', ['Quantidade total', 'Quantidade']),
    c('subtotal', 'Subtotal (FOB)', 'valor', ['Valor FOB', 'Subtotal']), c('frete', 'Frete', 'valor', ['Frete', 'Freight']), c('seguro', 'Seguro', 'valor', ['Seguro', 'Insurance']),
    o('total', 'Total', 'valor', ['Total CIF', 'Total a pagar', 'Valor total', 'Total'], { ultimo: true }), MOEDA,
    c('pais_origem', 'País de origem', 'texto', ['País de origem', 'Country of origin', 'Origem']),
    c('condicoes', 'Condições comerciais', 'texto', ['Condições comerciais', 'Condições de venda', 'Incoterm', 'Incoterms'])],
  principais: { nif: 'nif_importador', referencia: 'numero', data: 'data' },
  regras: ['aritmetica', 'datas', 'moeda_unica'],
};

const LOGISTICA = (id, rotulo, icone, descricao, termos, numeroRotulos, extra = []) => ({
  id, rotulo, icone, descricao, termos,
  campos: [o('numero', 'Número', 'ref', numeroRotulos), DATA, c('remetente', 'Remetente', 'texto', ['Remetente', 'Expedidor', 'Shipper']),
    c('nif_remetente', 'NIF do remetente', 'nif', ['NIF do remetente', 'NIF']), o('destinatario', 'Destinatário', 'texto', ['Destinatário', 'Consignatário', 'Consignee']),
    c('nif_destinatario', 'NIF do destinatário', 'nif', ['NIF do destinatário']), c('origem', 'Origem', 'texto', ['Local de origem', 'Origem', 'Porto de embarque']),
    c('destino', 'Destino', 'texto', ['Local de destino', 'Destino', 'Porto de descarga']), c('transportador', 'Transportador', 'texto', ['Transportador', 'Carrier', 'Armador']),
    c('produtos', 'Produtos', 'texto', ['Produtos', 'Mercadoria', 'Descrição'], { multiplo: true }), c('quantidade', 'Quantidade', 'numero', ['Quantidade total', 'Total de unidades', 'Quantidade', 'Qtd.']),
    c('peso_bruto', 'Peso bruto', 'numero', ['Peso bruto', 'Gross weight']), c('peso_liquido', 'Peso líquido', 'numero', ['Peso líquido', 'Net weight']),
    c('volumes', 'Volumes', 'numero', ['Total de volumes', 'N.º de volumes', 'Volumes']), c('dimensoes', 'Dimensões', 'texto', ['Dimensões', 'Medidas']),
    c('ref_factura', 'Factura', 'docnum', ['Factura n.º', 'Factura', 'Ref. factura']), ...extra],
  principais: { nif: 'nif_destinatario', referencia: 'numero', data: 'data' },
  regras: ['datas', 'correspondencias'],
  ligacoes: [{ campo: 'ref_factura', tipos: ['factura', 'factura_comercial', 'factura_recibo'], relacao: 'igual', rotulo: 'factura',
    comparar: [['nif_destinatario', 'nif_cliente', 'nif'], ['quantidade', '@qtd_itens', 'numero']] }],
});
export const TRANSPORTE = LOGISTICA('transporte', 'Documentos de transporte', 'Truck', 'Conhecimento de embarque, CMR, AWB ou guia de transporte.',
  [['conhecimento de embarque', 8], ['bill of lading', 8], ['b/l', 3], ['cmr', 5], ['awb', 5], ['guia de transporte', 5], ['transportador', 2]],
  ['Conhecimento de embarque n.º', 'B/L n.º', 'B/L', 'AWB', 'CMR', 'Guia de transporte n.º', 'Documento n.º']);
export const PACKING_LIST = LOGISTICA('packing_list', 'Packing Lists', 'Package', 'Lista de embalagem com volumes, pesos e dimensões.',
  [['packing list', 10], ['lista de embalagem', 8], ['volumes', 2], ['peso bruto', 2], ['dimensoes', 2]], ['Packing List n.º', 'Packing List', 'Documento n.º']);
export const GUIA_REMESSA = LOGISTICA('guia_remessa', 'Guias de remessa', 'ClipboardList', 'Guia que acompanha a entrega de mercadoria.',
  [['guia de remessa', 10], ['guia de entrega', 6], ['remessa', 2], ['destinatario', 1]], ['Guia de remessa n.º', 'Guia n.º', 'Guia de remessa', 'Documento n.º']);

export const EXTRACTO = {
  id: 'extracto_bancario', rotulo: 'Extractos bancários', icone: 'Landmark', descricao: 'Movimentos e saldos de uma conta bancária.',
  termos: [['extracto', 6], ['extrato', 6], ['saldo inicial', 4], ['saldo final', 4], ['movimentos', 2], ['iban', 3], ['debito', 1], ['credito', 1]],
  campos: [o('titular', 'Titular', 'texto', ['Nome do titular', 'Titular', 'Cliente']), c('nif_titular', 'NIF do titular', 'nif', ['NIF do titular', 'NIF']),
    c('banco', 'Banco', 'texto', ['Banco', 'Instituição'], { estrito: true }), c('iban', 'IBAN / conta', 'ref', ['IBAN', 'NIB', 'N.º da conta', 'Conta n.º', 'Conta']),
    o('periodo', 'Período', 'periodo', ['Período', 'Extracto de', 'Extrato de']),
    c('saldo_inicial', 'Saldo inicial', 'valor', ['Saldo inicial', 'Saldo anterior', 'Saldo transitado']), c('saldo_final', 'Saldo final', 'valor', ['Saldo final', 'Saldo actual', 'Saldo contabilístico'], { ultimo: true }),
    c('total_debitos', 'Total de débitos', 'valor', ['Total de débitos', 'Total débitos']), c('total_creditos', 'Total de créditos', 'valor', ['Total de créditos', 'Total créditos']),
    MOEDA, c('movimento', 'Movimentos (data | descrição | montante | saldo)', 'movimentos', [])],
  principais: { nif: 'nif_titular', referencia: 'iban', data: null },
  regras: ['saldos_extracto', 'moeda_unica', 'correspondencias'],
  ligacoes: [{ modo: 'movimentos', tipos: ['recibo', 'factura', 'factura_recibo'], rotulo: 'recibos e facturas' }],
};

export const CONTRATO = {
  id: 'contrato', rotulo: 'Contratos', icone: 'FileSignature', descricao: 'Contratos entre partes, com prazos, valores e obrigações.',
  termos: [['contrato', 5], ['outorgante', 5], ['clausula', 3], ['partes', 1], ['rescisao', 2], ['vigencia', 3], ['foro', 1.5]],
  campos: [o('titulo', 'Título', 'texto', ['Título', 'Contrato de', 'Contrato']), c('referencia', 'Referência', 'ref', ['Contrato n.º', 'Referência', 'Ref.']),
    o('parte_a', 'Primeira parte', 'texto', ['Primeiro Outorgante', 'Primeira Outorgante', 'Contratante']), c('nif_parte_a', 'NIF da primeira parte', 'nif', ['NIF do primeiro outorgante', 'NIF do contratante']),
    o('parte_b', 'Segunda parte', 'texto', ['Segundo Outorgante', 'Segunda Outorgante', 'Contratado']), c('nif_parte_b', 'NIF da segunda parte', 'nif', ['NIF do segundo outorgante', 'NIF do contratado']),
    o('objecto', 'Objecto', 'texto', ['Objecto', 'Objeto'], { bloco: true }), DATA,
    c('data_inicio', 'Início', 'data', ['Data de início', 'Início de vigência', 'Entra em vigor em']), c('data_fim', 'Fim', 'data', ['Data de fim', 'Data de termo', 'Válido até', 'Termo']),
    c('duracao', 'Duração', 'texto', ['Prazo de vigência', 'Duração', 'Vigência']), c('valor', 'Valor', 'valor', ['Valor do contrato', 'Valor global', 'Preço', 'Valor'], { multiplo: true }), MOEDA,
    c('condicoes_pagamento', 'Condições de pagamento', 'texto', ['Condições de pagamento', 'Forma de pagamento'], { bloco: true }),
    c('obrigacoes', 'Obrigações', 'texto', ['Obrigações das partes', 'Obrigações'], { bloco: true }), c('clausula', 'Cláusulas relevantes', 'clausulas', []),
    c('anexos', 'Anexos', 'texto', ['Anexos', 'Anexo'], { multiplo: true }), c('assinaturas', 'Assinaturas', 'texto', ['Assinaturas', 'Assinado por', 'Assinatura'])],
  principais: { nif: 'nif_parte_a', referencia: 'referencia', data: 'data' },
  regras: ['datas', 'prazos', 'valores_multiplos', 'moeda_unica'],
};

const ADMIN = (id, rotulo, icone, descricao, termos, extra = []) => ({
  id, rotulo, icone, descricao, termos,
  campos: [c('numero', 'Número', 'ref', ['Ofício n.º', 'Requerimento n.º', 'Certidão n.º', 'N.º']), DATA,
    c('remetente', 'Remetente', 'texto', ['Remetente', 'Requerente', 'Emitente']), c('destinatario', 'Destinatário', 'texto', ['Destinatário', 'Exmo. Senhor', 'Exma. Senhora', 'Ao Exmo.']),
    c('referencia', 'Referência', 'ref', ['Vossa referência', 'Nossa referência', 'Referência', 'Ref.']), o('assunto', 'Assunto', 'texto', ['Assunto'], { bloco: true }),
    c('processo', 'Processo', 'ref', ['Processo n.º', 'N.º do processo', 'Processo'], { multiplo: true }),
    c('pedido', 'Pedido', 'texto', ['Vem requerer', 'Vem solicitar', 'Requer', 'Solicita', 'Pedido'], { bloco: true }),
    c('fundamentacao', 'Fundamentação', 'texto', ['Fundamentação', 'Fundamentos', 'Motivo'], { bloco: true }),
    c('anexos', 'Anexos', 'texto', ['Documentos anexos', 'Anexos', 'Anexo'], { multiplo: true }), c('prazo', 'Prazo', 'data', ['Prazo limite', 'Data limite', 'Prazo', 'Até ao dia']),
    c('assinatura', 'Assinatura', 'texto', ['Assinatura', 'Atenciosamente', 'O Requerente', 'O Director']), ...extra],
  principais: { nif: null, referencia: 'numero', data: 'data' },
  regras: ['datas', 'prazos'],
});
export const OFICIO = ADMIN('oficio', 'Ofícios', 'Mail', 'Comunicação oficial entre entidades.', [['oficio', 8], ['exmo', 2], ['assunto', 2], ['vossa referencia', 3], ['atenciosamente', 2]]);
export const REQUERIMENTO = ADMIN('requerimento', 'Requerimentos', 'FilePen', 'Pedido dirigido a uma entidade.', [['requerimento', 8], ['vem requerer', 6], ['requerente', 3], ['solicita', 1.5]]);
export const CERTIDAO = ADMIN('certidao', 'Certidões', 'Award', 'Certidão emitida por uma entidade.', [['certidao', 8], ['certifica', 5], ['certifico', 5], ['conservatoria', 3], ['codigo de verificacao', 3]], [
  c('titular', 'Titular', 'texto', ['Titular', 'Nome']), c('validade', 'Validade', 'data', ['Válida até', 'Válido até', 'Validade']),
  c('codigo_verificacao', 'Código de verificação', 'ref', ['Código de verificação', 'Código de acesso'])]);

// Perfil genérico: extracção e resumo sem regras específicas (usa a extracção por regras antiga).
export const OUTROS = {
  id: 'outros', rotulo: 'Outros documentos', icone: 'File', descricao: 'Qualquer outro documento: extracção geral e resumo, sem regras específicas.',
  termos: [], generico: true,
  campos: [c('nif', 'NIF', 'nif', []), c('nome', 'Nome', 'texto', []), c('data', 'Data', 'data', []), c('valor', 'Valor', 'valor', []), c('referencia', 'Referência', 'ref', []), c('numero_factura', 'N.º de factura', 'ref', [])],
  principais: null, regras: [],
};
