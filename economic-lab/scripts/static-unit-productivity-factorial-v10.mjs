import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// WP-RV07-P62 extends the already-gated P61 static productivity diagnostic into
// a full 2^3 RESOURCE/MATERIALS/CONSUMER factorial. It changes diagnostic
// intervention membership only; the normalization algebra and world mechanics are unchanged.
// Workflow registration trigger: 2026-08-20.
const dir=dirname(fileURLToPath(import.meta.url));
const src=join(dir,'static-unit-productivity-normalization-matrix-v10.mjs');
const tmp=join(dir,'.__wp-rv07-p62-factorial-runtime.mjs');
let text=readFileSync(src,'utf8');
assert.ok(text.includes("const variants=['unit-basis-control','static-productivity-resource','static-productivity-materials','static-productivity-consumer','static-productivity-noncapital'];"));
text=text.replaceAll('P61','P62').replaceAll('p61','p62');
text=text.replace(
  "const variants=['unit-basis-control','static-productivity-resource','static-productivity-materials','static-productivity-consumer','static-productivity-noncapital'];",
  "const variants=['unit-basis-control','static-productivity-resource','static-productivity-materials','static-productivity-consumer','static-productivity-resource-materials','static-productivity-resource-consumer','static-productivity-materials-consumer','static-productivity-noncapital'];"
);
const oldSectors="function sectors(v){if(v==='static-productivity-resource')return new Set(['RESOURCE']);if(v==='static-productivity-materials')return new Set(['MATERIALS']);if(v==='static-productivity-consumer')return new Set(['CONSUMER']);if(v==='static-productivity-noncapital')return new Set(['RESOURCE','MATERIALS','CONSUMER']);return new Set();}";
const newSectors="function sectors(v){if(v==='static-productivity-resource')return new Set(['RESOURCE']);if(v==='static-productivity-materials')return new Set(['MATERIALS']);if(v==='static-productivity-consumer')return new Set(['CONSUMER']);if(v==='static-productivity-resource-materials')return new Set(['RESOURCE','MATERIALS']);if(v==='static-productivity-resource-consumer')return new Set(['RESOURCE','CONSUMER']);if(v==='static-productivity-materials-consumer')return new Set(['MATERIALS','CONSUMER']);if(v==='static-productivity-noncapital')return new Set(['RESOURCE','MATERIALS','CONSUMER']);return new Set();}";
assert.ok(text.includes(oldSectors),'P62 expected P61 sectors function not found');
text=text.replace(oldSectors,newSectors);
try{writeFileSync(tmp,text,'utf8');await import(`${pathToFileURL(tmp).href}?wp=p62`);}finally{try{unlinkSync(tmp);}catch{}}
