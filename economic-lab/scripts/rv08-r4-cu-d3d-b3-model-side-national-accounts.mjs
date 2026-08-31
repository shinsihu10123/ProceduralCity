import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || 24)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const contractPath = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-b3-model-side-national-accounts-contract.json');
const contractText = readFileSync(contractPath, 'utf8');
const contract = JSON.parse(contractText);
const EPS = 1e-9;
const TOL = Number(contract.execution?.relativeTolerance || 1e-8);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (values) => values.reduce((total, value) => total + finite(value), 0);
const ratio = (numerator, denominator) => Math.abs(finite(denominator)) > EPS ? finite(numerator) / finite(denominator) : null;
const absScale = (...values) => Math.max(1, ...values.map((value) => Math.abs(finite(value))));
const scaledResidual = (residual, ...scaleValues) => Math.abs(finite(residual)) / absScale(...scaleValues);

function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function statistics(values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length) {
    return { count: 0, min: null, p25: null, median: null, p75: null, max: null, iqr: null, mean: null };
  }
  const p25 = percentile(finiteValues, 0.25);
  const p75 = percentile(finiteValues, 0.75);
  return {
    count: finiteValues.length,
    min: finiteValues[0],
    p25,
    median: percentile(finiteValues, 0.5),
    p75,
    max: finiteValues.at(-1),
    iqr: p75 - p25,
    mean: sum(finiteValues) / finiteValues.length
  };
}

function digest(world) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ month: world.month, rng: world.rng }));
  for (const country of world.countries) hash.update(JSON.stringify(country));
  hash.update(JSON.stringify(world.ledger.entries));
  const entities = [...world.accounting.gl.entities.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const entity of entities) {
    hash.update(entity.id);
    hash.update(JSON.stringify([...entity.accounts.entries()]));
    hash.update(JSON.stringify(entity.journals));
    hash.update(JSON.stringify([...entity.monthlyResults.entries()]));
  }
  return hash.digest('hex');
}

function journalAmount(journal, account, side) {
  return sum((journal?.lines || [])
    .filter((line) => line.account === account)
    .map((line) => finite(line[side])));
}

function currentJournals(world, entityIds, month) {
  const journals = [];
  for (const id of entityIds) {
    const entity = world.accounting.gl.entities.get(id);
    if (!entity) continue;
    for (const journal of entity.journals) {
      if (Number(journal.month) === Number(month) && journal.kind !== 'period_close') journals.push(journal);
    }
  }
  return journals;
}

function naturalBalance(world, entityId, account) {
  const entity = world.accounting.gl.entities.get(entityId);
  if (!entity?.accounts?.has(account)) return 0;
  return finite(world.accounting.gl.naturalBalance(entityId, account));
}

function countryOpening(world, country) {
  return {
    householdCash: sum(country.households.map((household) => world.ledger.balance(household.accountId))),
    finishedInventoryBook: sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'inventory'))),
    inputInventoryBook: sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'input_inventory'))),
    wagesPayable: sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'wages_payable'))),
    wageReceivable: sum(country.households.map((household) => naturalBalance(world, household.id, 'wage_receivable')))
  };
}

function signedSettlementFlow(entries, accountIds) {
  let total = 0;
  for (const entry of entries) {
    for (const posting of entry.postings || []) {
      if (accountIds.has(String(posting.accountId))) total += finite(posting.delta);
    }
  }
  return total;
}

function settlementAmount(entries, kind, predicate = () => true) {
  return sum(entries.filter((entry) => entry.kind === kind && predicate(entry)).map((entry) => entry.amount));
}

function measureCountryMonth(world, country, opening) {
  const month = world.month;
  const entries = world.ledger.entriesFor({ month, countryId: country.id });
  const householdIds = new Set(country.households.map((household) => String(household.id)));
  const householdAccountIds = new Set(country.households.map((household) => String(household.accountId)));
  const firmJournals = currentJournals(world, country.firms.map((firm) => firm.id), month);
  const householdJournals = currentJournals(world, country.households.map((household) => household.id), month);

  const closing = {
    householdCash: sum(country.households.map((household) => world.ledger.balance(household.accountId))),
    finishedInventoryBook: sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'inventory'))),
    inputInventoryBook: sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'input_inventory'))),
    wagesPayable: sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'wages_payable'))),
    wageReceivable: sum(country.households.map((household) => naturalBalance(world, household.id, 'wage_receivable')))
  };

  const salesRevenue = sum(firmJournals.map((journal) => journalAmount(journal, 'sales_revenue', 'credit')));
  const costOfGoodsSold = sum(firmJournals.map((journal) => journalAmount(journal, 'cogs', 'debit')));
  const employeeCompensationAccrued = sum(firmJournals
    .filter((journal) => journal.kind === 'production_labor_accrual')
    .map((journal) => journalAmount(journal, 'wages_payable', 'credit')));
  const householdWageIncomeAccrued = sum(householdJournals
    .filter((journal) => journal.kind === 'wage_accrual')
    .map((journal) => journalAmount(journal, 'wage_income', 'credit')));
  const intermediateConsumptionBook = sum(firmJournals
    .filter((journal) => journal.kind === 'input_to_production')
    .map((journal) => journalAmount(journal, 'input_inventory', 'credit')));
  const inputPurchasesBook = sum(firmJournals
    .filter((journal) => journal.kind === 'interfirm_input_purchase' || journal.kind === 'international_input_import')
    .map((journal) => journalAmount(journal, 'input_inventory', 'debit')));

  const finishedInventoryBookChange = closing.finishedInventoryBook - opening.finishedInventoryBook;
  const inputInventoryBookChange = closing.inputInventoryBook - opening.inputInventoryBook;
  const grossOutputBookMarketHybrid = salesRevenue + finishedInventoryBookChange;
  const gvaBasicPriceProxy = grossOutputBookMarketHybrid - intermediateConsumptionBook;
  const grossOperatingSurplusProxy = salesRevenue - costOfGoodsSold;
  const gvaIncomeApproachProxy = employeeCompensationAccrued + grossOperatingSurplusProxy;
  const finishedInventoryBridgeResidual =
    finishedInventoryBookChange - (intermediateConsumptionBook + employeeCompensationAccrued - costOfGoodsSold);
  const inputInventoryBridgeResidual = inputInventoryBookChange - (inputPurchasesBook - intermediateConsumptionBook);
  const gvaApproachResidual = gvaBasicPriceProxy - gvaIncomeApproachProxy;

  const wagesSettled = settlementAmount(entries, 'wage');
  const unemploymentTransfers = settlementAmount(entries, 'unemployment_transfer');
  const incomeTaxes = settlementAmount(entries, 'income_tax');
  const consumptionTaxes = settlementAmount(entries, 'consumption_tax');
  const tariffTaxes = settlementAmount(entries, 'tariff_payment');
  const domesticGoodsPurchases = settlementAmount(entries, 'goods_purchase');
  const consumerImportBase = settlementAmount(entries, 'fx_import_payment', (entry) =>
    householdIds.has(String(entry.meta?.buyerId)) && String(entry.meta?.product) === 'consumer_good');
  const consumerImportTariffs = settlementAmount(entries, 'tariff_payment', (entry) =>
    householdIds.has(String(entry.meta?.payerId)) && String(entry.meta?.product) === 'consumer_good');

  const householdConsumptionExpense = sum(householdJournals
    .map((journal) => journalAmount(journal, 'consumption_expense', 'debit')));
  const householdTransferIncomeGL = sum(householdJournals
    .map((journal) => journalAmount(journal, 'transfer_income', 'credit')));
  const householdIncomeTaxGL = sum(householdJournals
    .filter((journal) => journal.kind === 'income_tax_payment')
    .map((journal) => journalAmount(journal, 'tax_expense', 'debit')));
  const householdConsumptionTaxGL = sum(householdJournals
    .filter((journal) => journal.kind === 'consumption_tax_payment')
    .map((journal) => journalAmount(journal, 'tax_expense', 'debit')));

  const cashDisposableHouseholdIncome = wagesSettled + unemploymentTransfers - incomeTaxes;
  const realizedHouseholdConsumptionPurchaserOutlay = householdConsumptionExpense + consumptionTaxes;
  const netHouseholdSavingFlowProxy = cashDisposableHouseholdIncome - realizedHouseholdConsumptionPurchaserOutlay;
  const householdCashChange = closing.householdCash - opening.householdCash;
  const householdCashLedgerDelta = signedSettlementFlow(entries, householdAccountIds);
  const nonSavingFinancialAndOtherNetFlow = householdCashChange - netHouseholdSavingFlowProxy;

  const productTaxes = consumptionTaxes + tariffTaxes;
  const gdpMarketPriceProxy = gvaBasicPriceProxy + productTaxes;
  const fieldDisposableIncome = sum(country.households.map((household) => household.disposableIncome));
  const fieldDomesticConsumption = sum(country.households.map((household) => household.consumption));
  const fieldSavings = sum(country.households.map((household) => household.savings));
  const desiredConsumptionBudget = sum(country.households.map((household) => household.desiredConsumptionBudget));

  const residuals = {
    firmVsHouseholdLabourAccrual: employeeCompensationAccrued - householdWageIncomeAccrued,
    wagesPayableBridge: closing.wagesPayable - opening.wagesPayable - employeeCompensationAccrued + wagesSettled,
    wageReceivableBridge: closing.wageReceivable - opening.wageReceivable - householdWageIncomeAccrued + wagesSettled,
    finishedInventoryBridge: finishedInventoryBridgeResidual,
    inputInventoryBridge: inputInventoryBridgeResidual,
    gvaApproach: gvaApproachResidual,
    settlementHouseholdCash: householdCashChange - householdCashLedgerDelta,
    cashDisposableIncomeField: cashDisposableHouseholdIncome - fieldDisposableIncome,
    macroDisposableIncome: cashDisposableHouseholdIncome - finite(country.macro?.disposableIncome),
    domesticConsumptionField: domesticGoodsPurchases - fieldDomesticConsumption,
    consumptionExpenseComposition:
      householdConsumptionExpense - (domesticGoodsPurchases + consumerImportBase + consumerImportTariffs),
    macroConsumptionExConsumptionTax: householdConsumptionExpense - finite(country.macro?.consumption),
    transferSettlementVsGL: unemploymentTransfers - householdTransferIncomeGL,
    incomeTaxSettlementVsGL: incomeTaxes - householdIncomeTaxGL,
    consumptionTaxSettlementVsGL: consumptionTaxes - householdConsumptionTaxGL,
    wageSettlementVsMacro: wagesSettled - finite(country.macro?.wageBill),
    consumptionTaxSettlementVsFiscal: consumptionTaxes - finite(country.lastFiscal?.consumptionTax),
    tariffSettlementVsInternational: tariffTaxes - finite(country.lastInternational?.tariffRevenue)
  };

  const residualScales = {
    firmVsHouseholdLabourAccrual: scaledResidual(residuals.firmVsHouseholdLabourAccrual, employeeCompensationAccrued, householdWageIncomeAccrued),
    wagesPayableBridge: scaledResidual(residuals.wagesPayableBridge, closing.wagesPayable, opening.wagesPayable, employeeCompensationAccrued, wagesSettled),
    wageReceivableBridge: scaledResidual(residuals.wageReceivableBridge, closing.wageReceivable, opening.wageReceivable, householdWageIncomeAccrued, wagesSettled),
    finishedInventoryBridge: scaledResidual(residuals.finishedInventoryBridge, finishedInventoryBookChange, intermediateConsumptionBook, employeeCompensationAccrued, costOfGoodsSold),
    inputInventoryBridge: scaledResidual(residuals.inputInventoryBridge, inputInventoryBookChange, inputPurchasesBook, intermediateConsumptionBook),
    gvaApproach: scaledResidual(residuals.gvaApproach, gvaBasicPriceProxy, gvaIncomeApproachProxy),
    settlementHouseholdCash: scaledResidual(residuals.settlementHouseholdCash, householdCashChange, householdCashLedgerDelta),
    cashDisposableIncomeField: scaledResidual(residuals.cashDisposableIncomeField, cashDisposableHouseholdIncome, fieldDisposableIncome),
    macroDisposableIncome: scaledResidual(residuals.macroDisposableIncome, cashDisposableHouseholdIncome, country.macro?.disposableIncome),
    domesticConsumptionField: scaledResidual(residuals.domesticConsumptionField, domesticGoodsPurchases, fieldDomesticConsumption),
    consumptionExpenseComposition: scaledResidual(residuals.consumptionExpenseComposition, householdConsumptionExpense, domesticGoodsPurchases, consumerImportBase, consumerImportTariffs),
    macroConsumptionExConsumptionTax: scaledResidual(residuals.macroConsumptionExConsumptionTax, householdConsumptionExpense, country.macro?.consumption),
    transferSettlementVsGL: scaledResidual(residuals.transferSettlementVsGL, unemploymentTransfers, householdTransferIncomeGL),
    incomeTaxSettlementVsGL: scaledResidual(residuals.incomeTaxSettlementVsGL, incomeTaxes, householdIncomeTaxGL),
    consumptionTaxSettlementVsGL: scaledResidual(residuals.consumptionTaxSettlementVsGL, consumptionTaxes, householdConsumptionTaxGL),
    wageSettlementVsMacro: scaledResidual(residuals.wageSettlementVsMacro, wagesSettled, country.macro?.wageBill),
    consumptionTaxSettlementVsFiscal: scaledResidual(residuals.consumptionTaxSettlementVsFiscal, consumptionTaxes, country.lastFiscal?.consumptionTax),
    tariffSettlementVsInternational: scaledResidual(residuals.tariffSettlementVsInternational, tariffTaxes, country.lastInternational?.tariffRevenue)
  };

  return {
    month,
    countryId: country.id,
    labour: {
      employeeCompensationAccrued,
      householdWageIncomeAccrued,
      wagesSettled,
      openingWagesPayable: opening.wagesPayable,
      closingWagesPayable: closing.wagesPayable,
      openingWageReceivable: opening.wageReceivable,
      closingWageReceivable: closing.wageReceivable,
      employeeCompensationShareOfGvaBasic: ratio(employeeCompensationAccrued, gvaBasicPriceProxy),
      employeeCompensationShareOfGdpMarket: ratio(employeeCompensationAccrued, gdpMarketPriceProxy)
    },
    production: {
      salesRevenue,
      costOfGoodsSold,
      grossOperatingSurplusProxy,
      openingFinishedInventoryBook: opening.finishedInventoryBook,
      closingFinishedInventoryBook: closing.finishedInventoryBook,
      finishedInventoryBookChange,
      openingInputInventoryBook: opening.inputInventoryBook,
      closingInputInventoryBook: closing.inputInventoryBook,
      inputInventoryBookChange,
      inputPurchasesBook,
      intermediateConsumptionBook,
      grossOutputBookMarketHybrid,
      gvaBasicPriceProxy,
      gvaIncomeApproachProxy,
      consumptionTaxes,
      tariffTaxes,
      productTaxes,
      gdpMarketPriceProxy,
      canonicalMacroGdp: finite(country.macro?.gdp),
      canonicalMacroGdpToReconstructedMarketGdp: ratio(country.macro?.gdp, gdpMarketPriceProxy)
    },
    household: {
      wagesSettled,
      unemploymentTransfers,
      incomeTaxes,
      cashDisposableHouseholdIncome,
      domesticGoodsPurchases,
      consumerImportBase,
      consumerImportTariffs,
      householdConsumptionExpense,
      consumptionTaxes,
      realizedHouseholdConsumptionPurchaserOutlay,
      realizedConsumptionShareOfCashDisposableIncome: ratio(realizedHouseholdConsumptionPurchaserOutlay, cashDisposableHouseholdIncome),
      netHouseholdSavingFlowProxy,
      netSavingShareOfCashDisposableIncome: ratio(netHouseholdSavingFlowProxy, cashDisposableHouseholdIncome),
      openingHouseholdCash: opening.householdCash,
      closingHouseholdCash: closing.householdCash,
      householdCashChange,
      householdCashLedgerDelta,
      nonSavingFinancialAndOtherNetFlow,
      fieldDisposableIncome,
      fieldDomesticConsumption,
      fieldSavings,
      desiredConsumptionBudget,
      desiredBudgetShareOfCashDisposableIncome: ratio(desiredConsumptionBudget, cashDisposableHouseholdIncome)
    },
    residuals,
    residualScales,
    semanticStatus: {
      labourShareComparator: contract.interpretation.labourShareComparatorStatus,
      householdSavingComparator: contract.interpretation.householdSavingComparatorStatus,
      desiredBudgetMappingAuthorized: false,
      canonicalMutationAuthorized: false
    }
  };
}

function run() {
  const world = new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
  const rows = [];
  for (let index = 0; index < months; index += 1) {
    const openings = new Map(world.countries.map((country) => [country.id, countryOpening(world, country)]));
    world.stepMonth();
    for (const country of world.countries) rows.push(measureCountryMonth(world, country, openings.get(country.id)));
  }
  const health = world.forceHealthCheck();
  const ledgerHealthy = world.countries.every((country) => world.ledger.verifyCountry(country.id)?.ok === true);
  const accountingHealthy = world.countries.every((country) => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok === true);
  const fiscalHealthy = world.countries.every((country) => world.fiscal.verifyCountry(country)?.accountingOk === true);
  const internationalHealthy = world.countries.every((country) => world.international.verifyCountry(country, world.countries)?.accountingOk === true);
  return {
    world,
    rows,
    digest: digest(world),
    hardAccountingHealthy: health.ok === true && ledgerHealthy && accountingHealthy && fiscalHealthy && internationalHealthy
  };
}

function summarize(rows) {
  const allResidualScales = rows.flatMap((row) => Object.values(row.residualScales).filter(Number.isFinite));
  const labourGvaShares = rows.map((row) => row.labour.employeeCompensationShareOfGvaBasic).filter(Number.isFinite);
  const labourGdpShares = rows.map((row) => row.labour.employeeCompensationShareOfGdpMarket).filter(Number.isFinite);
  const consumptionShares = rows.map((row) => row.household.realizedConsumptionShareOfCashDisposableIncome).filter(Number.isFinite);
  const savingShares = rows.map((row) => row.household.netSavingShareOfCashDisposableIncome).filter(Number.isFinite);
  const macroGdpRatios = rows.map((row) => row.production.canonicalMacroGdpToReconstructedMarketGdp).filter(Number.isFinite);
  const byCountry = {};
  for (const countryId of [...new Set(rows.map((row) => row.countryId))].sort()) {
    const countryRows = rows.filter((row) => row.countryId === countryId);
    byCountry[countryId] = {
      countryMonths: countryRows.length,
      employeeCompensationShareOfGvaBasic: statistics(countryRows.map((row) => row.labour.employeeCompensationShareOfGvaBasic)),
      employeeCompensationShareOfGdpMarket: statistics(countryRows.map((row) => row.labour.employeeCompensationShareOfGdpMarket)),
      realizedConsumptionShareOfCashDisposableIncome: statistics(countryRows.map((row) => row.household.realizedConsumptionShareOfCashDisposableIncome)),
      netSavingShareOfCashDisposableIncome: statistics(countryRows.map((row) => row.household.netSavingShareOfCashDisposableIncome)),
      negativeNetSavingMonthShare: countryRows.length
        ? countryRows.filter((row) => row.household.netHouseholdSavingFlowProxy < -EPS).length / countryRows.length
        : 0,
      nonPositiveGvaMonthShare: countryRows.length
        ? countryRows.filter((row) => row.production.gvaBasicPriceProxy <= EPS).length / countryRows.length
        : 0
    };
  }
  return {
    seed,
    months,
    countryMonths: rows.length,
    expectedCountryMonths: months * 4,
    maxScaledIdentityResidual: allResidualScales.length ? Math.max(...allResidualScales) : null,
    employeeCompensationShareOfGvaBasic: statistics(labourGvaShares),
    employeeCompensationShareOfGdpMarket: statistics(labourGdpShares),
    realizedConsumptionShareOfCashDisposableIncome: statistics(consumptionShares),
    netSavingShareOfCashDisposableIncome: statistics(savingShares),
    canonicalMacroGdpToReconstructedMarketGdp: statistics(macroGdpRatios),
    labourShareAboveOne: labourGvaShares.length ? labourGvaShares.filter((value) => value > 1).length / labourGvaShares.length : null,
    realizedConsumptionShareAboveOne: consumptionShares.length ? consumptionShares.filter((value) => value > 1).length / consumptionShares.length : null,
    negativeNetSavingCountryMonthShare: rows.length
      ? rows.filter((row) => row.household.netHouseholdSavingFlowProxy < -EPS).length / rows.length
      : 0,
    nonPositiveGvaCountryMonthShare: rows.length
      ? rows.filter((row) => row.production.gvaBasicPriceProxy <= EPS).length / rows.length
      : 0,
    byCountry
  };
}

assert.equal(contract.front, 'R4-CU-D3D-B3', 'B3 contract front mismatch');
assert.equal(contract.canonicalMutationAuthorized, false, 'Canonical mutation must remain locked');
assert.equal(contract.numericCalibrationRangesAuthorized, false, 'Numeric calibration ranges must remain locked');

const first = run();
const second = run();
const exactCanonicalReplay = first.digest === second.digest;
const exactDiagnosticReplay = JSON.stringify(first.rows) === JSON.stringify(second.rows);
const summary = summarize(first.rows);
const requiredGapIds = new Set([
  'EMPLOYER_SOCIAL_CONTRIBUTIONS',
  'SELF_EMPLOYED_MIXED_INCOME',
  'PENSION_ENTITLEMENT_ADJUSTMENT',
  'PROPERTY_INCOME_AND_TRANSFERS_IN_KIND',
  'BANK_FISIM_AND_NONMARKET_OUTPUT',
  'CONSUMPTION_OF_FIXED_CAPITAL'
]);
const registeredGapIds = new Set((contract.semanticGaps || []).map((gap) => gap.id));
const allResidualsWithinTolerance = first.rows.every((row) =>
  Object.values(row.residualScales).every((value) => Number.isFinite(value) && value <= TOL));
const finiteCoreMeasurements = first.rows.every((row) => [
  row.labour.employeeCompensationAccrued,
  row.labour.wagesSettled,
  row.production.salesRevenue,
  row.production.costOfGoodsSold,
  row.production.intermediateConsumptionBook,
  row.production.gvaBasicPriceProxy,
  row.production.gdpMarketPriceProxy,
  row.household.cashDisposableHouseholdIncome,
  row.household.realizedHouseholdConsumptionPurchaserOutlay,
  row.household.netHouseholdSavingFlowProxy
].every(Number.isFinite));

const gates = {
  noMutationByAudit: true,
  exactCanonicalReplay,
  exactDiagnosticReplay,
  hardAccountingHealthy: first.hardAccountingHealthy && second.hardAccountingHealthy,
  allCountryMonthsObserved: summary.countryMonths === summary.expectedCountryMonths,
  finiteCoreMeasurements,
  reconstructionIdentitiesHold: allResidualsWithinTolerance,
  firmAndHouseholdLabourAccrualReconciled: first.rows.every((row) => row.residualScales.firmVsHouseholdLabourAccrual <= TOL),
  wageAccrualSettlementBridgesReconciled: first.rows.every((row) =>
    row.residualScales.wagesPayableBridge <= TOL && row.residualScales.wageReceivableBridge <= TOL),
  productionAndIncomeGvaReconciled: first.rows.every((row) =>
    row.residualScales.finishedInventoryBridge <= TOL &&
    row.residualScales.inputInventoryBridge <= TOL &&
    row.residualScales.gvaApproach <= TOL),
  householdSettlementAndGlReconciled: first.rows.every((row) =>
    row.residualScales.settlementHouseholdCash <= TOL &&
    row.residualScales.cashDisposableIncomeField <= TOL &&
    row.residualScales.consumptionExpenseComposition <= TOL),
  semanticGapRegisterComplete: [...requiredGapIds].every((id) => registeredGapIds.has(id)),
  everySemanticGapExplicitlyNotImputed: (contract.semanticGaps || []).every((gap) => gap.imputationAuthorized === false),
  desiredBudgetDirectMappingBlocked: contract.interpretation.desiredConsumptionBudgetMappingAuthorized === false,
  empiricalBandPromotionBlocked: contract.interpretation.empiricalBandPromotionAuthorized === false,
  canonicalMutationLocked: contract.canonicalMutationAuthorized === false,
  numericCalibrationLocked: contract.numericCalibrationRangesAuthorized === false
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  schemaVersion: 'r4-cu-d3d-b3-model-side-national-accounts-v0.1',
  front: 'R4-CU-D3D-B3',
  generatedAt: new Date().toISOString(),
  seed,
  months,
  status: gates.ok ? 'PASS_MODEL_SIDE_RECONSTRUCTION_WITH_EXPLICIT_SEMANTIC_GAPS' : 'FAIL',
  contract: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b3-model-side-national-accounts-contract.json',
    sha256: createHash('sha256').update(contractText).digest('hex')
  },
  gates,
  summary,
  semanticGaps: contract.semanticGaps,
  nextFront: contract.nextFront,
  worldDigest: first.digest,
  rows: first.rows
};

console.log('WP_RV08_R4_CU_D3D_B3_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3D_B3_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R4_CU_D3D_B3_WORLD_DIGEST', first.digest);

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CU_D3D_B3_OUTPUT', outputJson);
}

assert.equal(gates.ok, true, `${seed}: R4-CU-D3D-B3 gate failed`);
