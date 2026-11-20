import { useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { EstadoVazio } from '@/shared/notificacoes';
import { ESTADOS, ROTULO_ESTADO } from './constantes';
import { diaMes, numero } from './formatar';

// Gráficos em SVG/CSS puro: sem dependências extra.

function escala(maior) {
  if (maior <= 4) return { passo: 1, maximo: 4 };
  const bruto = maior / 4;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((x) => x * p).find((x) => x >= bruto);
  return { passo, maximo: passo * 4 };
}

const L = 640, A = 250, M = { e: 38, d: 12, t: 12, b: 28 };

/** Recebidos vs. concluídos por dia. */
export function GraficoDiario({ serie }) {
  const [activo, setActivo] = useState(null);
  const ref = useRef(null);
  const maior = Math.max(0, ...serie.flatMap((p) => [p.recebidos, p.concluidos]));
  if (maior === 0) {
    return <EstadoVazio icone={Activity} titulo="Sem actividade neste período" texto="Quando houver documentos recebidos ou concluídos, o gráfico aparece aqui." />;
  }
  const { passo, maximo } = escala(maior);
  const util = L - M.e - M.d;
  const alto = A - M.t - M.b;
  const x = (i) => M.e + (serie.length === 1 ? util / 2 : (i * util) / (serie.length - 1));
  const y = (v) => M.t + alto - (v / maximo) * alto;
  const linha = (chave) => serie.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[chave]).toFixed(1)}`).join('');
  const area = (chave) => `${linha(chave)}L${x(serie.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const saltos = Math.ceil(serie.length / 8);
  const totais = serie.reduce((t, p) => ({ r: t.r + p.recebidos, c: t.c + p.concluidos }), { r: 0, c: 0 });

  const mover = (e) => {
    const caixa = ref.current.getBoundingClientRect();
    const px = ((e.clientX - caixa.left) / caixa.width) * L;
    const i = Math.round(((px - M.e) / util) * (serie.length - 1));
    setActivo(Math.max(0, Math.min(serie.length - 1, i)));
  };
  const p = activo != null ? serie[activo] : null;

  return (
    <figure className="graf" ref={ref}>
      <figcaption className="so-leitores">
        Nos últimos {serie.length} dias: {numero(totais.r)} documentos recebidos e {numero(totais.c)} concluídos.
      </figcaption>
      <div className="graf-legenda">
        <span><i className="graf-ponto graf-recebidos" />Recebidos</span>
        <span><i className="graf-ponto graf-concluidos" />Concluídos</span>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Gráfico de documentos recebidos e concluídos por dia"
        onPointerMove={mover} onPointerLeave={() => setActivo(null)}>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={M.e} x2={L - M.d} y1={y(k * passo)} y2={y(k * passo)} className="graf-grelha" />
            <text x={M.e - 6} y={y(k * passo) + 4} textAnchor="end" className="graf-eixo">{numero(k * passo)}</text>
          </g>
        ))}
        {serie.map((q, i) => (i % saltos === 0 || i === serie.length - 1) && (
          <text key={q.dia} x={x(i)} y={A - 8} textAnchor="middle" className="graf-eixo">{diaMes(q.data)}</text>
        ))}
        <path d={area('recebidos')} className="graf-area graf-area-recebidos" />
        <path d={area('concluidos')} className="graf-area graf-area-concluidos" />
        <path d={linha('concluidos')} pathLength="1" className="graf-linha graf-linha-concluidos" />
        <path d={linha('recebidos')} pathLength="1" className="graf-linha graf-linha-recebidos" />
        {p && (
          <g>
            <line x1={x(activo)} x2={x(activo)} y1={M.t} y2={y(0)} className="graf-guia" />
            <circle cx={x(activo)} cy={y(p.recebidos)} r="4.5" className="graf-marca graf-marca-recebidos" />
            <circle cx={x(activo)} cy={y(p.concluidos)} r="4.5" className="graf-marca graf-marca-concluidos" />
          </g>
        )}
      </svg>
      {p && (
        <div className="graf-dica" style={{ left: `${(x(activo) / L) * 100}%` }}>
          <strong>{diaMes(p.data)}</strong>
          <span>Recebidos: {numero(p.recebidos)}</span>
          <span>Concluídos: {numero(p.concluidos)}</span>
        </div>
      )}
    </figure>
  );
}

/** Distribuição dos documentos por estado. */
export function Rosca({ porEstado, total }) {
  if (!total) {
    return <EstadoVazio titulo="Ainda não há documentos" texto="A distribuição por estado aparece quando o primeiro documento for recebido." />;
  }
  const R = 64, C = 2 * Math.PI * R;
  let acumulado = 0;
  const partes = ESTADOS.map((e) => {
    const valor = porEstado[e] || 0;
    const comprimento = (valor / total) * C;
    const parte = { estado: e, valor, comprimento, desvio: -acumulado };
    acumulado += comprimento;
    return parte;
  });
  return (
    <div className="rosca">
      <svg viewBox="0 0 160 160" role="img" aria-label="Distribuição dos documentos por estado">
        <circle cx="80" cy="80" r={R} className="rosca-fundo" />
        {partes.filter((p) => p.valor > 0).map((p) => (
          <circle key={p.estado} cx="80" cy="80" r={R} className={`rosca-parte cor-${p.estado}`}
            style={{ strokeDasharray: `${Math.max(p.comprimento - 1.5, 0.1)} ${C}`, strokeDashoffset: p.desvio }} />
        ))}
        <text x="80" y="78" textAnchor="middle" className="rosca-total">{numero(total)}</text>
        <text x="80" y="96" textAnchor="middle" className="rosca-legenda">documentos</text>
      </svg>
      <ul className="rosca-lista">
        {partes.map((p) => (
          <li key={p.estado}>
            <i className={`graf-ponto cor-fundo-${p.estado}`} />
            <span>{ROTULO_ESTADO[p.estado]}</span>
            <strong>{numero(p.valor)}</strong>
            <small>{Math.round((p.valor / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Documentos por categoria. */
export function BarrasCategorias({ itens }) {
  if (!itens.length) {
    return <EstadoVazio titulo="Sem categorias para mostrar" texto="Os documentos categorizados aparecem aqui." />;
  }
  const maior = Math.max(...itens.map((i) => i.total));
  return (
    <ul className="barras">
      {itens.map((i) => (
        <li key={i.nome}>
          <div className="barras-topo"><span>{i.nome}</span><strong>{numero(i.total)}</strong></div>
          <div className="barras-pista"><div className="barras-barra" style={{ width: `${(i.total / maior) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
