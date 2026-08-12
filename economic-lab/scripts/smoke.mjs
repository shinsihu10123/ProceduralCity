import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4, 'exactly four countries must exist');
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingMoney = new Map();
for (const country of world.countries) {
  const opening = world.accountingReport(country.id);
  assert.ok(opening.settlement.ok, `${country.id} opening settlement ledger must balance`);
  assert.ok(opening.general.ok, `${country.id} opening general ledger must balance`);
  openingMoney.set(country.id, opening.settlement.currentMoney);
}

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
  assert.ok(country.macro.goodsTransactions > 0, `${country.id} must settle real goods transactions`);
  assert.ok(country.macro.payrollPayments > 0, `${country.id} must settle real wage payments`);

  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement ledger must balance`);
  assert.ok(report.general.ok, `${country.id} general ledger must balance`);
  assert.ok(Math.abs(report.settlement.moneyError) < 1e-6, `${country.id} money conservation failed`);
  assert.ok(Math.abs(report.settlement.currentMoney - openingMoney.get(country.id)) < 1e-6, `${country.id} money supply changed without banking/FX layer`);
  assert.ok(Math.abs(report.general.maxEquationError) < 1e-6, `${country.id} A=L+E must hold`);
  assert.ok(Math.abs(report.general.maxCashReconciliationError) < 1e-6, `${country.id} accounting cash must reconcile to settlement cash`);
  assert.ok(Number.isFinite(report.summary.firmProfit), `${country.id} firm profit must be finite`);

  const goodsEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'goods_purchase' });
  const wageEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'wage' });
  assert.ok(goodsEntries.length > 0, `${country.id} goods ledger entries missing`);
  assert.ok(wageEntries.length > 0, `${country.id} wage ledger entries missing`);

  for (const h of country.households.slice(0, 20)) {
    const statement = world.accounting.entityStatement(h.id, world.month);
    assert.ok(statement.verification.ok, `${h.id} accounting equation failed`);
    assert.ok(statement.balanceSheet.assets >= -1e-7, `${h.id} assets invalid`);
  }
  for (const f of country.firms.slice(0, 20)) {
    const statement = world.accounting.entityStatement(f.id, world.month);
    assert.ok(statement.verification.ok, `${f.id} accounting equation failed`);
    assert.ok(statement.balanceSheet.accounts.inventory >= -1e-6, `${f.id} inventory book value negative`);
  }
}

const snap = world.snapshot();
for (const country of snap.countries) {
  assert.ok(country.sampleHouseholdFinancials.verification.ok);
  assert.ok(country.sampleFirmFinancials.verification.ok);
  assert.ok(country.sampleFirmJournals.length > 0);
}

console.log('Economic Lab v0.3 accounting smoke test PASS');
