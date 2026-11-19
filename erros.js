// Erros com mensagem própria para o utilizador (ficam separados para não arrastar o PDF.js e o Tesseract).
export class ErroLeitura extends Error {
  constructor(mensagem, { interrompido = false } = {}) {
    super(mensagem);
    this.interrompido = interrompido;
  }
}
