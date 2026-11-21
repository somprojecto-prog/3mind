# Relatórios · o que cada número significa

O cálculo está em `src/modules/relatorios/construir.js` (função pura) e é testado por `testes/relatorios.mjs`.

## Âmbito
- **Período** = data de **envio** do documento ao 3MIND (`criado_em`), não a data escrita no documento.
- O operador só vê os seus documentos (RLS). Supervisor, auditor e admin vêem todos.
- Máximo de 5000 documentos por relatório (os mais recentes). Se faltar algum, o ecrã, o PDF e o XLSX avisam e o ficheiro leva `-incompleto` no nome.

## Indicadores
- **Lidos** = estados *Processado* + *Para revisão* (a leitura terminou). **Taxa de leitura** = lidos ÷ documentos incluídos (inclui os ainda pendentes ou em curso).
- **Erros por resolver** = validações de severidade *erro* não resolvidas + documentos ainda em estado *Com erro* (só a falha mais recente de cada um).
- **Avisos por resolver** = validações de severidade *aviso* não resolvidas. Informações contam à parte.
- **Resolvida por uma pessoa** vs **Já não se verifica** (a regra deixou de se aplicar depois de corrigir os dados): são coisas diferentes e aparecem separadas.
- **Origem do valor** de cada campo: *Lido pelo OCR*, *Corrigido à mão*, *Acrescentado à mão* ou *Descartado à mão*.
- **Confiança do OCR**: só existe para campos mantidos como o OCR leu. Nunca se atribui a valores corrigidos ou acrescentados por uma pessoa. Sem campos lidos, fica em branco (não 0 %).
- **Para revisão** = documentos em estado *Para revisão* (a mesma contagem de "Por estado").
