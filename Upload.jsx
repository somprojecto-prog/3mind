import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, UploadCloud, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { aviso, mensagemErro, Roda } from '@/shared/notificacoes';
import { TIPOS_ACEITES, TAMANHO_MAXIMO } from '../ocr/config';
import { iniciarProcessador } from '../fila/processador';
import { ErroUtilizador, enviarDocumento, listarCategorias } from './servico';

export default function Upload() {
  const { perfil } = useAuth();
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [itens, setItens] = useState([]);
  const [sobre, setSobre] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const entrada = useRef(null);

  useEffect(() => { listarCategorias().then(setCategorias).catch(() => {}); }, []);

  const actualizar = (id, campos) => setItens((l) => l.map((i) => (i.id === id ? { ...i, ...campos } : i)));

  async function enviar(lista) {
    const novos = [...lista].map((f) => ({ id: crypto.randomUUID(), nome: f.name, estado: 'espera', ficheiro: f }));
    if (!novos.length) return;
    setItens((l) => [...novos, ...l]);
    setAEnviar(true);
    let enviados = 0;
    for (const n of novos) {
      actualizar(n.id, { estado: 'a_enviar' });
      try {
        const docId = await enviarDocumento(n.ficheiro, perfil.id, categoria);
        actualizar(n.id, { estado: 'enviado', docId, ficheiro: null });
        enviados += 1;
      } catch (e) {
        actualizar(n.id, { estado: 'erro', mensagem: e instanceof ErroUtilizador ? e.message : mensagemErro(e, 'enviar o ficheiro'), ficheiro: null });
      }
    }
    setAEnviar(false);
    if (enviados) {
      aviso.sucesso(enviados === 1 ? 'Documento enviado. A leitura começa já.' : `${enviados} documentos enviados. A leitura começa já.`);
      iniciarProcessador(perfil.id); // idempotente; acorda a fila
    }
  }

  const aoLargar = (e) => { e.preventDefault(); setSobre(false); if (!aEnviar) enviar(e.dataTransfer.files); };

  return (
    <section className="cartao">
      <h2>Enviar documentos</h2>
      <p className="suave dc-sub">
        Aceita {Object.values(TIPOS_ACEITES).join(', ')} até {TAMANHO_MAXIMO / 1048576} MB cada. Pode escolher vários de uma vez.
        A leitura (OCR) acontece neste computador, por isso deixe esta janela aberta até terminar. Use apenas documentos de teste enquanto o sistema não estiver aprovado pela AGT.
      </p>
      <label className="grelha-form" style={{ maxWidth: 320, marginBottom: '1rem' }}>Categoria (opcional)
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>

      <label
        className={`dc-zona ${sobre ? 'dc-zona-sobre' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={aoLargar}
      >
        <UploadCloud size={32} aria-hidden="true" />
        <strong>{aEnviar ? 'A enviar…' : 'Arraste ficheiros para aqui ou clique para escolher'}</strong>
        <input
          ref={entrada} type="file" multiple disabled={aEnviar}
          accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
          onChange={(e) => { enviar(e.target.files); e.target.value = ''; }}
        />
      </label>

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
