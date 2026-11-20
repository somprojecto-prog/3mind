import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import './notificacoes.css';

// API estável usada por todos os módulos:
//   aviso.sucesso('...')   aviso.erro('...')   aviso.info('...')
// Segundo argumento opcional: { duracao } em milissegundos.
const ouvintes = new Set();
let contador = 0;
const DURACAO = { sucesso: 5000, info: 5000, erro: 8000 };
const MAXIMO_VISIVEIS = 4;

function emitir(tipo, texto, opcoes = {}) {
  if (!texto) return;
  const novo = { id: ++contador, tipo, texto: String(texto), duracao: opcoes.duracao ?? DURACAO[tipo] };
  ouvintes.forEach((f) => f(novo));
}

export const aviso = {
  sucesso: (texto, opcoes) => emitir('sucesso', texto, opcoes),
  erro: (texto, opcoes) => emitir('erro', texto, opcoes),
  info: (texto, opcoes) => emitir('info', texto, opcoes),
};

const ICONES = { sucesso: CheckCircle2, erro: AlertCircle, info: Info };

function ItemAviso({ a, fechar }) {
  const [pausado, setPausado] = useState(false);

  // O aviso fecha sozinho, mas fica parado enquanto o rato ou o foco estão sobre ele.
  useEffect(() => {
    if (pausado) return undefined;
    const t = setTimeout(() => fechar(a.id), a.duracao);
    return () => clearTimeout(t);
  }, [pausado, a.id, a.duracao, fechar]);

  const Icone = ICONES[a.tipo] || Info;
  return (
    <div
      className={`n-aviso n-aviso-${a.tipo}`}
      role={a.tipo === 'erro' ? 'alert' : 'status'}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <Icone size={20} className="n-aviso-icone" aria-hidden="true" />
      <p>{a.texto}</p>
      <button type="button" className="n-aviso-fechar" aria-label="Fechar aviso" onClick={() => fechar(a.id)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Avisos() {
  const [lista, setLista] = useState([]);
  const fechar = useCallback((id) => setLista((l) => l.filter((x) => x.id !== id)), []);

  useEffect(() => {
    const ouvir = (novo) => {
      setLista((l) => {
        // Evita empilhar o mesmo aviso várias vezes seguidas.
        if (l.some((x) => x.tipo === novo.tipo && x.texto === novo.texto)) return l;
        return [...l.slice(-(MAXIMO_VISIVEIS - 1)), novo];
      });
    };
    ouvintes.add(ouvir);
    return () => ouvintes.delete(ouvir);
  }, []);

  return (
    <div className="n-avisos">
      {lista.map((a) => <ItemAviso key={a.id} a={a} fechar={fechar} />)}
    </div>
  );
}
