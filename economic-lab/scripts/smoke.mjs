import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4, 'exactly four countries must exist');
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingMoney = new Map();
for (const country of world.countries) {
  assert.equal(country.banks.length, 1, `${country.id} must start with one commercial bank`);
  const opening = world.accountingReport(country.id);
  assert.ok(opening.settlement.ok, `${country.id} opening settlement ledger must balance`);
  assert.ok(opening.general.ok, `${country.id} opening general ledger must balance`);
  assert.ok(Math.abs(opening.general.depositReconciliationError) < 1e-6, `${country.id} opening deposits must reconcile`);
  assert.ok(Math.abs(opening.general.loanReconciliationError) < 1e-6, `${country.id} opening loans must reconcile`);
  openingMoney.set(country.id, opening.settlement.currentMoney);
}

world.step(12);
assert.equal(world.month, 12);

let totalOriginated = 0;
let totalPayments = 0;
for (const country of world.countries) {
  assert.ok(country.households.length > 0);
  assert.ok(country.firms.length > 0);
  assert.equal(country.banks.length, 1);
  for (const value of Object.values(country.macro)) assert.ok(Number.isFinite(value), `${country.id} macro value must be finite`);
  assert.ok(country.households.some(h => h.lastTrace), `${country.id} household reasoning trace missing`);
  assert.ok(country.firms.some(f => f.lastTrace), `${country.id} firm reasoning trace missing`);
  assert.ok(country.banks[0].lastTrace, `${country.id} bank reasoning trace missing`);
  assert.ok(country.macro.priceIndex > 0);
  assert.ok(country.macro.unemployment >= 0 && country.macro.unemployment <= 1);
  assert.ok(country.macro.goodsTransactions > 0, `${country.id} must settle real goods transactions`);
  assert.ok(country.macro.payrollPayments > 0, `${country.id} must settle real wage payments`);
  assert.ok(country.loans.length > 0, `${country.id} must originate at least one loan`);

  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement ledger must validate endogenous money changes`);
  assert.ok(report.general.ok, `${country.id} general ledger must balance`);
  assert.ok(Math.abs(report.settlement.currentMoney - report.settlement.expectedMoney) < 1e-6, `${country.id} money stock must equal opening plus authorized bank creation/destruction`);
  assert.ok(Math.abs(report.general.maxEquationError) < 1e-6, `${country.id} A=L+E must hold`);
  assert.ok(Math.abs(report.general.maxCashReconciliationError) < 1e-6, `${country.id} accounting deposits must reconcile to settlement deposits`);
  assert.ok(Math.abs(report.general.depositReconciliationError) < 1e-6, `${country.id} bank deposit liabilities must equal customer deposits`);
  assert.ok(Math.abs(report.general.loanReconciliationError) < 1e-6, `${country.id} bank loan assets must equal borrower loan liabilities`);
  assert.ok(Number.isFinite(report.summary.firmProfit), `${country.id} firm profit must be finite`);
  assert.ok(Number.isFinite(report.summary.bankProfit), `${country.id} bank profit must be finite`);

  const originations = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_origination' });
  const payments = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_payment' });
  assert.ok(originations.length > 0, `${country.id} loan origination monetary entries missing`);
  totalOriginated += originations.reduce((s, e) => s + e.amount, 0);
  totalPayments += payments.reduce((s, e) => s + e.amount, 0);

  const expectedDelta = totalMonetaryDelta(world, country.id);
  assert.ok(Math.abs(expectedDelta - report.settlement.authorizedMoneyDelta) < 1e-6, `${country.id} authorized money delta mismatch`);
  assert.ok(Math.abs(report.settlement.currentMoney - openingMoney.get(country.id) - expectedDelta) < 1e-6, `${country.id} endogenous money identity failed`);

  const bank = country.banks[0];
  const bankStatement = world.accounting.entityStatement(bank.id, world.month);
  assert.ok(bankStatement.verification.ok, `${bank.id} accounting equation failed`);
  assert.ok(bankStatement.balanceSheet.accounts.deposits >= -1e-7, `${bank.id} deposits invalid`);
  assert.ok(bankStatement.balanceSheet.accounts.loans >= -1e-7, `${bank.id} loans invalid`);

  for (const h of country.households.slice(0, 20)) {
    const statement = world.accounting.entityStatement(h.id, world.month);
    assert.ok(statement.verification.ok, `${h.id} accounting equation failed`);
    assert.ok(statement.balanceSheet.assets >= -1e-7, `${h.id} assets invalid`);
    assert.ok(statement.balanceSheet.accounts.loan_payable >= -1e-6, `${h.id} loan payable negative`);
  }
  for (const f of country.firms.slice(0, 20)) {
    const statement = world.accounting.entityStatement(f.id, world.month);
    assert.ok(statement.verification.ok, `${f.id} accounting equation failed`);
    assert.ok(statement.balanceSheet.accounts.inventory >= -1e-6, `${f.id} inventory book value negative`);
    assert.ok(statement.balanceSheet.accounts.loan_payable >= -1e-6, `${f.id} loan payable negative`);
  }
}

assert.ok(totalOriginated > 0, 'banking layer must create deposits through lending');
assert.ok(totalPayments > 0, 'banking layer must destroy deposits through debt service');

const snap = world.snapshot();
for (const country of snap.countries) {
  assert.ok(country.sampleHouseholdFinancials.verification.ok);
  assert.ok(country.sampleFirmFinancials.verification.ok);
  assert.ok(country.sampleBankFinancials.verification.ok);
  assert.ok(country.sampleBankJournals.length > 0);
}

console.log('Economic Lab v0.4 banking smoke test PASS');

function totalMonetaryDelta(world, countryId) {
  return world.ledger.entriesFor({ countryId }).reduce((s, e) => s + Number(e.monetaryDelta || 0), 0);
}
