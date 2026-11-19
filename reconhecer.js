import { createWorker } from 'tesseract.js';
import { IDIOMA_OCR, OCR_CAMINHOS } from './config';

// Cria um leitor OCR que corre no navegador (Web Worker). Chamar terminar() no fim.
export async function criarLeitor() {
  let aoSub = () => {};
  const worker = await createWorker(IDIOMA_OCR, 1, {
    ...OCR_CAMINHOS,
    logger: (m) => { if (m.status === 'recognizing text') aoSub(m.progress); },
  });
  return {
    async reconhecer(canvas, aoSubprogresso) {
      aoSub = aoSubprogresso || (() => {});
      const { data } = await worker.recognize(canvas);
      return { texto: data.text || '', confianca: Number(data.confidence) || 0 };
    },
    terminar: () => worker.terminate(),
  };
}
