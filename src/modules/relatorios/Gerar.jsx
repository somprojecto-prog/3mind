import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, RotateCcw, Table } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { registarAuditoria } from '@/lib/auditoria';
import { aviso, EstadoErro, EstadoVazio, Esqueleto, mensagemErro, Roda } from '@/shared/notificacoes';
import { ESTADOS, ROTULO_ESTADO, SECCOES, carregarCategorias, carregarRelatorio, descreverFiltros, filtrosPadrao } from './dados';
import { blobCSV } from './exportar/csv';
import { baixar, nomeFicheiro } from './exportar/ficheiro';

const LINHAS_PREVIA = 25;
const numero = (n) => new Intl.NumberFormat('pt-AO').format(n);
const mostrar = (v) => (v == null || v === '' ? '—' : String(v));

export default function Gerar() {
  const { perfil } = useAuth();
  const local = useLocation();
  const inicial = { ...filtrosPadrao(), ...(local.state?.filtros || {}) };
  const [filtros, setFiltros] = useState(inicial);
  const [aplicados, setAplicados] = useState(inicial);
  const [categorias, setCategorias] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState('');
  const [aGerar, setAGerar] = useState(true);
  const [aba, setAba] = useState('estatisticas');
  const [exportando, setExportando] = useState(null);
  const pedido = useRef(0);

  const gerar = useCallback(async (f) => {
    const meu = ++pedido.current;
    setAGerar(true);
    setErro('');
    try {
      const r = await carregarRelatorio(f);
      if (meu !== pedido.current) return;
      setRelatorio(r);
      setAplicados(f);
    } catch (e) {
      if (meu !== pedido.current) return;
      setRelatorio(null);
      setErro(mensagemErro(e, 'gerar a pré-visualização do relatório'));
    } finally {
      if (meu === pedido.current) setAGerar(false);
    }
  }, []);

  useEffect(() => {
    gerar(inicial);
    carregarCategorias().then(setCategorias).catch((e) => aviso.erro(mensagemErro(e, 'carregar as categorias')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const aplicar = (e) => {
    e.preventDefault();
    if (!filtros.inicio || !filtros.fim) return aviso.erro('Indique a data inicial e a data final.');
    if (filtros.inicio > filtros.fim) return aviso.erro('A data inicial não pode ser depois da data final.');
    return gerar(filtros);
  };

  const repor = () => { const p = filtrosPadrao(); setFiltros(p); gerar(p); };

  async function registar(formato, seccao) {
    const desc = descreverFiltros(aplicados, categorias);
    const { data, error } = await supabase.from('relatorios').insert({
      formato,
      criado_por: perfil.id,
      filtros: {
        inicio: aplicados.inicio, fim: aplicados.fim, estado: aplicados.estado, categoria: aplicados.categoria,
        categoria_nome: desc.categoria, ...(seccao ? { seccao } : {}),
      },
    }).select('id').single();
    if (error) { aviso.info('O ficheiro foi gerado, mas não ficou registado no histórico de relatórios.'); return; }
    registarAuditoria('exportar_relatorio', 'relatorios', data.id, { formato, seccao: seccao || 'todas', documentos: relatorio.resumo.total });
  }

  async function exportar(formato) {
    setExportando(formato);
    try {
      const geradoEm = new Date();
      const contexto = { descricao: descreverFiltros(aplicados, categorias), geradoPor: perfil.nome || perfil.email, geradoEm };
      let blob, nome, seccao = null;
      if (formato === 'csv') {
        const sec = SECCOES.find((s) => s.id === aba);
        blob = blobCSV(sec.colunas, relatorio.seccoes[sec.id]);
        nome = nomeFicheiro('csv', `${sec.id}${relatorio.meta.truncado ? '-incompleto' : ''}`, geradoEm);
        seccao = sec.titulo;
      } else if (formato === 'xlsx') {
        const { blobXLSX } = await import('./exportar/xlsx');
        blob = await blobXLSX(relatorio, contexto);
        nome = nomeFicheiro('xlsx', relatorio.meta.truncado ? 'incompleto' : '', geradoEm);
      } else {
        const { blobPDF } = await import('./exportar/pdf');
        blob = await blobPDF(relatorio, contexto);
        nome = nomeFicheiro('pdf', relatorio.meta.truncado ? 'incompleto' : '', geradoEm);
      }
      baixar(blob, nome);
      aviso.sucesso(`Relatório ${formato.toUpperCase()} gerado: ${nome}`);
      await registar(formato, seccao);
    } catch (e) {
      aviso.erro(mensagemErro(e, 'gerar o ficheiro'));
    } finally {
      setExportando(null);
    }
  }

  const seccao = SECCOES.find((s) => s.id === aba);
  const linhas = relatorio?.seccoes[aba] || [];
  const semDados = relatorio && relatorio.resumo.total === 0;
  const podeExportar = Boolean(relatorio) && !semDados && !aGerar && !exportando;

  return (
    <>
      <form className="cartao" onSubmit={aplicar}>
        <div className="grelha-form">
          <label>Enviados desde<input type="date" value={filtros.inicio} onChange={mudar('inicio')} required /></label>
          <label>Enviados até<input type="date" value={filtros.fim} onChange={mudar('fim')} required /></label>
          <label>Estado
            <select value={filtros.estado} onChange={mudar('estado')}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{ROTULO_ESTADO[e]}</option>)}
            </select>
          </label>
          <label>Categoria
            <select value={filtros.categoria} onChange={mudar('categoria')}>
              <option value="">Todas</option>
              <option value="sem">Sem categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="rel-botoes">
          <button type="submit" className="btn btn-primario" disabled={aGerar}>{aGerar && <Roda />}Aplicar filtros</button>
          <button type="button" className="btn btn-suave" onClick={repor} disabled={aGerar}><RotateCcw size={16} aria-hidden="true" />Repor filtros</button>
        </div>
        <p className="suave rel-nota">O período é a data em que os documentos foram enviados para o 3MIND, não a data escrita no documento.</p>
        {perfil.papel === 'operador' && <p className="suave rel-nota">O relatório inclui apenas os documentos que enviou.</p>}
      </form>

      {erro && <section className="cartao"><EstadoErro texto={erro} aoTentar={() => gerar(aplicados)} /></section>}

      {aGerar && !relatorio && !erro && (
        <section className="cartao" aria-busy="true"><Esqueleto altura={20} linhas={6} /></section>
      )}

      {relatorio && (
        <section className={`cartao ${aGerar ? 'rel-a-carregar' : ''}`}>
          {relatorio.meta.truncado && (
            <p className="erro rel-aviso" role="alert">
              Relatório incompleto: existem {numero(relatorio.meta.total)} documentos nestes filtros, mas só {numero(relatorio.meta.incluidos)} foram incluídos (o limite é {numero(relatorio.meta.limite)}, dos mais recentes). Todos os números abaixo referem-se só a estes. Reduza o período para ver todos.
            </p>
          )}
          {semDados ? (
            <EstadoVazio titulo="Nenhum documento encontrado" texto="Não há documentos para este período, estado e categoria. Alargue o período ou escolha outros filtros." />
          ) : (
            <>
              <div className="rel-resumo">
                <div><span>Documentos</span><strong>{numero(relatorio.resumo.total)}</strong></div>
                <div><span>Páginas analisadas</span><strong>{numero(relatorio.resumo.paginas)}</strong></div>
                <div><span>Lidos (processados + revisão)</span><strong>{numero(relatorio.resumo.lidos)}</strong></div>
                <div><span>Erros por resolver</span><strong>{numero(relatorio.resumo.errosAbertos)}</strong></div>
                <div><span>Avisos por resolver</span><strong>{numero(relatorio.resumo.avisosAbertos)}</strong></div>
                <div><span>Para revisão</span><strong>{numero(relatorio.resumo.paraRevisao)}</strong></div>
              </div>

              <div className="rel-exportar">
                <div className="rel-botoes">
                  <button type="button" className="btn btn-primario" disabled={!podeExportar} onClick={() => exportar('xlsx')}>
                    {exportando === 'xlsx' ? <Roda /> : <FileSpreadsheet size={16} aria-hidden="true" />}Exportar XLSX
                  </button>
                  <button type="button" className="btn btn-primario" disabled={!podeExportar} onClick={() => exportar('pdf')}>
                    {exportando === 'pdf' ? <Roda /> : <FileText size={16} aria-hidden="true" />}Exportar PDF
                  </button>
                  <button type="button" className="btn btn-suave" disabled={!podeExportar} onClick={() => exportar('csv')}>
                    {exportando === 'csv' ? <Roda /> : <Table size={16} aria-hidden="true" />}Exportar CSV
                  </button>
                </div>
                <p className="suave rel-nota"><Download size={13} aria-hidden="true" /> O XLSX e o PDF incluem todas as secções. O CSV inclui só a secção seleccionada: <strong>{seccao.titulo}</strong>.</p>
              </div>

              <div className="rel-abas" role="tablist" aria-label="Secções do relatório">
                {SECCOES.map((s) => (
                  <button key={s.id} type="button" role="tab" aria-selected={aba === s.id} className={`rel-aba ${aba === s.id ? 'activa' : ''}`} onClick={() => setAba(s.id)}>
                    {s.titulo}<span>{numero(relatorio.seccoes[s.id].length)}</span>
                  </button>
                ))}
              </div>

              {linhas.length === 0 ? (
                <EstadoVazio titulo={`Sem registos em “${seccao.titulo}”`} texto="Para estes filtros não há nada a mostrar nesta secção." />
              ) : (
                <>
                  <div className="tabela-rolar">
                    <table>
                      <thead><tr>{seccao.colunas.map((c) => <th key={c.chave}>{c.titulo}</th>)}</tr></thead>
                      <tbody>
                        {linhas.slice(0, LINHAS_PREVIA).map((l, i) => (
                          <tr key={i}>{seccao.colunas.map((c) => <td key={c.chave}>{mostrar(l[c.chave])}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="suave rel-nota">A mostrar {Math.min(LINHAS_PREVIA, linhas.length)} de {numero(linhas.length)} linhas. Os ficheiros exportados incluem todas.</p>
                </>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
