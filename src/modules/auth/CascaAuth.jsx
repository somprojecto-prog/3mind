import Logo from '@/shared/componentes/Logo';

export default function CascaAuth({ titulo, subtitulo, children }) {
  return (
    <div className="auth">
      <section className="auth-marca">
        <div className="auth-logo"><Logo tamanho={36} /><span>3MIND</span></div>
        <h1>Documentos lidos, validados e prontos a reportar.</h1>
        <p>Plataforma de inteligência documental. Trabalha ao lado dos sistemas existentes, sem os substituir.</p>
      </section>
      <section className="auth-form">
        <div className="auth-caixa">
          <h2>{titulo}</h2>
          {subtitulo && <p className="suave">{subtitulo}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}
