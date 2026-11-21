import { abrirPdf, textoNativo, paginaParaCanvas, imagemParaCanvas } from './render';
import { criarLeitor } from './reconhecer';
import { ErroLeitura } from './erros';
import { ESCALA_RENDER, MAX_PAGINAS, MIN_TEXTO_NATIVO } from './config';

function traduzir(e) {
  if (e?.name === 'PasswordException') return new ErroLeitura('O PDF está protegido por palavra-passe. Retire a protecção e envie de novo.');
  if (e?.name === 'InvalidPDFException') return new ErroLeitura('O ficheiro PDF está danificado ou não é um PDF válido.');
  if (e?.name === 'UnexpectedResponseException' || e?.name === 'MissingPDFException') return new ErroLeitura('Não foi possível abrir o ficheiro para leitura.');
  return e; // erro técnico (ex.: o leitor não carregou): segue com o detalhe real, sem o disfarçar
}

/**
 * Lê um PDF ou imagem. Páginas de PDF com texto digital são lidas directamente (sem OCR);
 * digitalizações passam pelo Tesseract. Permite retomar: `checkpoint` traz as páginas já lidas.
 */
export async function lerDocumento(blob, mime, { aoProgresso = () => {}, checkpoint = null, aoCheckpoint = async () => {}, cancelado = () => false } = {}) {
  const textos = Array.isArray(checkpoint?.textos) ? [...checkpoint.textos] : [];
  const confiancas = Array.isArray(checkpoint?.confiancas) ? [...checkpoint.confiancas] : [];
  let leitor = null;
  let fechar = async () => {};
  let total = 1;
  const obterLeitor = async () => { if (!leitor) leitor = await criarLeitor(); return leitor; };

  try {
    if (mime === 'application/pdf') {
      let pdf;
      try { ({ pdf, fechar } = await abrirPdf(blob)); } catch (e) { throw traduzir(e); }
      total = pdf.numPages;
      if (total > MAX_PAGINAS) throw new ErroLeitura(`O documento tem ${total} páginas; o máximo é ${MAX_PAGINAS}. Divida-o em partes.`);

      for (let n = textos.length + 1; n <= total; n += 1) {
        if (cancelado()) throw new ErroLeitura('Processamento interrompido.', { interrompido: true });
        const pagina = await pdf.getPage(n);
        const nativo = await textoNativo(pagina);
        if (nativo.length >= MIN_TEXTO_NATIVO) {
          textos.push(nativo);
          confiancas.push(98);
        } else {
          const canvas = await paginaParaCanvas(pagina, ESCALA_RENDER);
          const l = await obterLeitor();
          const r = await l.reconhecer(canvas, (f) => aoProgresso((n - 1 + f) / total));
          textos.push(r.texto);
          confiancas.push(r.confianca);
          canvas.width = 0;
          canvas.height = 0;
        }
        pagina.cleanup();
        aoProgresso(n / total);
        await aoCheckpoint({ textos, confiancas });
      }
    } else {
      if (cancelado()) throw new ErroLeitura('Processamento interrompido.', { interrompido: true });
      let canvas;
      try { canvas = await imagemParaCanvas(blob); } catch { throw new ErroLeitura('Não foi possível abrir a imagem. Verifique se o ficheiro não está danificado.'); }
      const l = await obterLeitor();
      const r = await l.reconhecer(canvas, aoProgresso);
      textos.push(r.texto);
      confiancas.push(r.confianca);
      aoProgresso(1);
    }
  } finally {
    await fechar();
    if (leitor) await leitor.terminar();
  }

  const media = confiancas.length ? confiancas.reduce((a, b) => a + b, 0) / confiancas.length : 0;
  return { paginas: total, texto: textos.join('\n\n'), confianca: media, paginasTexto: textos, confiancasPaginas: confiancas };
}
