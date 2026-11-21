// Motor de validação orientado por perfil (função pura). Não decide nada fiscal nem jurídico: aponta o que não bate certo.
import { dataValidaISO } from '../../ocr/extracao';
import { extensoParaNumero, formatarMontante, iguais, limpar, nifValido, norm } from './texto';
import { rotuloCampo, tipoCampo } from '../perfis';

const LIMITE_CONFIANCA = 70;
const txt = (v) => String(v ?? '').trim();
const parseItem = (v) => { const [desc, q, p, t] = String(v).split(' | '); return { desc, q: Number(q), p: Number(p), t: Number(t) }; };
const parseMov = (v) => { const [data, desc, m, s] = String(v).split(' | '); return { data, desc, m: Number(m), s: Number(s) }; };
const hoje = () => new Date().toISOString().slice(0, 10);

function contexto(dados) {
  const activos = dados.filter((d) => !(d.corrigido_manual && !txt(d.valor)));
  const todos = (k) => activos.filter((d) => d.campo === k && txt(d.valor));
  const v = (k) => { const l = todos(k); return (l.find((d) => d.corrigido_manual) || l[0])?.valor; };
  return { activos, todos, v, n: (k) => (v(k) == null ? null : Number(v(k))), tem: (k) => todos(k).length > 0 };
}

const REGRAS = {
  obrigatorios({ perfil, c, add }) {
    for (const f of perfil.campos.filter((x) => x.obrigatorio)) {
      if (!c.tem(f.chave) && !(f.alternativas || []).some((a) => c.tem(a))) add('campo_vazio', f.chave, `Campo obrigatório em falta: "${f.rotulo}".`, 'aviso');
    }
  },
  formatos({ perfil, c, add }) {
    for (const d of c.activos) {
      const val = txt(d.valor);
      if (!val) { add('campo_vazio', d.campo, `O campo "${rotuloCampo(d.campo)}" está vazio.`, 'erro'); continue; }
      const tipo = tipoCampo(d.campo);
      if (tipo === 'nif' && !nifValido(val.toUpperCase())) add('formato', d.campo, `O NIF "${val}" (${rotuloCampo(d.campo)}) não tem um formato válido (10 dígitos, ou 9 dígitos + 2 letras + 3 dígitos).`, 'erro');
      if (tipo === 'data' && !dataValidaISO(val)) add('formato', d.campo, `A data "${val}" (${rotuloCampo(d.campo)}) não é válida.`, 'erro');
      if (d.campo === 'data' && dataValidaISO(val)) {
        if (val > hoje()) add('inconsistencia', d.campo, `A data ${val} está no futuro.`, 'aviso');
        else if (val < '2000-01-01') add('inconsistencia', d.campo, `A data ${val} é anterior a 2000; confirme se está correcta.`, 'aviso');
      }
      if (tipo === 'valor') {
        const n = Number(val);
        if (!Number.isFinite(n)) add('formato', d.campo, `O valor "${val}" (${rotuloCampo(d.campo)}) não é um número.`, 'erro');
        else if (n < 0 && !['saldo_inicial', 'saldo_final', 'saldo'].includes(d.campo)) add('inconsistencia', d.campo, `O valor ${val} (${rotuloCampo(d.campo)}) é negativo.`, 'aviso');
      }
    }
    void perfil;
  },
  baixa_confianca({ c, add }) {
    const baixas = c.activos.filter((d) => !d.corrigido_manual && d.confianca != null && Number(d.confianca) < LIMITE_CONFIANCA && txt(d.valor) && !['item', 'movimento'].includes(d.campo));
    for (const d of baixas.slice(0, 6)) add('baixa_confianca', d.campo, `Leitura pouco fiável em "${rotuloCampo(d.campo)}" (${Math.round(d.confianca)}%): confirme "${txt(d.valor)}".`, 'aviso');
    if (baixas.length > 6) add('baixa_confianca', null, `Mais ${baixas.length - 6} campos com leitura pouco fiável.`, 'aviso');
  },
  duplicados({ duplicados = {}, add }) {
    if (duplicados.por_ficheiro > 0) add('duplicado', null, `Este ficheiro é idêntico a ${duplicados.por_ficheiro} outro(s) já enviado(s).`, 'erro');
    if (duplicados.por_referencia > 0) add('duplicado', null, `Existem ${duplicados.por_referencia} outro(s) documento(s) com o mesmo NIF e a mesma referência (possível duplicado).`, 'aviso');
  },
  alertas({ perfil, add }) { for (const a of perfil.alertas || []) add('alerta', null, a, 'info'); },

  aritmetica({ perfil, c, add }) {
    const m = (x) => formatarMontante(x);
    const itens = c.todos('item').map((d) => parseItem(d.valor));
    for (const it of itens) {
      if (Number.isFinite(it.q) && Number.isFinite(it.p) && Number.isFinite(it.t) && !iguais(it.q * it.p, it.t, Math.max(0.05, it.t * 0.001))) {
        add('aritmetica', 'item', `Item "${it.desc}": ${it.q} × ${m(it.p)} = ${m(it.q * it.p)}, mas o total indicado é ${m(it.t)}.`, 'erro');
      }
    }
    const sub = c.n('subtotal'); const imp = c.n('imposto'); const desc = c.n('desconto') ?? 0; const tot = c.n('total');
    const frete = c.n('frete') ?? 0; const seguro = c.n('seguro') ?? 0;
    if (itens.length && sub != null) {
      const soma = itens.reduce((s, i) => s + (i.t || 0), 0);
      if (!iguais(soma, sub) && !iguais(soma - desc, sub)) add('aritmetica', 'subtotal', `A soma dos itens (${m(soma)}) não coincide com o subtotal (${m(sub)}).`, 'erro');
    }
    if (sub != null && tot != null) {
      const base = sub - desc + (imp ?? 0);
      if (!iguais(tot, base) && !iguais(tot, base + frete + seguro)) {
        add('aritmetica', 'total', imp == null
          ? `O total (${m(tot)}) não coincide com o subtotal (${m(sub)}); não foi lido nenhum imposto. Confirme.`
          : `Subtotal ${m(sub)}${desc ? ` − desconto ${m(desc)}` : ''} + impostos ${m(imp)} = ${m(base)}, mas o total indicado é ${m(tot)}.`, 'erro');
      }
    } else if (sub == null && imp != null && tot != null && itens.length) {
      const soma = itens.reduce((s, i) => s + (i.t || 0), 0);
      if (!iguais(tot, soma + imp - desc)) add('aritmetica', 'total', `Soma dos itens ${m(soma)} + impostos ${m(imp)} = ${m(soma + imp - desc)}, mas o total indicado é ${m(tot)}.`, 'aviso');
    }
    if (perfil.sinal) {
      const orig = c.n('valor_original'); const corr = c.n('valor_corrigido');
      if (orig != null && corr != null && tot != null && !iguais(orig + perfil.sinal * tot, corr)) {
        add('aritmetica', 'valor_corrigido', `Valor original ${m(orig)} ${perfil.sinal < 0 ? '−' : '+'} ${m(tot)} = ${m(orig + perfil.sinal * tot)}, mas o valor corrigido indicado é ${m(corr)}.`, 'erro');
      }
    }
  },
  aritmetica_du({ c, add }) {
    const m = (x) => formatarMontante(x);
    const va = c.n('valor_aduaneiro'); const vf = c.n('valor_factura');
    if (va != null && vf != null) {
      const esperado = vf + (c.n('frete') ?? 0) + (c.n('seguro') ?? 0);
      if (!iguais(va, esperado) && !iguais(va, vf)) add('aritmetica', 'valor_aduaneiro', `Valor aduaneiro ${m(va)} difere de valor da factura + frete + seguro (${m(esperado)}). Pode dever-se às condições de venda; confirme.`, 'aviso');
    }
    const dir = c.n('direitos'); const imp = c.n('impostos'); const tot = c.n('total_a_pagar');
    if (dir != null && imp != null && tot != null && !iguais(dir + imp, tot)) add('aritmetica', 'total_a_pagar', `Direitos ${m(dir)} + impostos ${m(imp)} = ${m(dir + imp)}, mas o total a pagar é ${m(tot)}.`, 'aviso');
    const pb = c.n('peso_bruto'); const pl = c.n('peso_liquido');
    if (pb != null && pl != null && pl > pb) add('inconsistencia', 'peso_liquido', `O peso líquido (${pl}) é superior ao peso bruto (${pb}).`, 'erro');
  },
  datas({ c, add }) {
    const d = c.v('data');
    const venc = c.v('vencimento');
    if (d && venc && dataValidaISO(d) && dataValidaISO(venc) && venc < d) add('inconsistencia', 'vencimento', `O vencimento (${venc}) é anterior à data do documento (${d}).`, 'erro');
    const val = c.v('validade');
    if (val && dataValidaISO(val) && val < hoje()) add('inconsistencia', 'validade', `A validade terminou em ${val}.`, 'aviso');
  },
  extenso({ c, add }) {
    const ext = c.v('total_extenso');
    if (!ext) return;
    const ref = c.n('total') ?? c.n('valor');
    const n = extensoParaNumero(ext);
    if (n == null) { add('divergencia', 'total_extenso', `Não foi possível interpretar o valor por extenso "${limpar(ext).slice(0, 80)}". Confirme à mão.`, 'info'); return; }
    if (ref != null && !iguais(n, ref, 0.01)) add('divergencia', 'total_extenso', `O valor por extenso (${formatarMontante(n)}) não coincide com o valor numérico (${formatarMontante(ref)}).`, 'erro');
  },
  moeda_unica({ c, add }) {
    const ms = new Set(c.todos('moeda').map((d) => txt(d.valor).toUpperCase()));
    if (ms.size > 1) add('inconsistencia', 'moeda', `Foram encontradas várias moedas no documento: ${[...ms].join(', ')}.`, 'aviso');
  },
  valores_multiplos({ c, add }) {
    const vs = [...new Set(c.todos('valor').map((d) => Number(d.valor).toFixed(2)))];
    if (vs.length > 1) add('divergencia', 'valor', `Foram encontrados valores diferentes (${vs.map((x) => formatarMontante(x)).join('; ')}). Verifique se o contrato e os anexos coincidem.`, 'aviso');
  },
  prazos({ c, add }) {
    const ini = c.v('data_inicio'); const fim = c.v('data_fim'); const dur = c.v('duracao');
    if (ini && fim && dataValidaISO(ini) && dataValidaISO(fim)) {
      if (fim < ini) add('inconsistencia', 'data_fim', `A data de fim (${fim}) é anterior à data de início (${ini}).`, 'erro');
      const mm = /(\d+)\s*(dias?|mes(?:es)?|m[eê]s|anos?)/i.exec(norm(dur || ''));
      if (mm) {
        const meses = /ano/.test(mm[2]) ? Number(mm[1]) * 12 : /dia/.test(mm[2]) ? Number(mm[1]) / 30 : Number(mm[1]);
        const real = (new Date(fim) - new Date(ini)) / 86400000 / 30.4;
        if (Math.abs(real - meses) > 1.2) add('inconsistencia', 'duracao', `A duração indicada (${dur}) não corresponde ao intervalo entre ${ini} e ${fim} (cerca de ${real.toFixed(1)} meses).`, 'aviso');
      }
    }
    if (fim && dataValidaISO(fim) && fim < hoje()) add('inconsistencia', 'data_fim', `O prazo do contrato terminou em ${fim}.`, 'info');
    const prazo = c.v('prazo'); const d = c.v('data');
    if (prazo && dataValidaISO(prazo)) {
      if (d && dataValidaISO(d) && prazo < d) add('inconsistencia', 'prazo', `O prazo (${prazo}) é anterior à data do documento (${d}).`, 'erro');
      else if (prazo < hoje()) add('inconsistencia', 'prazo', `O prazo (${prazo}) já passou.`, 'aviso');
    }
  },
  saldos_extracto({ c, add }) {
    const movs = c.todos('movimento').map((d) => parseMov(d.valor));
    const m = (x) => formatarMontante(x);
    const si = c.n('saldo_inicial'); const sf = c.n('saldo_final');
    let creditos = 0; let debitos = 0; let anterior = si;
    movs.forEach((mv, i) => {
      if (!mv.desc || mv.desc.length < 3) add('inconsistencia', 'movimento', `Movimento ${i + 1} (${mv.data}, ${m(mv.m)}) sem descrição ou referência suficiente.`, 'aviso');
      if (anterior != null && Number.isFinite(mv.s)) {
        const delta = mv.s - anterior;
        if (iguais(Math.abs(delta), mv.m, 0.02)) { if (delta >= 0) creditos += mv.m; else debitos += mv.m; }
        else add('aritmetica', 'movimento', `Movimento ${i + 1} (${mv.data}, ${mv.desc}): o saldo passou de ${m(anterior)} para ${m(mv.s)}, mas o montante indicado é ${m(mv.m)}.`, 'erro');
      }
      if (Number.isFinite(mv.s)) anterior = mv.s;
    });
    if (movs.length && sf != null && anterior != null && !iguais(anterior, sf)) add('aritmetica', 'saldo_final', `O saldo do último movimento (${m(anterior)}) não coincide com o saldo final (${m(sf)}).`, 'erro');
    if (si != null && sf != null && movs.length && iguais(creditos + debitos, 0) === false) {
      const calc = si + creditos - debitos;
      if (!iguais(calc, sf)) add('aritmetica', 'saldo_final', `Saldo inicial ${m(si)} + créditos ${m(creditos)} − débitos ${m(debitos)} = ${m(calc)}, mas o saldo final é ${m(sf)}.`, 'erro');
    }
    const td = c.n('total_debitos'); const tc = c.n('total_creditos');
    if (td != null && movs.length && !iguais(td, debitos, 0.05)) add('aritmetica', 'total_debitos', `O total de débitos indicado (${m(td)}) difere da soma dos movimentos (${m(debitos)}).`, 'aviso');
    if (tc != null && movs.length && !iguais(tc, creditos, 0.05)) add('aritmetica', 'total_creditos', `O total de créditos indicado (${m(tc)}) difere da soma dos movimentos (${m(creditos)}).`, 'aviso');
    const vistos = new Map();
    for (const mv of movs) { const k = `${mv.data}|${norm(mv.desc)}|${mv.m}`; vistos.set(k, (vistos.get(k) || 0) + 1); }
    for (const [k, n] of vistos) if (n > 1) { const [d, ds, mt] = k.split('|'); add('duplicado', 'movimento', `Movimento repetido ${n} vezes: ${d}, "${ds}", ${m(Number(mt))}. Pode ser legítimo; confirme.`, 'aviso'); }
    const per = c.v('periodo');
    if (per) {
      const [a, b] = per.split(' a ');
      const fora = movs.filter((mv) => (a && mv.data < a) || (b && mv.data > b)).length;
      if (fora) add('inconsistencia', 'periodo', `${fora} movimento(s) fora do período do extracto (${per}).`, 'aviso');
    }
  },
  correspondencias({ perfil, c, relacionados = [], add }) {
    (perfil.ligacoes || []).forEach((lig, i) => {
      const rel = relacionados[i] || [];
      if (lig.modo === 'movimentos') return correspondenciaMovimentos({ c, rel, add });
      const chave = c.v(lig.campo);
      if (!chave) return undefined;
      if (!rel.length) { add('divergencia', lig.campo, `Não encontrei no 3MIND ${lig.rotulo === 'factura' ? 'a factura' : `o documento (${lig.rotulo})`} "${chave}". Envie-o para poder comparar.`, 'info'); return undefined; }
      const alvo = rel[0];
      const nome = alvo.documento.nome_ficheiro;
      const get = (k) => { if (k === '@qtd_itens') { const q = alvo.dados.filter((d) => d.campo === 'item').map((d) => parseItem(d.valor).q).filter(Number.isFinite); return q.length ? q.reduce((a, b) => a + b, 0) : null; } return (alvo.dados.find((d) => d.campo === k && txt(d.valor)) || {}).valor ?? null; };
      for (const [local, remoto, tipo] of lig.comparar || []) {
        const a = c.v(local); const b = get(remoto);
        if (a == null || b == null) continue;
        const igual = tipo === 'valor' || tipo === 'numero' ? iguais(a, b) : tipo === 'nif' ? txt(a).toUpperCase() === txt(b).toUpperCase() : norm(a) === norm(b);
        const fmtv = (x) => (tipo === 'valor' ? formatarMontante(x) : x);
        if (lig.relacao === 'pagamento' && local === 'valor') {
          const pago = Number(a); const dev = Number(b);
          if (iguais(pago, dev)) add('correspondencia', 'valor', `Pagamento total: o valor coincide com a factura ${chave} (${nome}).`, 'info');
          else if (pago < dev) add('correspondencia', 'valor', `Pagamento parcial: ${formatarMontante(pago)} de ${formatarMontante(dev)} (factura ${chave}); em falta ${formatarMontante(dev - pago)}.`, 'aviso');
          else add('divergencia', 'valor', `O valor pago (${formatarMontante(pago)}) excede o total da factura ${chave} (${formatarMontante(dev)}).`, 'aviso');
        } else if (lig.relacao === 'nota' && local === 'total') {
          /* tratado abaixo */
        } else if (!igual) add('divergencia', local, `${rotuloCampo(local)} (${fmtv(a)}) difere do documento relacionado "${nome}" (${rotuloCampo(remoto.replace('@', ''))}: ${fmtv(b)}).`, tipo === 'nif' ? 'erro' : 'aviso');
      }
      if (lig.relacao === 'nota') {
        const t = c.n('total'); const orig = Number((alvo.dados.find((d) => d.campo === 'total') || {}).valor);
        if (t != null && Number.isFinite(orig)) {
          if (perfil.sinal < 0 && t > orig + 0.02) add('divergencia', 'total', `O crédito (${formatarMontante(t)}) é superior ao total da factura original (${formatarMontante(orig)}).`, 'erro');
          else add('correspondencia', 'total', `Documento original encontrado: ${nome} (total ${formatarMontante(orig)}).`, 'info');
        }
      }
      return undefined;
    });
  },
};

function correspondenciaMovimentos({ c, rel, add }) {
  const movs = c.todos('movimento').map((d) => parseMov(d.valor));
  if (!movs.length || !rel.length) return;
  let ligados = 0;
  for (const mv of movs) {
    const hit = rel.find((r) => {
      const tot = r.dados.find((d) => ['total', 'valor'].includes(d.campo));
      const num = r.dados.find((d) => d.campo === 'numero')?.valor;
      return (tot && iguais(Number(tot.valor), mv.m, 0.02)) || (num && norm(mv.desc).includes(norm(num)));
    });
    if (hit) ligados += 1;
  }
  add('correspondencia', 'movimento', `${ligados} de ${movs.length} movimento(s) coincidem em valor ou referência com recibos/facturas já carregados. Os restantes ficam sem correspondência.`, 'info');
}

/** Devolve [{ tipo, campo, mensagem, severidade }]. */
export function avaliarPerfil({ perfil, dados, duplicados, relacionados }) {
  const problemas = [];
  const add = (tipo, campo, mensagem, severidade) => problemas.push({ tipo, campo, mensagem, severidade });
  const c = contexto(dados);
  if (dados.length === 0) add('incompleto', null, 'Não foi possível ler informação útil neste documento. Confirme se a imagem está nítida ou preencha os dados à mão.', 'erro');
  const nomes = ['obrigatorios', 'formatos', 'baixa_confianca', 'duplicados', 'alertas', ...(perfil.regras || [])];
  for (const n of new Set(nomes)) REGRAS[n]?.({ perfil, c, add, duplicados, relacionados });
  return problemas;
}
