import { ROTULO_ESTADO } from './estados';
import './documentos.css';

export function EstadoTag({ estado }) {
  return <span className={`dc-est dc-est-${estado}`}>{ROTULO_ESTADO[estado] ?? estado}</span>;
}

export function Confianca({ valor }) {
  if (valor == null) return <span className="suave">—</span>;
  const v = Math.round(Number(valor));
  const nivel = v >= 85 ? 'alta' : v >= 70 ? 'media' : 'baixa';
  return <span className={`dc-conf dc-conf-${nivel}`} title="Confiança da leitura">{v}%</span>;
}
