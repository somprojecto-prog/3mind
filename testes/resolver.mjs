// Só para os testes em Node: aceita imports sem extensão, como o Vite.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('.') || spec.startsWith('/')) && !path.extname(spec) && ctx.parentURL) {
    const base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    for (const e of ['.js', '.jsx', '/index.js']) if (existsSync(base + e)) return next(pathToFileURL(base + e).href, ctx);
  }
  return next(spec, ctx);
}
