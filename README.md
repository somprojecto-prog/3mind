# 3MIND

Plataforma de inteligência documental (OCR, validação, comparação e relatórios), complementar aos sistemas existentes da AGT.

## Arrancar
1. Criar um projecto no Supabase.
2. SQL Editor: executar `supabase/migrations/001_fundacao.sql` e depois `002_modulo_documentos.sql`.
3. Authentication > Providers > Email: **desligar "Allow new users to sign up"** (as contas são criadas pelo administrador).
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
Entregue (IA 1, em nome da IA 2): documentos (envio, pesquisa, detalhe, correcção manual), OCR no navegador, validação, comparação e fila com retoma.

## OCR
O OCR corre no navegador de quem envia o documento (PDF.js + Tesseract.js). Páginas de PDF com texto digital são lidas sem OCR.
Na primeira utilização o Tesseract descarrega o motor e o idioma português de um CDN público; para ambiente institucional, aloje-os e defina `VITE_OCR_*` no `.env`.
Formatos de NIF assumidos (confirmar com a AGT): 10 dígitos (empresa) e 9 dígitos + 2 letras + 3 dígitos (pessoa singular). Ver `docs/CONTRATO_TECNICO.md`.
