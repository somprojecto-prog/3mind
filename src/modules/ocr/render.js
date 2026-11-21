// O PDF.js só é carregado quando há um PDF (imagens não dependem dele). Usa-se a versão "legacy", que corre em mais
// navegadores, e acrescenta-se Promise.withResolvers, que o PDF.js 4 exige e navegadores um pouco mais antigos não têm.
let pdfjsPronto = null;
function carregarPdfjs() {
  if (!pdfjsPronto) {
    pdfjsPronto = (async () => {
      if (typeof Promise.withResolvers !== 'function') {
        Promise.withResolvers = function withResolvers() {
          let resolve; let reject;
          const promise = new Promise((a, b) => { resolve = a; reject = b; });
          return { promise, resolve, reject };
        };
      }
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })().catch((e) => { pdfjsPronto = null; throw e; });
  }
  return pdfjsPronto;
}

const MAX_PIXEIS = 16_000_000;

export async function abrirPdf(blob) {
  const pdfjs = await carregarPdfjs();
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
