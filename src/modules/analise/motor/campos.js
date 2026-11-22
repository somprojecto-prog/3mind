// Extracção guiada por perfil: lê os campos que o perfil do documento define, linha a linha, página a página.
// Não é inteligência artificial: usa rótulos ("NIF:", "Total a pagar:") e formatos. Tudo deve ser confirmado por uma pessoa.
import { MONEY, contarMoedas, limitar, limpar, moedaDeTexto, norm, primeiraData, primeiroNif, primeiroValor, numeroDeTexto } from './texto';

const CLASSES = { a: 'aàáâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç' };

/** Rótulo → expressão regular tolerante a acentos e espaços ("Data de emissão", "data de emissao"). */
function regexRotulo(rotulo, estrito = false) {
  const chars = [...String(rotulo)];
  const corpo = chars.map((ch, i) => {
    const l = ch.toLowerCase();
    if (l === 'c' && chars[i + 1]?.toLowerCase() === 't') return 'c?'; // factura/fatura, objecto/objeto
    if (/\s/.test(ch)) return String.raw`\s+`;
    if (CLASSES[l]) return `[${CLASSES[l]}]`;
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return new RegExp(String.raw`(?<![\p{L}\d])${corpo}(?![\p{L}])${estrito ? String.raw`(?=\s*[:=])` : ''}`, 'giu');
}

// Quem tem o NIF quando a linha é "Cliente: X • NIF 123": o NIF genérico segue o nome que o antecede na linha.
const NIF_DE = { cliente: 'nif_cliente', pagador: 'nif_pagador', destinatario: 'nif_destinatario', importador: 'nif_importador', titular: 'nif_titular', parte_a: 'nif_parte_a', parte_b: 'nif_parte_b', remetente: 'nif_remetente', fornecedor: 'nif_fornecedor', emitente: 'nif_emitente', beneficiario: 'nif_beneficiario' };
const NIF_GENERICOS = new Set(['nif', 'n.i.f', 'contribuinte']);
const EMPRESA = /\b(lda|limitada|s\.?\s?a\.?|ltd|unipessoal|sarl)\b\.?/i;
const IMPOSTOS = /\b(IVA|IRT|IAC|IPU|Imposto Industrial|Imposto de Selo|Imposto de Consumo|Imposto sobre o Rendimento[^.\n•]{0,30})\b/;
const NUMTOK = /^-?(?:\d{1,3}(?:[. ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)$/;
const TRACO = /^[—–-]$/;

// Linha de extracto: data (com ou sem ano), descrição, [débito] [crédito] saldo. "—" marca coluna vazia.
function lerMovimento(linha, ano) {
  const m = /^(?<d>\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?|\d{4}-\d{2}-\d{2})\s+(?:\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?\s+)?(?<r>.+)$/.exec(limpar(linha));
  if (!m) return null;
  const toks = m.groups.r.split(' ');
  const fim = [];
  while (toks.length && fim.length < 3 && (NUMTOK.test(toks[toks.length - 1]) || TRACO.test(toks[toks.length - 1]))) fim.unshift(toks.pop());
  if (!fim.length || TRACO.test(fim[fim.length - 1])) return null;
  let colunas = fim;
  if (fim.length === 3 && !fim.some((t) => TRACO.test(t))) { toks.push(fim[0]); colunas = fim.slice(1); } // 3 números sem "—": o primeiro é da descrição
  const saldo = Number(numeroDeTexto(colunas[colunas.length - 1].replace('-', '')));
  const negativo = colunas[colunas.length - 1].startsWith('-') ? -1 : 1;
  const montantes = colunas.slice(0, -1).filter((t) => NUMTOK.test(t)).map((t) => Number(numeroDeTexto(t)));
  const desc = toks.join(' ').trim();
  let data = primeiraData(m.groups.d)?.iso;
  if (!data) {
    const p = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/.exec(m.groups.d);
    if (!p) return null;
    const a = p[3] ? (p[3].length === 2 ? `20${p[3]}` : p[3]) : ano;
    if (!a) return null;
    const d = primeiraData(`${p[1]}/${p[2]}/${a}`);
    data = d?.ok ? d.iso : null;
  }
  if (!data || !Number.isFinite(saldo)) return null;
  return { data, desc, saldo: saldo * negativo, montante: montantes[0] ?? null };
}

const RESTO_INICIAL = /^[\s:.\-–=]*(?:n[.º°o]{1,2}\s*)?[\s:.\-–=]*/i;

// Linha de item: descrição, quantidade, preço unitário, total.
const NUM = String.raw`\d{1,3}(?:[. ]\d{3})*,\d{2}|\d{1,3}(?:\.\d{3})+(?![\d,])|\d+[.,]\d{2}(?!\d)|\d+(?:[.,]\d+)?`;
const ITEM = new RegExp(String.raw`^(?<desc>[^\d\s].{1,70}?)\s+(?<n1>${NUM})\s+(?<n2>${NUM})\s+(?<n3>${NUM})$`, 'i');
const SIMBOLO_MOEDA = /(?:R\$|US\$|€|\$|\b(?:kz|aoa|usd|eur|brl)\b)/gi;
const PALAVRAS_TOTAIS = /\b(sub-?total|total|iva|imposto|desconto|saldo|a pagar|troco)\b/i;
// Linha de movimento bancário: data, [data valor], descrição, montante, saldo.
const MOVIMENTO = new RegExp(String.raw`^(?<d1>\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}-\d{2}-\d{2})\s+(?:(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}-\d{2}-\d{2})\s+)?(?<desc>.{0,80}?)\s*(?<mont>-?${MONEY})\s+(?<saldo>-?${MONEY})\s*(?:kz|aoa|usd|eur)?$`, 'i');

function valorDoTipo(tipo, texto) {
  switch (tipo) {
    case 'nif': return primeiroNif(texto);
    case 'data': { const d = primeiraData(texto); return d ? { valor: d.iso, fraca: !d.ok } : null; }
    case 'valor': return primeiroValor(texto);
    case 'numero': { const v = primeiroValor(texto); return v; }
    case 'moeda': return moedaDeTexto(texto);
    case 'docnum': {
      const m = /\b((?:FT|FR|FS|NC|ND|GT|FA|VD|RC|GR)\s?[A-Z0-9]{1,12}(?:\s?\/\s?[A-Z0-9]{1,12})*\s?[/\-]\s?\d{1,8})\b/i.exec(texto);
      return m ? limpar(m[1]).toUpperCase() : valorDoTipo('ref', texto);
    }
    case 'periodo': {
      const r = /\b(\d{1,2})\s*[–\-a]\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/.exec(texto);
      if (r) { const a = primeiraData(`${r[1]}/${r[3]}/${r[4]}`); const b = primeiraData(`${r[2]}/${r[3]}/${r[4]}`); if (a?.ok && b?.ok) return `${a.iso} a ${b.iso}`; }
      const ds = [...String(texto).matchAll(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}-\d{2}-\d{2})\b/g)].map((m) => primeiraData(m[1])).filter((d) => d?.ok);
      return ds.length >= 2 ? `${ds[0].iso} a ${ds[1].iso}` : ds[0]?.iso ?? null;
    }
    case 'ref': {
      const sem = String(texto).split(/\s[•|·]\s?/)[0];
      for (const m of sem.matchAll(/((?:[A-Z]{1,4}\s)?[A-Za-z0-9][A-Za-z0-9/\-.]*[A-Za-z0-9])/g)) {
        if (/\d/.test(m[1]) && m[1].length >= 3 && !/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(m[1])) return m[1].toUpperCase();
      }
      return null;
    }
    default: {
      const t = limpar(String(texto).split(/\s[•|·]\s?|\s[•|·]$/)[0]).replace(/^[^:]{1,25}:\s*/, '').replace(/^[:.\-–=\s]+/, '').replace(/[;,\s]+$/, '');
      return t.length >= 2 ? t.slice(0, 200) : null;
    }
  }
}

/**
 * Extrai os campos do perfil. paginas: textos por página; confiancas: confiança do OCR por página (0-100).
 * Devolve [{ campo, valor, confianca, pagina }]. Campos com `multiplo` podem aparecer várias vezes.
 */
export function extrairPorPerfil(perfil, paginas, confiancas = []) {
  const campos = perfil.campos.filter((c) => c.rotulos?.length);
  const candidatos = new Map(); // campo -> [{ valor, confianca, pagina, ordem }]
  const poe = (campo, valor, confianca, pagina) => {
    if (!candidatos.has(campo)) candidatos.set(campo, []);
    const lista = candidatos.get(campo);
    if (!lista.some((x) => x.valor === valor)) lista.push({ valor, confianca: limitar(confianca), pagina, ordem: lista.length });
  };

  const regexes = [];
  for (const c of campos) for (const r of c.rotulos) regexes.push({ campo: c, rotulo: r, re: regexRotulo(r, c.estrito), len: r.length });

  paginas.forEach((texto, idx) => {
    const pagina = idx + 1;
    const base = Number(confiancas[idx] ?? 80) || 0;
    const linhas = String(texto).split(/\n/);
    const anoDoc = /\b(20\d{2})\b/.exec(paginas.join('\n'))?.[1];
    linhas.forEach((linha, i) => {
      // 1) encontrar todos os rótulos da linha; em caso de sobreposição, ganha o mais comprido
      const achados = [];
      for (const r of regexes) {
        r.re.lastIndex = 0;
        for (const m of linha.matchAll(r.re)) achados.push({ ...r, ini: m.index, fim: m.index + m[0].length });
      }
      achados.sort((a, b) => b.len - a.len || a.ini - b.ini);
      const escolhidos = [];
      for (const a of achados) if (!escolhidos.some((e) => a.ini < e.fim && a.fim > e.ini)) escolhidos.push(a);
      escolhidos.sort((a, b) => a.ini - b.ini);
      let nomeAnterior = null;

      // 2) o valor de cada rótulo vai até ao rótulo seguinte (ou ao fim da linha)
      escolhidos.forEach((e, k) => {
        const fimValor = k + 1 < escolhidos.length ? escolhidos[k + 1].ini : linha.length;
        let resto = linha.slice(e.fim, fimValor).replace(RESTO_INICIAL, '');
        if (!limpar(resto) && k === escolhidos.length - 1) { // valor na linha seguinte
          const seguinte = linhas.slice(i + 1, i + 3).find((l) => limpar(l));
          if (seguinte) resto = seguinte;
        }
        const tipo = e.campo.tipo;
        let chave = e.campo.chave;
        if (tipo === 'nif' && NIF_GENERICOS.has(norm(e.rotulo)) && nomeAnterior && perfil.campos.some((c) => c.chave === NIF_DE[nomeAnterior])) chave = NIF_DE[nomeAnterior];
        if (NIF_DE[e.campo.chave]) nomeAnterior = e.campo.chave;
        if (e.campo.bloco && tipo === 'texto') {
          const extra = [];
          for (const l of linhas.slice(i + 1, i + 4)) { if (!limpar(l)) break; extra.push(limpar(l)); }
          resto = [limpar(resto), ...extra].filter(Boolean).join(' ');
        }
        const r = valorDoTipo(tipo, resto);
        if (r == null || r === '') return;
        const valor = typeof r === 'object' ? r.valor : r;
        const fraca = typeof r === 'object' && r.fraca;
        poe(chave, String(valor), base + 5 - (fraca ? base * 0.5 : 0) - (i > 0 && !limpar(linha.slice(e.fim, fimValor)) ? 8 : 0), pagina);
      });

      // 3) tabelas
      if (perfil.campos.some((c) => c.chave === 'item')) {
        const m = ITEM.exec(limpar(linha.replace(SIMBOLO_MOEDA, ' ')));
        if (m && !PALAVRAS_TOTAIS.test(m.groups.desc)) {
          const [a, b, t] = [m.groups.n1, m.groups.n2, m.groups.n3].map((x) => Number(numeroDeTexto(x)));
          // quantidade × preço = total, em qualquer das duas ordens ("2 18.500,00" ou "2,99 15")
          const ordem = Math.abs(a * b - t) <= Math.max(0.05, t * 0.001) || Math.abs(b * a - t) <= 0.05 ? (Number.isInteger(a) || !Number.isInteger(b) ? [a, b] : [b, a]) : [a, b];
          poe('item', `${limpar(m.groups.desc)} | ${ordem[0]} | ${ordem[1].toFixed(2)} | ${t.toFixed(2)}`, base - 3, pagina);
        }
      }
      if (perfil.campos.some((c) => c.chave === 'movimento')) {
        const mv = lerMovimento(linha, anoDoc);
        if (mv) {
          if (/saldo\s+(inicial|anterior|transitado)/i.test(mv.desc)) poe('saldo_inicial', String(mv.saldo.toFixed(2)), base - 2, pagina);
          else if (/saldo\s+(final|actual|atual)/i.test(mv.desc)) poe('saldo_final', String(mv.saldo.toFixed(2)), base - 2, pagina);
          else if (mv.montante != null) poe('movimento', `${mv.data} | ${mv.desc} | ${mv.montante.toFixed(2)} | ${mv.saldo.toFixed(2)}`, base - 3, pagina);
        }
      }
    });
  });

  // data sem rótulo: primeira data válida das duas primeiras páginas (confiança mais baixa)
  for (const c of perfil.campos.filter((x) => x.tipo === 'data' && x.fallback && !candidatos.has(x.chave))) {
    for (let i = 0; i < Math.min(2, paginas.length); i += 1) {
      const d = primeiraData(paginas[i]);
      if (d?.ok) { poe(c.chave, d.iso, (Number(confiancas[i] ?? 80) || 0) - 15, i + 1); break; }
    }
  }
  if (perfil.campos.some((c) => c.tipo === 'clausulas')) {
    paginas.forEach((texto, idx) => {
      for (const l of String(texto).split(/\n/)) {
        if (/^\s*cl[aá]usula\b/i.test(l) && /(rescis|penalid|confidencial|foro|renova|responsabilidade|for[cç]a maior|propriedade intelectual|pagamento)/i.test(l)) poe('clausula', limpar(l).slice(0, 200), (Number(confiancas[idx] ?? 80) || 0) - 5, idx + 1);
      }
    });
  }
  // fornecedor/emitente sem rótulo: a primeira linha com "Lda"/"S.A." (cabeçalho do documento)
  for (const c of perfil.campos.filter((x) => x.deduzir === 'empresa' && !candidatos.has(x.chave))) {
    for (let i = 0; i < Math.min(2, paginas.length); i += 1) {
      const l = String(paginas[i]).split('\n').slice(0, 12).find((x) => EMPRESA.test(x) && !/cliente|recebemos|destinat|importador/i.test(x));
      if (l) { poe(c.chave, valorDoTipo('texto', l.trim()), (Number(confiancas[i] ?? 80) || 0) - 12, i + 1); break; }
    }
  }
  for (const c of perfil.campos.filter((x) => x.deduzir === 'imposto' && !candidatos.has(x.chave))) {
    const hit = IMPOSTOS.exec(paginas.join('\n'));
    if (hit) poe(c.chave, hit[1].toUpperCase() === hit[1] ? hit[1] : limpar(hit[1]), (Number(confiancas[0] ?? 80) || 0) - 15, 1);
  }
  // moeda: se o perfil a pede e não houve rótulo, usar a moeda mais frequente
  const todo = paginas.join('\n');
  if (perfil.campos.some((c) => c.chave === 'moeda') && !candidatos.has('moeda')) {
    const cont = Object.entries(contarMoedas(todo)).sort((a, b) => b[1] - a[1]);
    if (cont.length) poe('moeda', cont[0][0], (confiancas.length ? confiancas.reduce((a, b) => a + b, 0) / confiancas.length : 80) - 8, 1);
  }

  for (const c of perfil.campos) {
    if (c.fallback === 'primeira' && !candidatos.has(c.chave)) {
      for (let i = 0; i < Math.min(2, paginas.length); i += 1) {
        const d = primeiraData(paginas[i]);
        if (d) { poe(c.chave, d.iso, (Number(confiancas[i] ?? 80) || 0) - 15, i + 1); break; }
      }
    }
  }
  // Rede de segurança para campos obrigatórios sem rótulo reconhecido (OCR com rótulo partido, layout diferente):
  // NIF → primeiro NIF numa linha com "NIF/contribuinte"; valor → o maior montante numa linha de total. Confiança baixa.
  const confMedia = confiancas.length ? confiancas.reduce((a, b) => a + b, 0) / confiancas.length : 80;
  const faltaObrig = (tipo) => perfil.campos.find((c) => c.obrigatorio && c.tipo === tipo && !candidatos.has(c.chave));
  const fNif = faltaObrig('nif');
  if (fNif) {
    paginas.some((t, i) => String(t).split('\n').some((l) => {
      if (!/n\.?\s?i\.?\s?f|contribuinte/i.test(l)) return false;
      const n = primeiroNif(l.replace(/^[^\d]*/, ''));
      if (n && n.length >= 10) { poe(fNif.chave, n, (Number(confiancas[i] ?? confMedia) || 0) - 25, i + 1); return true; }
      return false;
    }));
  }
  const fValor = faltaObrig('valor');
  if (fValor) {
    let melhor = null;
    paginas.forEach((t, i) => String(t).split('\n').forEach((l) => {
      if (!/\b(total|valor|montante|import[aâ]ncia)\b/i.test(l) || /%|sub-?total|iva\b|desconto/i.test(l)) return;
      const v = primeiroValor(l.replace(/^[^\d]*/, ''));
      if (v != null && Number(v) > 0 && (!melhor || Number(v) > Number(melhor.v))) melhor = { v, i };
    }));
    if (melhor) poe(fValor.chave, String(melhor.v), (Number(confiancas[melhor.i] ?? confMedia) || 0) - 25, melhor.i + 1);
  }

  const saida = [];
  for (const c of perfil.campos) {
    const lista = candidatos.get(c.chave);
    if (!lista?.length) continue;
    if (c.tipo === 'itens' || c.tipo === 'movimentos' || c.tipo === 'clausulas') {
      lista.slice(0, 200).forEach((x) => saida.push({ campo: c.chave, valor: x.valor, confianca: x.confianca, pagina: x.pagina }));
      continue;
    }
    const ordenada = [...lista].sort((a, b) => (c.ultimo ? b.ordem - a.ordem : a.ordem - b.ordem));
    const max = c.multiplo ? 5 : 1;
    ordenada.slice(0, max).forEach((x, k) => saida.push({ campo: c.chave, valor: x.valor, confianca: k ? limitar(x.confianca - 12) : x.confianca, pagina: x.pagina }));
  }
  return saida;
}

export const normalizarComparacao = (tipo, valor) => {
  const v = String(valor ?? '').trim();
  if (tipo === 'valor' || tipo === 'numero') return Number.isFinite(Number(v)) && v !== '' ? Number(v).toFixed(2) : v;
  if (tipo === 'texto') return norm(v);
  if (tipo === 'data') return v;
  return v.toUpperCase().replace(/[\s.\-/]/g, '');
};
