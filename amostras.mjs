// Facturas fictícias (nomes, NIF e números inventados).
export default [
 { nome:'digital simples', texto:`COMERCIAL KIANDA, LDA
NIF: 5417000001
Rua Fictícia n.º 12, Luanda
Factura n.º FT KIA2026/45
Data de emissão: 03/11/2026
Cliente: Maria da Conceição Bento
NIF do cliente: 001234567LA041
Descrição Qtd Preço Total
Arroz 25kg 2 18.500,00 37.000,00
Subtotal 37.000,00
IVA 14% 5.180,00
Total a pagar: 42.180,00 Kz`,
  esperado:{ nif:['5417000001','001234567LA041'], numero_factura:'FT KIA2026/45', data:'2026-11-03', valor:'42180.00', nome:'Maria da Conceição Bento' } },
 { nome:'kz antes do valor, espaço como milhar', texto:`Distribuidora Ngola Mar, S.A.
Contribuinte n.º 5000999888
FACTURA-RECIBO FR 2026/0012
Luanda, 15-10-2026
Exmo(s). Sr(s).: Panificadora Mussulo Lda
TOTAL Kz 1 250 000,00`,
  esperado:{ nif:['5000999888'], numero_factura:'FR 2026/0012', data:'2026-10-15', valor:'1250000.00', nome:'Panificadora Mussulo Lda' } },
 { nome:'AOA e data por extenso', texto:`Mercearia Kilamba Prestígio
N.I.F. 5401112223
Factura FT M01/2026/7
Data: 7 de Março de 2026
Adquirente: João Manuel Tchipa
Valor total: AOA 9.999,50`,
  esperado:{ nif:['5401112223'], numero_factura:'FT M01/2026/7', data:'2026-03-07', valor:'9999.50', nome:'João Manuel Tchipa' } },
 { nome:'digitalização com ruído OCR', texto:`FACTURA N° FT 3M2026/118
NlF: 5419 876 543
Data 21.09.2026
Cliente : Oficina Auto Bengo, Lda.
Total ...... 315.400,00 Kz`,
  esperado:{ nif:['5419876543'], numero_factura:'FT 3M2026/118', data:'2026-09-21', valor:'315400.00', nome:'Oficina Auto Bengo, Lda' } },
 { nome:'nota de crédito', texto:`Nota de Crédito NC NC2026/3
Referente à Factura FT NC2026/101
Fornecedor: Gráfica Lubango Unida Lda
NIF 5412223334
Data 2026-08-30
Total: -12.000,00`,
  esperado:{ nif:['5412223334'], numero_factura:'NC NC2026/3', data:'2026-08-30', valor:'12000.00', nome:'Gráfica Lubango Unida Lda' } },
];
