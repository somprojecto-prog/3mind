import { useCallback, useEffect, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { registarAuditoria } from '@/lib/auditoria';
import { aviso, EstadoErro, EstadoVazio, Esqueleto, mensagemErro } from '@/shared/notificacoes';
import { rotuloCampo, tipoCampo } from '../analise/perfis';
import { normalizarComparacao } from '../analise/motor/campos';
import { estadoDaLinha } from './comparar';
import { EstadoTag } from '../documentos/Componentes';
import { ROTULO_ESTADO, formatarData, formatarDataHora } from '../documentos/estados';
import { listarDocumentos } from '../documentos/servico';
import './comparacao.css';

const MAXIMO = 6;
async function construir(ids) {
  const [docs, dados] = await Promise.all([
    supabase.from('documentos').select('id, nome_ficheiro, estado, nif, referencia, data_documento, paginas, categorias(nome)').in('id', ids),
    supabase.from('dados_extraidos').select('documento_id, campo, valor, corrigido_manual, pagina').in('documento_id', ids),
  ]);
  if (docs.error) throw docs.error;
  if (dados.error) throw dados.error;
  const documentos = ids.map((id) => docs.data.find((d) => d.id === id)).filter(Boolean);
  if (documentos.length < 2) throw new Error('Não foi possível aceder a pelo menos dois dos documentos.');

  const linhas = [];
  const juntar = (rotulo, celulas, chave, tipo = 'texto') => {
    const estado = estadoDaLinha(celulas, tipo);
    linhas.push({ chave, rotulo, celulas, estado, diferente: estado !== 'igual' });
  };

  const ignorados = new Set(['item', 'movimento', 'clausula']);
  const campos = [...new Set(dados.data.map((r) => r.campo))].filter((c) => !ignorados.has(c));
  for (const campo of campos) {
    const celulas = documentos.map((d) => {
      const vistos = new Map();
      for (const r of dados.data) {
        if (r.documento_id !== d.id || r.campo !== campo || !String(r.valor ?? '').trim()) continue;
        const norma = normalizarComparacao(tipoCampo(campo), r.valor);
        if (!vistos.has(norma)) vistos.set(norma, { texto: r.valor, norma, pagina: r.pagina });
      }
      return [...vistos.values()];
    });
    if (celulas.some((c) => c.length)) juntar(rotuloCampo(campo), celulas, campo, tipoCampo(campo));
  }
  const meta = [
    ['Categoria', (d) => d.categorias?.nome], ['Páginas', (d) => d.paginas], ['Estado', (d) => ROTULO_ESTADO[d.estado]],
    ['Data do documento', (d) => (d.data_documento ? formatarData(d.data_documento) : null)],
  ];
  for (const [rotulo, obter] of meta) {
    const celulas = documentos.map((d) => { const v = obter(d); return v == null || v === '' ? [] : [{ texto: String(v), norma: String(v).toUpperCase() }]; });
    juntar(rotulo, celulas, `meta-${rotulo}`);
  }
  return { documentos, linhas };
}

export default function Comparacao() {
  const { perfil } = useAuth();
  const [q, setQ] = useState('');
  const [lista, setLista] = useState(null);
  const [erroLista, setErroLista] = useState(false);
  const [params] = useSearchParams();
  const [escolhidos, setEscolhidos] = useState(() => (params.get('docs') || '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, MAXIMO));
  const [resultado, setResultado] = useState(null);
  const [aComparar, setAComparar] = useState(false);
  const [recentes, setRecentes] = useState([]);
  const [soDiferencas, setSoDiferencas] = useState(false);

  const carregarRecentes = useCallback(async () => {
    const { data } = await supabase.from('comparacoes').select('id, documento_ids, criado_em, resultado').eq('criado_por', perfil.id).order('criado_em', { ascending: false }).limit(6);
    setRecentes(data || []);
  }, [perfil.id]);
  useEffect(() => { carregarRecentes(); }, [carregarRecentes]);

  useEffect(() => {
    let cancelado = false;
    const t = setTimeout(() => {
      listarDocumentos({ q, pagina: 0 }).then((r) => { if (!cancelado) { setLista(r.linhas); setErroLista(false); } }).catch(() => { if (!cancelado) setErroLista(true); });
    }, 300);
    return () => { cancelado = true; clearTimeout(t); };
  }, [q]);

  const alternar = (id) => setEscolhidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : e.length >= MAXIMO ? (aviso.info(`Pode comparar até ${MAXIMO} documentos.`), e) : [...e, id]));

  async function comparar(ids = escolhidos, guardar = true) {
    setAComparar(true);
    try {
      const r = await construir(ids);
      setResultado(r);
      if (guardar) {
        const diferencas = r.linhas.filter((l) => l.diferente).map((l) => l.rotulo);
        const { error } = await supabase.from('comparacoes').insert({ documento_ids: ids, resultado: { diferencas, total: r.linhas.length }, criado_por: perfil.id });
        if (!error) { registarAuditoria('comparar_documentos', 'comparacoes', null, { documentos: ids.length, diferencas: diferencas.length }); carregarRecentes(); }
      }
    } catch (e) { aviso.erro(e.message?.startsWith('Não foi possível aceder') ? e.message : mensagemErro(e, 'comparar os documentos')); }
    setAComparar(false);
  }

  const nDif = resultado ? resultado.linhas.filter((l) => l.diferente).length : 0;
  const visiveis = resultado ? resultado.linhas.filter((l) => !soDiferencas || l.diferente) : [];
  const ROTULO = { igual: 'Igual', difere: 'Difere', falta: 'Falta num documento' };
  function exportarCsv() {
    const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const cab = ['Campo', ...resultado.documentos.map((d) => d.nome_ficheiro), 'Resultado'];
    const corpo = visiveis.map((l) => [l.rotulo, ...l.celulas.map((c) => c.map((x) => x.texto).join(' / ')), ROTULO[l.estado]]);
    const blob = new Blob(['\ufeff' + [cab, ...corpo].map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'comparacao-3mind.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <h1>Comparação</h1>
      <p className="suave" style={{ marginTop: 0 }}>Escolha dois ou mais documentos (até {MAXIMO}) para ver o que coincide e o que difere. A comparação usa os dados extraídos, incluindo as suas correcções.</p>

      <section className="cartao">
        <label style={{ maxWidth: 360, marginBottom: '1rem' }}>Pesquisar documentos<input type="search" placeholder="Nome, NIF ou referência" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {erroLista ? <EstadoErro />
          : !lista ? <Esqueleto linhas={4} altura={22} />
          : lista.length === 0 ? <EstadoVazio titulo="Nenhum documento encontrado" />
          : (
            <div className="tabela-rolar"><table>
              <thead><tr><th></th><th>Documento</th><th>NIF</th><th>Referência</th><th>Estado</th></tr></thead>
              <tbody>{lista.map((d) => (
                <tr key={d.id}>
                  <td><input type="checkbox" checked={escolhidos.includes(d.id)} onChange={() => alternar(d.id)} aria-label={`Seleccionar ${d.nome_ficheiro}`} /></td>
                  <td>{d.nome_ficheiro}</td><td>{d.nif || '—'}</td><td>{d.referencia || '—'}</td><td><EstadoTag estado={d.estado} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        <p><button className="btn btn-primario" disabled={escolhidos.length < 2 || aComparar} onClick={() => comparar()}><GitCompare size={16} aria-hidden="true" />{aComparar ? 'A comparar…' : `Comparar (${escolhidos.length})`}</button></p>
      </section>

      {recentes.length > 0 && (
        <section className="cartao">
          <h2>Comparações recentes</h2>
          <ul className="dc-lista">{recentes.map((r) => (
            <li key={r.id}><div>{r.documento_ids.length} documentos · {r.resultado?.diferencas?.length ?? 0} diferenças<br /><span className="dc-fino">{formatarDataHora(r.criado_em)}</span></div>
              <button className="btn btn-suave" onClick={() => { setEscolhidos(r.documento_ids); comparar(r.documento_ids, false); }}>Abrir de novo</button></li>
          ))}</ul>
        </section>
      )}

      {resultado && (
        <section className="cartao">
          <h2>Resultado</h2>
          <p className={nDif ? 'erro' : 'sucesso'} role="status">{nDif ? `${nDif} campo(s) com diferenças ou em falta, destacados abaixo.` : 'Todos os campos comparados coincidem.'}</p>
          <div className="dc-accoes" style={{ marginBottom: '.8rem' }}>
            <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}><input type="checkbox" checked={soDiferencas} onChange={(e) => setSoDiferencas(e.target.checked)} /> Mostrar só diferenças</label>
            <button className="btn btn-suave" onClick={exportarCsv}>Exportar tabela (CSV)</button>
          </div>
          <p className="dc-fino">Montantes iguais até 2 cêntimos (ou 0,05 %) contam como iguais; nomes comparam-se sem acentos nem maiúsculas.</p>
          <div className="tabela-rolar"><table className="cmp-tabela">
            <thead><tr><th>Campo</th>{resultado.documentos.map((d) => <th key={d.id}>{d.nome_ficheiro}</th>)}<th>Resultado</th></tr></thead>
            <tbody>{visiveis.map((l) => (
              <tr key={l.chave} className={l.diferente ? 'cmp-dif' : ''}>
                <th scope="row">{l.rotulo}</th>
                {l.celulas.map((c, i) => <td key={resultado.documentos[i].id}>{c.length ? c.map((x) => <div key={x.norma}>{x.texto}{x.pagina ? <span className="suave"> · pág. {x.pagina}</span> : null}</div>) : <span className="suave">—</span>}</td>)}
                <td>{l.diferente ? <strong>{ROTULO[l.estado]}</strong> : <span className="suave">Igual</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
