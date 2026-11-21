// Cálculo do relatório (função pura, sem rede): o mesmo código serve o ecrã, o XLSX, o PDF e o CSV.
// Regra de ouro: cada número diz exactamente o que conta. "Por resolver" nunca inclui o que já foi resolvido,
// e a confiança do OCR nunca é atribuída a valores que uma pessoa corrigiu ou acrescentou.
import { rotuloCampo, rotuloTipo } from '../analise/perfis';

export const ESTADOS = ['pendente', 'em_processamento', 'processado', 'revisao', 'erro'];
export const ROTULO_ESTADO = {
  pendente: 'Pendente', em_processamento: 'Em processamento', processado: 'Processado', revisao: 'Para revisão', erro: 'Com erro',
};
const ROTULO_SEVERIDADE = { erro: 'Erro', aviso: 'Aviso', info: 'Informação' };
const ANALISADOS = ['processado', 'revisao']; // leitura concluída (com ou sem pendências)

export const LIMITE_DOCUMENTOS = 5000;

// Colunas de cada secção (usadas na pré-visualização e nos três formatos). `peso` = largura relativa.
export const SECCOES = [
  { id: 'estatisticas', titulo: 'Estatísticas', colunas: [
    { chave: 'grupo', titulo: 'Grupo', peso: 18 }, { chave: 'indicador', titulo: 'Indicador', peso: 40 }, { chave: 'valor', titulo: 'Valor', peso: 14 },
  ] },
  { id: 'dados', titulo: 'Dados extraídos', colunas: [
    { chave: 'documento', titulo: 'Documento', peso: 30 }, { chave: 'referencia', titulo: 'Referência', peso: 16 },
    { chave: 'nif', titulo: 'NIF', peso: 14 }, { chave: 'categoria', titulo: 'Categoria', peso: 16 },
    { chave: 'tipo', titulo: 'Tipo de documento', peso: 18 }, { chave: 'campo', titulo: 'Campo', peso: 16 }, { chave: 'pagina', titulo: 'Pág.', peso: 7 }, { chave: 'valor', titulo: 'Valor extraído', peso: 22 },
    { chave: 'valorOriginal', titulo: 'Valor lido pelo OCR', peso: 22 }, { chave: 'confianca', titulo: 'Confiança do OCR (%)', peso: 12 },
    { chave: 'corrigido', titulo: 'Origem do valor', peso: 16 },
  ] },
  { id: 'erros', titulo: 'Erros e avisos', colunas: [
    { chave: 'documento', titulo: 'Documento', peso: 28 }, { chave: 'origem', titulo: 'Origem', peso: 14 },
    { chave: 'tipo', titulo: 'Tipo', peso: 16 }, { chave: 'campo', titulo: 'Campo', peso: 14 },
    { chave: 'mensagem', titulo: 'Mensagem', peso: 40 }, { chave: 'severidade', titulo: 'Severidade', peso: 12 },
    { chave: 'situacao', titulo: 'Situação', peso: 22 }, { chave: 'data', titulo: 'Data', peso: 16 },
  ] },
  { id: 'revisao', titulo: 'Para revisão', colunas: [
    { chave: 'documento', titulo: 'Documento', peso: 30 }, { chave: 'referencia', titulo: 'Referência', peso: 16 },
    { chave: 'nif', titulo: 'NIF', peso: 14 }, { chave: 'categoria', titulo: 'Categoria', peso: 16 },
    { chave: 'estado', titulo: 'Estado', peso: 16 }, { chave: 'motivo', titulo: 'Motivo', peso: 36 },
    { chave: 'porResolver', titulo: 'Validações por resolver', peso: 14 }, { chave: 'enviadoEm', titulo: 'Recebido em', peso: 16 },
  ] },
];

const fDataHora = new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fData = new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const dataHora = (iso) => (iso ? fDataHora.format(new Date(iso)) : '');
export const dataSimples = (iso) => (iso ? fData.format(new Date(iso)) : '');

const texto = (v) => String(v ?? '').trim();
const arredondar = (n) => Math.round(n * 10) / 10;

/** De onde vem o valor de um campo: lido pelo OCR, corrigido, acrescentado ou descartado por uma pessoa. */
export function origemDoValor(x) {
  if (x.corrigido_manual && !texto(x.valor)) return 'descartado';
  if (x.corrigido_manual && x.valor_original == null) return 'acrescentado';
  if (x.corrigido_manual && texto(x.valor) !== texto(x.valor_original)) return 'corrigido';
  return 'ocr';
}
const ROTULO_ORIGEM = { ocr: 'Lido pelo OCR', corrigido: 'Corrigido à mão', acrescentado: 'Acrescentado à mão', descartado: 'Descartado à mão' };

const situacaoValidacao = (v) => (!v.resolvida ? 'Por resolver' : v.resolvida_manual ? 'Resolvida por uma pessoa' : 'Já não se verifica');

// Transforma os documentos (com filhos embebidos) nas quatro secções do relatório.
// meta: { total (nos filtros), incluidos, parcial } vindo da consulta; sem meta, assume-se completo.
export function construirRelatorio(documentos, meta = {}) {
  const dados = [];
  const erros = [];
  const revisao = [];
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  const porCategoria = new Map();
  const porTipo = new Map();
  const sev = { erro: 0, aviso: 0, info: 0 }; // só validações POR RESOLVER (info: todas)
  const resolvidas = { pessoa: 0, automatica: 0 };
  const origens = { ocr: 0, corrigido: 0, acrescentado: 0, descartado: 0 };
  let paginas = 0, somaConf = 0, nConf = 0, falhasAbertas = 0;

  for (const d of documentos) {
    porEstado[d.estado] = (porEstado[d.estado] || 0) + 1;
    const categoria = d.categorias?.nome || 'Sem categoria';
    porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + 1);
    const tipoRotulo = d.tipo_documento ? rotuloTipo(d.tipo_documento) : 'Sem tipo';
    porTipo.set(tipoRotulo, (porTipo.get(tipoRotulo) || 0) + 1);
    if (ANALISADOS.includes(d.estado)) paginas += d.paginas || 0;

    for (const x of d.dados_extraidos || []) {
      const origem = origemDoValor(x);
      origens[origem] += 1;
      const conf = x.confianca == null ? null : Number(x.confianca);
      // A confiança é a do OCR: só vale para o que o OCR leu e ninguém mexeu.
      const confValida = origem === 'ocr' && conf != null && Number.isFinite(conf) ? conf : null;
      if (confValida != null) { somaConf += confValida; nConf += 1; }
      dados.push({
        documento: d.nome_ficheiro, referencia: d.referencia || '', nif: d.nif || '', categoria,
        campo: rotuloCampo(x.campo), pagina: x.pagina ?? '', tipo: tipoRotulo, valor: x.valor ?? '', valorOriginal: x.valor_original ?? '',
        confianca: confValida, corrigido: ROTULO_ORIGEM[origem],
      });
    }

    let porResolver = 0; // erros e avisos por resolver deste documento
    for (const v of d.validacoes || []) {
      if (v.severidade === 'info') sev.info += 1;
      else if (!v.resolvida) { sev[v.severidade] = (sev[v.severidade] || 0) + 1; porResolver += 1; }
      if (v.resolvida && v.severidade !== 'info') resolvidas[v.resolvida_manual ? 'pessoa' : 'automatica'] += 1;
      if (v.severidade !== 'info') {
        erros.push({
          documento: d.nome_ficheiro, origem: 'Validação', tipo: v.tipo, campo: v.campo ? rotuloCampo(v.campo) : '',
          mensagem: v.mensagem, severidade: ROTULO_SEVERIDADE[v.severidade] || v.severidade,
          situacao: situacaoValidacao(v), data: dataHora(v.criado_em), _ordem: (v.resolvida ? 2 : 0) + (v.severidade === 'erro' ? 0 : 1),
        });
      }
    }

    // Falhas de processamento: só a mais recente conta como "por resolver"; as anteriores já foram repetidas.
    const falhas = (d.fila_processamento || []).filter((f) => f.erro_mensagem || f.estado === 'falhou')
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    falhas.forEach((f, i) => {
      const aberta = i === 0 && d.estado === 'erro';
      if (aberta) falhasAbertas += 1;
      erros.push({
        documento: d.nome_ficheiro, origem: 'Processamento', tipo: 'falha_processamento', campo: '',
        mensagem: f.erro_mensagem || 'O processamento falhou.', severidade: 'Erro',
        situacao: aberta ? 'Documento ainda com erro' : i === 0 ? 'Documento já não está em erro' : 'Tentativa anterior (já repetida)',
        data: dataHora(f.criado_em), _ordem: aberta ? 0 : 2,
      });
    });

    // "Para revisão" = estado "Para revisão" (ou, por inconsistência, processado com pendências).
    if (d.estado === 'revisao' || (d.estado === 'processado' && porResolver > 0)) {
      const motivos = [];
      if (d.estado === 'revisao') motivos.push('Marcado para revisão');
      if (porResolver > 0) motivos.push(`${porResolver} validação(ões) por resolver`);
      revisao.push({
        documento: d.nome_ficheiro, referencia: d.referencia || '', nif: d.nif || '', categoria,
        estado: ROTULO_ESTADO[d.estado] || d.estado, motivo: motivos.join('; '), porResolver, enviadoEm: dataHora(d.criado_em),
      });
    }
  }
  erros.sort((a, b) => a._ordem - b._ordem);
  erros.forEach((e) => delete e._ordem);

  const total = documentos.length;
  const lidos = porEstado.processado + porEstado.revisao;
  const errosAbertos = sev.erro + falhasAbertas;
  const avisosAbertos = sev.aviso;
  const camposLidosOcr = origens.ocr + origens.corrigido + origens.descartado;
  const ordenar = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const linha = (grupo, indicador, valor) => ({ grupo, indicador, valor });
  const nosFiltros = meta.total ?? total;
  const parcial = Boolean(meta.parcial ?? meta.truncado);

  const estatisticas = [
    linha('Resumo', 'Documentos nestes filtros', nosFiltros),
    linha('Resumo', 'Documentos incluídos no relatório', total),
    ...(parcial ? [linha('Resumo', 'ATENÇÃO: relatório incompleto (faltam documentos)', nosFiltros - total)] : []),
    linha('Resumo', 'Páginas analisadas (processados e para revisão)', paginas),
    linha('Resumo', 'Documentos lidos (processados + para revisão)', lidos),
    linha('Resumo', 'Taxa de leitura (% dos documentos incluídos)', total ? arredondar((lidos / total) * 100) : ''),
    linha('Resumo', 'Documentos sem problemas por resolver (processados)', porEstado.processado),
    linha('Resumo', 'Documentos para revisão', revisao.length),
    ...ESTADOS.map((e) => linha('Por estado', ROTULO_ESTADO[e], porEstado[e] || 0)),
    ...ordenar(porCategoria).map(([nome, n]) => linha('Por categoria', nome, n)),
    ...ordenar(porTipo).map(([nome, n]) => linha('Por tipo de documento', nome, n)),
    linha('Extracção', 'Campos lidos pelo OCR', camposLidosOcr),
    linha('Extracção', 'Mantidos como o OCR leu', origens.ocr),
    linha('Extracção', 'Corrigidos à mão', origens.corrigido),
    linha('Extracção', 'Descartados à mão', origens.descartado),
    linha('Extracção', 'Acrescentados à mão (não lidos pelo OCR)', origens.acrescentado),
    linha('Extracção', 'Confiança média do OCR (%) · só campos mantidos como lidos', nConf ? arredondar(somaConf / nConf) : ''),
    linha('Validações', 'Erros por resolver (inclui falhas de processamento actuais)', errosAbertos),
    linha('Validações', 'Avisos por resolver', avisosAbertos),
    linha('Validações', 'Informações', sev.info),
    linha('Validações', 'Resolvidas por uma pessoa', resolvidas.pessoa),
    linha('Validações', 'Deixaram de se verificar (corrigidas pelos dados)', resolvidas.automatica),
  ];

  return {
    seccoes: { estatisticas, dados, erros, revisao },
    resumo: {
      total, paginas, porEstado, lidos, paraRevisao: revisao.length, errosAbertos, avisosAbertos,
      campos: camposLidosOcr + origens.acrescentado,
    },
    meta: { total: nosFiltros, incluidos: total, truncado: parcial, limite: LIMITE_DOCUMENTOS },
  };
}
