import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Gerar from './Gerar';
import Historico from './Historico';
import './relatorios.css';

export default function Relatorios() {
  return (
    <div className="rel">
      <h1>Relatórios</h1>
      <p className="suave rel-sub">Estatísticas, dados extraídos, erros e documentos para revisão, em XLSX, PDF ou CSV.</p>
      <nav className="rel-navegacao" aria-label="Relatórios">
        <NavLink to="/relatorios" end>Gerar relatório</NavLink>
        <NavLink to="/relatorios/historico">Histórico</NavLink>
      </nav>
      <Routes>
        <Route index element={<Gerar />} />
        <Route path="historico" element={<Historico />} />
        <Route path="*" element={<Navigate to="/relatorios" replace />} />
      </Routes>
    </div>
  );
}
