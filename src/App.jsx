import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Avisos } from '@/shared/notificacoes';
import { Autorizar, RotaProtegida } from '@/shared/componentes/RotaProtegida';
import { configurado } from '@/lib/supabase';
import Layout from '@/app/Layout';
import { MODULOS } from '@/app/modulos';
import Login from '@/modules/auth/Login';
import Recuperar from '@/modules/auth/Recuperar';
import Redefinir from '@/modules/auth/Redefinir';

function SoParaVisitantes({ children }) {
  const { sessao, perfil, recuperacao } = useAuth();
  if (recuperacao) return <Navigate to="/redefinir" replace />;
  return sessao && perfil ? <Navigate to="/" replace /> : children;
}

export default function App() {
  if (!configurado) {
    return (
      <div className="vazio">
        <h2>Ligação ao Supabase em falta</h2>
        <p>Crie o ficheiro <code>.env</code> a partir de <code>.env.example</code> com o URL e a chave anon do projecto, e reinicie.</p>
      </div>
    );
  }
  return (
    <AuthProvider>
      <Avisos />
      <Routes>
        <Route path="/entrar" element={<SoParaVisitantes><Login /></SoParaVisitantes>} />
        <Route path="/recuperar" element={<SoParaVisitantes><Recuperar /></SoParaVisitantes>} />
        <Route path="/redefinir" element={<Redefinir />} />
        <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
          {MODULOS.map(({ caminho, permissao, Componente }) => {
            const elemento = <Autorizar permissao={permissao}><Componente /></Autorizar>;
            return caminho === '/'
              ? <Route key={caminho} index element={elemento} />
              : <Route key={caminho} path={`${caminho.slice(1)}/*`} element={elemento} />;
          })}
          <Route path="*" element={<div className="vazio"><h2>Página não encontrada</h2><p>O endereço não existe. Use o menu à esquerda.</p></div>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
