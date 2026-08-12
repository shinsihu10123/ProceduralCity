import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v08.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4);
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);
assert.ok(world.globalInternationalReport().ok, 'opening global external position must balance');

const openingFx = new Map();
for (const country of world.countries) {
  openingFx.set(country.id, country.fx.rate);
  assert.ok(country.fx.rate > 0);
  assert.ok(country.tradePolicy.tariffRate >= 0);
  assert.ok(world.international.verifyCountry(country, world.countries).accountingOk, `${country.id} opening international accounting failed`);
  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} opening settlement failed`);
  assert.ok(report.general.ok, `${country.id} opening general accounting failed`);
  assert.ok(report.fiscal.accountingOk, `${country.id} opening fiscal accounting failed`);
  assert.ok(report.monetary.accountingOk, `${country.id} opening monetary accounting failed`);
  assert.ok(report.assetMarket.accountingOk, `${country.id} opening asset market accounting failed`);
}

// Deterministic capability probe: force one real cross-border input trade, then
// reclassify the resulting clearing claim/payable into a formal foreign funding contract.
{
  const probe = new EconomicWorld('ECON-INTL-PROBE');
  const importer = probe.countries[0];
  let buyer = importer.firms.find(f => f.active !== false && f.inputProduct);
  let exporter = probe.countries.find(c => c.id !== importer.id && c.firms.some(f => f.active !== false && f.product === buyer.inputProduct && f.inventory > 1));
  if (!exporter) {
    buyer = importer.firms.find(f => f.active !== false && f.industryId === 'CONSUMER');
    exporter = probe.countries.find(c => c.id !== importer.id && c.firms.some(f => f.active !== false && f.product === 'consumer_good' && f.inventory > 1));
  }
  assert.ok(buyer && exporter, 'probe cross-border buyer/exporter missing');
  const seller = exporter.firms.find(f => f.active !== false && f.product === (buyer.inputProduct || 'consumer_good') && f.inventory > 1);
  const trade = probe.international.settleTrade({
    importer,
    exporter,
    buyer,
    seller,
    month: 0,
    units: 0.5,
    product: buyer.inputProduct || 'consumer_good',
    purchaseType: buyer.inputProduct ? 'input' : 'consumer'
  });
  assert.ok(trade && trade.worldValue > 0, 'forced cross-border trade must settle');
  assert.ok(importer.internationalPosition.payablesWXU > 0);
  assert.ok(exporter.internationalPosition.receivablesWXU > 0);
  const funding = probe.international.createFundingContract(
    exporter,
    importer,
    0,
    Math.min(importer.internationalPosition.payablesWXU, exporter.internationalPosition.receivablesWXU) * 0.5,
    0.055
  );
  assert.ok(funding > 0, 'formal foreign funding contract must be creatable');
  assert.ok(probe.international.verifyCountry(importer, probe.countries).accountingOk);
  assert.ok(probe.international.verifyCountry(exporter, probe.countries).accountingOk);
  assert.ok(probe.globalInternationalReport().ok, 'probe global external accounts must balance');
}

world.step(36);
assert.equal(world.month, 36);

let totalImportsWXU = 0;
let totalExportsWXU = 0;
let totalTariffs = 0;
let totalFormalFunding = 0;
let countriesWithTrade = 0;
let countriesWithFxMovement = 0;
let intermediateTrade = 0;
let consumerTrade = 0;
let capitalTrade = 0;

for (const country of world.countries) {
  const intl = country.lastInternational;
  const report = world.accountingReport(country.id);
  for (const value of Object.values(country.macro)) assert.ok(Number.isFinite(value), `${country.id} macro value must be finite`);
  assert.ok(country.fx.rate > 0 && Number.isFinite(country.fx.rate), `${country.id} FX rate invalid`);
  if (Math.abs(country.fx.rate - openingFx.get(country.id)) > 1e-6) countriesWithFxMovement += 1;

  assert.ok(report.settlement.ok, `${country.id} settlement identity failed after FX flows`);
  assert.ok(report.general.ok, `${country.id} private/bank SFC failed`);
  assert.ok(report.fiscal.accountingOk, `${country.id} fiscal accounting failed`);
  assert.ok(report.monetary.accountingOk, `${country.id} monetary accounting failed`);
  assert.ok(report.assetMarket.accountingOk, `${country.id} asset accounting failed`);
  assert.ok(report.international.accountingOk, `${country.id} international bank-position accounting failed`);
  assert.ok(Math.abs(report.international.receivableBookError) < 1e-5);
  assert.ok(Math.abs(report.international.payableBookError) < 1e-5);
  assert.ok(Math.abs(report.international.foreignLoanBookError) < 1e-5);
  assert.ok(Math.abs(report.international.foreignBorrowingBookError) < 1e-5);

  const expectedGDP = country.macro.consumption
    + country.macro.grossInvestment
    + country.macro.publicInvestment
    + country.macro.governmentConsumption
    + country.macro.inventoryInvestment
    + country.macro.exports
    - country.macro.imports;
  assert.ok(Math.abs(country.macro.gdp - expectedGDP) < 1e-5, `${country.id} open-economy GDP identity failed`);
  assert.ok(Math.abs(intl.currentAccountWXU + intl.financialAccountNetInflowWXU) < 1e-8, `${country.id} balance-of-payments counterpart failed`);
  assert.ok(intl.foreignDebtWXU >= -1e-8);
  assert.ok(Number.isFinite(intl.netForeignAssetsWXU));

  const imports = world.ledger.entriesFor({ countryId: country.id, kind: 'fx_import_payment' });
  const exports = world.ledger.entriesFor({ countryId: country.id, kind: 'fx_export_receipt' });
  const tariffs = world.ledger.entriesFor({ countryId: country.id, kind: 'tariff_payment' });
  if (imports.length || exports.length) countriesWithTrade += 1;
  totalTariffs += tariffs.reduce((s, e) => s + e.amount, 0);

  const trades = world.international.trades.filter(t => t.importerId === country.id || t.exporterId === country.id);
  intermediateTrade += trades.filter(t => t.purchaseType === 'input').length;
  consumerTrade += trades.filter(t => t.purchaseType === 'consumer').length;
  capitalTrade += trades.filter(t => t.purchaseType === 'capital').length;

  totalImportsWXU += country.internationalHistory.reduce((s, row) => s + Number(row.importsWXU || 0), 0);
  totalExportsWXU += country.internationalHistory.reduce((s, row) => s + Number(row.exportsWXU || 0), 0);
  totalFormalFunding += country.internationalHistory.reduce((s, row) => s + Number(row.formalFundingInflowWXU || 0), 0);

  assert.ok(country.centralBanks[0].lastTrace, `${country.id} central bank reasoning missing`);
  assert.ok(country.banks[0].lastTrace, `${country.id} domestic bank reasoning missing`);
  assert.ok(country.governments[0].lastTrace, `${country.id} government reasoning missing`);
}

const global = world.globalInternationalReport();
assert.ok(global.ok, 'global trade / current account / NFA / funding identities must balance');
assert.ok(Math.abs(global.tradeErrorWXU) < 1e-6);
assert.ok(Math.abs(global.currentAccountErrorWXU) < 1e-6);
assert.ok(Math.abs(global.nfaErrorWXU) < 1e-6);
assert.ok(Math.abs(global.fundingErrorWXU) < 1e-6);
assert.ok(totalImportsWXU > 0 && totalExportsWXU > 0, 'international trade must occur');
assert.ok(Math.abs(totalImportsWXU - totalExportsWXU) < 1e-5, 'cumulative world exports must equal cumulative world imports');
assert.ok(totalTariffs > 0, 'tariff settlement must occur');
assert.ok(countriesWithTrade >= 3, 'trade must connect most countries');
assert.ok(countriesWithFxMovement >= 3, 'floating FX rates must move');
assert.ok(intermediateTrade > 0, 'international supply-chain trade must occur');
assert.ok(consumerTrade + capitalTrade > 0, 'at least one final/capital import channel must operate');
assert.ok(totalFormalFunding >= 0, 'foreign funding metric invalid');

const snap = world.snapshot();
assert.ok(snap.globalInternational.ok);
for (const c of snap.countries) {
  assert.ok(c.internationalAccounting.accountingOk);
  assert.ok(c.fx.rate > 0);
  assert.equal(c.bilateralExchangeRates.length, 3);
}

console.log('Economic Lab v0.8 international economy smoke test PASS');
