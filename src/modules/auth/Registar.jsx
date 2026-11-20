import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import CascaAuth from './CascaAuth';
import './auth.css';

const MIN = 10;
const REQUISITOS = [
  { id: 'tam', texto: `Pelo menos ${MIN} caracteres`, ok: (p) => p.length >= MIN },
  { id: 'letra', texto: 'Pelo menos uma letra', ok: (p) => /\p{L}/u.test(p) },
  { id: 'num', texto: 'Pelo menos um número', ok: (p) => /\d/.test(p) },
];

function traduzir(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'O registo está desligado de momento. Peça uma conta ao administrador.';
  if (m.includes('password') && (m.includes('weak') || m.includes('pwned') || m.includes('least'))) return 'Esta palavra-passe é fraca ou já apareceu em fugas de dados. Escolha outra.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiadas tentativas. Tente novamente dentro de alguns minutos.';
  if (m.includes('captcha')) return 'Não foi possível validar a verificação de segurança. Tente novamente.';
  return 'Não foi possível criar a conta agora. Tente novamente.';
}

export default function Registar() {
  const [f, setF] = useState({ nome: '', email: '', palavra: '', repetir: '' });
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState(false);
  const mudar = (c) => (e) => setF((x) => ({ ...x, [c]: e.target.value }));
  const tudoOk = REQUISITOS.every((r) => r.ok(f.palavra));

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    if (!tudoOk) return setErro('A palavra-passe não cumpre os requisitos.');
    if (f.palavra !== f.repetir) return setErro('As palavras-passe não coincidem.');
    setAEnviar(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.palavra,
      options: { data: { nome: f.nome.trim() }, emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}entrar` },
    });
    setAEnviar(false);
    if (error) return setErro(traduzir(error));
    // Mensagem sempre igual, exista ou não o email, para não revelar quem já tem conta.
    setFeito(true);
  }

  if (feito) {
    return (
      <CascaAuth titulo="Pedido enviado" subtitulo="Falta pouco.">
        <div className="sucesso-caixa" role="status">
          <strong>1.</strong> Abra a mensagem que enviámos para <strong>{f.email}</strong> e confirme o email (veja também o spam).<br />
          <strong>2.</strong> Depois, o administrador tem de aprovar a sua conta. Só então consegue entrar.
        </div>
        <Link to="/entrar" className="ligacao">Voltar a entrar</Link>
      </CascaAuth>
    );
  }

  return (
    <CascaAuth titulo="Criar conta" subtitulo="O acesso só é dado depois de confirmar o email e de o administrador aprovar.">
      <form onSubmit={submeter} className="form">
        <label>Nome<input required maxLength={120} autoComplete="name" value={f.nome} onChange={mudar('nome')} /></label>
        <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={mudar('email')} /></label>
        <label>Palavra-passe
          <input type="password" required autoComplete="new-password" value={f.palavra} onChange={mudar('palavra')} />
        </label>
        <ul className="requisitos" aria-label="Requisitos da palavra-passe">
          {REQUISITOS.map((r) => <li key={r.id} className={r.ok(f.palavra) ? 'cumpre' : ''}>{r.texto}</li>)}
        </ul>
        <label>Repetir palavra-passe
          <input type="password" required autoComplete="new-password" value={f.repetir} onChange={mudar('repetir')} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn btn-primario" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Pedir acesso'}</button>
        <Link to="/entrar" className="ligacao">Já tenho conta</Link>
      </form>

      <div className="info-caixa">
        <h3>Como funciona e como protegemos a sua conta</h3>
        <ol>
          <li>Cria a conta e confirma o email.</li>
          <li>A conta fica <strong>a aguardar aprovação</strong>: não acede a nenhum documento.</li>
          <li>O administrador aprova e define o seu papel (operador, supervisor ou auditor).</li>
        </ol>
        <ul>
          <li>A palavra-passe nunca é guardada em texto legível: fica só um código irreversível (hash). Nem o administrador a vê.</li>
          <li>A ligação ao site é cifrada (HTTPS) e os dados e ficheiros ficam cifrados em repouso no fornecedor (Supabase).</li>
          <li>O seu papel nunca é escolhido por si: começa sempre no nível mais baixo.</li>
          <li>Cada pessoa só vê o que o seu papel permite, e as acções importantes ficam registadas na auditoria.</li>
        </ul>
      </div>
    </CascaAuth>
  );
}
