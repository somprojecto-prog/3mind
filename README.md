# 3MIND

Plataforma de inteligência documental (OCR, validação, comparação e relatórios), complementar aos sistemas existentes da AGT.

## Arrancar
1. Criar um projecto no Supabase.
2. SQL Editor: executar `supabase/migrations/001_fundacao.sql`, depois `002_modulo_documentos.sql`, `003_registo_com_aprovacao.sql` e `004_analise_adaptativa.sql`.
3. Authentication > Providers > Email: **ligar** "Allow new users to sign up" e **"Confirm email"**. Em Authentication > Sign In / Providers, palavra-passe com mínimo de 10 caracteres e protecção contra palavras-passe vazadas. Em Authentication > Attack Protection, activar o **CAPTCHA**.
4. Authentication > URL Configuration: acrescentar o endereço do site (ex.: `http://localhost:5173` e o de produção) em *Redirect URLs*.
5. Criar o primeiro utilizador em Authentication > Users e promovê-lo a administrador:
   `update public.profiles set papel = 'admin' where email = 'o-seu-email';`
6. Publicar a Edge Function de criação de contas: `supabase functions deploy admin-criar-utilizador`.
7. `cp .env.example .env` e preencher URL e chave anon.
8. `npm install` e `npm run dev`.

## GitHub Pages
Compilar com `VITE_BASE=/nome-do-repositorio/ npm run build` (o script copia `index.html` para `404.html` para as rotas funcionarem).

## Estado
Entregue (fundação): login, recuperação de palavra-passe, perfis e permissões, RLS, bucket privado, layout, utilizadores, auditoria.
Entregue (IA 3): painel, relatórios (XLSX, PDF, CSV) e notificações.
Entregue (extra): página Clientes (documentos agrupados por NIF; `src/modules/clientes`).
Entregue (IA 1, em nome da IA 2): documentos (envio, pesquisa, detalhe, correcção manual), OCR no navegador, validação, comparação e fila com retoma.

## OCR
O OCR corre no navegador de quem envia o documento (PDF.js + Tesseract.js). Páginas de PDF com texto digital são lidas sem OCR.
Na primeira utilização o Tesseract descarrega o motor e o idioma português de um CDN público; para ambiente institucional, aloje-os e defina `VITE_OCR_*` no `.env`.
Formatos de NIF assumidos (confirmar com a AGT): 10 dígitos (empresa) e 9 dígitos + 2 letras + 3 dígitos (pessoa singular). Ver `docs/CONTRATO_TECNICO.md`.

## Vercel
1. Importar o repositório no Vercel (Framework: Vite; build `npm run build`; saída `dist`).
2. Settings > Environment Variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Não definir `VITE_BASE`.
3. O `vercel.json` já trata das rotas (recarregar `/documentos` não dá 404).
4. Supabase > Authentication > URL Configuration: acrescentar o endereço do Vercel em *Redirect URLs*.

## Registo com aprovação
- Qualquer pessoa pode pedir conta em `/registar`; tem de confirmar o email.
- A conta nasce **bloqueada e pendente**, com o papel `operador` (nunca escolhido pelo cliente). Sem aprovação, a base de dados nega todo o acesso (RLS).
- O administrador aprova ou recusa em **Utilizadores > Pedidos de registo** e define o papel.
- Contas criadas pelo administrador (botão *Criar conta*) ficam activas logo.
- Palavras-passe: guardadas apenas como hash pelo Supabase Auth. Ligação em HTTPS; dados e ficheiros cifrados em repouso pelo Supabase.

## Análise adaptativa (migração 004)
- O utilizador escolhe o **tipo de documento** (18 perfis + "Não sei identificar") e o **tipo de análise** (extracção, validação, comparação, resumo, pesquisa, completa) antes de enviar.
- Código em `src/modules/analise/`: `perfis/` (dados de cada tipo), `motor/` (classificação, extracção, validação, resumo; funções puras), `servico.js` (liga ao Supabase). Para acrescentar um tipo: criar o perfil em `perfis/definicoes.js` e listá-lo em `perfis/index.js`.
- A classificação automática usa palavras-chave (não é IA generativa); com confiança abaixo de 70 % pede confirmação e só depois analisa.
- O texto lido fica em `documentos.texto_original` (páginas separadas por `\f`), por isso mudar o tipo refaz a análise sem repetir o OCR.
- Testes do motor: `node --import ./testes/registar.mjs testes/analise.mjs`.
