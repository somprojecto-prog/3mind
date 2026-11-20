const LOCAL = 'pt-AO';
const fNumero = new Intl.NumberFormat(LOCAL);
const fDiaMes = new Intl.DateTimeFormat(LOCAL, { day: '2-digit', month: '2-digit' });
const fData = new Intl.DateTimeFormat(LOCAL, { day: '2-digit', month: '2-digit', year: 'numeric' });
const fHora = new Intl.DateTimeFormat(LOCAL, { hour: '2-digit', minute: '2-digit' });

export const numero = (n) => fNumero.format(Number.isFinite(n) ? n : 0);
export const diaMes = (d) => fDiaMes.format(d);
export const dataCurta = (iso) => fData.format(new Date(iso));
export const horaCurta = (d) => fHora.format(d);

export function haQuanto(iso, agora = Date.now()) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'agora mesmo';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  return dataCurta(iso);
}

export function duracao(segundos) {
  if (segundos == null) return '—';
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

// Chave de dia na hora local (AAAA-MM-DD).
export const chaveDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
