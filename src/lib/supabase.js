import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configurado = Boolean(url && chave);

// Só a chave "anon" pública vai para o navegador. A segurança vem das políticas RLS.
export const supabase = createClient(url || 'http://localhost', chave || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
