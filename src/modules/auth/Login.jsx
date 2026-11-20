import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import CascaAuth from './CascaAuth';
import './auth.css';

export default function Login() {
  const { entrar, mensagemBloqueio, contaPendente } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [palavraPasse, setPalavraPasse] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro(''); setAEnviar(true);
    const r = await entrar(email, palavraPasse);
    setAEnviar(false);
    if (r.erro) setErro(r.erro);
    else navegar(local.state?.de || '/', { replace: true });
  }

  return (
    <CascaAuth titulo="Entrar" subtitulo="Entre com a sua conta. Ainda não tem? Crie uma e aguarde a aprovação do administrador.">
      <form onSubmit={submeter} className="form">
        <label>Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Palavra-passe
          <input type="password" autoComplete="current-password" required value={palavraPasse} onChange={(e) => setPalavraPasse(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {!erro && mensagemBloqueio && (
          <p className={contaPendente ? 'info-pendente' : 'erro'} role={contaPendente ? 'status' : 'alert'}>{mensagemBloqueio}</p>
        )}
        <button className="btn btn-primario" disabled={aEnviar}>{aEnviar ? 'A entrar…' : 'Entrar'}</button>
        <Link to="/recuperar" className="ligacao">Esqueci a palavra-passe</Link>
        <Link to="/registar" className="ligacao">Criar conta</Link>
      </form>
    </CascaAuth>
  );
}
