// Extracção guiada por perfil: lê os campos que o perfil do documento define, linha a linha, página a página.
// Não é inteligência artificial: usa rótulos ("NIF:", "Total a pagar:") e formatos. Tudo deve ser confirmado por uma pessoa.
import { MONEY, contarMoedas, limitar, limpar, moedaDeTexto, norm, primeiraData, primeiroNif, primeiroValor, numeroDeTexto } from './texto';

const CLASSES = { a: 'aàáâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç' };

/** Rótulo → expressão regular tolerante a acentos e espaços ("Data de emissão", "data de emissao"). */
function regexRotulo(rotulo) {
  const corpo = [...String(rotulo)].map((ch) => {
    const l = ch.toLowerCase();
    if (/\s/.test(ch)) return String.raw`\s+`;
    if (CLASSES[l]) return `[${CLASSES[l]}]`;
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return new RegExp(String.raw`(?<![\p{L}\d])${corpo}(?![\p{L}])`, 'giu');
}

const RESTO_INICIAL = /^[\s:.\-–=]*(?:n[.º°o]{1,2}\s*)?[\s:.\-–=]*/i;

// Linha de item: descrição, quantidade, preço unitário, total.
const ITEM = new RegExp(String.raw`^(?<desc>[^\d\s].{1,70}?)\s+(?<qtd>\d+(?:[.,]\d+)?)\s+(?<preco>${MONEY})\s+(?<total>${MONEY})\s*(?:kz|aoa|usd|eur)?$`, 'i');
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
      const ds = [...String(texto).matchAll(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}-\d{2}-\d{2})\b/g)].map((m) => primeiraData(m[1])).filter((d) => d?.ok);
      return ds.length >= 2 ? `${ds[0].iso} a ${ds[1].iso}` : ds[0]?.iso ?? null;
    }
    case 'ref': {
      const m = /([A-Z0-9][A-Z0-9/\-. ]{1,28}[A-Z0-9])/i.exec(texto.trim());
      return m && /\d/.test(m[1]) ? m[1].toUpperCase().replace(/\s+$/, '') : null;
    }
    default: {
      const t = limpar(texto).replace(/^[:.\-–=\s]+/, '').replace(/[;,\s]+$/, '');
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
  for (const c of campos) for (const r of c.rotulos) regexes.push({ campo: c, rotulo: r, re: regexRotulo(r), len: r.length });

  paginas.forEach((texto, idx) => {
    const pagina = idx + 1;
    const base = Number(confiancas[idx] ?? 80) || 0;
    const linhas = String(texto).split(/\n/);
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

      // 2) o valor de cada rótulo vai até ao rótulo seguinte (ou ao fim da linha)
      escolhidos.forEach((e, k) => {
        const fimValor = k + 1 < escolhidos.length ? escolhidos[k + 1].ini : linha.length;
        let resto = linha.slice(e.fim, fimValor).replace(RESTO_INICIAL, '');
        if (!limpar(resto) && k === escolhidos.length - 1) { // valor na linha seguinte
          const seguinte = linhas.slice(i + 1, i + 3).find((l) => limpar(l));
          if (seguinte) resto = seguinte;
        }
        const tipo = e.campo.tipo;
        if (e.campo.bloco && tipo === 'texto') {
          const extra = [];
          for (const l of linhas.slice(i + 1, i + 4)) { if (!limpar(l)) break; extra.push(limpar(l)); }
          resto = [limpar(resto), ...extra].filter(Boolean).join(' ');
        }
        const r = valorDoTipo(tipo, resto);
        if (r == null || r === '') return;
        const valor = typeof r === 'object' ? r.valor : r;
        const fraca = typeof r === 'object' && r.fraca;
        poe(e.campo.chave, String(valor), base + 5 - (fraca ? base * 0.5 : 0) - (i > 0 && !limpar(linha.slice(e.fim, fimValor)) ? 8 : 0), pagina);
      });

      // 3) tabelas
      if (perfil.campos.some((c) => c.chave === 'item')) {
        const m = ITEM.exec(limpar(linha));
        if (m && !PALAVRAS_TOTAIS.test(m.groups.desc)) {
          const q = numeroDeTexto(m.groups.qtd); const p = numeroDeTexto(m.groups.preco); const t = numeroDeTexto(m.groups.total);
          poe('item', `${limpar(m.groups.desc)} | ${q} | ${p} | ${t}`, base - 3, pagina);
        }
      }
      if (perfil.campos.some((c) => c.chave === 'movimento')) {
        const m = MOVIMENTO.exec(limpar(linha));
        if (m) {
          const d = primeiraData(m.groups.d1);
          const mont = numeroDeTexto(m.groups.mont.replace('-', ''));
          const saldo = (m.groups.saldo.startsWith('-') ? '-' : '') + numeroDeTexto(m.groups.saldo.replace('-', ''));
          poe('movimento', `${d?.iso ?? m.groups.d1} | ${limpar(m.groups.desc)} | ${mont} | ${saldo}`, base - 3, pagina);
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
