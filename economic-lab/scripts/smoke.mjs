import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4, 'exactly four countries must exist');
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingMoney = new Map(world.countries.map(c => [c.id, world.accountingReport(c.id).currentMoney]));
world.step(6);
assert.equal(world.month, 6);

for (const country of world.countries) {
  assert.ok(country.households.length > 0);
  assert.ok(country.firms.length > 0);
  for (const value of Object.values(country.macro)) assert.ok(Number.isFinite(value), `${country.id} macro value must be finite`);
  assert.ok(country.households.some(h => h.lastTrace), `${country.id} household reasoning trace missing`);
  assert.ok(country.firms.some(f => f.lastTrace), `${country.id} firm reasoning trace missing`);
  assert.ok(country.macro.priceIndex > 0);
  assert.ok(country.macro.unemployment >= 0 && country.macro.unemployment <= 1);
  assert.ok(country.macro.goodsTransactions > 0, `${country.id} needs actual household purchase transactions`);
  assert.ok(country.macro.payrollPayments > 0, `${country.id} needs actual wage transactions`);

  const report = world.accountingReport(country.id);
  assert.equal(report.ok, true, `${country.id} ledger must balance`);
  assert.ok(Math.abs(report.moneyError) < 1e-6, `${country.id} money conservation failed`);
  assert.ok(Math.abs(report.currentMoney - openingMoney.get(country.id)) < 1e-6, `${country.id} money supply changed without banking/FX layer`);
  assert.equal(report.unbalancedEntries, 0);
  assert.equal(report.negativeAccounts, 0);

  const goodsEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'goods_purchase' });
  const wageEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'wage' });
  assert.ok(goodsEntries.length > 0, `${country.id} goods ledger entries missing`);
  assert.ok(wageEntries.length > 0, `${country.id} wage ledger entries missing`);
}

console.log('Economic Lab smoke test PASS: 4 countries, agent reasoning, labor/goods markets, balanced ledger');
