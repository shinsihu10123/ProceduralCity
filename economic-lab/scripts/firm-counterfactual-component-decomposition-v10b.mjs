import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// WP-RV07-P53 instrumentation correction only.
// The v10 observer wrapped originateCredit and then reconstructed the decision-time
// projectedCash from the post-origination ledger balance. firmDecision runs before
// originateCredit, so its projectedCash uses the pre-origination synchronized f.cash.
// Patch only that observation timestamp; no economic mechanism is changed.
const dir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(dir, 'firm-counterfactual-component-decomposition-v10.mjs');
const tempPath = join(dir, '.__wp-rv07-p53-v10b-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');

const oldStage = "w.banking.originateCredit=(c,m,s)=>{const out=credit(c,m,s);for";
const newStage = "w.banking.originateCredit=(c,m,s)=>{const decisionCash=new Map(c.firms.filter(x=>x.active!==false).map(f=>[f.id,F(f.cash,0)]));const out=credit(c,m,s);for";
const oldCash = "cash=w.ledger.balance(f.accountId),workers=";
const newCash = "cash=decisionCash.has(f.id)?decisionCash.get(f.id):F(f.cash,0),workers=";

assert.equal(source.split(oldStage).length - 1, 1, 'P53 v10 originateCredit observation anchor changed');
assert.equal(source.split(oldCash).length - 1, 1, 'P53 v10 cash reconstruction anchor changed');
source = source.replace(oldStage, newStage).replace(oldCash, newCash);

try {
  writeFileSync(tempPath, source, 'utf8');
  await import(`${pathToFileURL(tempPath).href}?corrected=p53-v10b`);
} finally {
  try { unlinkSync(tempPath); } catch {}
}
