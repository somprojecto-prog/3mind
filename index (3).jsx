import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { pode } from '@/lib/permissoes';
import { aviso, EstadoErro, EstadoVazio, Esqueleto, mensagemErro } from '@/shared/notificacoes';
import { formatarDataHora } from '../documentos/estados';
import '../documentos/documentos.css';
import { resolverValidacao } from './servico';

const POR_PAGINA = 30;
const TIPOS = { campo_vazio: 'Campo vazio', formato: 'Formato', duplicado: 'Duplicado', inconsistencia: 'Inconsistência', incompleto: 'Incompleto', baixa_confianca: 'Baixa confiança' };

export default function Validacao() {
  const { perfil } = useAuth();
  const [f, setF] = useState({ estado: 'abertas', severidade: '', tipo: '' });
  const [pagina, setPagina] = useState(0);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    try {
      let q = supabase.from('validacoes')
        .select('id, documento_id, tipo, campo, mensagem, severidade, resolvida, criado_em, documentos(nome_ficheiro)', { count: 'exact' })
        .order('criado_em', { ascending: false }).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (f.estado === 'abertas') q = q.eq('resolvida', false);
      if (f.estado === 'resolvidas') q = q.eq('resolvida', true);
      if (f.severidade) q = q.eq('severidade', f.severidade);
      if (f.tipo) q = q.eq('tipo', f.tipo);
      const { data, count, error } = await q;
      if (error) throw error;
      setDados({ linhas: data, total: count ?? 0 }); setErro(false);
    } catch { setErro(true); }
  }, [f, pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  const mudar = (k) => (e) => { setPagina(0); setDados(null); setF((x) => ({ ...x, [k]: e.target.value })); };
  const podeResolver = pode(perfil.papel, 'validacao.resolver');
  async function resolver(v) {
    try { await resolverValidacao(v.id, v.documento_id); aviso.sucesso('Marcada como resolvida.'); carregar(); }
    catch (e) { aviso.erro(mensagemErro(e, 'resolver')); }
  }
  const paginas = Math.max(1, Math.ceil((dados?.total ?? 0) / POR_PAGINA));

  return (
    <>
      <h1>Validação</h1>
      <p className="suave dc-sub">Problemas encontrados nos documentos lidos: campos vazios, formatos incorrectos, duplicados e valores inconsistentes. Para corrigir, abra o documento.</p>
      <section className="cartao">
        <div className="dc-filtros" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <label>Mostrar<select value={f.estado} onChange={mudar('estado')}><option value="abertas">Por resolver</option><option value="resolvidas">Resolvidas</option><option value="todas">Todas</option></select></label>
          <label>Gravidade<select value={f.severidade} onChange={mudar('severidade')}><option value="">Todas</option><option value="erro">Erro</option><option value="aviso">Aviso</option><option value="info">Info</option></select></label>
          <label>Tipo<select value={f.tipo} onChange={mudar('tipo')}><option value="">Todos</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        {erro ? <EstadoErro aoTentar={carregar} />
          : !dados ? <Esqueleto linhas={5} altura={22} />
          : dados.linhas.length === 0 ? <EstadoVazio titulo="Nada para mostrar" texto="Não há problemas com estes filtros." />
          : (
            <ul className="dc-lista">
              {dados.linhas.map((v) => (
                <li key={v.id} className={v.resolvida ? 'dc-resolvida' : ''}>
                  <span className={`dc-severidade dc-sev-${v.severidade}`}>{v.severidade === 'erro' ? 'Erro' : v.severidade === 'aviso' ? 'Aviso' : 'Info'}</span>
                  <div>{v.mensagem}<br /><span className="dc-fino"><Link className="dc-ligacao" to={`/documentos/${v.documento_id}`}>{v.documentos?.nome_ficheiro || 'Documento'}</Link> · {TIPOS[v.tipo] || v.tipo} · {formatarDataHora(v.criado_em)}</span></div>
                  {!v.resolvida && podeResolver && <button className="btn btn-suave" onClick={() => resolver(v)}>Marcar como resolvida</button>}
                </li>
              ))}
            </ul>
          )}
        {dados && dados.total > POR_PAGINA && (
          <div className="paginacao">
            <button className="btn btn-suave" disabled={pagina === 0} onClick={() => { setDados(null); setPagina(pagina - 1); }}>Anterior</button>
            <span>Página {pagina + 1} de {paginas}</span>
            <button className="btn btn-suave" disabled={pagina + 1 >= paginas} onClick={() => { setDados(null); setPagina(pagina + 1); }}>Seguinte</button>
          </div>
        )}
      </section>
    </>
  );
}
