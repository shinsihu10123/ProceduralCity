import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v07.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4);
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingMoney = new Map();
for (const country of world.countries) {
  assert.equal(country.centralBanks.length, 1, `${country.id} central bank missing`);
  assert.equal(country.banks.length, 1, `${country.id} commercial bank missing`);
  assert.equal(country.governments.length, 1, `${country.id} government missing`);
  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} opening settlement invalid`);
  assert.ok(report.general.ok, `${country.id} opening private/bank accounting invalid`);
  assert.ok(report.fiscal.accountingOk, `${country.id} opening fiscal accounting invalid`);
  assert.ok(report.monetary.accountingOk, `${country.id} opening central-bank accounting invalid`);
  assert.ok(report.assetMarket.accountingOk, `${country.id} opening asset-market accounting invalid`);
  openingMoney.set(country.id, report.settlement.currentMoney);
}

// Explicitly exercise reserve-only monetary operations. They must change bank reserves
// without directly changing customer deposit money.
{
  const probe = new EconomicWorld('ECON-CB-PROBE');
  const country = probe.countries[0];
  const bank = country.banks[0];
  const openingDeposits = probe.ledger.totalBalance(country.id);
  const openingReserves = probe.accounting.gl.naturalBalance(bank.id, 'reserves');
  const purchase = probe.monetary.openMarketPurchase(country, 0, Math.max(1, openingReserves * 0.04));
  assert.ok(purchase > 0, 'open-market purchase must execute');
  probe.rebaseLegacySecurities(country);
  assert.ok(probe.accounting.gl.naturalBalance(bank.id, 'reserves') > openingReserves, 'OMO must increase bank reserves');
  assert.ok(Math.abs(probe.ledger.totalBalance(country.id) - openingDeposits) < 1e-6, 'OMO must not directly create customer deposits');
  const facility = probe.monetary.extendFacility(country, 0, Math.max(1, openingReserves * 0.025));
  assert.ok(facility > 0, 'central-bank liquidity facility must execute');
  assert.ok(probe.monetary.verifyCountry(country).accountingOk, 'central-bank facility accounting must reconcile');
  assert.ok(probe.fiscal.verifyCountry(country).accountingOk, 'fiscal securities reconciliation must survive OMO');
}

world.step(30);
assert.equal(world.month, 30);

let totalPrivateLoans = 0;
let totalB2B = 0;
let totalTaxes = 0;
let totalGovernmentDemand = 0;
let totalEquitySubscriptions = 0;
let totalSecondaryTurnover = 0;
let policyMoves = 0;

for (const country of world.countries) {
  for (const value of Object.values(country.macro)) assert.ok(Number.isFinite(value), `${country.id} macro must remain finite`);
  assert.ok(country.centralBanks[0].lastTrace, `${country.id} central-bank reasoning trace missing`);
  assert.ok(country.banks[0].lastTrace, `${country.id} bank reasoning trace missing`);
  assert.ok(country.governments[0].lastTrace, `${country.id} government reasoning trace missing`);
  assert.ok(country.households.some(h => h.lastTrace), `${country.id} household reasoning missing`);
  assert.ok(country.firms.some(f => f.lastTrace), `${country.id} firm reasoning missing`);
  assert.ok(country.lastAssetMarket.equityIndex > 0, `${country.id} equity index invalid`);
  assert.ok(country.lastMonetary.policyRate >= 0 && country.lastMonetary.policyRate <= 0.16, `${country.id} policy rate invalid`);
  assert.ok(country.lastMonetary.bankReserveRatio >= 0, `${country.id} reserve ratio invalid`);

  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement failed`);
  assert.ok(report.general.ok, `${country.id} private/bank SFC failed`);
  assert.ok(report.fiscal.accountingOk, `${country.id} fiscal accounting failed`);
  assert.ok(report.monetary.accountingOk, `${country.id} monetary accounting failed`);
  assert.ok(report.assetMarket.accountingOk, `${country.id} equity ownership/accounting failed`);
  assert.ok(Math.abs(report.monetary.reserveReconciliationError) < 1e-6, `${country.id} bank reserves != central-bank reserve liability`);
  assert.ok(Math.abs(report.monetary.facilityReconciliationError) < 1e-6, `${country.id} central-bank lending mismatch`);
  assert.ok(Math.abs(report.assetMarket.equityBookError) < 1e-6, `${country.id} equity book value mismatch`);
  assert.ok(Math.abs(report.assetMarket.shareOwnershipError) < 1e-6, `${country.id} share ownership mismatch`);

  const expectedGDP = country.macro.consumption
    + country.macro.grossInvestment
    + country.macro.publicInvestment
    + country.macro.governmentConsumption
    + country.macro.inventoryInvestment;
  assert.ok(Math.abs(country.macro.gdp - expectedGDP) < 1e-6, `${country.id} GDP expenditure identity failed`);

  const originations = world.ledger.entriesFor({ countryId: country.id, kind: 'bank_loan_origination' });
  const b2b = world.ledger.entriesFor({ countryId: country.id, kind: 'interfirm_purchase' });
  const tax = [
    ...world.ledger.entriesFor({ countryId: country.id, kind: 'income_tax' }),
    ...world.ledger.entriesFor({ countryId: country.id, kind: 'consumption_tax' }),
    ...world.ledger.entriesFor({ countryId: country.id, kind: 'corporate_tax' })
  ];
  const govDemand = [
    ...world.ledger.entriesFor({ countryId: country.id, kind: 'government_consumption' }),
    ...world.ledger.entriesFor({ countryId: country.id, kind: 'public_investment' })
  ];
  const subscriptions = world.ledger.entriesFor({ countryId: country.id, kind: 'equity_subscription' });
  const secondary = world.ledger.entriesFor({ countryId: country.id, kind: 'equity_secondary_trade' });

  totalPrivateLoans += originations.reduce((s, e) => s + e.amount, 0);
  totalB2B += b2b.reduce((s, e) => s + e.amount, 0);
  totalTaxes += tax.reduce((s, e) => s + e.amount, 0);
  totalGovernmentDemand += govDemand.reduce((s, e) => s + e.amount, 0);
  totalEquitySubscriptions += subscriptions.reduce((s, e) => s + e.amount, 0);
  totalSecondaryTurnover += secondary.reduce((s, e) => s + e.amount, 0);

  const rates = country.history.map(row => row.policyRate).filter(Number.isFinite);
  if (new Set(rates.map(x => x.toFixed(6))).size > 1) policyMoves += 1;

  const currentMoney = report.settlement.currentMoney;
  assert.ok(currentMoney >= 0 && openingMoney.get(country.id) >= 0);
  for (const h of country.households.slice(0, 20)) {
    const statement = world.accounting.entityStatement(h.id, world.month);
    assert.ok(statement.verification.ok, `${h.id} accounting equation failed`);
    assert.ok((statement.balanceSheet.accounts.equity_investments || 0) >= -1e-6, `${h.id} equity asset negative`);
  }
  for (const f of country.firms.slice(0, 20)) assert.ok(world.accounting.entityStatement(f.id, world.month).verification.ok, `${f.id} accounting failed`);
  assert.ok(world.accounting.entityStatement(country.centralBanks[0].id, world.month).verification.ok, `${country.id} central-bank equation failed`);
}

assert.ok(totalPrivateLoans > 0, 'private credit must remain active');
assert.ok(totalB2B > 0, 'supply chain must remain active');
assert.ok(totalTaxes > 0, 'fiscal taxation must remain active');
assert.ok(totalGovernmentDemand > 0, 'government final demand must remain active');
assert.ok(totalEquitySubscriptions > 0, 'firms must raise some real equity capital from households');
assert.ok(policyMoves > 0, 'at least one central bank must move its policy rate');
assert.ok(totalSecondaryTurnover >= 0);

const snap = world.snapshot();
for (const country of snap.countries) {
  assert.ok(country.monetaryAccounting.accountingOk);
  assert.ok(country.assetMarketAccounting.accountingOk);
  assert.ok(country.sampleCentralBankFinancials.verification.ok);
  assert.ok(country.assetMarket.equityIndex > 0);
}

console.log('Economic Lab v0.7 monetary / financial-market smoke test PASS');
