// Regra de comparação de uma linha (função pura, testada em testes/analise.mjs).
import { iguais } from '../analise/motor/texto';

/**
 * celulas: por documento, lista de { norma } já normalizada. Devolve 'igual' | 'difere' | 'falta'.
 * Montantes comparam-se com tolerância; um documento sem valor conta como 'falta' (não como diferença de conteúdo).
 */
export function estadoDaLinha(celulas, tipo = 'texto') {
  const cheias = celulas.filter((c) => c.length);
  if (!cheias.length) return 'igual';
  const montante = tipo === 'valor' || tipo === 'numero';
  const ref = cheias[0];
  const mesmo = (a, b) => (montante
    ? a.length === b.length && a.every((x) => b.some((y) => iguais(x.norma, y.norma)))
    : a.map((x) => x.norma).sort().join('|') === b.map((x) => x.norma).sort().join('|'));
  if (cheias.some((c) => !mesmo(c, ref))) return 'difere';
  return cheias.length < celulas.length ? 'falta' : 'igual';
}
