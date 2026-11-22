import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PAPEIS, pode } from '@/lib/permissoes';
import Logo from '@/shared/componentes/Logo';
import { Carregando } from '@/shared/componentes/Estados';
import { MODULOS } from './modulos';

export default function Layout() {
  const { perfil, sair } = useAuth();
  const [aberto, setAberto] = useState(false);
  const local = useLocation();
  const navegar = useNavigate();
  const [termo, setTermo] = useState('');
  const pesquisar = (e) => {
    e.preventDefault();
    const q = termo.trim();
    navegar(q ? `/documentos?q=${encodeURIComponent(q)}` : '/documentos');
  };
  useEffect(() => setAberto(false), [local.pathname]);

  useEffect(() => {
    if (!pode(perfil.papel, 'documentos.enviar')) return undefined;
    let modulo = null;
    let activo = true;
    import('@/modules/fila/processador').then((m) => { if (activo) { modulo = m; m.iniciarProcessador(perfil.id); } });
    return () => { activo = false; modulo?.pararProcessador(); };
  }, [perfil.id, perfil.papel]);

  const visiveis = MODULOS.filter((m) => pode(perfil.papel, m.permissao));
  const grupos = [
    { titulo: null, itens: visiveis.filter((m) => m.grupo === 'trabalho') },
    { titulo: 'Administração', itens: visiveis.filter((m) => m.grupo === 'admin') },
  ].filter((g) => g.itens.length);

  return (
    <div className="app">
      <aside className={`menu ${aberto ? 'menu-aberto' : ''}`} aria-label="Navegação principal">
        <div className="menu-marca"><Logo /><span>3MIND</span></div>
        <nav>
          {grupos.map((g) => (
            <div key={g.titulo || 'trabalho'} className="menu-grupo">
              {g.titulo && <p className="menu-titulo">{g.titulo}</p>}
              {g.itens.map(({ caminho, rotulo, icone: Icone }) => (
                <NavLink key={caminho} to={caminho} end={caminho === '/'} className="menu-item">
                  <Icone size={18} aria-hidden="true" />{rotulo}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {aberto && <button className="menu-fundo" aria-label="Fechar menu" onClick={() => setAberto(false)} />}

      <div className="principal">
        <header className="topo">
          <button className="btn-icone menu-botao" aria-label={aberto ? 'Fechar menu' : 'Abrir menu'} onClick={() => setAberto(!aberto)}>
            {aberto ? <X size={20} /> : <Menu size={20} />}
          </button>
          <form className="topo-pesquisa" role="search" onSubmit={pesquisar}>
            <Logo tamanho={22} />
            <input type="search" aria-label="Pesquisar documentos" placeholder="Pesquisar documentos: nome, NIF, referência…" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <button type="submit" className="btn-icone" aria-label="Pesquisar"><Search size={18} aria-hidden="true" /></button>
          </form>
          <div className="topo-utilizador">
            <div>
              <strong>{perfil.nome || perfil.email}</strong>
              <span>{PAPEIS[perfil.papel]}</span>
            </div>
            <button className="btn btn-suave" onClick={sair}><LogOut size={16} aria-hidden="true" />Sair</button>
          </div>
        </header>
        <main className="conteudo">
          <Suspense fallback={<Carregando />}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  );
}
