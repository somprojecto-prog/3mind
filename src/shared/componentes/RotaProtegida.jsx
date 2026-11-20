import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { pode } from '@/lib/permissoes';
import { Carregando } from './Estados';

export function RotaProtegida({ children }) {
  const { sessao, perfil, carregando, recuperacao } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (recuperacao) return <Navigate to="/redefinir" replace />;
  if (!sessao || !perfil) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  return children;
}

export function Autorizar({ permissao, children }) {
  const { perfil } = useAuth();
  if (!pode(perfil.papel, permissao)) {
    return (
      <div className="vazio">
        <h2>Sem permissão</h2>
        <p>O seu perfil não tem acesso a esta área. Se precisa dela, peça ao administrador.</p>
      </div>
    );
  }
  return children;
}
