// Testes do cálculo dos relatórios. Correr: node --import ./testes/registar.mjs testes/relatorios.mjs
import { construirRelatorio, origemDoValor } from '../src/modules/relatorios/construir.js';

let falhas = 0;
const ok = (c, msg) => { if (!c) { falhas += 1; console.log('FALHA:', msg); } };
const stat = (r, indicador) => r.seccoes.estatisticas.find((l) => l.indicador.startsWith(indicador))?.valor;

const campo = (campo, valor, extra = {}) => ({ campo, valor, valor_original: valor, confianca: 90, corrigido_manual: false, pagina: 1, ...extra });
const val = (severidade, extra = {}) => ({ tipo: 'campo_vazio', campo: 'nif', mensagem: `m-${Math.random()}`, severidade, resolvida: false, resolvida_manual: false, criado_em: '2026-11-10T10:00:00Z', ...extra });

const docs = [
  // A: processado, tudo limpo
  { id: 'A', nome_ficheiro: 'a.pdf', estado: 'processado', tipo_documento: 'factura', paginas: 2, criado_em: '2026-11-10T09:00:00Z', categorias: { nome: 'Facturas' },
    dados_extraidos: [campo('nif', '5417000001', { confianca: 80 }), campo('valor', '100.00', { confianca: 100 })], validacoes: [], fila_processamento: [] },
  // B: para revisão: 1 erro aberto, 1 aviso aberto, 1 resolvida por pessoa, 1 resolvida sozinha, 1 info; campos corrigido / acrescentado / descartado
  { id: 'B', nome_ficheiro: 'b.pdf', estado: 'revisao', tipo_documento: 'recibo', paginas: 3, criado_em: '2026-11-11T09:00:00Z', categorias: null,
    dados_extraidos: [
      campo('nif', '999', { corrigido_manual: true, valor: '5417000002', valor_original: '999', confianca: 10 }), // corrigido: a confiança 10 NÃO conta
      campo('data', '2026-11-01', { confianca: 60 }),
      campo('nome', '', { corrigido_manual: true, valor: '', valor_original: 'Lixo', confianca: 5 }),                 // descartado
      campo('valor', '50.00', { corrigido_manual: true, valor_original: null, confianca: null }),                        // acrescentado
    ],
    validacoes: [val('erro'), val('aviso'), val('aviso', { resolvida: true, resolvida_manual: true }), val('aviso', { resolvida: true, resolvida_manual: false }), val('info')],
    fila_processamento: [] },
  // C: com erro; falhou duas vezes (só a mais recente está "por resolver")
  { id: 'C', nome_ficheiro: 'c.png', estado: 'erro', tipo_documento: null, paginas: null, criado_em: '2026-11-12T09:00:00Z', categorias: { nome: 'Facturas' },
    dados_extraidos: [], validacoes: [],
    fila_processamento: [
      { estado: 'falhou', erro_mensagem: 'antiga', criado_em: '2026-11-12T09:01:00Z' },
      { estado: 'falhou', erro_mensagem: 'recente', criado_em: '2026-11-12T09:05:00Z' },
    ] },
  // D: já processado depois de uma falha antiga
  { id: 'D', nome_ficheiro: 'd.pdf', estado: 'processado', tipo_documento: 'factura', paginas: 1, criado_em: '2026-11-13T09:00:00Z', categorias: { nome: 'Facturas' },
    dados_extraidos: [], validacoes: [],
    fila_processamento: [{ estado: 'falhou', erro_mensagem: 'rede', criado_em: '2026-11-13T09:01:00Z' }] },
  // E: ainda na fila
  { id: 'E', nome_ficheiro: 'e.pdf', estado: 'pendente', tipo_documento: 'auto', paginas: null, criado_em: '2026-11-14T09:00:00Z', categorias: null, dados_extraidos: [], validacoes: [], fila_processamento: [] },
];

const r = construirRelatorio(docs);

// origem do valor
ok(origemDoValor(docs[1].dados_extraidos[0]) === 'corrigido', 'origem corrigido');
ok(origemDoValor(docs[1].dados_extraidos[2]) === 'descartado', 'origem descartado');
ok(origemDoValor(docs[1].dados_extraidos[3]) === 'acrescentado', 'origem acrescentado');
ok(origemDoValor(docs[0].dados_extraidos[0]) === 'ocr', 'origem ocr');

// resumo
ok(r.resumo.total === 5, `total ${r.resumo.total}`);
ok(r.resumo.lidos === 3, `lidos (processado+revisão) = ${r.resumo.lidos}, esperado 3`);
ok(r.resumo.paginas === 2 + 3 + 1, `páginas ${r.resumo.paginas}, esperado 6 (só lidos)`);
ok(stat(r, 'Taxa de leitura') === 60, `taxa de leitura ${stat(r, 'Taxa de leitura')}, esperado 60`);
ok(r.resumo.errosAbertos === 2, `erros por resolver ${r.resumo.errosAbertos}, esperado 2 (1 validação + 1 falha do doc C)`);
ok(r.resumo.avisosAbertos === 1, `avisos por resolver ${r.resumo.avisosAbertos}, esperado 1`);
ok(r.resumo.paraRevisao === 1, `para revisão ${r.resumo.paraRevisao}`);
ok(stat(r, 'Resolvidas por uma pessoa') === 1, 'resolvidas por pessoa');
ok(stat(r, 'Deixaram de se verificar') === 1, 'deixaram de se verificar');

// extracção
ok(stat(r, 'Campos lidos pelo OCR') === 5, `campos lidos pelo OCR ${stat(r, 'Campos lidos pelo OCR')}, esperado 5 (2 + corrigido + descartado + data)`);
ok(stat(r, 'Mantidos como o OCR leu') === 3, 'mantidos como lidos');
ok(stat(r, 'Corrigidos à mão') === 1, 'corrigidos');
ok(stat(r, 'Descartados à mão') === 1, 'descartados');
ok(stat(r, 'Acrescentados à mão') === 1, 'acrescentados');
// confiança média só dos mantidos: (80 + 100 + 60) / 3 = 80
ok(stat(r, 'Confiança média') === 80, `confiança média ${stat(r, 'Confiança média')}, esperado 80`);
const linhaCorrigida = r.seccoes.dados.find((l) => l.valor === '5417000002');
ok(linhaCorrigida.confianca === null && linhaCorrigida.corrigido === 'Corrigido à mão', 'valor corrigido não leva confiança do OCR');

// secção de erros: 2 por resolver validações? (erro B, aviso B) + 2 resolvidas + falhas
const e = r.seccoes.erros;
ok(e.filter((x) => x.situacao === 'Por resolver').length === 2, 'por resolver na secção');
ok(e.filter((x) => x.situacao === 'Resolvida por uma pessoa').length === 1, 'situação "por uma pessoa"');
ok(e.filter((x) => x.situacao === 'Já não se verifica').length === 1, 'situação "já não se verifica"');
ok(e.filter((x) => x.situacao === 'Documento ainda com erro').length === 1, 'só a falha mais recente do doc C está aberta');
ok(e.filter((x) => x.situacao === 'Tentativa anterior (já repetida)').length === 1, 'falha antiga repetida');
ok(e.filter((x) => x.situacao === 'Documento já não está em erro').length === 1, 'falha do doc D');
ok(e.every((x) => x.severidade !== 'Informação'), 'informações não entram em erros e avisos');
ok(e[0].situacao !== 'Resolvida por uma pessoa', 'por resolver vêm primeiro');

// vazios não viram zero
const r0 = construirRelatorio([docs[3]]);
ok(stat(r0, 'Confiança média') === '', 'sem campos lidos não há confiança média (não é 0%)');

// relatório incompleto
const rp = construirRelatorio(docs, { total: 8, parcial: true });
ok(rp.meta.truncado === true && rp.meta.incluidos === 5 && rp.meta.total === 8, 'meta de relatório incompleto');
ok(stat(rp, 'ATENÇÃO') === 3, 'linha de atenção com o que falta');
ok(stat(rp, 'Documentos nestes filtros') === 8, 'total nos filtros');

console.log(falhas ? `${falhas} falhas` : 'tudo ok');
process.exit(falhas ? 1 : 0);
