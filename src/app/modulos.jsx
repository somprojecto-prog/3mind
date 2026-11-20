import { lazy } from 'react';
import { BarChart3, FileText, GitCompare, LayoutDashboard, ListChecks, ScrollText, ShieldCheck, Users } from 'lucide-react';

// Registo único de módulos. Cada IA só edita as linhas do seu módulo (o componente e as sub-rotas dele).
// "permissao" tem de existir em src/lib/permissoes.js. Sub-rotas: o módulo trata de /caminho/* sozinho.
export const MODULOS = [
  { caminho: '/', rotulo: 'Painel', icone: LayoutDashboard, permissao: 'painel.ver', grupo: 'trabalho', Componente: lazy(() => import('../modules/dashboard')) },
  { caminho: '/documentos', rotulo: 'Documentos', icone: FileText, permissao: 'documentos.ver', grupo: 'trabalho', Componente: lazy(() => import('../modules/documentos')) },
  { caminho: '/validacao', rotulo: 'Validação', icone: ShieldCheck, permissao: 'validacao.ver', grupo: 'trabalho', Componente: lazy(() => import('../modules/validacao')) },
  { caminho: '/comparacao', rotulo: 'Comparação', icone: GitCompare, permissao: 'comparacao.usar', grupo: 'trabalho', Componente: lazy(() => import('../modules/comparacao')) },
  { caminho: '/fila', rotulo: 'Fila', icone: ListChecks, permissao: 'fila.ver', grupo: 'trabalho', Componente: lazy(() => import('../modules/fila')) },
  { caminho: '/relatorios', rotulo: 'Relatórios', icone: BarChart3, permissao: 'relatorios.gerar', grupo: 'trabalho', Componente: lazy(() => import('../modules/relatorios')) },
  { caminho: '/admin/utilizadores', rotulo: 'Utilizadores', icone: Users, permissao: 'admin.utilizadores', grupo: 'admin', Componente: lazy(() => import('../modules/admin/Utilizadores')) },
  { caminho: '/admin/auditoria', rotulo: 'Auditoria', icone: ScrollText, permissao: 'admin.auditoria', grupo: 'admin', Componente: lazy(() => import('../modules/admin/Auditoria')) },
];
