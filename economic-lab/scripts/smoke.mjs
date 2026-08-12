import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4, 'exactly four countries must exist');
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingMoney = new Map();
const openingAuthorizedDelta = new Map();
for (const country of world.countries) {
  assert.equal(country.banks.length, 1, `${country.id} must start with one commercial bank`);
  assert.equal(country.governments.length, 1, `${country.id} must start with one fiscal government`);
  const sectors = new Set(country.firms.map(f => f.industryId));
  assert.deepEqual([...sectors].sort(), ['CAPITAL', 'CONSUMER', 'MATERIALS', 'RESOURCE'], `${country.id} must contain all four sectors`);
  const opening = world.accountingReport(country.id);
  assert.ok(opening.settlement.ok, `${country.id} opening settlement ledger must balance`);
  assert.ok(opening.general.ok, `${country.id} opening general ledger must balance`);
  assert.ok(opening.fiscal.accountingOk, `${country.id} opening government accounting must balance`);
  assert.ok(Math.abs(opening.general.depositReconciliationError) < 1e-6, `${country.id} opening deposits must reconcile`);
  assert.ok(Math.abs(opening.general.loanReconciliationError) < 1e-6, `${country.id} opening loans must reconcile`);
  openingMoney.set(country.id, opening.settlement.currentMoney);
  openingAuthorizedDelta.set(country.id, opening.settlement.authorizedMoneyDelta);
}

world.step(24);
assert.equal(world.month, 24);

let totalOriginated = 0;
let totalPayments = 0;
let totalB2B = 0;
let totalInvestment = 0;
let totalTax = 0;
let totalTransfers = 0;
let totalGovernmentConsumption = 0;
let totalPublicInvestment = 0;
let totalGovernmentBondIssues = 0;
let totalGovernmentBondPayments = 0;

for (const country of world.countries) {
  assert.ok(country.households.length > 0);
  assert.ok(country.firms.length > 0);
  assert.equal(country.banks.length, 1);
  assert.equal(country.governments.length, 1);
  for (const value of Object.values(country.macro)) assert.ok(Number.isFinite(value), `${country.id} macro value must be finite`);
  assert.ok(country.households.some(h => h.lastTrace), `${country.id} household reasoning trace missing`);
  assert.ok(country.firms.some(f => f.lastTrace), `${country.id} firm reasoning trace missing`);
  assert.ok(country.banks[0].lastTrace, `${country.id} bank reasoning trace missing`);
  assert.ok(country.governments[0].lastTrace, `${country.id} government reasoning trace missing`);
  assert.ok(country.macro.priceIndex > 0);
  assert.ok(country.macro.unemployment >= 0 && country.macro.unemployment <= 1);
  assert.ok(country.loans.length > 0, `${country.id} must originate at least one private loan`);

  const goodsEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'goods_purchase' });
  const wageEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'wage' });
  const b2bEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'interfirm_purchase' });
  const investmentEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'capital_investment' });
  const incomeTaxEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'income_tax' });
  const consumptionTaxEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'consumption_tax' });
  const corporateTaxEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'corporate_tax' });
  const transferEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'unemployment_transfer' });
  const governmentConsumptionEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'government_consumption' });
  const publicInvestmentEntries = world.ledger.entriesFor({ countryId: country.id, kind: 'public_investment' });
  const governmentBondIssues = world.ledger.entriesFor({ countryId: country.id, kind: 'government_bond_issue' });
  const governmentBondPayments = world.ledger.entriesFor({ countryId: country.id, kind: 'government_bond_payment' });

  assert.ok(goodsEntries.length > 0, `${country.id} must settle household final-goods purchases`);
  assert.ok(wageEntries.length > 0, `${country.id} must settle wage payments`);
  assert.ok(b2bEntries.length > 0, `${country.id} must settle interfirm input purchases`);
  assert.ok(b2bEntries.some(e => e.meta.product === 'raw_material'), `${country.id} raw-material supply chain missing`);
  assert.ok(b2bEntries.some(e => e.meta.product === 'processed_material'), `${country.id} processed-material supply chain missing`);
  assert.ok(incomeTaxEntries.length > 0, `${country.id} must collect labor income tax`);
  assert.ok(consumptionTaxEntries.length > 0, `${country.id} must collect consumption tax`);
  assert.ok(transferEntries.length > 0, `${country.id} automatic stabilizer transfers missing`);

  totalB2B += b2bEntries.reduce((s, e) => s + e.amount, 0);
  totalInvestment += investmentEntries.reduce((s, e) => s + e.amount, 0);
  totalTax += [...incomeTaxEntries, ...consumptionTaxEntries, ...corporateTaxEntries].reduce((s, e) => s + e.amount, 0);
  totalTransfers += transferEntries.reduce((s, e) => s + e.amount, 0);
  totalGovernmentConsumption += governmentConsumptionEntries.reduce((s, e) => s + e.amount, 0);
  totalPublicInvestment += publicInvestmentEntries.reduce((s, e) => s + e.amount, 0);
  totalGovernmentBondIssues += governmentBondIssues.reduce((s, e) => s + e.amount, 0);
  totalGovernmentBondPayments += governmentBondPayments.reduce((s, e) => s + e.amount, 0);

  const sectorTotals = country.history.reduce((acc, row) => {
    acc.RESOURCE += row.resourceOutput || 0;
    acc.MATERIALS += row.materialsOutput || 0;
    acc.CAPITAL += row.capitalGoodsOutput || 0;
    acc.CONSUMER += row.consumerGoodsOutput || 0;
    return acc;
  }, { RESOURCE: 0, MATERIALS: 0, CAPITAL: 0, CONSUMER: 0 });
  for (const [sector, output] of Object.entries(sectorTotals)) assert.ok(output > 0, `${country.id} ${sector} must produce positive output over time`);

  const expectedGDP = country.macro.consumption
    + country.macro.grossInvestment
    + country.macro.publicInvestment
    + country.macro.governmentConsumption
    + country.macro.inventoryInvestment;
  assert.ok(Math.abs(country.macro.gdp - expectedGDP) < 1e-6,
    `${country.id} GDP must equal C + private I + public I + government consumption + inventory investment`);

  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement ledger must validate endogenous money changes`);
  assert.ok(report.general.ok, `${country.id} private/bank general ledger must balance`);
  assert.ok(report.fiscal.accountingOk, `${country.id} government ledger / bond reconciliation must balance`);
  assert.ok(Math.abs(report.settlement.currentMoney - report.settlement.expectedMoney) < 1e-6, `${country.id} money stock identity failed`);
  assert.ok(Math.abs(report.general.maxEquationError) < 1e-6, `${country.id} A=L+E must hold`);
  assert.ok(Math.abs(report.general.maxCashReconciliationError) < 1e-6, `${country.id} accounting deposits must reconcile to settlement deposits`);
  assert.ok(Math.abs(report.general.depositReconciliationError) < 1e-6, `${country.id} bank deposit liabilities must equal all settlement deposits`);
  assert.ok(Math.abs(report.general.loanReconciliationError) < 1e-6, `${country.id} bank loan assets must equal borrower loan liabilities`);
  assert.ok(Math.abs(report.fiscal.cashReconciliationError) < 1e-6, `${country.id} treasury deposit must reconcile`);
  assert.ok(Math.abs(report.fiscal.bondReconciliationError) < 1e-6, `${country.id} government bond liability mismatch`);
  assert.ok(Math.abs(report.fiscal.securitiesReconciliationError) < 1e-6, `${country.id} bank government-security asset mismatch`);
  assert.ok(report.general.inventoryBook >= -1e-6, `${country.id} aggregate inventory book value invalid`);
  assert.ok(report.general.fixedAssets >= -1e-6, `${country.id} fixed assets invalid`);

  const originations = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_origination' });
  const payments = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_payment' });
  assert.ok(originations.length > 0, `${country.id} loan origination monetary entries missing`);
  totalOriginated += originations.reduce((s, e) => s + e.amount, 0);
  totalPayments += payments.reduce((s, e) => s + e.amount, 0);

  const postOpeningDelta = totalMonetaryDelta(world, country.id) - openingAuthorizedDelta.get(country.id);
  assert.ok(Math.abs(report.settlement.currentMoney - openingMoney.get(country.id) - postOpeningDelta) < 1e-6,
    `${country.id} post-opening endogenous money identity failed`);

  const bank = country.banks[0];
  const government = country.governments[0];
  assert.ok(world.accounting.entityStatement(bank.id, world.month).verification.ok, `${bank.id} accounting equation failed`);
  assert.ok(world.accounting.entityStatement(government.id, world.month).verification.ok, `${government.id} accounting equation failed`);

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

assert.ok(totalOriginated > 0, 'banking layer must create deposits through private lending');
assert.ok(totalPayments > 0, 'private debt service must destroy deposits');
assert.ok(totalB2B > 0, 'supply-chain layer must create interfirm trade');
assert.ok(totalInvestment > 0, 'capital-goods sector must generate private fixed investment');
assert.ok(totalTax > 0, 'fiscal layer must collect actual taxes');
assert.ok(totalTransfers > 0, 'fiscal automatic stabilizers must transfer income');
assert.ok(totalGovernmentConsumption > 0, 'government must create real final consumption demand');
assert.ok(totalPublicInvestment > 0, 'government must purchase real public capital goods');
assert.ok(totalGovernmentBondIssues > 0, 'government bond financing must occur');
assert.ok(totalGovernmentBondPayments > 0, 'government debt service must occur');

const snap = world.snapshot();
for (const country of snap.countries) {
  assert.ok(country.sampleHouseholdFinancials.verification.ok);
  assert.ok(country.sampleFirmFinancials.verification.ok);
  assert.ok(country.sampleBankFinancials.verification.ok);
  assert.ok(country.sampleGovernmentFinancials.verification.ok);
  assert.ok(country.industry);
  assert.ok(country.fiscal);
  assert.ok(country.fiscalAccounting.accountingOk);
}

console.log('Economic Lab v0.6 fiscal-government smoke test PASS');

function totalMonetaryDelta(world, countryId) {
  return world.ledger.entriesFor({ countryId }).reduce((s, e) => s + Number(e.monetaryDelta || 0), 0);
}