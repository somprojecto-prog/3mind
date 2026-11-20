import { useEffect, useRef, useState } from 'react';

// Anima um número até ao valor novo (respeita "reduzir movimento").
export function useContagem(alvo, duracao = 700) {
  const [valor, setValor] = useState(0);
  const actual = useRef(0);
  useEffect(() => {
    const reduzido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzido || actual.current === alvo) { actual.current = alvo; setValor(alvo); return undefined; }
    const de = actual.current;
    const t0 = performance.now();
    let id;
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / duracao);
      actual.current = Math.round(de + (alvo - de) * (1 - (1 - p) ** 3));
      setValor(actual.current);
      if (p < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo, duracao]);
  return valor;
}

// Devolve "agora" e re-renderiza de x em x milissegundos (para "há 3 min").
export function useAgora(intervalo = 30000) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervalo);
    return () => clearInterval(t);
  }, [intervalo]);
  return agora;
}
