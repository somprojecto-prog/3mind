# Análise adaptativa · o que está feito e o que falta

## Feito (testado só com Node; ver abaixo)
- Migração `004_analise_adaptativa.sql` (já aplicada no Supabase `oxncuwnaichddurcewxu`, versão 20261121000710; copiada para o repo).
- `src/modules/analise/`: 18 perfis (facturas, factura-recibo, recibos, notas de crédito/débito, declarações fiscais, comprovativos, DU, factura comercial, transporte, packing list, extracto, contrato, guia de remessa, ofício, requerimento, certidão, outros), classificação por palavras-chave com confiança, extracção por perfil com página de origem, validação por perfil (NIF, datas, aritmética, itens, extenso, moeda, saldos de extracto, prazos, correspondência recibo↔factura, nota↔original, DU↔factura/packing/transporte, duplicados), resumo por regras.
- Fluxo: Upload em 3 passos (tipo → análise → ficheiros) → fila (OCR) → `gravarLeitura` + `analisarDocumento` → validação. Tipo automático com confiança < 70 % pára e pede confirmação no detalhe.
- Detalhe: separadores Resultado, Dados (com página clicável), Texto original (pesquisa e destaque), tipo/análise no cabeçalho, confirmação de tipo. Lista com coluna e filtro de tipo. Comparação com campos de todos os perfis e `?docs=`. Relatórios com colunas Tipo e Pág.
- Testes: `node --import ./testes/registar.mjs testes/analise.mjs` (passa) e `node testes/correr.mjs` (passa).

## NÃO verificado
- Nunca corri `npm install`/`vite build` nem abri a app no navegador (sem rede). Só verifiquei a sintaxe JSX com `tsc` e o motor com Node. Primeiro passo: `npm install && npm run build` e corrigir o que aparecer.
- Nenhum teste com OCR real nem com PDFs reais; os textos de teste são fictícios e limpos. Os rótulos dos perfis (ex.: "Valor aduaneiro", "Primeiro Outorgante") são suposições a validar com documentos angolanos reais.
- RLS: `limpar_analise` e as colunas novas não foram testadas com cada papel (operador/supervisor/auditor).

## Falta fazer
1. Clicar num campo e "localizar a origem" a sério: hoje salta para a página (PDF `#page=N`) e destaca o valor no texto; não há caixa a marcar a posição na imagem (guardar coordenadas das palavras do Tesseract).
2. Comparação: o módulo usa os campos comuns, mas não tem ainda comparação "por tipo" com tolerâncias nem exportação da tabela de diferenças.
3. Relatórios: falta relatório específico por tipo (secções próprias, ex.: itens da factura, movimentos do extracto) e secção "Resumo por documento"; só foram acrescentadas as colunas Tipo e Pág. Os PDF/XLSX/CSV não incluem ainda texto original nem ligação ao documento.
4. Histórico como módulo próprio: hoje usa `auditoria` (acções `seleccionar_tipo_documento`, `classificar_documento`, `analisar_documento`); não há tabela de análises versionadas.
5. Perfis: itens/movimentos só reconhecem linhas "descrição qtd preço total" e "data descrição montante saldo" numa linha; tabelas multilinha, colunas débito/crédito separadas e várias moedas por linha não estão tratadas. Declarações fiscais e certidões têm campos escolhidos por mim (não estavam no pedido).
6. Correspondência extracto↔recibos/facturas é só por valor ou número na descrição.
7. Perfis personalizados/administração: acrescentar tipo exige código (`perfis/definicoes.js`); não há ecrã de admin.
8. Actualizar `docs/CONTRATO_TECNICO.md` (novas colunas, estados, campos por perfil, `src/modules/analise` como pasta nova com dono a definir).
9. Revisão de acessibilidade/responsivo dos cartões (`documentos.css`, classes `.an-*`) e testes de interface.
10. Ficheiros soltos na raiz do zip (`index (1).jsx`, `servico (4).js`, etc.) são cópias duplicadas; não foram tocados nem limpos.

## Notas
- A classificação é por palavras-chave; não é IA generativa. O resumo é escrito por regras.
- O 3MIND não confirma pagamentos nem toma decisões fiscais/jurídicas (alerta fixo nos comprovativos e declarações).
