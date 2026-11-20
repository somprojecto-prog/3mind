import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { pode } from '@/lib/permissoes';
import { aviso, BarraProgresso, EstadoErro, EstadoVazio, Esqueleto, mensagemErro } from '@/shared/notificacoes';
import { ROTULO_ESTADO_FILA, formatarDataHora } from '../documentos/estados';
import '../documentos/documentos.css';
import { LIMITE_INTERROMPIDO_MS, acordar, repetirTrabalho } from './processador';

const ESTADOS = ['espera', 'em_processamento', 'concluido', 'falhou'];

export default function Fila() {
  const { perfil } = useAuth();
  const [linhas, setLinhas] = useState(null);
  const [contagens, setContagens] = useState({});
  const [filtro, setFiltro] = useState('');
  const [erro, setErro] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  const carregar = useCallback(async () => {
    try {
      let q = supabase.from('fila_processamento')
        .select('id, documento_id, estado, progresso, tentativas, erro_mensagem, criado_em, iniciado_em, concluido_em, actualizado_em, documentos(nome_ficheiro, enviado_por, paginas)')
        .order('criado_em', { ascending: false }).limit(200);
      if (filtro) q = q.eq('estado', filtro);
      const [lista, ...conts] = await Promise.all([
        q,
        ...ESTADOS.map((e) => supabase.from('fila_processamento').select('id', { count: 'exact', head: true }).eq('estado', e)),
      ]);
      if (lista.error) throw lista.error;
      setLinhas(lista.data);
      setContagens(Object.fromEntries(ESTADOS.map((e, i) => [e, conts[i].count ?? 0])));
      setErro(false);
    } catch { setErro(true); }
  }, [filtro]);

  useEffect(() => { setLinhas(null); carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { // progresso em tempo real
    let t;
    const canal = supabase.channel(`fila-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_processamento' }, () => { clearTimeout(t); t = setTimeout(carregar, 800); })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(canal); };
  }, [carregar]);

  const interrompido = (f) => f.estado === 'em_processamento' && agora - new Date(f.actualizado_em).getTime() > LIMITE_INTERROMPIDO_MS;
  const podeGerir = pode(perfil.papel, 'fila.gerir');
  const podeRepetir = pode(perfil.papel, 'documentos.editar');

  async function repetir(f) {
    try { await repetirTrabalho(f.id, f.documento_id, { todos: f.documentos?.enviado_por !== perfil.id }); aviso.info('O trabalho voltou à fila.'); carregar(); }
    catch (e) { aviso.erro(mensagemErro(e, 'repetir o trabalho')); }
  }

  return (
    <>
      <h1>Fila de processamento</h1>
      <p className="suave dc-sub">A leitura de cada documento acontece no computador de quem o enviou. Se fechar a janela a meio, o trabalho fica "interrompido" e retoma da última página lida quando voltar a entrar.</p>

      <div className="grelha-form" style={{ marginBottom: '1rem' }}>
        {ESTADOS.map((e) => (
          <button key={e} className={`cartao btn`} style={{ flexDirection: 'column', alignItems: 'flex-start', margin: 0, outline: filtro === e ? '2px solid var(--azul-600)' : undefined }}
            aria-pressed={filtro === e} onClick={() => setFiltro(filtro === e ? '' : e)}>
            <span className="suave">{ROTULO_ESTADO_FILA[e]}</span>
            <strong style={{ fontSize: '1.6rem', fontFamily: 'var(--titulo)' }}>{contagens[e] ?? '—'}</strong>
          </button>
        ))}
      </div>

      {podeGerir && <p><button className="btn btn-suave" onClick={() => { acordar({ todos: true }); aviso.info('A processar os documentos em espera de todos os utilizadores neste computador.'); }}><Play size={15} aria-hidden="true" />Processar toda a fila neste computador</button></p>}

      <section className="cartao">
        {erro ? <EstadoErro aoTentar={carregar} />
          : !linhas ? <Esqueleto linhas={5} altura={22} />
          : linhas.length === 0 ? <EstadoVazio titulo="Fila vazia" texto="Os documentos enviados aparecem aqui enquanto são lidos." />
          : (
            <div className="tabela-rolar"><table>
              <thead><tr><th>Documento</th><th>Estado</th><th style={{ minWidth: 150 }}>Progresso</th><th>Tentativas</th><th>Criado</th><th>Concluído</th><th></th></tr></thead>
              <tbody>{linhas.map((f) => (
                <tr key={f.id}>
                  <td><Link className="dc-ligacao" to={`/documentos/${f.documento_id}`}>{f.documentos?.nome_ficheiro || 'Documento'}</Link></td>
                  <td>{interrompido(f) ? 'Interrompido' : ROTULO_ESTADO_FILA[f.estado]}{f.erro_mensagem && <><br /><span className="dc-fino">{f.erro_mensagem}</span></>}</td>
                  <td><BarraProgresso valor={f.progresso} rotulo={`Progresso de ${f.documentos?.nome_ficheiro || 'documento'}`} /></td>
                  <td>{f.tentativas}</td>
                  <td>{formatarDataHora(f.criado_em)}</td>
                  <td>{formatarDataHora(f.concluido_em)}</td>
                  <td>{podeRepetir && (f.estado === 'falhou' || interrompido(f)) && <button className="btn btn-suave" onClick={() => repetir(f)}>{f.estado === 'falhou' ? 'Tentar de novo' : 'Retomar'}</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        {linhas?.length === 200 && <p className="dc-fino">A mostrar os 200 trabalhos mais recentes.</p>}
      </section>
    </>
  );
}
