// Classificação automática por palavras-chave ponderadas (não é IA generativa). Devolve o tipo provável,
// o nível de confiança e alternativas; com pouca confiança o sistema pede confirmação ao utilizador.
import { norm } from './texto';

export const LIMITE_CONFIANCA = 55; // abaixo disto pede confirmação; 55-100 segue (o tipo fica visível e corrigível)

export function classificar(texto, perfis) {
  const t = ` ${norm(texto)} `;
  const inicio = t.slice(0, 700);
  const pares = [];
  for (const p of perfis) for (const [termo, peso] of p.termos || []) pares.push({ id: p.id, termo: norm(termo), peso });
  pares.sort((a, b) => b.termo.length - a.termo.length); // frases longas primeiro ("factura-recibo" antes de "recibo")
  const grupos = new Map();
  for (const p of pares) { if (!grupos.has(p.termo)) grupos.set(p.termo, []); grupos.get(p.termo).push(p); }

  let trabalho = t;
  let cabeca = inicio;
  const pontos = {};
  for (const [termo, donos] of grupos) {
    const re = new RegExp(`(?<![a-z0-9])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?![a-z0-9])`, 'g');
    const n = (trabalho.match(re) || []).length;
    if (!n) continue;
    const noTitulo = (cabeca.match(re) || []).length;
    for (const { id, peso } of donos) pontos[id] = (pontos[id] || 0) + peso * Math.min(n, 3) + peso * Math.min(noTitulo, 2) * 0.5;
    trabalho = trabalho.replace(re, ' ');
    cabeca = cabeca.replace(re, ' ');
  }
  const ordem = Object.entries(pontos).sort((a, b) => b[1] - a[1]);
  if (!ordem.length || ordem[0][1] < 2) return { tipo: 'outros', confianca: 0, alternativas: [], sinais: 0 };
  const [melhor, s1] = ordem[0];
  const s2 = ordem[1]?.[1] ?? 0;
  const confianca = Math.min(97, Math.round((100 * s1) / (s1 + s2 * 1.2 + 1.5)));
  const alternativas = ordem.slice(1, 4).map(([tipo, s]) => ({ tipo, confianca: Math.min(97, Math.round((100 * s) / (s + s1 * 1.2 + 1.5))) }));
  return { tipo: melhor, confianca, alternativas, sinais: s1 };
}
