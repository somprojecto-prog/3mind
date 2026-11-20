import { useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { EstadoErro, Esqueleto, Roda } from '@/shared/notificacoes';
import { BarrasCategorias, GraficoDiario, Rosca } from './Graficos';
import { ActividadeRecente, CartoesTotais, Desempenho, EsqueletoCartoes, TrabalhosEmCurso } from './Paineis';
import { horaCurta } from './formatar';
import { useAgora } from './hooks';
import { useDashboard } from './useDashboard';
import './dashboard.css';

const PERIODOS = [7, 14, 30];

export default function Painel() {
  const { perfil } = useAuth();
  const [dias, setDias] = useState(14);
  const { dados, erro, carregando, actualizando, ligado, recarregar } = useDashboard(dias);
  const agora = useAgora();

  return (
    <div className="painel">
      <header className="painel-cabeca">
        <div>
          <h1>Painel</h1>
          <p className="suave">
            Visão geral do processamento documental
            {perfil?.papel === 'operador' ? ' · a mostrar apenas os seus documentos' : ''}
          </p>
        </div>
        <div className="painel-accoes">
          <span className={`painel-ligacao ${ligado ? 'ligado' : ''}`} role="status">
            {ligado ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
            {ligado ? 'Em tempo real' : 'Actualização a cada 30 s'}
          </span>
          <label className="painel-periodo">Período dos gráficos
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              {PERIODOS.map((d) => <option key={d} value={d}>Últimos {d} dias</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-suave" onClick={recarregar} disabled={actualizando}>
            {actualizando ? <Roda /> : <RefreshCw size={16} aria-hidden="true" />}Actualizar
          </button>
        </div>
      </header>

      {carregando && !dados && (
        <>
          <EsqueletoCartoes />
          <div className="painel-grelha">
            <section className="cartao"><Esqueleto altura={220} raio={8} /></section>
            <section className="cartao"><Esqueleto altura={220} raio={8} /></section>
          </div>
        </>
      )}

      {!dados && erro && (
        <section className="cartao"><EstadoErro texto={erro} aoTentar={recarregar} /></section>
      )}

      {dados && (
        <>
          <CartoesTotais dados={dados} />
          <div className="painel-grelha painel-grelha-larga">
            <section className="cartao">
              <h2>Desempenho</h2>
              <Desempenho desempenho={dados.desempenho} dias={dias} />
              <GraficoDiario serie={dados.serie} />
            </section>
            <section className="cartao">
              <h2>Documentos por estado</h2>
              <Rosca porEstado={dados.porEstado} total={dados.total} />
            </section>
          </div>
          <div className="painel-grelha">
            <section className="cartao">
              <h2>Trabalhos em curso</h2>
              <TrabalhosEmCurso trabalhos={dados.trabalhos} fila={dados.fila} agora={agora} />
            </section>
            <section className="cartao">
              <h2>Actividade recente</h2>
              <ActividadeRecente recentes={dados.recentes} agora={agora} />
            </section>
          </div>
          <section className="cartao">
            <h2>Documentos por categoria</h2>
            <BarrasCategorias itens={dados.categorias} />
          </section>
          <p className="suave painel-rodape">
            Última actualização às {horaCurta(dados.actualizadoEm)}
            {dados.parcial ? ' · volume muito elevado: gráficos e páginas calculados sobre os 20 000 documentos mais recentes' : ''}
          </p>
        </>
      )}
    </div>
  );
}
