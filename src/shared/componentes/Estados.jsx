export function Carregando({ texto = 'A carregar…' }) {
  return <div className="carregando"><span className="roda" aria-hidden="true" />{texto}</div>;
}

export function EmDesenvolvimento({ nome, responsavel }) {
  return (
    <div className="vazio">
      <h2>{nome}</h2>
      <p>Este módulo ainda não foi entregue. Está atribuído a {responsavel} e vai usar o esquema e as convenções de <code>docs/CONTRATO_TECNICO.md</code>.</p>
    </div>
  );
}
