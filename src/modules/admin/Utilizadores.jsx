import { useCallback, useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PAPEIS } from '@/lib/permissoes';
import { aviso } from '@/shared/notificacoes';
import { Carregando } from '@/shared/componentes/Estados';

const VAZIO = { nome: '', email: '', palavra_passe: '', papel: 'operador' };

async function mensagemDaFuncao(error) {
  try { return (await error.context.json()).erro; } catch { return null; }
}

export default function Utilizadores() {
  const { perfil: eu } = useAuth();
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [aCriar, setACriar] = useState(false);
  const [papeisNovos, setPapeisNovos] = useState({});

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('criado_em', { ascending: false });
    if (error) aviso.erro('Não foi possível carregar os utilizadores.');
    else setLista(data);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function criar(e) {
    e.preventDefault();
    setACriar(true);
    const { error } = await supabase.functions.invoke('admin-criar-utilizador', { body: form });
    setACriar(false);
    if (error) return aviso.erro((await mensagemDaFuncao(error)) || 'Não foi possível criar a conta.');
    aviso.sucesso('Conta criada. Entregue a palavra-passe temporária ao utilizador.');
    setForm(VAZIO);
    carregar();
  }

  async function alterar(id, campos, mensagem) {
    const { error } = await supabase.from('profiles').update(campos).eq('id', id);
    if (error) return aviso.erro('Não foi possível guardar a alteração.');
    aviso.sucesso(mensagem);
    carregar();
  }

  const pendentes = (lista || []).filter((u) => u.pendente && !u.activo);

  async function aprovar(u) {
    await alterar(u.id, { activo: true, pendente: false, papel: papeisNovos[u.id] || 'operador' }, `Conta de ${u.email} aprovada.`);
  }
  async function recusar(u) {
    if (!window.confirm(`Recusar o pedido de ${u.email}? A conta fica bloqueada.`)) return;
    await alterar(u.id, { pendente: false }, 'Pedido recusado. A conta ficou bloqueada.');
  }

  return (
    <>
      <h1>Utilizadores</h1>

      <section className="cartao">
        <h2>Pedidos de registo{pendentes.length > 0 && ` (${pendentes.length})`}</h2>
        <p className="suave">Quem cria conta pelo site fica aqui a aguardar. Só depois de aprovar a pessoa consegue entrar. Escolha o papel certo antes de aprovar.</p>
        {!lista ? <Carregando /> : pendentes.length === 0 ? (
          <p className="suave">Não há pedidos por aprovar.</p>
        ) : (
          <div className="tabela-rolar">
            <table>
              <thead><tr><th>Nome</th><th>Email</th><th>Pedido em</th><th>Papel</th><th></th></tr></thead>
              <tbody>
                {pendentes.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome || '—'}</td>
                    <td>{u.email}</td>
                    <td>{new Date(u.criado_em).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <select value={papeisNovos[u.id] || 'operador'} aria-label={`Papel para ${u.email}`}
                        onChange={(e) => setPapeisNovos((p) => ({ ...p, [u.id]: e.target.value }))}>
                        {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-primario" onClick={() => aprovar(u)}><Check size={16} aria-hidden="true" />Aprovar</button>{' '}
                      <button className="btn btn-suave" onClick={() => recusar(u)}><X size={16} aria-hidden="true" />Recusar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cartao">
        <h2>Criar conta</h2>
        <form onSubmit={criar} className="grelha-form">
          <label>Nome<input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
          <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Palavra-passe temporária
            <input type="text" required minLength={10} autoComplete="off" value={form.palavra_passe} onChange={(e) => setForm({ ...form, palavra_passe: e.target.value })} />
          </label>
          <label>Papel
            <select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })}>
              {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <button className="btn btn-primario" disabled={aCriar}><UserPlus size={16} aria-hidden="true" />{aCriar ? 'A criar…' : 'Criar conta'}</button>
        </form>
      </section>

      <section className="cartao">
        <h2>Contas existentes</h2>
        {!lista ? <Carregando /> : (
          <div className="tabela-rolar">
            <table>
              <thead><tr><th>Nome</th><th>Email</th><th>Papel</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {lista.map((u) => {
                  const sou = u.id === eu.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.nome || '—'}</td>
                      <td>{u.email}</td>
                      <td>
                        <select value={u.papel} disabled={sou} aria-label={`Papel de ${u.email}`}
                          onChange={(e) => alterar(u.id, { papel: e.target.value }, 'Papel actualizado.')}>
                          {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td><span className={`etiqueta ${u.activo ? 'etiqueta-ok' : 'etiqueta-erro'}`}>{u.activo ? 'Activa' : u.pendente ? 'A aguardar' : 'Bloqueada'}</span></td>
                      <td>
                        <button className="btn btn-suave" disabled={sou}
                          onClick={() => alterar(u.id, u.activo ? { activo: false } : { activo: true, pendente: false }, u.activo ? 'Conta bloqueada.' : 'Conta desbloqueada.')}>
                          {u.activo ? 'Bloquear' : u.pendente ? 'Aprovar' : 'Desbloquear'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
