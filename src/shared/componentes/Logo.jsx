// Três linhas de texto a descer: um documento a ser lido.
export default function Logo({ tamanho = 28 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="6" width="24" height="4" rx="2" fill="#7FB2E5" />
      <rect x="4" y="14" width="17" height="4" rx="2" fill="#fff" />
      <rect x="4" y="22" width="10" height="4" rx="2" fill="#2563A8" />
    </svg>
  );
}
