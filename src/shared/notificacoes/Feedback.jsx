import { AlertCircle, FolderOpen } from 'lucide-react';
import './notificacoes.css';

// Componentes reutilizáveis de estado: carregamento, vazio, erro e progresso.
// Para o carregamento de uma página inteira continua a existir <Carregando /> em shared/componentes/Estados.

/** Rodinha pequena, para botões e linhas. Com `rotulo`, é anunciada aos leitores de ecrã. */
export function Roda({ tamanho = 16, rotulo }) {
  return (
    <span
      className="n-roda"
      style={{ width: tamanho, height: tamanho }}
      role={rotulo ? 'status' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    />
  );
}

/** Bloco cinzento animado que ocupa o lugar do conteúdo enquanto carrega. */
export function Esqueleto({ altura = 16, largura = '100%', linhas = 1, raio = 6 }) {
  const blocos = Array.from({ length: linhas }, (_, i) => (
    <span
      key={i}
      className="n-esqueleto"
      style={{ height: altura, width: linhas > 1 && i === linhas - 1 ? '60%' : largura, borderRadius: raio }}
      aria-hidden="true"
    />
  ));
  return <span className="n-esqueleto-grupo">{blocos}</span>;
}

/**
 * Estado vazio. `accao` é opcional e tem de ser uma acção real: { rotulo, aoClicar, icone }.
 */
export function EstadoVazio({ icone: Icone = FolderOpen, titulo, texto, accao }) {
  const IconeAccao = accao?.icone;
  return (
    <div className="n-vazio">
      <span className="n-vazio-icone"><Icone size={26} aria-hidden="true" /></span>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {accao && (
        <button type="button" className="btn btn-suave" onClick={accao.aoClicar}>
          {IconeAccao && <IconeAccao size={16} aria-hidden="true" />}{accao.rotulo}
        </button>
      )}
    </div>
  );
}

/** Estado de erro. O botão "Tentar novamente" só aparece se for passada `aoTentar`. */
export function EstadoErro({ titulo = 'Não foi possível carregar', texto = 'Verifique a ligação e tente novamente.', aoTentar }) {
  return (
    <div className="n-vazio n-vazio-erro" role="alert">
      <span className="n-vazio-icone"><AlertCircle size={26} aria-hidden="true" /></span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {aoTentar && <button type="button" className="btn btn-suave" onClick={aoTentar}>Tentar novamente</button>}
    </div>
  );
}

/** Barra de progresso (0–100) com animação suave. */
export function BarraProgresso({ valor = 0, rotulo, mostrarValor = true }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
  return (
    <div className="n-progresso">
      <div
        className="n-progresso-pista"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-label={rotulo || 'Progresso'}
      >
        <div className="n-progresso-barra" style={{ width: `${v}%` }} />
      </div>
      {mostrarValor && <span className="n-progresso-valor">{v}%</span>}
    </div>
  );
}
