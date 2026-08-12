import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4, 'exactly four countries must exist');
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingMoney = new Map();
for (const country of world.countries) {
  assert.equal(country.banks.length, 1, `${country.id} must start with one commercial bank`);
  const sectors = new Set(country.firms.map(f => f.industryId));
  assert.deepEqual([...sectors].sort(), ['CAPITAL', 'CONSUMER', 'MATERIALS', 'RESOURCE'], `${country.id} must contain all four sectors`);
  const opening = world.accountingReport(country.id);
  assert.ok(opening.settlement.ok, `${country.id} opening settlement ledger must balance`);
  assert.ok(opening.general.ok, `${country.id} opening general ledger must balance`);
  assert.ok(Math.abs(opening.general.depositReconciliationError) < 1e-6, `${country.id} opening deposits must reconcile`);
  assert.ok(Math.abs(opening.general.loanReconciliationError) < 1e-6, `${country.id} opening loans must reconcile`);
  openingMoney.set(country.id, opening.settlement.currentMoney);
}

world.step(18);
assert.equal(world.month, 18);

let totalOriginated = 0;
let totalPayments = 0;
let totalB2B = 0;
let totalInvestment = 0;

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
  assert.ok(country.loans.length > 0, `${country.id} must originate at least one loan`);

  const goodsEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'goods_purchase' });
  const wageEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'wage' });
  const b2bEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'interfirm_purchase' });
  const investmentEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'capital_investment' });
  assert.ok(goodsEntries.length > 0, `${country.id} must settle household final-goods purchases during the run`);
  assert.ok(wageEntries.length > 0, `${country.id} must settle wage payments during the run`);
  assert.ok(b2bEntries.length > 0, `${country.id} must settle interfirm input purchases`);
  assert.ok(b2bEntries.some(e => e.meta.product === 'raw_material'), `${country.id} raw-material supply chain missing`);
  assert.ok(b2bEntries.some(e => e.meta.product === 'processed_material'), `${country.id} processed-material supply chain missing`);
  totalB2B += b2bEntries.reduce((s, e) => s + e.amount, 0);
  totalInvestment += investmentEntries.reduce((s, e) => s + e.amount, 0);

  const sectorTotals = country.history.reduce((acc, row) => {
    acc.RESOURCE += row.resourceOutput || 0;
    acc.MATERIALS += row.materialsOutput || 0;
    acc.CAPITAL += row.capitalGoodsOutput || 0;
    acc.CONSUMER += row.consumerGoodsOutput || 0;
    return acc;
  }, { RESOURCE: 0, MATERIALS: 0, CAPITAL: 0, CONSUMER: 0 });
  for (const [sector, output] of Object.entries(sectorTotals)) assert.ok(output > 0, `${country.id} ${sector} must produce positive output over time`);

  assert.ok(Math.abs(country.macro.gdp - (country.macro.consumption + country.macro.grossInvestment + country.macro.inventoryInvestment)) < 1e-6,
    `${country.id} GDP must equal C + I + inventory investment in the closed-economy stage`);

  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement ledger must validate endogenous money changes`);
  assert.ok(report.general.ok, `${country.id} general ledger must balance`);
  assert.ok(Math.abs(report.settlement.currentMoney - report.settlement.expectedMoney) < 1e-6, `${country.id} money stock must equal opening plus authorized bank creation/destruction`);
  assert.ok(Math.abs(report.general.maxEquationError) < 1e-6, `${country.id} A=L+E must hold`);
  assert.ok(Math.abs(report.general.maxCashReconciliationError) < 1e-6, `${country.id} accounting deposits must reconcile to settlement deposits`);
  assert.ok(Math.abs(report.general.depositReconciliationError) < 1e-6, `${country.id} bank deposit liabilities must equal customer deposits`);
  assert.ok(Math.abs(report.general.loanReconciliationError) < 1e-6, `${country.id} bank loan assets must equal borrower loan liabilities`);
  assert.ok(report.general.inventoryBook >= -1e-6, `${country.id} aggregate inventory book value invalid`);
  assert.ok(report.general.fixedAssets >= -1e-6, `${country.id} fixed assets invalid`);

  const originations = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_origination' });
  const payments = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_payment' });
  assert.ok(originations.length > 0, `${country.id} loan origination monetary entries missing`);
  totalOriginated += originations.reduce((s, e) => s + e.amount, 0);
  totalPayments += payments.reduce((s, e) => s + e.amount, 0);

  const expectedDelta = totalMonetaryDelta(world, country.id);
  assert.ok(Math.abs(expectedDelta - report.settlement.authorizedMoneyDelta) < 1e-6, `${country.id} authorized money delta mismatch`);
  assert.ok(Math.abs(report.settlement.currentMoney - openingMoney.get(country.id) - expectedDelta) < 1e-6, `${country.id} endogenous money identity failed`);

  const bank = country.banks[0];
  assert.ok(world.accounting.entityStatement(bank.id, world.month).verification.ok, `${bank.id} accounting equation failed`);

  for (const f of country.firms.slice(0, 30)) {
    const statement = world.accounting.entityStatement(f.id, world.month);
    assert.ok(statement.verification.ok, `${f.id} accounting equation failed`);
    assert.ok(statement.balanceSheet.accounts.inventory >= -1e-6, `${f.id} finished inventory book value negative`);
    assert.ok(statement.balanceSheet.accounts.input_inventory >= -1e-6, `${f.id} input inventory book value negative`);
    assert.ok(statement.balanceSheet.accounts.fixed_assets >= -1e-6, `${f.id} fixed assets negative`);
    assert.ok(statement.balanceSheet.accounts.loan_payable >= -1e-6, `${f.id} loan payable negative`);
    for (const qty of Object.values(f.inputInventory || {})) assert.ok(qty >= -1e-7, `${f.id} physical input inventory negative`);
  }
}

assert.ok(totalOriginated > 0, 'banking layer must create deposits through lending');
assert.ok(totalPayments > 0, 'banking layer must destroy deposits through debt service');
assert.ok(totalB2B > 0, 'supply-chain layer must create interfirm trade');
assert.ok(totalInvestment > 0, 'capital-goods sector must generate fixed investment');

const snap = world.snapshot();
for (const country of snap.countries) {
  assert.ok(country.sampleHouseholdFinancials.verification.ok);
  assert.ok(country.sampleFirmFinancials.verification.ok);
  assert.ok(country.sampleBankFinancials.verification.ok);
  assert.ok(country.industry);
  assert.ok(country.recentB2B.length >= 0);
}

console.log('Economic Lab v0.5 industry / supply-chain smoke test PASS');

function totalMonetaryDelta(world, countryId) {
  return world.ledger.entriesFor({ countryId }).reduce((s, e) => s + Number(e.monetaryDelta || 0), 0);
}
