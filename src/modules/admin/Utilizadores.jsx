import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
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

  return (
    <>
      <h1>Utilizadores</h1>

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
                      <td><span className={`etiqueta ${u.activo ? 'etiqueta-ok' : 'etiqueta-erro'}`}>{u.activo ? 'Activa' : 'Bloqueada'}</span></td>
                      <td>
                        <button className="btn btn-suave" disabled={sou}
                          onClick={() => alterar(u.id, { activo: !u.activo }, u.activo ? 'Conta bloqueada.' : 'Conta desbloqueada.')}>
                          {u.activo ? 'Bloquear' : 'Desbloquear'}
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
