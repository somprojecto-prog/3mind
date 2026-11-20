import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Carregando } from '@/shared/componentes/Estados';
import CascaAuth from './CascaAuth';

export default function Redefinir() {
  const { sessao, carregando, setRecuperacao } = useAuth();
  const navegar = useNavigate();
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  if (carregando) return <Carregando />;

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    if (nova.length < 10) return setErro('A palavra-passe deve ter pelo menos 10 caracteres.');
    if (nova !== confirmar) return setErro('As duas palavras-passe não são iguais.');
    setAEnviar(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    setAEnviar(false);
    if (error) return setErro('Não foi possível guardar. A ligação pode ter expirado; peça outra.');
    setRecuperacao(false);
    navegar('/', { replace: true });
  }

  return (
    <CascaAuth titulo="Nova palavra-passe">
      {!sessao ? (
        <>
          <p className="erro">Esta ligação expirou ou já foi usada.</p>
          <Link to="/recuperar" className="ligacao">Pedir nova ligação</Link>
        </>
      ) : (
        <form onSubmit={submeter} className="form">
          <label>Nova palavra-passe
            <input type="password" autoComplete="new-password" required minLength={10} value={nova} onChange={(e) => setNova(e.target.value)} />
          </label>
          <label>Repetir palavra-passe
            <input type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn btn-primario" disabled={aEnviar}>{aEnviar ? 'A guardar…' : 'Guardar palavra-passe'}</button>
        </form>
      )}
    </CascaAuth>
  );
}
