// Testes do motor de análise com documentos fictícios. Correr: node --import ./testes/registar.mjs testes/analise.mjs
import { PERFIS, obterPerfil } from '../src/modules/analise/perfis/index.js';
import { classificar } from '../src/modules/analise/motor/classificar.js';
import { extrairPorPerfil } from '../src/modules/analise/motor/campos.js';
import { avaliarPerfil } from '../src/modules/analise/motor/validar.js';
import { resumir } from '../src/modules/analise/motor/resumir.js';
import { extensoParaNumero } from '../src/modules/analise/motor/texto.js';

let falhas = 0;
const ok = (c, msg) => { if (!c) { falhas += 1; console.log('FALHA:', msg); } };
const valor = (r, k) => r.find((x) => x.campo === k)?.valor;

const FACTURA = `COMERCIAL KIANDA, LDA
NIF: 5417000001
Factura n.º FT KIA2026/45
Data de emissão: 03/11/2026   Vencimento: 03/12/2026
Cliente: Maria da Conceição Bento
NIF do cliente: 001234567LA041
Descrição Qtd Preço Total
Arroz 25kg 2 18.500,00 37.000,00
Subtotal 37.000,00
IVA 14% 5.180,00
Total a pagar: 42.180,00 Kz
Total por extenso: quarenta e dois mil cento e oitenta kwanzas`;

// 1) classificação
const c1 = classificar(FACTURA, PERFIS);
ok(c1.tipo === 'factura', `factura classificada como ${c1.tipo}`);
ok(c1.confianca >= 70, `confiança ${c1.confianca}`);
const c2 = classificar('FACTURA-RECIBO FR 2026/12\nTotal 100,00 Kz', PERFIS);
ok(c2.tipo === 'factura_recibo', `factura-recibo classificada como ${c2.tipo}`);
const c3 = classificar('Texto qualquer sem palavras relevantes', PERFIS);
ok(c3.confianca < 70, 'texto neutro deve ter baixa confiança');

// 2) extracção + validação de factura correcta
const p = obterPerfil('factura');
const r = extrairPorPerfil(p, [FACTURA], [90]);
ok(valor(r, 'numero') === 'FT KIA2026/45', `numero: ${valor(r, 'numero')}`);
ok(valor(r, 'nif_fornecedor') === '5417000001', `nif_fornecedor: ${valor(r, 'nif_fornecedor')}`);
ok(valor(r, 'nif_cliente') === '001234567LA041', `nif_cliente: ${valor(r, 'nif_cliente')}`);
ok(valor(r, 'data') === '2026-11-03', `data: ${valor(r, 'data')}`);
ok(valor(r, 'vencimento') === '2026-12-03', `vencimento: ${valor(r, 'vencimento')}`);
ok(valor(r, 'subtotal') === '37000.00', `subtotal: ${valor(r, 'subtotal')}`);
ok(valor(r, 'imposto') === '5180.00', `imposto: ${valor(r, 'imposto')}`);
ok(valor(r, 'total') === '42180.00', `total: ${valor(r, 'total')}`);
ok(valor(r, 'moeda') === 'AOA', `moeda: ${valor(r, 'moeda')}`);
ok(valor(r, 'item') === 'Arroz 25kg | 2 | 18500.00 | 37000.00', `item: ${valor(r, 'item')}`);
ok(r.every((x) => x.pagina === 1), 'página de origem');
const prob = avaliarPerfil({ perfil: p, dados: r });
ok(!prob.some((x) => x.severidade === 'erro'), `factura correcta sem erros: ${JSON.stringify(prob.filter((x) => x.severidade === 'erro'))}`);
ok(/Factura FT KIA2026\/45/.test(resumir(p, r, [FACTURA])), 'resumo');

// 3) factura com erro aritmético e extenso divergente
const ERRADA = FACTURA.replace('42.180,00', '45.000,00').replace('quarenta e dois mil cento e oitenta', 'quarenta mil');
const r2 = extrairPorPerfil(p, [ERRADA], [90]);
const prob2 = avaliarPerfil({ perfil: p, dados: r2 });
ok(prob2.some((x) => x.tipo === 'aritmetica' && x.campo === 'total'), 'deteta total errado');
ok(prob2.some((x) => x.tipo === 'divergencia' && x.campo === 'total_extenso'), 'deteta extenso divergente');

// 4) NIF inválido e campos em falta
const r3 = extrairPorPerfil(p, ['Factura n.º FT A/1\nNIF: 12345\nTotal: 10,00 Kz'], [90]);
const prob3 = avaliarPerfil({ perfil: p, dados: r3 });
ok(prob3.some((x) => x.tipo === 'campo_vazio'), 'campos obrigatórios em falta');

// 5) extenso
ok(extensoParaNumero('mil duzentos e trinta e quatro kwanzas e cinquenta cêntimos') === 1234.5, 'extenso 1234,50');
ok(extensoParaNumero('dois milhões e quinhentos mil kwanzas') === 2500000, 'extenso 2,5M');
ok(extensoParaNumero('palavra estranha') === null, 'extenso desconhecido');

// 6) extracto bancário
const EXT = `Extracto bancário
Banco Fictício
Titular: João Manuel Silva
Período: 01/10/2026 a 31/10/2026
Saldo inicial: 100.000,00
02/10/2026 Pagamento FT KIA2026/45 42.180,00 57.820,00
05/10/2026 Deposito numerario 20.000,00 77.820,00
06/10/2026 Levantamento ATM 10.000,00 67.820,00
Saldo final: 67.820,00`;
const pe = obterPerfil('extracto_bancario');
const re = extrairPorPerfil(pe, [EXT], [90]);
ok(re.filter((x) => x.campo === 'movimento').length === 3, `movimentos: ${re.filter((x) => x.campo === 'movimento').length}`);
ok(!avaliarPerfil({ perfil: pe, dados: re }).some((x) => x.tipo === 'aritmetica'), 'extracto coerente sem erros aritméticos');
const re2 = extrairPorPerfil(pe, [EXT.replace('77.820,00', '90.000,00')], [90]);
ok(avaliarPerfil({ perfil: pe, dados: re2 }).some((x) => x.tipo === 'aritmetica'), 'extracto com saldo errado');

// 7) recibo ↔ factura (pagamento parcial)
const pr = obterPerfil('recibo');
const rr = extrairPorPerfil(pr, ['Recibo n.º RC 2026/3\nData: 10/11/2026\nNIF do emitente: 5417000001\nNIF do cliente: 001234567LA041\nFactura n.º FT KIA2026/45\nValor recebido: 20.000,00 Kz'], [90]);
const rel = [[{ documento: { nome_ficheiro: 'factura.pdf' }, dados: r }]];
const pp = avaliarPerfil({ perfil: pr, dados: rr, relacionados: rel });
ok(pp.some((x) => /parcial/i.test(x.mensagem)), `pagamento parcial: ${JSON.stringify(pp.map((x) => x.mensagem))}`);

// 8) comprovativo: nunca afirma confirmação
const pc = obterPerfil('comprovativo_imposto');
ok(avaliarPerfil({ perfil: pc, dados: [] }).some((x) => x.tipo === 'alerta' && /não confirma/.test(x.mensagem)), 'aviso de não confirmação');

// 9) factura em modelo brasileiro ("Fatura", R$, preço antes da quantidade, taxa em %)
const BR = `Data Fatura nº 2211
Número do item Descrição Preço Quantidade Valor
ABC-123 Item 1 R$ 2,99 15 R$ 44,85
ABC-134 Item 2 R$ 4,00 20 R$ 80,00
Total de itens: 2 Subtotal R$ 124,85
Alíquota de imposto sobre vendas: 5,0% Imposto sobre vendas R$ 6,24
Desconto de depósito recebido R$ 50,00
Total da fatura R$ 81,09`;
const rb = extrairPorPerfil(obterPerfil('factura'), [BR], [85]);
ok(valor(rb, 'numero') === '2211', `BR numero: ${valor(rb, 'numero')}`);
ok(valor(rb, 'total') === '81.09', `BR total: ${valor(rb, 'total')}`);
ok(valor(rb, 'imposto') === '6.24', `BR imposto: ${valor(rb, 'imposto')}`);
ok(valor(rb, 'moeda') === 'BRL', `BR moeda: ${valor(rb, 'moeda')}`);
ok(rb.filter((x) => x.campo === 'item').length === 2, `BR itens: ${rb.filter((x) => x.campo === 'item').length}`);
ok(!avaliarPerfil({ perfil: obterPerfil('factura'), dados: rb }).some((x) => x.severidade === 'erro'), 'BR sem erros aritméticos');

// 10) PDF "3MIND_testes_documentais_Angola" (8 documentos fictícios, uma página cada)
import fs from 'node:fs';
const pg = (i) => fs.readFileSync(new URL(`./amostras/angola_p${i}.txt`, import.meta.url), 'utf8');
const caso = (i, tipoEsperado, esperados, semAvisos = true) => {
  const t = pg(i);
  const cl = classificar(t, PERFIS.filter((x) => !x.generico));
  ok(cl.tipo === tipoEsperado && cl.confianca >= 55, `pág ${i}: tipo ${cl.tipo} (${cl.confianca}%), esperado ${tipoEsperado}`);
  const perfil = obterPerfil(tipoEsperado);
  const r = extrairPorPerfil(perfil, [t], [98]);
  for (const [k, v] of Object.entries(esperados)) ok(valor(r, k) === v || (/^\d+(\.\d+)?$/.test(v) && Number(valor(r, k)) === Number(v)), `pág ${i}: ${k} = ${valor(r, k)}, esperado ${v}`);
  const prob = avaliarPerfil({ perfil, dados: r }).filter((x) => x.severidade !== 'info');
  if (semAvisos) ok(prob.length === 0, `pág ${i}: sem avisos/erros, mas há: ${prob.map((x) => x.mensagem).join(' || ')}`);
  return r;
};
const r1 = caso(1, 'factura', { numero: 'FT-TEST-2026-001', data: '2026-11-15', nif_fornecedor: '5000000000', nif_cliente: '5410000000', subtotal: '190000.00', imposto: '26600.00', total: '216600.00', moeda: 'AOA' });
ok(r1.filter((x) => x.campo === 'item').length === 3, 'pág 1: 3 itens');
caso(2, 'recibo', { numero: 'RC-TEST-2026-008', valor: '216600.00', factura_associada: 'FT-TEST-2026-001', nif_pagador: '5410000000' });
caso(3, 'nota_credito', { numero: 'NC-TEST-2026-003', factura_original: 'FT-TEST-2026-001', total: '22800.00', imposto: '2800.00', nif_destinatario: '5410000000' });
caso(4, 'du', { numero: 'ADU-TEST-2026-014', nif_importador: '5410000000', peso_bruto: '180', peso_liquido: '156', valor_factura: '4800000.00', frete: '350000.00', seguro: '48000.00', pais_origem: 'Portugal' });
const r5 = caso(5, 'extracto_bancario', { saldo_inicial: '1250000.00', periodo: '2026-11-01 a 2026-11-30', nif_titular: '5410000000' });
ok(r5.filter((x) => x.campo === 'movimento').length === 5, `pág 5: ${r5.filter((x) => x.campo === 'movimento').length} movimentos`);
const r6 = caso(6, 'factura', { numero: 'FS-TEST-2026-112', subtotal: '238000', imposto: '33320', total: '271320', vencimento: '2026-12-10', nif_fornecedor: '5000000123' });
ok(r6.filter((x) => x.campo === 'item').length === 3, 'pág 6: 3 itens');
caso(7, 'declaracao_fiscal', { nif_contribuinte: '5410000000', tipo_imposto: 'IVA', valor_base: '3500000', valor_imposto: '490000', saldo: '440000', periodo_fiscal: 'Outubro de 2026' });
caso(8, 'du', { numero: 'IMP-TEST-2026-031', valor_aduaneiro: '6732500', valor_factura: '6250000', frete: '420000', seguro: '62500', nif_importador: '5410000000' });
// 238.000 é 238 mil, não 238
ok(Number(valor(r6, 'subtotal')) === 238000, 'valores sem decimais com ponto de milhares');

// 11) pesquisa: acentos, números com pontos, todas as palavras primeiro, sugestões
import { pesquisar, marcarTermos } from '../src/modules/analise/motor/pesquisa.js';
const ps = pesquisar(FACTURA, 'emissao');
ok(ps.exactos.length === 1 && ps.exactos[0].linha.startsWith('Data de emissão'), 'pesquisa ignora acentos');
ok(pesquisar(FACTURA, '42180').exactos.length >= 1, 'pesquisa 42180 encontra 42.180,00');
const pm = pesquisar(FACTURA, 'total pagar');
ok(pm.exactos.length === 1 && pm.parciais.length >= 1, 'linhas com todas as palavras primeiro, parciais depois');
ok(pesquisar(FACTURA, 'vencimeto').sugestoes.includes('Vencimento'), 'sugere palavra parecida');
ok(marcarTermos('Total a pagar: 42.180,00 Kz', ['42180']).some((x) => x.marcado && x.texto === '42.180,00'), 'marca o número encontrado');

// 12) comparação: tolerância em montantes e documentos sem valor
import { estadoDaLinha } from '../src/modules/comparacao/comparar.js';
ok(estadoDaLinha([[{ norma: '100.00' }], [{ norma: '100.01' }]], 'valor') === 'igual', '1 cêntimo de diferença é igual');
ok(estadoDaLinha([[{ norma: '100.00' }], [{ norma: '101.00' }]], 'valor') === 'difere', '1 Kz de diferença difere');
ok(estadoDaLinha([[{ norma: 'X' }], []], 'texto') === 'falta', 'valor ausente num documento = falta');

// 13) extracção: NIF e total sem rótulo reconhecido
const semRotulo = 'EMPRESA TESTE, LDA\nN.I.F 5417000001\nFactura n.º FT 1/2026\nData: 01/11/2026\nValor global a liquidar 9.999,00 Kz';
const rs = extrairPorPerfil(obterPerfil('factura'), [semRotulo], [90]);
ok(valor(rs, 'nif_fornecedor') === '5417000001', `nif de segurança: ${valor(rs, 'nif_fornecedor')}`);
ok(Number(valor(rs, 'total')) === 9999, `total de segurança: ${valor(rs, 'total')}`);

// 14) resumo aponta o que falta
const rFalta = resumir(obterPerfil('factura'), [{ campo: 'numero', valor: 'FT 1', confianca: 90 }], [semRotulo]);
ok(/Não foi possível ler: .*Total/.test(rFalta), `resumo indica campos em falta: ${rFalta}`);

console.log(falhas ? `${falhas} falhas` : 'tudo ok');
process.exit(falhas ? 1 : 0);
