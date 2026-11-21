import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { pode } from '@/lib/permissoes';
import { aviso, EstadoErro, EstadoVazio, Esqueleto, mensagemErro } from '@/shared/notificacoes';
import { EstadoTag } from './Componentes';
import { ESTADOS, ROTULO_ESTADO, formatarData, formatarDataHora } from './estados';
import { PERFIS, rotuloTipo } from '../analise/perfis';
import { POR_PAGINA, apagarCategoria, criarCategoria, listarCategorias, listarDocumentos } from './servico';

const FILTROS_VAZIOS = { q: '', estado: '', categoria: '', tipo: '', de: '', ate: '' };

function GerirCategorias({ categorias, aoMudar }) {
  const [nome, setNome] = useState('');
  async function criar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    try { await criarCategoria(nome); setNome(''); aoMudar(); aviso.sucesso('Categoria criada.'); }
    catch (err) { aviso.erro(mensagemErro(err, 'criar a categoria')); }
  }
  async function apagar(c) {
    if (!window.confirm(`Apagar a categoria "${c.nome}"? Os documentos ficam sem categoria.`)) return;
    try { await apagarCategoria(c.id); aoMudar(); aviso.sucesso('Categoria apagada.'); }
    catch (err) { aviso.erro(mensagemErro(err, 'apagar a categoria')); }
  }
  return (
    <details className="cartao">
      <summary><strong>Gerir categorias</strong></summary>
      <ul className="dc-lista" style={{ margin: '1rem 0' }}>
        {categorias.map((c) => (
          <li key={c.id}><div>{c.nome}</div>
            <button className="btn btn-suave dc-perigo" onClick={() => apagar(c)} aria-label={`Apagar ${c.nome}`}><Trash2 size={15} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <form onSubmit={criar} className="dc-novo">
        <label>Nova categoria<input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} /></label>
        <button className="btn btn-primario"><Plus size={16} aria-hidden="true" />Adicionar</button>
      </form>
    </details>
  );
}

export default function Lista() {
  const { perfil } = useAuth();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [versao, setVersao] = useState(0);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [aCarregar, setACarregar] = useState(false);
  const [categorias, setCategorias] = useState([]);

  const carregarCategorias = useCallback(() => listarCategorias().then(setCategorias).catch(() => {}), []);
  useEffect(() => { carregarCategorias(); }, [carregarCategorias]);

  useEffect(() => { // pesquisa com pequena pausa enquanto escreve
    const t = setTimeout(() => { setPagina(0); setBusca(filtros.q); }, 350);
    return () => clearTimeout(t);
  }, [filtros.q]);

  useEffect(() => { // estados actualizam-se sozinhos enquanto os documentos são lidos
    let t;
    const canal = supabase.channel(`lista-docs-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, () => { clearTimeout(t); t = setTimeout(() => setVersao((v) => v + 1), 1500); })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(canal); };
  }, []);

  useEffect(() => {
    let cancelado = false;
    setACarregar(true);
    listarDocumentos({ ...filtros, q: busca, pagina })
      .then((r) => { if (!cancelado) { setDados(r); setErro(false); } })
      .catch(() => { if (!cancelado) setErro(true); })
      .finally(() => { if (!cancelado) setACarregar(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, filtros.estado, filtros.categoria, filtros.tipo, filtros.de, filtros.ate, pagina, versao]);

  const mudar = (campo) => (e) => { setPagina(0); setFiltros((f) => ({ ...f, [campo]: e.target.value })); };
  const paginas = Math.max(1, Math.ceil((dados?.total ?? 0) / POR_PAGINA));
  const mostraAutor = perfil.papel !== 'operador';
  const filtrado = Object.entries(filtros).some(([, v]) => v);

  return (
    <>
      {pode(perfil.papel, 'fila.gerir') && <GerirCategorias categorias={categorias} aoMudar={carregarCategorias} />}
      <section className="cartao">
        <div className="dc-filtros">
          <label>Pesquisar<input type="search" placeholder="Nome, NIF, referência ou data (dd/mm/aaaa)" value={filtros.q} onChange={mudar('q')} /></label>
          <label>Estado
            <select value={filtros.estado} onChange={mudar('estado')}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{ROTULO_ESTADO[e]}</option>)}
            </select>
          </label>
          <label>Categoria
            <select value={filtros.categoria} onChange={mudar('categoria')}>
              <option value="">Todas</option><option value="sem">Sem categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>Tipo de documento
            <select value={filtros.tipo} onChange={mudar('tipo')}>
              <option value="">Todos</option>
              {PERFIS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </label>
          <label>Enviado desde<input type="date" value={filtros.de} onChange={mudar('de')} /></label>
          <label>Até<input type="date" value={filtros.ate} onChange={mudar('ate')} /></label>
        </div>

        {erro ? <EstadoErro aoTentar={() => setVersao((v) => v + 1)} />
          : !dados ? <Esqueleto linhas={6} altura={22} />
          : dados.linhas.length === 0 ? (
            <EstadoVazio titulo={filtrado ? 'Nenhum documento com estes filtros' : 'Ainda não há documentos'}
              texto={filtrado ? 'Experimente alargar a pesquisa.' : 'Envie o primeiro documento para começar.'} />
          ) : (
            <div className={`tabela-rolar ${aCarregar ? 'dc-opaco' : ''}`}>
              <table>
                <thead><tr><th>Documento</th><th>Tipo</th><th>Categoria</th><th>NIF</th><th>Referência</th><th>Data</th><th>Estado</th>{mostraAutor && <th>Enviado por</th>}<th>Enviado em</th></tr></thead>
                <tbody>
                  {dados.linhas.map((d) => (
                    <tr key={d.id}>
                      <td><Link className="dc-ligacao" to={`/documentos/${d.id}`}>{d.nome_ficheiro}</Link></td>
                      <td>{d.tipo_documento ? rotuloTipo(d.tipo_documento) : '—'}</td>
                      <td>{d.categorias?.nome || '—'}</td>
                      <td>{d.nif || '—'}</td>
                      <td>{d.referencia || '—'}</td>
                      <td>{formatarData(d.data_documento)}</td>
                      <td><EstadoTag estado={d.estado} /></td>
                      {mostraAutor && <td>{d.profiles?.nome || '—'}</td>}
                      <td>{formatarDataHora(d.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {dados && dados.total > POR_PAGINA && (
          <div className="paginacao">
            <button className="btn btn-suave" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span>Página {pagina + 1} de {paginas} · {dados.total} documentos</span>
            <button className="btn btn-suave" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Seguinte</button>
          </div>
        )}
      </section>
    </>
  );
}
