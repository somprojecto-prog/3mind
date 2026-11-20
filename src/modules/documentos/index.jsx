import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { pode } from '@/lib/permissoes';
import Lista from './Lista';
import Upload from './Upload';
import Detalhe from './Detalhe';
import './documentos.css';

export default function Documentos() {
  const { perfil } = useAuth();
  return (
    <>
      <h1>Documentos</h1>
      <nav className="dc-nav" aria-label="Documentos">
        <NavLink to="/documentos" end>Todos os documentos</NavLink>
        {pode(perfil.papel, 'documentos.enviar') && <NavLink to="/documentos/enviar">Enviar documentos</NavLink>}
      </nav>
      <Routes>
        <Route index element={<Lista />} />
        <Route path="enviar" element={pode(perfil.papel, 'documentos.enviar') ? <Upload /> : <Navigate to="/documentos" replace />} />
        <Route path=":id" element={<Detalhe />} />
        <Route path="*" element={<Navigate to="/documentos" replace />} />
      </Routes>
    </>
  );
}
