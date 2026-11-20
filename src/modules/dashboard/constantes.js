// Estados definidos no contrato técnico (enum estado_documento).
export const ESTADOS = ['pendente', 'em_processamento', 'processado', 'revisao', 'erro'];

export const ROTULO_ESTADO = {
  pendente: 'Pendente',
  em_processamento: 'Em processamento',
  processado: 'Processado',
  revisao: 'Para revisão',
  erro: 'Com erro',
};

// Estados em que o documento já foi lido pelo OCR (usado em "páginas analisadas").
export const ESTADOS_ANALISADOS = ['processado', 'revisao'];
