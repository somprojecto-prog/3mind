import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EstadoErro, EstadoVazio, Esqueleto, mensagemErro } from '@/shared/notificacoes';
import { ROTULO_ESTADO, dataHora, dataSimples } from './dados';

const POR_PAGINA = 20;

export default function Historico() {
  const navegar = useNavigate();
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState('');
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLinhas(null); setErro('');
      const { data, count, error } = await supabase.from('relatorios')
        .select('id, formato, filtros, criado_em, profiles(nome, email)', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (cancelado) return;
      if (error) { setErro(mensagemErro(error, 'carregar o histórico de relatórios')); return; }
      setLinhas(data); setTotal(count ?? 0);
    })();
    return () => { cancelado = true; };
  }, [pagina, tentativa]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const periodo = (f) => (f?.inicio && f?.fim ? `${dataSimples(`${f.inicio}T00:00:00`)} a ${dataSimples(`${f.fim}T00:00:00`)}` : '—');

  return (
    <section className="cartao">
      {erro ? <EstadoErro texto={erro} aoTentar={() => setTentativa((t) => t + 1)} />
        : !linhas ? <Esqueleto altura={20} linhas={5} />
        : linhas.length === 0 ? (
          <EstadoVazio icone={BarChart3} titulo="Ainda não foram gerados relatórios" texto="Os relatórios que exportar ficam registados aqui, com os filtros usados."
            accao={{ rotulo: 'Gerar relatório', aoClicar: () => navegar('/relatorios') }} />
        ) : (
          <>
            <div className="tabela-rolar">
              <table>
                <thead><tr><th>Data e hora</th><th>Formato</th><th>Período</th><th>Estado</th><th>Categoria</th><th>Gerado por</th><th><span className="so-leitores">Acção</span></th></tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id}>
                      <td>{dataHora(l.criado_em)}</td>
                      <td><span className="etiqueta rel-formato">{l.formato.toUpperCase()}{l.filtros?.seccao ? ` · ${l.filtros.seccao}` : ''}</span></td>
                      <td>{periodo(l.filtros)}</td>
                      <td>{l.filtros?.estado ? ROTULO_ESTADO[l.filtros.estado] : 'Todos'}</td>
                      <td>{l.filtros?.categoria_nome || 'Todas'}</td>
                      <td>{l.profiles?.nome || l.profiles?.email || '—'}</td>
                      <td>
                        <button type="button" className="btn btn-suave" onClick={() => navegar('/relatorios', { state: { filtros: { inicio: l.filtros?.inicio, fim: l.filtros?.fim, estado: l.filtros?.estado || '', categoria: l.filtros?.categoria || '' } } })}>
                          <RotateCcw size={15} aria-hidden="true" />Usar filtros
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="suave rel-nota">Os ficheiros não ficam guardados na plataforma: para obter de novo, use os mesmos filtros e exporte outra vez.</p>
            <div className="paginacao">
              <button type="button" className="btn btn-suave" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <span>Página {pagina + 1} de {paginas}</span>
              <button type="button" className="btn btn-suave" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Seguinte</button>
            </div>
          </>
        )}
    </section>
  );
}
