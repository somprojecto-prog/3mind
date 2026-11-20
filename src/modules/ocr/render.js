import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PIXEIS = 16_000_000;

export async function abrirPdf(blob) {
  const dados = new Uint8Array(await blob.arrayBuffer());
  const tarefa = pdfjs.getDocument({ data: dados, isEvalSupported: false, useSystemFonts: true });
  const pdf = await tarefa.promise;
  return { pdf, fechar: () => tarefa.destroy() };
}

export async function textoNativo(pagina) {
  const conteudo = await pagina.getTextContent();
  return conteudo.items
    .map((i) => i.str + (i.hasEOL ? '\n' : ' '))
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

export async function paginaParaCanvas(pagina, escala) {
  const base = pagina.getViewport({ scale: 1 });
  const e = Math.min(escala, Math.sqrt(MAX_PIXEIS / (base.width * base.height)));
  const vista = pagina.getViewport({ scale: e });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vista.width);
  canvas.height = Math.ceil(vista.height);
  await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
  return canvas;
}

export async function imagemParaCanvas(blob, maxLado = 3500) {
  const imagem = await createImageBitmap(blob);
  const f = Math.min(1, maxLado / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.width * f);
  canvas.height = Math.round(imagem.height * f);
  canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close?.();
  return canvas;
}
