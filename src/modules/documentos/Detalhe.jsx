import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { pode } from '@/lib/permissoes';
import { aviso, BarraProgresso, EstadoErro, Esqueleto, mensagemErro, Roda } from '@/shared/notificacoes';
import { ANALISES, PERFIS, obterAnalise, obterPerfil, rotuloCampo, rotuloTipo } from '../analise/perfis';
import { confirmarTipo, pesquisarNoTexto } from '../analise/servico';
import { dividirPaginas } from '../analise/motor/texto';
import { executarValidacao, resolverValidacao } from '../validacao/servico';
import { acordar, repetirTrabalho } from '../fila/processador';
import { Confianca, EstadoTag } from './Componentes';
import { ROTULO_ESTADO_FILA, formatarData, formatarDataHora, formatarTamanho } from './estados';
import {
  acrescentarDado, carregarAuditoriaDoDocumento, carregarDetalhe, corrigirDado, definirCategoria,
  descarregarFicheiro, eliminarDocumento, listarCategorias, reprocessarDocumento,
} from './servico';

function Visualizador({ documento, pagina }) {
  const [url, setUrl] = useState(null);
  const [falha, setFalha] = useState(false);
  useEffect(() => {
    let criado = null;
    let cancelado = false;
    setUrl(null); setFalha(false);
    descarregarFicheiro(documento.storage_path)
      .then((b) => { if (!cancelado) { criado = URL.createObjectURL(new Blob([b], { type: documento.mime_type })); setUrl(criado); } })
      .catch(() => { if (!cancelado) setFalha(true); });
    return () => { cancelado = true; if (criado) URL.revokeObjectURL(criado); };
  }, [documento.storage_path, documento.mime_type]);

  if (falha) return <EstadoErro titulo="Não foi possível mostrar o ficheiro" texto="Tente recarregar a página." />;
  if (!url) return <Esqueleto altura={360} />;
  return (
    <>
      {documento.mime_type === 'application/pdf'
        ? <iframe key={pagina || 0} className="dc-visor" src={pagina ? `${url}#page=${pagina}` : url} title={`Visualização de ${documento.nome_ficheiro}`} />
        : <img className="dc-imagem" src={url} alt={`Imagem de ${documento.nome_ficheiro}`} />}
      <p><a className="dc-ligacao" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" /> Abrir numa janela nova</a></p>
    </>
  );
}

function LinhaDado({ linha, editavel, aoGuardar, aoDescartar, aoLocalizar }) {
  const [valor, setValor] = useState(linha.valor ?? '');
  useEffect(() => setValor(linha.valor ?? ''), [linha.valor]);
  const descartado = linha.corrigido_manual && !(linha.valor || '').trim();
  const alterado = valor !== (linha.valor ?? '');
  const rotulo = rotuloCampo(linha.campo);
  return (
    <tr className={descartado ? 'dc-descartado' : ''}>
      <td>{rotulo}</td>
      <td>
        <input className="dc-celula-input" value={valor} disabled={!editavel} aria-label={`Valor de ${rotulo}`}
          title={linha.corrigido_manual && linha.valor_original ? `Lido originalmente: ${linha.valor_original}` : undefined}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && alterado) aoGuardar(linha, valor); }} />
      </td>
      <td><Confianca valor={linha.confianca} /></td>
      <td>{linha.pagina ? <button type="button" className="btn btn-suave" onClick={() => aoLocalizar(linha)} title="Ver a origem no documento">Pág. {linha.pagina}</button> : '—'}</td>
      <td>{descartado ? 'Descartado' : linha.corrigido_manual ? 'Corrigido' : 'Lido'}</td>
      {editavel && (
        <td><div className="dc-accoes">
          {alterado && <button className="btn btn-primario" onClick={() => aoGuardar(linha, valor)}>Guardar</button>}
          {!descartado && !alterado && <button className="btn btn-suave" onClick={() => aoDescartar(linha)}>Descartar</button>}
        </div></td>
      )}
    </tr>
  );
}

function SeparadorDados({ dados, editavel, aoGuardar, aoDescartar, aoAcrescentar, aoLocalizar, perfilDoc }) {
  const opcoes = perfilDoc.campos.filter((c) => !['itens', 'movimentos', 'clausulas'].includes(c.tipo));
  const [campo, setCampo] = useState(opcoes[0]?.chave || 'nif');
  const [valor, setValor] = useState('');
  return (
    <>
      {dados.length === 0 ? <p className="suave">Ainda não há dados lidos neste documento.</p> : (
        <div className="tabela-rolar">
          <table>
            <thead><tr><th>Campo</th><th>Valor</th><th>Confiança</th><th>Página</th><th>Origem</th>{editavel && <th></th>}</tr></thead>
            <tbody>{dados.map((l) => <LinhaDado key={l.id} linha={l} editavel={editavel} aoGuardar={aoGuardar} aoDescartar={aoDescartar} aoLocalizar={aoLocalizar} />)}</tbody>
          </table>
        </div>
      )}
      <p className="dc-fino">A leitura é automática e pode ter erros. Confirme os valores contra o documento; as correcções ficam registadas.</p>
      {editavel && (
        <form className="dc-novo" onSubmit={(e) => { e.preventDefault(); if (valor.trim()) { aoAcrescentar(campo, valor); setValor(''); } }}>
          <label>Campo
            <select value={campo} onChange={(e) => setCampo(e.target.value)}>{opcoes.map((c) => <option key={c.chave} value={c.chave}>{c.rotulo}</option>)}</select>
          </label>
          <label>Valor<input value={valor} onChange={(e) => setValor(e.target.value)} /></label>
          <button className="btn btn-suave">Acrescentar</button>
        </form>
      )}
    </>
  );
}

function SeparadorValidacoes({ validacoes, podeResolver, podeValidar, aoResolver, aoValidar, aValidar }) {
  const abertas = validacoes.filter((v) => !v.resolvida);
  const fechadas = validacoes.filter((v) => v.resolvida);
  const item = (v) => (
    <li key={v.id} className={v.resolvida ? 'dc-resolvida' : ''}>
      <span className={`dc-severidade dc-sev-${v.severidade}`}>{v.severidade === 'erro' ? 'Erro' : v.severidade === 'aviso' ? 'Aviso' : 'Info'}</span>
      <div>{v.mensagem}<br /><span className="dc-fino">{formatarDataHora(v.criado_em)}{v.resolvida ? (v.resolvida_manual ? ' · resolvida por uma pessoa' : ' · já não se verifica') : ''}</span></div>
      {!v.resolvida && podeResolver && <button className="btn btn-suave" onClick={() => aoResolver(v)}>Marcar como resolvida</button>}
    </li>
  );
  return (
    <>
      {podeValidar && <p><button className="btn btn-suave" onClick={aoValidar} disabled={aValidar}>{aValidar ? <Roda /> : <RefreshCw size={15} aria-hidden="true" />} Validar de novo</button></p>}
      {abertas.length === 0 ? <p className="sucesso">Sem problemas por resolver.</p> : <ul className="dc-lista">{abertas.map(item)}</ul>}
      {fechadas.length > 0 && <details style={{ marginTop: '1rem' }}><summary>Resolvidas ({fechadas.length})</summary><ul className="dc-lista" style={{ marginTop: '.6rem' }}>{fechadas.map(item)}</ul></details>}
    </>
  );
}

const TIPOS_CONTAGEM = [
  ['campo_vazio', 'Campos incompletos'], ['aritmetica', 'Erros aritméticos'], ['divergencia', 'Divergências'], ['duplicado', 'Duplicados'], ['alerta', 'Alertas'],
];

function SeparadorResultado({ d, perfilDoc, aoLocalizar }) {
  const { documento, dados, validacoes } = d;
  const abertas = validacoes.filter((v) => !v.resolvida);
  const ocr = documento.classificacao?.ocr?.media;
  const obrigatorios = perfilDoc.campos.filter((c) => c.obrigatorio);
  const validados = obrigatorios.filter((c) => dados.some((x) => x.campo === c.chave && (x.valor || '').trim()) && !abertas.some((v) => v.campo === c.chave && v.severidade !== 'info'));
  const revisao = documento.estado === 'revisao' || abertas.some((v) => v.severidade !== 'info') || (ocr != null && ocr < 70);
  const principais = dados.filter((x) => !['item', 'movimento', 'clausula'].includes(x.campo) && (x.valor || '').trim());
  return (
    <>
      <p><span className="an-etiqueta">{rotuloTipo(documento.tipo_documento)}</span><span className="an-etiqueta">{obterAnalise(documento.tipo_analise).rotulo}</span></p>
      <h3>Resumo</h3>
      {documento.resumo ? <p>{documento.resumo}</p> : <p className="suave">{['resumo', 'completa'].includes(documento.tipo_analise) ? 'Ainda sem resumo.' : 'O tipo de análise escolhido não inclui resumo.'}</p>}
      {documento.resumo && <p className="dc-fino">Resumo automático escrito por regras a partir dos dados lidos; confirme contra o documento.</p>}
      <dl className="dc-meta">
        <div><dt>Confiança do OCR</dt><dd>{ocr != null ? `${Math.round(ocr)}%` : '—'}</dd></div>
        <div><dt>Campos obrigatórios validados</dt><dd>{validados.length} de {obrigatorios.length}</dd></div>
        {TIPOS_CONTAGEM.map(([t, r]) => <div key={t}><dt>{r}</dt><dd>{abertas.filter((v) => v.tipo === t).length}</dd></div>)}
        <div><dt>Revisão humana</dt><dd>{revisao ? 'Necessária' : 'Não detectada'}</dd></div>
      </dl>
      <h3>Dados principais</h3>
      {principais.length === 0 ? <p className="suave">Sem dados lidos.</p> : (
        <div className="tabela-rolar"><table><thead><tr><th>Campo</th><th>Valor</th><th>Página</th></tr></thead>
          <tbody>{principais.map((x) => <tr key={x.id}><td>{rotuloCampo(x.campo)}</td><td>{x.valor}</td><td>{x.pagina ? <button type="button" className="btn btn-suave" onClick={() => aoLocalizar(x)}>Pág. {x.pagina}</button> : '—'}</td></tr>)}</tbody></table></div>
      )}
      {['comparacao', 'completa'].includes(documento.tipo_analise) && <p style={{ marginTop: '1rem' }}><Link className="btn btn-suave" to={`/comparacao?docs=${documento.id}`}>Comparar com outros documentos</Link></p>}
    </>
  );
}

function SeparadorOriginal({ documento, destaque }) {
  const paginas = dividirPaginas(documento.texto_original);
  const [q, setQ] = useState('');
  const termo = q.trim().length >= 2 ? q.trim() : destaque?.valor || '';
  const resultados = pesquisarNoTexto(documento.texto_original, q);
  const marcar = (t) => {
    if (!termo) return t;
    const partes = t.split(new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'));
    return partes.map((p, i) => (i % 2 ? <mark key={i} className="an-mark">{p}</mark> : p));
  };
  if (!paginas.length) return <p className="suave">O texto original ainda não está disponível.</p>;
  return (
    <>
      <label style={{ maxWidth: 360, marginBottom: '.8rem' }}>Pesquisar no documento<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Palavra, número ou referência" /></label>
      {q.trim().length >= 2 && <p className="dc-fino">{resultados.length} resultado(s){resultados.length ? ': ' + [...new Set(resultados.map((r) => `pág. ${r.pagina}`))].join(', ') : ''}.</p>}
      {paginas.map((p, i) => (
        <details key={i} open={destaque?.pagina === i + 1 || paginas.length === 1 || (q.trim().length >= 2 && resultados.some((r) => r.pagina === i + 1))} style={{ marginBottom: '.6rem' }}>
          <summary>Página {i + 1}</summary>
          <div className="an-pagina">{marcar(p)}</div>
        </details>
      ))}
    </>
  );
}

function PainelTipo({ documento, aoConfirmar, aA }) {
  const [tipo, setTipo] = useState(documento.tipo_documento || 'outros');
  const cl = documento.classificacao || {};
  return (
    <div className="an-confirmar" role="alert">
      <strong>{cl.pendente ? 'Confirme o tipo de documento' : 'Confirmar o tipo de documento'}</strong>
      <p style={{ margin: '.4rem 0' }}>{cl.pendente
        ? `O 3MIND acha que é "${rotuloTipo(cl.tipo)}", mas só com ${cl.confianca ?? 0}% de confiança. A análise só continua depois de confirmar.`
        : `Escolheu "${rotuloTipo(documento.tipo_documento)}", mas o conteúdo parece ser "${rotuloTipo(cl.divergente?.tipo)}" (${cl.divergente?.confianca}%).`}</p>
      <div className="dc-accoes">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de documento">{PERFIS.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}</select>
        <button className="btn btn-primario" disabled={aA} onClick={() => aoConfirmar(tipo)}>{aA ? <Roda /> : null} Confirmar e analisar</button>
      </div>
    </div>
  );
}

function SeparadorHistorico({ fila, auditoria, podeRepetir, aoRepetir }) {
  return (
    <>
      <h3>Processamento</h3>
      {fila.length === 0 ? <p className="suave">Sem registos de processamento.</p> : (
        <div className="tabela-rolar"><table>
          <thead><tr><th>Estado</th><th>Progresso</th><th>Tentativas</th><th>Início</th><th>Fim</th><th></th></tr></thead>
          <tbody>{fila.map((f) => (
            <tr key={f.id}>
              <td>{ROTULO_ESTADO_FILA[f.estado]}{f.erro_mensagem && <><br /><span className="dc-fino">{f.erro_mensagem}</span></>}</td>
              <td style={{ minWidth: 130 }}><BarraProgresso valor={f.progresso} rotulo="Progresso do processamento" /></td>
              <td>{f.tentativas}</td><td>{formatarDataHora(f.iniciado_em)}</td><td>{formatarDataHora(f.concluido_em)}</td>
              <td>{f.estado === 'falhou' && podeRepetir && <button className="btn btn-suave" onClick={() => aoRepetir(f)}>Tentar de novo</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {auditoria && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Quem fez o quê</h3>
          {auditoria.length === 0 ? <p className="suave">Sem registos.</p> : (
            <div className="tabela-rolar"><table>
              <thead><tr><th>Data e hora</th><th>Utilizador</th><th>Acção</th></tr></thead>
              <tbody>{auditoria.map((a) => (
                <tr key={a.id}><td>{formatarDataHora(a.criado_em)}</td><td>{a.profiles?.nome || a.profiles?.email || 'Sistema'}</td><td>{a.accao}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}
    </>
  );
}

export default function Detalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { perfil } = useAuth();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState('resultado');
  const [categorias, setCategorias] = useState([]);
  const [auditoria, setAuditoria] = useState(null);
  const [aValidar, setAValidar] = useState(false);
  const [origem, setOrigem] = useState(null);
  const [aConfirmar, setAConfirmar] = useState(false);

  const carregar = useCallback(async () => {
    try { setD(await carregarDetalhe(id)); setErro(null); } catch (e) { setErro(e); }
  }, [id]);
  useEffect(() => { setD(null); setAuditoria(null); carregar(); }, [carregar]);
  useEffect(() => { listarCategorias().then(setCategorias).catch(() => {}); }, []);

  const emCurso = Boolean(d) && ['pendente', 'em_processamento'].includes(d.documento.estado);
  useEffect(() => {
    if (!emCurso) return undefined;
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [emCurso, carregar]);

  const verAuditoria = pode(perfil.papel, 'admin.auditoria');
  useEffect(() => {
    if (aba !== 'historico' || !verAuditoria) return;
    carregarAuditoriaDoDocumento(id).then(setAuditoria).catch(() => setAuditoria([]));
  }, [aba, id, verAuditoria, d?.documento.actualizado_em]);

  if (erro) {
    return <EstadoErro titulo={erro.code === 'PGRST116' ? 'Documento não encontrado' : 'Não foi possível carregar o documento'}
      texto={erro.code === 'PGRST116' ? 'Pode ter sido removido ou não ter permissão para o ver.' : undefined}
      aoTentar={erro.code === 'PGRST116' ? undefined : carregar} />;
  }
  if (!d) return <Esqueleto linhas={8} altura={22} />;

  const { documento, dados, validacoes, fila } = d;
  const perfilDoc = obterPerfil(documento.tipo_documento);
  const precisaTipo = Boolean(documento.classificacao?.pendente || documento.classificacao?.divergente);
  const editavel = pode(perfil.papel, 'documentos.editar') && !emCurso;
  const abertas = validacoes.filter((v) => !v.resolvida).length;

  async function depois(mensagem) {
    try { await executarValidacao(id); } catch { /* a validação pode ser repetida à mão */ }
    await carregar();
    aviso.sucesso(mensagem);
  }
  const guardar = async (linha, valor) => {
    if (!valor.trim()) return aviso.erro('Indique um valor. Para ignorar esta linha use "Descartar".');
    try { await corrigirDado(linha.id, valor, perfil.id); await depois('Valor guardado.'); } catch (e) { aviso.erro(mensagemErro(e, 'guardar o valor')); }
    return undefined;
  };
  const descartar = async (linha) => {
    try { await corrigirDado(linha.id, '', perfil.id); await depois('Linha descartada.'); } catch (e) { aviso.erro(mensagemErro(e, 'descartar a linha')); }
  };
  const acrescentar = async (campo, valor) => {
    try { await acrescentarDado(id, campo, valor, perfil.id); await depois('Dado acrescentado.'); } catch (e) { aviso.erro(mensagemErro(e, 'acrescentar o dado')); }
  };
  const resolver = async (v) => {
    try { await resolverValidacao(v.id, id); await carregar(); aviso.sucesso('Marcada como resolvida.'); } catch (e) { aviso.erro(mensagemErro(e, 'resolver')); }
  };
  const validarDeNovo = async () => {
    setAValidar(true);
    try { await executarValidacao(id, { forcar: true }); await carregar(); aviso.sucesso('Validação actualizada.'); } catch (e) { aviso.erro(mensagemErro(e, 'validar')); }
    setAValidar(false);
  };
  const mudarCategoria = async (e) => {
    try { await definirCategoria(id, e.target.value); await carregar(); } catch (er) { aviso.erro(mensagemErro(er, 'mudar a categoria')); }
  };
  const repetir = async (f) => {
    try { await repetirTrabalho(f.id, id, { todos: documento.enviado_por !== perfil.id }); await carregar(); aviso.info('O documento voltou à fila.'); } catch (e) { aviso.erro(mensagemErro(e, 'repetir o processamento')); }
  };
  const reprocessar = async () => {
    if (!window.confirm('Reprocessar apaga os dados lidos e as correcções feitas à mão neste documento, e lê o ficheiro outra vez. Continuar?')) return;
    try { await reprocessarDocumento(id); await carregar(); aviso.info('O documento voltou à fila.'); acordar({ todos: documento.enviado_por !== perfil.id }); } catch (e) { aviso.erro(mensagemErro(e, 'reprocessar')); }
  };
  const localizar = (linha) => { setOrigem(linha); setAba('original'); };
  const mudarTipo = async (tipo) => {
    setAConfirmar(true);
    try { await confirmarTipo(id, tipo); await carregar(); aviso.sucesso('Tipo confirmado. Análise actualizada.'); } catch (e) { aviso.erro(mensagemErro(e, 'analisar com o tipo escolhido')); }
    setAConfirmar(false);
  };
  const eliminar = async () => {
    if (!window.confirm(`Eliminar "${documento.nome_ficheiro}" de forma definitiva? Esta acção não pode ser desfeita.`)) return;
    try { await eliminarDocumento(documento); aviso.sucesso('Documento eliminado.'); navegar('/documentos'); } catch (e) { aviso.erro(mensagemErro(e, 'eliminar o documento')); }
  };

  return (
    <>
      <p><Link className="dc-ligacao" to="/documentos"><ArrowLeft size={14} aria-hidden="true" /> Voltar aos documentos</Link></p>
      <div className="dc-cabeca">
        <div><h2 style={{ marginBottom: '.3rem' }}>{documento.nome_ficheiro}</h2><EstadoTag estado={documento.estado} /> <span className="an-etiqueta">{rotuloTipo(documento.tipo_documento)}</span><span className="an-etiqueta">{obterAnalise(documento.tipo_analise).rotulo}</span></div>
        <div className="dc-accoes">
          {pode(perfil.papel, 'fila.gerir') && <button className="btn btn-suave" onClick={reprocessar} disabled={emCurso}>Reprocessar</button>}
          {pode(perfil.papel, 'admin.utilizadores') && <button className="btn btn-suave dc-perigo" onClick={eliminar}><Trash2 size={15} aria-hidden="true" />Eliminar</button>}
        </div>
      </div>

      {emCurso && <p className="sucesso" role="status"><Roda /> {documento.estado === 'pendente' ? 'À espera de ser lido.' : 'A ler o documento…'} Esta página actualiza sozinha.</p>}

      {precisaTipo && pode(perfil.papel, 'documentos.editar') && <PainelTipo documento={documento} aoConfirmar={mudarTipo} aA={aConfirmar} />}

      <section className="cartao">
        <dl className="dc-meta">
          <div><dt>Enviado por</dt><dd>{documento.profiles?.nome || documento.profiles?.email || '—'}</dd></div>
          <div><dt>Enviado em</dt><dd>{formatarDataHora(documento.criado_em)}</dd></div>
          <div><dt>Tamanho</dt><dd>{formatarTamanho(documento.tamanho_bytes)}{documento.paginas ? ` · ${documento.paginas} pág.` : ''}</dd></div>
          <div><dt>NIF</dt><dd>{documento.nif || '—'}</dd></div>
          <div><dt>Referência</dt><dd>{documento.referencia || '—'}</dd></div>
          <div><dt>Data do documento</dt><dd>{formatarData(documento.data_documento)}</dd></div>
          <div><dt>Categoria</dt><dd>
            {pode(perfil.papel, 'documentos.editar')
              ? <select value={documento.categoria_id || ''} onChange={mudarCategoria} aria-label="Categoria"><option value="">Sem categoria</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              : (documento.categorias?.nome || '—')}
          </dd></div>
        </dl>
      </section>

      <div className="dc-detalhe">
        <section className="cartao"><Visualizador documento={documento} pagina={origem?.pagina} /></section>
        <section className="cartao">
          <div className="dc-abas" role="tablist">
            {[['resultado', 'Resultado'], ['dados', 'Dados extraídos'], ['validacoes', `Validações${abertas ? ` (${abertas})` : ''}`], ['original', 'Texto original'], ['historico', 'Histórico']].map(([k, r]) => (
              <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{r}</button>
            ))}
          </div>
          {aba === 'resultado' && <SeparadorResultado d={d} perfilDoc={perfilDoc} aoLocalizar={localizar} />}
          {aba === 'dados' && <SeparadorDados dados={dados} editavel={editavel} aoGuardar={guardar} aoDescartar={descartar} aoAcrescentar={acrescentar} aoLocalizar={localizar} perfilDoc={perfilDoc} />}
          {aba === 'original' && <SeparadorOriginal documento={documento} destaque={origem} />}
          {aba === 'validacoes' && <SeparadorValidacoes validacoes={validacoes} podeResolver={editavel && pode(perfil.papel, 'validacao.resolver')} podeValidar={editavel} aoResolver={resolver} aoValidar={validarDeNovo} aValidar={aValidar} />}
          {aba === 'historico' && <SeparadorHistorico fila={fila} auditoria={verAuditoria ? auditoria : null} podeRepetir={pode(perfil.papel, 'documentos.editar')} aoRepetir={repetir} />}
        </section>
      </div>
    </>
  );
}
