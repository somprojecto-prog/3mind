import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import CascaAuth from './CascaAuth';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro(''); setAEnviar(true);
    const destino = `${window.location.origin}${import.meta.env.BASE_URL}redefinir`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: destino });
    setAEnviar(false);
    if (error) setErro('Não foi possível enviar o email agora. Tente novamente dentro de alguns minutos.');
    else setEnviado(true);
  }

  return (
    <CascaAuth titulo="Recuperar palavra-passe" subtitulo="Enviamos uma ligação para definir uma nova palavra-passe.">
      {enviado ? (
        <p className="sucesso" role="status">Se o email existir no sistema, vai receber a ligação em breve. Verifique também o spam.</p>
      ) : (
        <form onSubmit={submeter} className="form">
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn btn-primario" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Enviar ligação'}</button>
        </form>
      )}
      <Link to="/entrar" className="ligacao">Voltar a entrar</Link>
    </CascaAuth>
  );
}
