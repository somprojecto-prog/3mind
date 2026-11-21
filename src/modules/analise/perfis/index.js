import * as D from './definicoes';

// Ordem = ordem dos cartões no ecrã. Para acrescentar um tipo: criar o perfil em definicoes.js e listá-lo aqui.
export const PERFIS = [
  D.FACTURAS, D.FACTURA_RECIBO, D.RECIBOS, D.NOTA_CREDITO, D.NOTA_DEBITO, D.DECLARACAO_FISCAL, D.COMPROVATIVO_IMPOSTO, D.DU,
  D.FACTURA_COMERCIAL, D.TRANSPORTE, D.PACKING_LIST, D.EXTRACTO, D.CONTRATO, D.GUIA_REMESSA, D.OFICIO, D.REQUERIMENTO, D.CERTIDAO, D.OUTROS,
];
export const AUTO = 'auto';
const POR_ID = new Map(PERFIS.map((p) => [p.id, p]));
export const obterPerfil = (id) => POR_ID.get(id) || D.OUTROS;
export const rotuloTipo = (id) => (id === AUTO ? 'A identificar' : POR_ID.get(id)?.rotulo || id || '—');

// Rótulos legados (extracção antiga) + campos de todos os perfis.
const LEGADO = { nif: 'NIF', nome: 'Nome', data: 'Data', valor: 'Valor', referencia: 'Referência', numero_factura: 'N.º de factura' };
const CAMPOS = new Map();
for (const p of PERFIS) for (const c of p.campos) if (!CAMPOS.has(c.chave)) CAMPOS.set(c.chave, c);
export const rotuloCampo = (chave) => LEGADO[chave] || CAMPOS.get(chave)?.rotulo || chave;
export const tipoCampo = (chave) => CAMPOS.get(chave)?.tipo || 'texto';

export const ANALISES = [
  { id: 'extraccao', rotulo: 'Extracção de dados', icone: 'ScanText', descricao: 'Lê e organiza os campos do documento.', etapas: { extrair: true, validar: false, resumir: false } },
  { id: 'validacao', rotulo: 'Verificação e validação', icone: 'ShieldCheck', descricao: 'Extrai e aplica as regras do tipo de documento.', etapas: { extrair: true, validar: true, resumir: false } },
  { id: 'comparacao', rotulo: 'Comparação de documentos', icone: 'GitCompare', descricao: 'Extrai e prepara a comparação com outros documentos.', etapas: { extrair: true, validar: false, resumir: false, comparar: true } },
  { id: 'resumo', rotulo: 'Resumo inteligente', icone: 'FileText', descricao: 'Resumo automático por regras, com os dados principais.', etapas: { extrair: true, validar: false, resumir: true } },
  { id: 'pesquisa', rotulo: 'Pesquisa de informações', icone: 'Search', descricao: 'Extrai e deixa o texto pronto para pesquisar.', etapas: { extrair: true, validar: false, resumir: false, pesquisar: true } },
  { id: 'completa', rotulo: 'Análise completa', icone: 'Layers', descricao: 'Executa todas as verificações aplicáveis ao tipo escolhido.', etapas: { extrair: true, validar: true, resumir: true, comparar: true, pesquisar: true } },
];
export const obterAnalise = (id) => ANALISES.find((a) => a.id === id) || ANALISES[ANALISES.length - 1];
