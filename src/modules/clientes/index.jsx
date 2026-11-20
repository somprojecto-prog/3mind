import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EstadoErro, EstadoVazio, Esqueleto } from '@/shared/notificacoes';
import { EstadoTag } from '../documentos/Componentes';
import { formatarData } from '../documentos/estados';
import { listarClientes } from './servico';
import './clientes.css';

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Clientes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setErro(false);
    listarClientes()
      .then((r) => { if (!cancelado) setDados(r); })
      .catch(() => { if (!cancelado) setErro(true); });
    return () => { cancelado = true; };
  }, [tentativa]);

  const lista = useMemo(() => {
    if (!dados) return [];
    const busca = normalizar(q).trim();
    return dados.clientes
      .filter((c) => !busca || normalizar(c.nome).includes(busca) || normalizar(c.nif).includes(busca))
      .sort((a, b) => (a.nome || '~').localeCompare(b.nome || '~', 'pt') || a.nif.localeCompare(b.nif));
  }, [dados, q]);

  return (
    <>
      <h1>Clientes</h1>
      <section className="cartao">
        <p className="suave" style={{ marginTop: 0 }}>Os documentos agrupados pelo NIF lido em cada um. O nome vem da leitura (OCR) ou da correcção manual.</p>
        <div className="cl-pesquisa">
          <label>Pesquisar<input type="search" placeholder="Nome ou NIF" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        </div>

        {erro ? <EstadoErro aoTentar={() => setTentativa((t) => t + 1)} />
          : !dados ? <Esqueleto linhas={6} altura={22} />
          : lista.length === 0 ? (
            <EstadoVazio titulo={q ? 'Nenhum cliente encontrado' : 'Ainda não há clientes'}
              texto={q ? 'Experimente outro nome ou NIF.' : 'Aparecem aqui quando um documento tiver o NIF lido.'} />
          ) : (
            <div className="tabela-rolar">
              <table>
                <thead><tr><th>Cliente</th><th>NIF</th><th>Documentos</th><th>Por rever</th><th>Último documento</th></tr></thead>
                <tbody>
                  {lista.map((c) => {
                    const aberta = aberto === c.nif;
                    return (
                      <Fragment key={c.nif}>
                        <tr className="cl-linha" onClick={() => setAberto(aberta ? null : c.nif)}>
                          <td><button type="button" aria-expanded={aberta}>{c.nome || 'Sem nome lido'}</button></td>
                          <td>{c.nif}</td>
                          <td>{c.documentos.length}</td>
                          <td>{c.porRever ? <span className="cl-rever">{c.porRever}</span> : '—'}</td>
                          <td>{formatarData(c.documentos[0].data_documento || c.documentos[0].criado_em)}</td>
                        </tr>
                        {aberta && c.documentos.map((d) => (
                          <tr key={d.id} className="cl-docs">
                            <td colSpan={2}><Link to={`/documentos/${d.id}`}>{d.nome_ficheiro}</Link></td>
                            <td>{d.referencia || '—'}</td>
                            <td><EstadoTag estado={d.estado} /></td>
                            <td>{formatarData(d.data_documento)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        {dados?.cortado && <p className="cl-aviso">A mostrar os 5 000 documentos mais recentes.</p>}
      </section>
    </>
  );
}
