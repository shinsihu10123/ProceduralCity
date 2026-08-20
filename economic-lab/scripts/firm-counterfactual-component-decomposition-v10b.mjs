import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// WP-RV07-P53 instrumentation correction only.
// firmDecision runs before current-month credit origination. Its projectedCash therefore
// uses the synchronized f.cash available at decision time. Older P53 v10 used the
// post-originination ledger balance; newer source revisions may already read f.cash.
// This wrapper accepts either source form and changes observation only when necessary.
const dir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(dir, 'firm-counterfactual-component-decomposition-v10.mjs');
const tempPath = join(dir, '.__wp-rv07-p53-v10b-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');

const oldStage = "w.banking.originateCredit=(c,m,s)=>{const out=credit(c,m,s);for";
const snapStage = "w.banking.originateCredit=(c,m,s)=>{const decisionCash=new Map(c.firms.filter(x=>x.active!==false).map(f=>[f.id,F(f.cash,0)]));const out=credit(c,m,s);for";
const ledgerCash = "cash=w.ledger.balance(f.accountId),workers=";
const fieldCash = "cash=F(f.cash,0),workers=";
const snapCash = "cash=decisionCash.has(f.id)?decisionCash.get(f.id):F(f.cash,0),workers=";

assert.equal(source.split(oldStage).length - 1, 1, 'P53 v10 originateCredit observation anchor changed');
const ledgerCount = source.split(ledgerCash).length - 1;
const fieldCount = source.split(fieldCash).length - 1;
assert.equal(ledgerCount + fieldCount, 1, 'P53 v10 cash reconstruction anchor changed');

if (ledgerCount === 1) {
  source = source.replace(oldStage, snapStage).replace(ledgerCash, snapCash);
} else {
  // f.cash is not synchronized again until after originateCredit returns in canonical
  // world.stepCountry, so this is already the decision-time cash value.
  assert.equal(fieldCount, 1);
}

try {
  writeFileSync(tempPath, source, 'utf8');
  await import(`${pathToFileURL(tempPath).href}?corrected=p53-v10b2`);
} finally {
  try { unlinkSync(tempPath); } catch {}
}
