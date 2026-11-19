# 3MIND · Contrato técnico

Documento obrigatório para todas as IAs. Se algo aqui tiver de mudar, pedir ao dono da fundação (IA 1); ninguém altera por conta própria.

## 1. Donos de cada pasta
| Pasta | Dono |
|---|---|
| `supabase/`, `src/lib/`, `src/contexts/`, `src/app/Layout.jsx`, `src/modules/auth`, `src/modules/admin`, `src/shared/componentes`, `src/estilos.css` | IA 1 (fundação) |
| `src/modules/documentos`, `ocr`, `validacao`, `comparacao`, `fila` | IA 2 (entregues pela IA 1 em JavaScript; migração `002`) |
| `src/modules/dashboard`, `relatorios`, `src/shared/notificacoes` | IA 3 |

Cada IA só edita a sua linha em `src/app/modulos.jsx`. Dependências novas (`npm install`) devem ser listadas na entrega.

## 2. Papéis e permissões
`admin`, `supervisor`, `operador`, `auditor`. A base de dados decide o acesso (RLS); `src/lib/permissoes.js` só esconde opções no ecrã.
- Operador vê apenas os seus documentos. Supervisor, auditor e admin vêem todos.
- Auditor só lê (e gera relatórios). Só o admin apaga documentos.
- Conta bloqueada (`profiles.activo = false`) perde todo o acesso.
- Novas permissões: pedir à IA 1 para acrescentar em `permissoes.js` e nas políticas.

## 3. Tabelas (ver `supabase/migrations/001_fundacao.sql`)
`profiles`, `categorias`, `documentos`, `dados_extraidos`, `validacoes`, `fila_processamento`, `comparacoes`, `relatorios`, `auditoria`.

Estados do documento: `pendente`, `em_processamento`, `processado`, `erro`, `revisao`.
Estados da fila: `espera`, `em_processamento`, `concluido`, `falhou` (`progresso` 0–100, `checkpoint jsonb` para retomar).
Campos em `dados_extraidos.campo`: `nif`, `nome`, `data`, `valor`, `referencia`, `numero_factura`.
Se faltar uma coluna ou tabela, a IA pede a migração `002_...sql` à IA 1; não altera a 001.

## 4. Ficheiros (Storage)
- Bucket privado `documentos`, máx. 20 MB; tipos: PDF, PNG, JPEG, TIFF, WebP.
- Caminho obrigatório: `{auth.uid()}/{uuid}-{nome_do_ficheiro}`. Guardar o mesmo valor em `documentos.storage_path`.
- Nunca usar URLs públicas. Ler com `supabase.storage.from('documentos').createSignedUrl(path, 60)`.
- Fluxo de upload: 1) enviar para o Storage, 2) inserir em `documentos` com `enviado_por = auth.uid()`, 3) inserir em `fila_processamento` com estado `espera`.

## 5. Código partilhado
```js
import { supabase } from '@/lib/supabase';                 // cliente único
import { useAuth } from '@/contexts/AuthContext';           // { perfil, sessao }
import { pode } from '@/lib/permissoes';                    // pode(perfil.papel, 'documentos.editar')
import { registarAuditoria } from '@/lib/auditoria';        // registarAuditoria('exportar_relatorio', 'relatorios', id, {formato})
import { aviso } from '@/shared/notificacoes';              // aviso.sucesso(t) / aviso.erro(t) / aviso.info(t)
import { Carregando } from '@/shared/componentes/Estados';
```
- Alterações a `documentos` e `dados_extraidos` são auditadas automaticamente pela base de dados. Acções sem alteração de dados (exportar, comparar, ver) registam-se com `registarAuditoria`.
- Progresso em tempo real: `supabase.channel(...).on('postgres_changes', { table: 'fila_processamento' }, ...)`.

## 6. Convenções
- Textos do ecrã em português de Angola, frases em minúsculas depois da primeira maiúscula, botões com verbo (“Guardar alterações”).
- Cores e espaçamentos: usar as variáveis CSS de `src/estilos.css` (`--azul-900`, `--azul-600`, `--azul-300`, `--azul-100`, `--linha`, etc.) e as classes `.cartao`, `.btn`, `.btn-primario`, `.btn-suave`, `.tabela-rolar`, `.etiqueta`. CSS próprio vai num ficheiro dentro da pasta do módulo.
- Todo o módulo exporta `default` um componente e trata as suas sub-rotas com `<Routes>` (a rota base é `/<modulo>/*`).
- Erros do Supabase nunca se mostram em bruto; traduzir para uma frase que diga o que fazer.
- OCR só no navegador (PDF.js + Tesseract.js). Nenhum documento real da AGT em testes.
- Não inventar funcionalidades: se algo não funciona, não aparece no ecrã.
