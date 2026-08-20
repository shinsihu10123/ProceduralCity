import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// P60 namespace wrapper. The base waterfall runner was authored before the
// concurrently allocated P55/P57 identifiers were visible. Economic logic is unchanged.
const dir=dirname(fileURLToPath(import.meta.url));
const src=join(dir,'operating-feasibility-utilization-waterfall-v10.mjs');
const tmp=join(dir,'.__wp-rv07-p60-waterfall-runtime.mjs');
let text=readFileSync(src,'utf8');
assert.ok(text.includes('WP_RV07_P55_GATES'));
text=text.replaceAll('P55','P60').replaceAll('p55','p60');
try{writeFileSync(tmp,text,'utf8');await import(`${pathToFileURL(tmp).href}?wp=p60`);}finally{try{unlinkSync(tmp);}catch{}}
