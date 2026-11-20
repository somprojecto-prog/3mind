export const PAPEIS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  auditor: 'Auditor',
};

// Espelha as políticas RLS da base de dados. A base de dados é quem decide de facto;
// isto serve apenas para mostrar ou esconder opções no ecrã.
const PERMISSOES = {
  admin: ['*'],
  supervisor: [
    'painel.ver', 'documentos.ver', 'documentos.enviar', 'documentos.editar',
    'validacao.ver', 'validacao.resolver', 'comparacao.usar',
    'fila.ver', 'fila.gerir', 'relatorios.gerar',
  ],
  operador: [
    'painel.ver', 'documentos.ver', 'documentos.enviar', 'documentos.editar',
    'validacao.ver', 'validacao.resolver', 'comparacao.usar',
    'fila.ver', 'relatorios.gerar',
  ],
  auditor: ['painel.ver', 'documentos.ver', 'validacao.ver', 'fila.ver', 'relatorios.gerar', 'admin.auditoria'],
};

export function pode(papel, permissao) {
  const lista = PERMISSOES[papel] || [];
  return lista.includes('*') || lista.includes(permissao);
}
