import { AlertTriangle, CheckCircle2, Clock, FileSearch, Inbox, Layers, Activity, Gauge, Timer, FileText } from 'lucide-react';
import { BarraProgresso, EstadoVazio, Esqueleto } from '@/shared/notificacoes';
import { ROTULO_ESTADO } from './constantes';
import { duracao, haQuanto, numero } from './formatar';
import { useContagem } from './hooks';

function Cartao({ icone: Icone, rotulo, valor, nota, tom, indice }) {
  const n = useContagem(valor);
  return (
    <article className={`kpi kpi-${tom}`} style={{ '--i': indice }}>
      <span className="kpi-icone"><Icone size={22} aria-hidden="true" /></span>
      <div>
        <p className="kpi-rotulo">{rotulo}</p>
        <p className="kpi-valor">{numero(n)}</p>
        {nota && <p className="kpi-nota">{nota}</p>}
      </div>
    </article>
  );
}

export function CartoesTotais({ dados }) {
  const e = dados.porEstado;
  const pendentes = e.pendente + e.em_processamento;
  return (
    <section className="kpis" aria-label="Totais de documentos">
      <Cartao indice={0} tom="azul" icone={Inbox} rotulo="Documentos recebidos" valor={dados.total}
        nota={dados.hoje.recebidos > 0 ? `+${numero(dados.hoje.recebidos)} hoje` : 'Nenhum hoje'} />
      <Cartao indice={1} tom="ok" icone={CheckCircle2} rotulo="Processados" valor={e.processado}
        nota={`${numero(dados.hoje.concluidos)} concluídos hoje`} />
      <Cartao indice={2} tom="claro" icone={Clock} rotulo="Pendentes" valor={pendentes}
        nota={`${numero(e.em_processamento)} em processamento`} />
      <Cartao indice={3} tom="erro" icone={AlertTriangle} rotulo="Com erros" valor={e.erro}
        nota={e.erro > 0 ? 'Requerem atenção' : 'Sem erros'} />
      <Cartao indice={4} tom="revisao" icone={FileSearch} rotulo="Para revisão" valor={e.revisao} nota="Aguardam validação" />
      <Cartao indice={5} tom="azul" icone={Layers} rotulo="Páginas analisadas" valor={dados.paginas}
        nota={dados.parcial ? 'Valor parcial (volume muito elevado)' : 'Processados e em revisão'} />
    </section>
  );
}

export function EsqueletoCartoes() {
  return (
    <section className="kpis" aria-busy="true" aria-label="A carregar totais">
      {Array.from({ length: 6 }, (_, i) => (
        <article key={i} className="kpi"><Esqueleto altura={56} raio={8} /></article>
      ))}
    </section>
  );
}

export function Desempenho({ desempenho, dias }) {
  const d = desempenho;
  const itens = [
    { icone: CheckCircle2, rotulo: `Concluídos (${dias} dias)`, valor: numero(d.concluidos) },
    { icone: Gauge, rotulo: 'Taxa de sucesso', valor: d.taxaSucesso == null ? '—' : `${Math.round(d.taxaSucesso * 100)}%` },
    { icone: Timer, rotulo: 'Tempo médio por documento', valor: duracao(d.tempoMedioSeg) },
  ];
  return (
    <ul className="desempenho">
      {itens.map(({ icone: Icone, rotulo, valor }) => (
        <li key={rotulo}><Icone size={18} aria-hidden="true" /><span>{rotulo}</span><strong>{valor}</strong></li>
      ))}
    </ul>
  );
}

export function TrabalhosEmCurso({ trabalhos, fila, agora }) {
  const total = fila.espera + fila.emCurso;
  if (trabalhos.length === 0) {
    return <EstadoVazio icone={Activity} titulo="Sem trabalhos em curso" texto="Quando um documento entrar em processamento, o progresso aparece aqui em tempo real." />;
  }
  return (
    <>
      <p className="suave trabalhos-resumo">{numero(fila.emCurso)} em processamento · {numero(fila.espera)} em espera</p>
      <ul className="trabalhos">
        {trabalhos.map((t) => {
          const a = t.estado === 'em_processamento';
          return (
            <li key={t.id}>
              <div className="trabalho-topo">
                <span className="trabalho-nome" title={t.documentos?.nome_ficheiro}>{t.documentos?.nome_ficheiro || 'Documento'}</span>
                <span className={`etiqueta ${a ? 'etq-em_processamento' : 'etq-pendente'}`}>{a ? 'A processar' : 'Em espera'}</span>
              </div>
              <BarraProgresso valor={a ? t.progresso : 0} rotulo={`Progresso de ${t.documentos?.nome_ficheiro || 'documento'}`} />
              <p className="trabalho-meta">
                {a ? `Iniciado ${haQuanto(t.iniciado_em, agora)}` : `Na fila ${haQuanto(t.criado_em, agora)}`}
                {t.documentos?.paginas ? ` · ${numero(t.documentos.paginas)} pág.` : ''}
                {t.tentativas > 1 ? ` · tentativa ${t.tentativas}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
      {total > trabalhos.length && <p className="suave">A mostrar {trabalhos.length} de {numero(total)} trabalhos.</p>}
    </>
  );
}

export function ActividadeRecente({ recentes, agora }) {
  if (recentes.length === 0) {
    return <EstadoVazio icone={FileText} titulo="Ainda não há actividade" texto="Os documentos recebidos e processados aparecem aqui." />;
  }
  return (
    <ul className="actividade">
      {recentes.map((r) => (
        <li key={r.id}>
          <span className={`actividade-marca cor-fundo-${r.estado}`} aria-hidden="true" />
          <div>
            <p className="actividade-nome" title={r.nome_ficheiro}>{r.nome_ficheiro}</p>
            <p className="actividade-meta">{r.categorias?.nome || 'Sem categoria'} · {haQuanto(r.actualizado_em, agora)}</p>
          </div>
          <span className={`etiqueta etq-${r.estado}`}>{ROTULO_ESTADO[r.estado]}</span>
        </li>
      ))}
    </ul>
  );
}
