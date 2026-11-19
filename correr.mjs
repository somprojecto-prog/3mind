import A from './amostras.mjs'; import { extrairCampos } from '../src/modules/ocr/extracao.js';
let f=0;
for (const a of A){ const r=extrairCampos(a.texto,85); const de=c=>r.filter(x=>x.campo===c).sort((x,y)=>y.confianca-x.confianca).map(x=>x.valor);
 for (const [c,v] of Object.entries(a.esperado)){ const got=de(c); const ok = Array.isArray(v)? v.every(x=>got.includes(x)) : got[0]===v;
  if(!ok){f++;console.log('FALHA',a.nome,c,'esperado',v,'obtido',got);} } }
console.log(f?f+' falhas':'tudo ok');
