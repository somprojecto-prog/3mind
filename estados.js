export const ESTADOS = ['pendente', 'em_processamento', 'processado', 'revisao', 'erro'];
export const ROTULO_ESTADO = {
  pendente: 'Pendente', em_processamento: 'Em processamento', processado: 'Processado', revisao: 'Para revisão', erro: 'Com erro',
};
export const ROTULO_ESTADO_FILA = { espera: 'À espera', em_processamento: 'Em processamento', concluido: 'Concluído', falhou: 'Falhou' };

export const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const formatarData = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-PT') : '—');
export const formatarTamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
