import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// P60 namespace + observer-signature/field correction wrapper.
// The base waterfall runner predates the current SupplyChainSystem.produce(country, month, metrics)
// signature and reads a legacy salesThisMonth field. This wrapper corrects only diagnostic observer
// forwarding and the observed sales field; no economic state-transition rule or parameter is changed.
const dir=dirname(fileURLToPath(import.meta.url));
const src=join(dir,'operating-feasibility-utilization-waterfall-v10.mjs');
const tmp=join(dir,'.__wp-rv07-p60-waterfall-runtime.mjs');
let text=readFileSync(src,'utf8');
assert.ok(text.includes('WP_RV07_P55_GATES'));
text=text.replaceAll('P55','P60').replaceAll('p55','p60');
const oldProduce="const produce=w.supply.produce.bind(w.supply);w.supply.produce=c=>{const out=produce(c);";
const newProduce="const produce=w.supply.produce.bind(w.supply);w.supply.produce=(c,month,metrics)=>{const out=produce(c,month,metrics);";
assert.ok(text.includes(oldProduce),'P60 expected observer produce wrapper not found');
text=text.replace(oldProduce,newProduce);
const oldSales='r.sales=F(f.salesThisMonth);';
const newSales='r.sales=F(f.sales);';
assert.ok(text.includes(oldSales),'P60 expected legacy sales observer field not found');
text=text.replace(oldSales,newSales);
try{writeFileSync(tmp,text,'utf8');await import(`${pathToFileURL(tmp).href}?wp=p60`);}finally{try{unlinkSync(tmp);}catch{}}
