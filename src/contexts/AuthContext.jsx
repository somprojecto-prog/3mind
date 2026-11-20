import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { registarAuditoria } from '@/lib/auditoria';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [recuperacao, setRecuperacao] = useState(false);
  const [mensagemBloqueio, setMensagemBloqueio] = useState('');
  const [contaPendente, setContaPendente] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      if (!data.session) setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, nova) => {
      setSessao(nova);
      if (evento === 'PASSWORD_RECOVERY') setRecuperacao(true);
      if (!nova) { setPerfil(null); setCarregando(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // O perfil é carregado à parte (não dentro do callback acima, para evitar bloqueios do cliente Supabase).
  const userId = sessao?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (cancelado) return;
      if (error || !data) {
        setMensagemBloqueio('Não foi possível carregar o seu perfil. Tente novamente.');
        await supabase.auth.signOut();
      } else if (!data.activo && data.pendente) {
        setContaPendente(true);
        setMensagemBloqueio('A sua conta está a aguardar aprovação do administrador. Receberá acesso assim que for aprovada.');
        await supabase.auth.signOut();
      } else if (!data.activo) {
        setContaPendente(false);
        setMensagemBloqueio('A sua conta está bloqueada. Contacte o administrador.');
        await supabase.auth.signOut();
      } else {
        setPerfil(data);
      }
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [userId]);

  const entrar = useCallback(async (email, palavraPasse) => {
    setMensagemBloqueio(''); setContaPendente(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: palavraPasse });
    if (error) {
      if (error.message === 'Invalid login credentials') return { erro: 'Email ou palavra-passe incorrectos.' };
      if (/email not confirmed/i.test(error.message)) return { erro: 'Confirme primeiro o email: abra a mensagem que lhe enviámos (veja também o spam).' };
      return { erro: 'Não foi possível entrar. Tente novamente.' };
    }
    registarAuditoria('login');
    return {};
  }, []);

  const sair = useCallback(async () => {
    await registarAuditoria('logout');
    await supabase.auth.signOut();
  }, []);

  const valor = useMemo(
    () => ({ sessao, perfil, carregando, recuperacao, setRecuperacao, mensagemBloqueio, contaPendente, entrar, sair }),
    [sessao, perfil, carregando, recuperacao, mensagemBloqueio, contaPendente, entrar, sair],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
