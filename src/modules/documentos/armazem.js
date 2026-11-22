// Cópia do ficheiro original SÓ neste computador (IndexedDB). O original nunca é enviado para o servidor.
// Se o IndexedDB não estiver disponível (ex.: separador privado), usa a memória até fechar a página.
const BD = '3mind-originais';
const LOJA = 'ficheiros';
const SETE_DIAS = 7 * 24 * 3600 * 1000;
const memoria = new Map();

function abrir() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('sem indexedDB'));
    const p = indexedDB.open(BD, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(LOJA);
    p.onsuccess = () => resolve(p.result);
    p.onerror = () => reject(p.error);
  });
}
async function operar(modo, fn, loja = LOJA) {
  const bd = await abrir();
  try {
    return await new Promise((resolve, reject) => {
      const t = bd.transaction(loja, modo);
      const r = fn(t.objectStore(loja));
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally { bd.close(); }
}

// Cifra o original com AES-GCM; a chave é gerada neste browser e não pode ser exportada.
// Protege contra a leitura casual dos ficheiros do perfil do browser; não substitui a protecção do computador.
async function chave() {
  let k = await operar('readonly', (l) => l.get('k'), 'chave');
  if (!k) {
    k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await operar('readwrite', (l) => l.put(k, 'k'), 'chave');
  }
  return k;
}

export async function guardarOriginal(id, blob, mime) {
  memoria.set(id, { blob, mime, em: Date.now() });
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(), await blob.arrayBuffer());
    await operar('readwrite', (l) => l.put({ dados, iv, mime, em: Date.now() }, id));
  } catch { /* fica em memória */ }
}
export async function obterOriginal(id) {
  if (memoria.has(id)) return memoria.get(id).blob;
  try {
    const r = await operar('readonly', (l) => l.get(id));
    if (!r?.dados) return null;
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv }, await chave(), r.dados);
    return new Blob([claro], { type: r.mime });
  } catch { return null; }
}
export async function apagarOriginal(id) {
  memoria.delete(id);
  try { await operar('readwrite', (l) => l.delete(id)); } catch { /* nada */ }
}
export async function limparAntigos() {
  try {
    const bd = await abrir();
    await new Promise((resolve) => {
      const t = bd.transaction(LOJA, 'readwrite');
      const c = t.objectStore(LOJA).openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur) return;
        if (Date.now() - (cur.value?.em || 0) > SETE_DIAS) cur.delete();
        cur.continue();
      };
      t.oncomplete = () => { bd.close(); resolve(); };
      t.onerror = () => { bd.close(); resolve(); };
    });
  } catch { /* nada */ }
}
