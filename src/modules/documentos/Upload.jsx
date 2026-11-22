import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icones from 'lucide-react';
import { CheckCircle2, HelpCircle, Search, UploadCloud, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { registarAuditoria } from '@/lib/auditoria';
import { aviso, mensagemErro, Roda } from '@/shared/notificacoes';
import { TIPOS_ACEITES, TAMANHO_MAXIMO } from '../ocr/config';
import { iniciarProcessador } from '../fila/processador';
import { ANALISES, AUTO, PERFIS, obterAnalise, rotuloTipo } from '../analise/perfis';
import { norm } from '../analise/motor/texto';
import { ErroUtilizador, enviarDocumento, listarCategorias } from './servico';

const Icone = ({ nome, ...p }) => { const C = Icones[nome] || Icones.File; return <C aria-hidden="true" {...p} />; };

function Cartao({ icone, titulo, descricao, escolhido, aoEscolher }) {
  return (
    <button type="button" className={`an-cartao ${escolhido ? 'an-cartao-on' : ''}`} onClick={aoEscolher} aria-pressed={escolhido}>
      <Icone nome={icone} size={22} />
      <strong>{titulo}</strong>
      <span>{descricao}</span>
    </button>
  );
}

export default function Upload() {
  const { perfil } = useAuth();
  const [passo, setPasso] = useState(1);
  const [tipo, setTipo] = useState(null);
  const [analise, setAnalise] = useState('completa');
  const [busca, setBusca] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [itens, setItens] = useState([]);
  const [sobre, setSobre] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const entrada = useRef(null);

  useEffect(() => { listarCategorias().then(setCategorias).catch(() => {}); }, []);
  const actualizar = (id, campos) => setItens((l) => l.map((i) => (i.id === id ? { ...i, ...campos } : i)));

  const filtrados = useMemo(() => {
    const q = norm(busca);
    return PERFIS.filter((p) => !q || norm(`${p.rotulo} ${p.descricao}`).includes(q));
  }, [busca]);

  async function enviar(lista) {
    const novos = [...lista].map((f) => ({ id: crypto.randomUUID(), nome: f.name, estado: 'espera', ficheiro: f }));
    if (!novos.length) return;
    setItens((l) => [...novos, ...l]);
    setAEnviar(true);
    let enviados = 0;
    for (const n of novos) {
      actualizar(n.id, { estado: 'a_enviar' });
      try {
        const docId = await enviarDocumento(n.ficheiro, perfil.id, categoria, { tipoDocumento: tipo, tipoAnalise: analise });
        actualizar(n.id, { estado: 'enviado', docId, ficheiro: null });
        registarAuditoria('seleccionar_tipo_documento', 'documentos', docId, { tipo, analise }).catch(() => {});
        enviados += 1;
      } catch (e) {
        actualizar(n.id, { estado: 'erro', mensagem: e instanceof ErroUtilizador ? e.message : mensagemErro(e, 'enviar o ficheiro'), ficheiro: null });
      }
    }
    setAEnviar(false);
    if (enviados) {
      aviso.sucesso(enviados === 1 ? 'Documento enviado. A leitura começa já.' : `${enviados} documentos enviados. A leitura começa já.`);
      iniciarProcessador(perfil.id);
    }
  }
  const aoLargar = (e) => { e.preventDefault(); setSobre(false); if (!aEnviar) enviar(e.dataTransfer.files); };

  return (
    <section className="cartao">
      <h2>Analisar documentos</h2>
      <ol className="an-passos" aria-label="Passos">
        {['Tipo de documento', 'Tipo de análise', 'Ficheiros'].map((t, i) => (
          <li key={t} className={passo === i + 1 ? 'an-passo-on' : passo > i + 1 ? 'an-passo-ok' : ''}>{i + 1}. {t}</li>
        ))}
      </ol>

      {passo === 1 && (
        <>
          <p className="suave dc-sub">Escolha o tipo de documento. O 3MIND adapta a leitura, os campos e as verificações a essa escolha.</p>
          <label className="an-pesquisa"><Search size={16} aria-hidden="true" />
            <input type="search" placeholder="Pesquisar tipo de documento" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar tipo de documento" />
          </label>
          <div className="an-grelha">
            {filtrados.map((p) => <Cartao key={p.id} icone={p.icone} titulo={p.rotulo} descricao={p.descricao} escolhido={tipo === p.id} aoEscolher={() => { setTipo(p.id); setPasso(2); }} />)}
            {(!busca || norm('Não sei identificar o documento').includes(norm(busca))) && (
              <Cartao icone="HelpCircle" titulo="Não sei identificar o documento" descricao="O 3MIND tenta classificar por palavras-chave e pede confirmação se tiver dúvidas." escolhido={tipo === AUTO} aoEscolher={() => { setTipo(AUTO); setPasso(2); }} />
            )}
          </div>
          {filtrados.length === 0 && <p className="suave">Nenhum tipo corresponde à pesquisa. Experimente "Outros documentos".</p>}
        </>
      )}

      {passo === 2 && (
        <>
          <p className="suave dc-sub">Tipo escolhido: <strong>{rotuloTipo(tipo)}</strong>. Agora escolha o que pretende fazer.</p>
          <div className="an-grelha">
            {ANALISES.map((a) => <Cartao key={a.id} icone={a.icone} titulo={a.rotulo} descricao={a.descricao} escolhido={analise === a.id} aoEscolher={() => { setAnalise(a.id); setPasso(3); }} />)}
          </div>
          <p><button className="btn btn-suave" onClick={() => setPasso(1)}>Voltar</button></p>
        </>
      )}

      {passo === 3 && (
        <>
          <p className="suave dc-sub">
            <strong>{rotuloTipo(tipo)}</strong> · {obterAnalise(analise).rotulo}. Aceita {Object.values(TIPOS_ACEITES).join(', ')} até {TAMANHO_MAXIMO / 1048576} MB cada.
            A leitura (OCR) acontece neste computador, por isso deixe esta janela aberta até terminar. O ficheiro original não é enviado para o sistema; no fim, o resultado é descarregado para este computador e fica disponível 7 dias. Máximo de 200 documentos por dia. Use apenas documentos de teste enquanto o sistema não estiver aprovado pela AGT.
          </p>
          <label className="grelha-form" style={{ maxWidth: 320, marginBottom: '1rem' }}>Categoria (opcional)
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Sem categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className={`dc-zona ${sobre ? 'dc-zona-sobre' : ''}`} onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={aoLargar}>
            <UploadCloud size={32} aria-hidden="true" />
            <strong>{aEnviar ? 'A enviar…' : 'Arraste ficheiros para aqui ou clique para escolher'}</strong>
            <input ref={entrada} type="file" multiple disabled={aEnviar} accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.jfif,.webp"
              onChange={(e) => { enviar(e.target.files); e.target.value = ''; }} />
          </label>
          <p><button className="btn btn-suave" onClick={() => setPasso(2)} disabled={aEnviar}>Voltar</button></p>
        </>
      )}

      {itens.length > 0 && (
        <ul className="dc-itens" aria-live="polite">
          {itens.map((i) => (
            <li key={i.id} className={`dc-item ${i.estado === 'erro' ? 'dc-item-erro' : ''}`}>
              <span>{i.nome}{i.mensagem && <><br /><span className="dc-fino">{i.mensagem}</span></>}</span>
              {i.estado === 'espera' && <span className="suave">À espera</span>}
              {i.estado === 'a_enviar' && <Roda rotulo="A enviar" />}
              {i.estado === 'enviado' && <><CheckCircle2 size={18} color="var(--ok)" aria-hidden="true" /><Link className="dc-ligacao" to={`/documentos/${i.docId}`}>Abrir</Link></>}
              {i.estado === 'erro' && <XCircle size={18} color="var(--erro)" aria-label="Falhou" />}
            </li>
          ))}
        </ul>
      )}
      {itens.some((i) => i.estado === 'enviado') && <p style={{ marginTop: '1rem' }}>Acompanhe o progresso na <Link className="dc-ligacao" to="/fila">fila de processamento</Link>.</p>}
    </section>
  );
}
void HelpCircle;
