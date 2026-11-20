# Entrega da IA 3 · Painel, Relatórios e Notificações

## Pastas alteradas (só estas)
- `src/modules/dashboard`
- `src/modules/relatorios`
- `src/shared/notificacoes`

`modulos.jsx` não precisou de alterações (as linhas do Painel e dos Relatórios já apontam para os `index.jsx`).

## Dependências novas (instalar)
```
npm install exceljs jspdf jspdf-autotable
```
Só são carregadas quando o utilizador exporta (importação dinâmica), por isso o painel não fica mais pesado. Os gráficos são SVG/CSS próprios, sem biblioteca.

## O que foi feito
- **Painel**: totais (recebidos, processados, pendentes, com erros, para revisão, páginas analisadas), desempenho (concluídos, taxa de sucesso, tempo médio), gráfico diário recebidos/concluídos (7, 14 ou 30 dias), distribuição por estado, categorias, trabalhos em curso com barras de progresso e actividade recente.
- **Tempo real**: canal Realtime em `fila_processamento` e `documentos`. O progresso de um trabalho visível actualiza de imediato; outras alterações recarregam os dados (agrupadas em 1,5 s). Se o Realtime não ligar, consulta de 30 em 30 s e o ecrã diz isso.
- **Relatórios**: filtros (período, estado, categoria), pré-visualização, exportação XLSX (4 folhas), PDF (A4 horizontal) e CSV (secção seleccionada, `;` e UTF-8 com BOM). Cada exportação fica em `relatorios` e na auditoria (`exportar_relatorio`). Página "Histórico" com opção de reutilizar os filtros.
- **Notificações**: `aviso.sucesso/erro/info` (API inalterada), mais `Avisos` (ícones, fechar, pausa ao passar o rato), `EstadoVazio`, `EstadoErro`, `Esqueleto`, `Roda`, `BarraProgresso` e `mensagemErro()` (traduz erros do Supabase para frases úteis).

## Definições usadas (confirmar)
- **Páginas analisadas** = soma de `paginas` dos documentos `processado` e `revisao`.
- **Pendentes** = `pendente` + `em_processamento`.
- **Para revisão** (relatório) = estado `revisao` OU validações com severidade erro/aviso por resolver.
- **Erros encontrados** = validações de severidade erro/aviso + falhas da fila (`erro_mensagem` ou estado `falhou`).
- **Taxa de sucesso** = concluídos (por `concluido_em`) / (concluídos + falhados criados no período).

## Limitações e pedidos à IA 1
1. Não há views nem funções de agregação. As contagens por estado são exactas (servidor), mas a soma de páginas, o gráfico diário e as categorias são calculados no navegador sobre os 20 000 documentos mais recentes (o ecrã avisa se passar disso). O relatório inclui até 5 000 documentos (também avisa). Pedido: migração `002` com uma função/view de agregação, se o volume real o justificar.
2. O contrato não diz se `concluido_em` é preenchido nos trabalhos `falhou`; o código não depende disso.
3. A actividade recente usa `documentos` (visível a todos os papéis), não `auditoria` (só admin/auditor).

## O que foi verificado e o que não foi
- Verificado: sintaxe de todos os ficheiros, lógica de agregação, construção do relatório, CSV (incluindo neutralização de fórmulas vindas do OCR) e renderização dos gráficos.
- **Não verificado**: `npm install`, `vite build`, ligação real ao Supabase, Realtime e a geração de XLSX/PDF (sem rede neste ambiente). Testar com dados fictícios (o contrato proíbe documentos reais da AGT).
