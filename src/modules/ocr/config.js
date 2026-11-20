// Tipos aceites para OCR no navegador. (O bucket também aceita TIFF, mas o navegador não o lê; por isso não é oferecido.)
export const TIPOS_ACEITES = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};
export const TAMANHO_MAXIMO = 20 * 1024 * 1024; // igual ao limite do bucket
export const MAX_PAGINAS = 50;
export const ESCALA_RENDER = 2;       // resolução ao converter páginas de PDF em imagem
export const MIN_TEXTO_NATIVO = 40;   // abaixo disto a página é tratada como digitalização e vai para o OCR
export const IDIOMA_OCR = 'por';

// Por omissão o Tesseract.js descarrega o motor e o idioma de um CDN público na primeira utilização.
// Em ambiente institucional, aloje estes ficheiros no seu servidor e defina estas variáveis no .env.
const env = import.meta.env;
export const OCR_CAMINHOS = {
  ...(env.VITE_OCR_WORKER_PATH ? { workerPath: env.VITE_OCR_WORKER_PATH } : {}),
  ...(env.VITE_OCR_CORE_PATH ? { corePath: env.VITE_OCR_CORE_PATH } : {}),
  ...(env.VITE_OCR_LANG_PATH ? { langPath: env.VITE_OCR_LANG_PATH } : {}),
};
