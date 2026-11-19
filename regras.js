import { ROTULO_CAMPO, dataValidaISO, nifValido } from '../ocr/extracao';

const OBRIGATORIOS = ['nif', 'data', 'valor'];
const LIMITE_CONFIANCA = 70;
const texto = (v) => String(v ?? '').trim();

/**
 * Regras de validação (função pura). Devolve problemas { tipo, campo, mensagem, severidade }.
 *  dados: linhas de dados_extraidos. duplicados: { por_ficheiro, por_referencia }.
 * Linhas esvaziadas à mão (corrigido_manual com valor vazio) contam como "descartadas" e são ignoradas.
 */
export function avaliar({ dados, duplicados = {} }) {
  const problemas = [];
  const add = (tipo, campo, mensagem, severidade) => problemas.push({ tipo, campo, mensagem, severidade });
  const activos = dados.filter((d) => !(d.corrigido_manual && !texto(d.valor)));
  const de = (campo) => activos.filter((d) => d.campo === campo);

  if (dados.length === 0) {
    add('incompleto', null, 'Não foi possível ler informação útil neste documento. Confirme se a imagem está nítida ou preencha os dados à mão.', 'erro');
  }

  for (const campo of OBRIGATORIOS) {
    if (!de(campo).some((d) => texto(d.valor))) add('campo_vazio', campo, `Não foi encontrado nenhum valor para "${ROTULO_CAMPO[campo]}".`, 'aviso');
  }
  if (!de('numero_factura').some((d) => texto(d.valor)) && !de('referencia').some((d) => texto(d.valor))) {
    add('campo_vazio', 'numero_factura', 'Não foi encontrado o número da factura nem uma referência.', 'aviso');
  }

  for (const d of activos) {
    const v = texto(d.valor);
    if (!v) { add('campo_vazio', d.campo, `O campo "${ROTULO_CAMPO[d.campo] || d.campo}" está vazio.`, 'erro'); continue; }
    if (d.campo === 'nif' && !nifValido(v.toUpperCase())) add('formato', 'nif', `O NIF "${v}" não tem um formato válido (10 dígitos, ou 9 dígitos + 2 letras + 3 dígitos).`, 'erro');
    if (d.campo === 'data') {
      if (!dataValidaISO(v)) add('formato', 'data', `A data "${v}" não é válida.`, 'erro');
      else if (v > new Date().toISOString().slice(0, 10)) add('inconsistencia', 'data', `A data ${v} está no futuro.`, 'aviso');
      else if (v < '2000-01-01') add('inconsistencia', 'data', `A data ${v} é anterior a 2000; confirme se está correcta.`, 'aviso');
    }
    if (d.campo === 'valor') {
      const n = Number(v);
      if (!Number.isFinite(n)) add('formato', 'valor', `O valor "${v}" não é um número.`, 'erro');
      else if (n <= 0) add('inconsistencia', 'valor', `O valor ${v} não é positivo.`, 'erro');
    }
  }

  const baixas = activos.filter((d) => !d.corrigido_manual && d.confianca != null && Number(d.confianca) < LIMITE_CONFIANCA && texto(d.valor));
  for (const d of baixas.slice(0, 6)) {
    add('baixa_confianca', d.campo, `Leitura pouco fiável em "${ROTULO_CAMPO[d.campo] || d.campo}" (${Math.round(d.confianca)}%): confirme "${texto(d.valor)}".`, 'aviso');
  }
  if (baixas.length > 6) add('baixa_confianca', null, `Mais ${baixas.length - 6} campos com leitura pouco fiável.`, 'aviso');

  const facturas = new Set(de('numero_factura').map((d) => texto(d.valor).toUpperCase()).filter(Boolean));
  if (facturas.size > 1) add('inconsistencia', 'numero_factura', `Foram encontrados ${facturas.size} números de factura diferentes: ${[...facturas].join(', ')}.`, 'aviso');
  const nifs = new Set(de('nif').map((d) => texto(d.valor).toUpperCase()).filter(Boolean));
  if (nifs.size > 2) add('inconsistencia', 'nif', `Foram encontrados ${nifs.size} NIF diferentes; normalmente há apenas emitente e cliente.`, 'aviso');

  if (duplicados.por_ficheiro > 0) add('duplicado', null, `Este ficheiro é idêntico a ${duplicados.por_ficheiro} outro(s) já enviado(s).`, 'erro');
  if (duplicados.por_referencia > 0) add('duplicado', null, `Existem ${duplicados.por_referencia} outro(s) documento(s) com o mesmo NIF e a mesma referência (possível duplicado).`, 'aviso');

  return problemas;
}

export const chave = (p) => `${p.tipo}|${p.campo ?? ''}|${p.mensagem}`;
