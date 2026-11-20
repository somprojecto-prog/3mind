// Traduz erros do Supabase / da rede para uma frase que diz ao utilizador o que fazer.
// Nunca devolve o texto em bruto do servidor.
export function mensagemErro(erro, accao = 'concluir a operação') {
  const codigo = erro?.code ? String(erro.code) : '';
  const texto = String(erro?.message || '').toLowerCase();

  if (texto.includes('failed to fetch') || texto.includes('networkerror') || texto.includes('network request failed')) {
    return 'Sem ligação ao servidor. Verifique a internet e tente novamente.';
  }
  if (codigo === '42501' || texto.includes('row-level security') || texto.includes('permission denied')) {
    return 'O seu perfil não tem permissão para esta acção. Se precisa dela, peça ao administrador.';
  }
  if (codigo === 'PGRST301' || texto.includes('jwt')) {
    return 'A sessão expirou. Entre novamente.';
  }
  if (codigo === '57014' || texto.includes('statement timeout')) {
    return 'O pedido demorou demasiado. Reduza o período ou os filtros e tente novamente.';
  }
  if (codigo === '23505') return 'Este registo já existe.';
  return `Não foi possível ${accao}. Tente novamente dentro de instantes.`;
}
