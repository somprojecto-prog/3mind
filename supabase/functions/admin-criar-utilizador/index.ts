// Cria contas. Só um administrador activo pode chamar esta função.
// Usa a chave de serviço (nunca exposta no navegador) para criar o utilizador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PAPEIS = ['admin', 'supervisor', 'operador', 'auditor'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const chamador = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await chamador.auth.getUser();
    if (!user) return json({ erro: 'Sessão inválida.' }, 401);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: perfil } = await admin.from('profiles').select('papel, activo').eq('id', user.id).single();
    if (!perfil?.activo || perfil.papel !== 'admin') return json({ erro: 'Sem permissão.' }, 403);

    const { nome, email, palavra_passe, papel } = await req.json();
    if (!nome?.trim() || !/^\S+@\S+\.\S+$/.test(email ?? '')) return json({ erro: 'Nome ou email inválido.' }, 400);
    if ((palavra_passe ?? '').length < 10) return json({ erro: 'A palavra-passe deve ter pelo menos 10 caracteres.' }, 400);
    if (!PAPEIS.includes(papel)) return json({ erro: 'Papel inválido.' }, 400);

    const { data, error } = await admin.auth.admin.createUser({
      email, password: palavra_passe, email_confirm: true, user_metadata: { nome: nome.trim() },
    });
    if (error) return json({ erro: error.message }, 400);

    await admin.from('profiles').update({ nome: nome.trim(), papel }).eq('id', data.user.id);
    await admin.from('auditoria').insert({
      utilizador_id: user.id, accao: 'criar_utilizador', entidade: 'profiles',
      entidade_id: data.user.id, detalhes: { email, papel },
    });
    return json({ id: data.user.id });
  } catch (_e) {
    return json({ erro: 'Erro interno.' }, 500);
  }
});
