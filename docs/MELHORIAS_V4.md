# 3MIND v4 · melhorias na análise

## Princípio: primeiro o que foi pedido, depois as outras opções
- O tipo e a análise escolhidos são sempre aplicados primeiro. Se o conteúdo parecer outro tipo, aparece "Analisado como X" com botões "Manter X" e "Analisar como Y (n %)".
- Com tipo automático e pouca confiança, a análise **já não pára**: corre com o tipo mais provável e mostra as alternativas para confirmar.
- O separador que abre primeiro segue a análise pedida: Pesquisa → Texto original; Extracção → Dados; Validação → Validações; Resumo/Completa/Comparação → Resultado.

## Extracção de dados
- Rede de segurança para campos obrigatórios sem rótulo reconhecido: NIF (linha com NIF/contribuinte) e valor/total (maior montante numa linha de total), com confiança baixa (−25).

## Resumo
- Acrescenta pontos de atenção: campos obrigatórios não lidos, valores com pouca confiança e ficheiros que juntam vários documentos.

## Pesquisa de informação (`motor/pesquisa.js`)
- Ignora acentos e maiúsculas; várias palavras; "frases entre aspas"; números com ou sem separadores (1500 = 1.500,00).
- Mostra primeiro as linhas com todas as palavras; depois "Outras opções" com resultados parciais; "Talvez quisesse dizer" para erros de escrita/OCR.
- Cada resultado leva à página do PDF.

## Comparação (`comparacao/comparar.js`)
- Montantes com tolerância (2 cêntimos ou 0,05 %); estado "Falta num documento" separado de "Difere".
- Filtro "Mostrar só diferenças" e exportação CSV da tabela.

## Verificado
- `node --import ./testes/registar.mjs testes/analise.mjs` e `node testes/correr.mjs`: passam (com 13 testes novos).
- `npm install && vite build`: compila.
- NÃO verificado no navegador com Supabase real (sem as chaves do projecto).
