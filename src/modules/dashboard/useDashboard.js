import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { aviso, mensagemErro } from '@/shared/notificacoes';
import { carregarPainel } from './dados';

const EM_CURSO = ['espera', 'em_processamento'];

// Carrega o painel e mantém-no actualizado com Supabase Realtime (fila_processamento e documentos).
// - Progresso de um trabalho já visível: actualiza a barra de imediato, sem novo pedido.
// - Qualquer outra alteração: novo carregamento (com espera de 1,5 s para juntar eventos seguidos).
// - Se o Realtime não ligar, volta a consultar de 30 em 30 segundos.
export function useDashboard(dias) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [ligado, setLigado] = useState(false);

  const dadosRef = useRef(null);
  const diasRef = useRef(dias);
  const emCurso = useRef(false);
  const repetir = useRef(false);
  const falhou = useRef(false);
  const espera = useRef(null);
  diasRef.current = dias;

  const carregar = useCallback(async () => {
    if (emCurso.current) { repetir.current = true; return; }
    emCurso.current = true;
    setActualizando(true);
    try {
      const novos = await carregarPainel(diasRef.current);
      if (!repetir.current) { // se há outro pedido a seguir (ex.: período mudou), não mostra dados desactualizados
        dadosRef.current = novos;
        setDados(novos);
        setErro('');
        falhou.current = false;
      }
    } catch (e) {
      const msg = mensagemErro(e, 'carregar o painel');
      if (!dadosRef.current) setErro(msg);
      else if (!falhou.current) aviso.erro(`${msg} Estão a ser mostrados os últimos dados obtidos.`);
      falhou.current = true;
    } finally {
      emCurso.current = false;
      setActualizando(false);
      setCarregando(false);
      if (repetir.current) { repetir.current = false; carregar(); }
    }
  }, []);

  useEffect(() => { carregar(); }, [dias, carregar]);

  const agendar = useCallback(() => {
    clearTimeout(espera.current);
    espera.current = setTimeout(carregar, 1500);
  }, [carregar]);

  useEffect(() => {
    const canal = supabase
      .channel(`painel-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_processamento' }, (p) => {
        const novo = p.new;
        const visivel = novo?.id && dadosRef.current?.trabalhos.find((t) => t.id === novo.id);
        if (p.eventType === 'UPDATE' && visivel && visivel.estado === novo.estado && EM_CURSO.includes(novo.estado)) {
          const trabalhos = dadosRef.current.trabalhos.map((t) => (t.id === novo.id
            ? { ...t, progresso: novo.progresso, tentativas: novo.tentativas, iniciado_em: novo.iniciado_em }
            : t));
          dadosRef.current = { ...dadosRef.current, trabalhos };
          setDados(dadosRef.current);
          return;
        }
        agendar();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, agendar)
      .subscribe((estado) => setLigado(estado === 'SUBSCRIBED'));
    return () => {
      clearTimeout(espera.current);
      supabase.removeChannel(canal);
    };
  }, [agendar]);

  useEffect(() => {
    if (ligado) return undefined;
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [ligado, carregar]);

  return { dados, erro, carregando, actualizando, ligado, recarregar: carregar };
}
