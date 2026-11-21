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

console.log(falhas ? `${falhas} falhas` : 'tudo ok');
process.exit(falhas ? 1 : 0);
