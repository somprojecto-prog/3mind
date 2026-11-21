// Ajudantes para declarar perfis. Um perfil é só dados + nomes de regras: acrescentar um tipo novo = acrescentar um ficheiro
// em perfis/ e registá-lo em perfis/index.js, sem tocar no motor.
export const campo = (chave, rotulo, tipo, rotulos, extra = {}) => ({ chave, rotulo, tipo, rotulos, obrigatorio: false, ...extra });
export const obrig = (chave, rotulo, tipo, rotulos, extra = {}) => campo(chave, rotulo, tipo, rotulos, { ...extra, obrigatorio: true });

export const MOEDA = campo('moeda', 'Moeda', 'moeda', ['Moeda']);
export const REFERENCIA = campo('referencia', 'Referência', 'ref', ['Referência', 'Ref.', 'N.º de encomenda', 'Encomenda'], { multiplo: true });

// Regras que se aplicam a todos os perfis.
export const REGRAS_BASE = ['obrigatorios', 'formatos', 'baixa_confianca', 'duplicados', 'alertas'];

export const fmt = (v) => (x) => v(x);
