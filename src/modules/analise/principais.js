import { dataValidaISO, nifValido } from '../ocr/extracao';
import { camposPrincipais } from '../ocr/extracao';

// Campos "principais" guardados no próprio documento (pesquisa, clientes, duplicados), conforme o perfil.
export function principaisDoPerfil(perfil, dados) {
  if (!perfil.principais) return camposPrincipais(dados);
  const act = dados.filter((d) => String(d.valor ?? '').trim() && !(d.corrigido_manual && !String(d.valor).trim()));
  const de = (k) => (k ? (act.filter((d) => d.campo === k).sort((a, b) => (b.corrigido_manual ? 1 : 0) - (a.corrigido_manual ? 1 : 0) || (b.confianca ?? 100) - (a.confianca ?? 100))[0]?.valor ?? null) : null);
  const nif = de(perfil.principais.nif); const data = de(perfil.principais.data); const ref = de(perfil.principais.referencia);
  return {
    nif: nif && nifValido(String(nif).trim().toUpperCase()) ? String(nif).trim().toUpperCase() : null,
    referencia: ref ? String(ref).trim() : null,
    data_documento: data && dataValidaISO(String(data).trim()) ? String(data).trim() : null,
  };
}
