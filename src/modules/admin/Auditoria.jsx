import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { aviso } from '@/shared/notificacoes';
import { Carregando } from '@/shared/componentes/Estados';

const POR_PAGINA = 50;

export default function Auditoria() {
  const [linhas, setLinhas] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [accao, setAccao] = useState('');
  const [entidade, setEntidade] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLinhas(null);
      let q = supabase.from('auditoria')
        .select('*, profiles(nome, email)', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (accao.trim()) q = q.ilike('accao', `%${accao.trim()}%`);
      if (entidade) q = q.eq('entidade', entidade);
      const { data, count, error } = await q;
      if (cancelado) return;
      if (error) { aviso.erro('Não foi possível carregar o registo de auditoria.'); setLinhas([]); return; }
      setLinhas(data); setTotal(count ?? 0);
    })();
    return () => { cancelado = true; };
  }, [pagina, accao, entidade]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <h1>Auditoria</h1>
      <section className="cartao">
        <div className="filtros">
          <label>Acção
            <input placeholder="ex.: login, update" value={accao} onChange={(e) => { setPagina(0); setAccao(e.target.value); }} />
          </label>
          <label>Entidade
            <select value={entidade} onChange={(e) => { setPagina(0); setEntidade(e.target.value); }}>
              <option value="">Todas</option>
              <option value="documentos">Documentos</option>
              <option value="dados_extraidos">Dados extraídos</option>
              <option value="profiles">Contas</option>
            </select>
          </label>
        </div>
        {!linhas ? <Carregando /> : linhas.length === 0 ? (
          <p className="suave">Sem registos para estes filtros.</p>
        ) : (
          <div className="tabela-rolar">
            <table>
              <thead><tr><th>Data e hora</th><th>Utilizador</th><th>Acção</th><th>Entidade</th><th>Detalhes</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.criado_em).toLocaleString('pt-PT')}</td>
                    <td>{l.profiles?.nome || l.profiles?.email || 'Sistema'}</td>
                    <td>{l.accao}</td>
                    <td>{l.entidade || '—'}</td>
                    <td>
                      {l.detalhes && Object.keys(l.detalhes).length > 0
                        ? <details><summary>Ver</summary><pre>{JSON.stringify(l.detalhes, null, 2)}</pre></details>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="paginacao">
          <button className="btn btn-suave" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina + 1} de {paginas}</span>
          <button className="btn btn-suave" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Seguinte</button>
        </div>
      </section>
    </>
  );
}
