# Sem original no servidor + retenção 7 dias (migration 005)

Feito: IndexedDB local para o original (armazem.js); envio sem Storage; processador lê do local; visor mostra aviso se o original não está neste PC; resultado CSV descarregado ao fim (e botão/banner); apagamento aos 7 dias (RPC apagar_expirados, chamada ao abrir o site + pg_cron se existir); limite 200/dia (trigger); upload/listagem com explicação.

**Obrigatório antes de usar:** correr `supabase/migrations/005_sem_original_retencao.sql` no SQL Editor.

Falta / não verificado:
- Testar no browser (envio, leitura, download automático, banner, visor sem original, limite 200).
- Download "obrigatório" é só aviso + download automático; não bloqueia o utilizador de sair. Bloquear (ex.: impedir novo envio com resultados por descarregar) = decisão de produto.
- Documentos antigos com storage_path continuam a funcionar; limpar bucket `documentos` manualmente.
- Auditoria/histórico também expira? Tabela auditoria não é apagada aos 7 dias (decidir política).
- Download automático pode ser bloqueado pelo browser ao processar vários (permitir transferências múltiplas); o banner cobre isso.
- Reprocessar/supervisor a processar docs de outros só funciona se o original existir nesse PC.
- Original no IndexedDB não é cifrado.
- Cálculo do limite diário: 200 no total de todas as contas, dia de Luanda.

## Actualização
- Original no browser agora cifrado (AES-GCM, chave não exportável). Não testado em browser.
- Novos envios bloqueados enquanto houver resultados processados por descarregar (Upload.jsx + contarPorDescarregar).
- Continua por decidir: apagar a auditoria aos 7 dias; limpar à mão o bucket `documentos` (ficheiros antigos).
