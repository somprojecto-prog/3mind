import { supabase } from '@/lib/supabase';
import { carregarDetalhe } from './servico';
import { rotuloCampo, rotuloTipo } from '../analise/perfis';

const celula = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

/** CSV (abre no Excel) com os dados lidos e os alertas de um documento. */
export function construirCsv({ documento, dados, validacoes }) {
  const linhas = [
    ['Documento', documento.nome_ficheiro],
    ['Tipo', documento.tipo_documento ? rotuloTipo(documento.tipo_documento) : ''],
    ['Estado', documento.estado],
    ['Resumo', documento.resumo || ''],
    [],
    ['DADOS LIDOS'],
    ['Campo', 'Valor', 'Página', 'Confiança (%)', 'Corrigido à mão'],
    ...dados.map((d) => [rotuloCampo(d.campo), d.valor, d.pagina || '', d.confianca ?? '', d.corrigido_manual ? 'Sim' : 'Não']),
    [],
    ['ALERTAS'],
    ['Gravidade', 'Campo', 'Mensagem', 'Resolvido'],
    ...validacoes.map((v) => [v.severidade, v.campo ? rotuloCampo(v.campo) : '', v.mensagem, v.resolvida ? 'Sim' : 'Não']),
    [],
    ['Resultado gerado por regras automáticas; não substitui a revisão humana nem constitui decisão fiscal.'],
  ];
  return `﻿${linhas.map((l) => l.map(celula).join(';')).join('\r\n')}`;
}

function gravarFicheiro(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Descarrega o resultado e regista que foi descarregado. */
export async function descarregarResultado(documentoId) {
  const det = await carregarDetalhe(documentoId);
  const base = String(det.documento.nome_ficheiro).replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_').slice(0, 60);
  gravarFicheiro(`resultado_${base}.csv`, construirCsv(det));
  await supabase.rpc('marcar_descarregado', { p_id: documentoId });
}
