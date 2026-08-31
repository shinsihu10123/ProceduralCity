import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const contractPath = resolve('economic-lab/diagnostics/reality-validation/r4-cu-d3d-b5-shadow-repair-family-contract.json');
const contractText = readFileSync(contractPath, 'utf8');
const contract = JSON.parse(contractText);
const candidateId = (process.env.CANDIDATE_ID || 'CTRL').trim();
const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const months = Math.max(1, Math.round(Number(process.env.DIAG_MONTHS || contract.stage1Execution.months)));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const candidate = contract.candidates.find((row) => row.id === candidateId);
const seedSpec = contract.stage1Execution.seeds.find((row) => row.seed === seed);
const EPS = 1e-9;
const TOL = 1e-8;

assert.ok(candidate, `Unknown B5 candidate: ${candidateId}`);
assert.ok(seedSpec, `Seed is not admitted to B5 Stage 1: ${seed}`);
assert.equal(months, contract.stage1Execution.months, 'Stage-1 horizon must remain frozen');
assert.equal(contract.canonicalMutationAuthorized, false, 'Canonical mutation must remain locked');

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
    return { count: 0, min: null, p25: null, median: null, p75: null, p90: null, max: null, mean: null };
  }
  return {
    count: finiteValues.length,
    min: finiteValues[0],
    p25: percentile(finiteValues, 0.25),
    median: percentile(finiteValues, 0.5),
    p75: percentile(finiteValues, 0.75),
    p90: percentile(finiteValues, 0.9),
    max: finiteValues.at(-1),
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

function candidateFactor(firm, candidateSpec) {
  if (candidateSpec.kind === 'CONTROL') return 1;
  const shape = finite(contract.mechanisms.valueRecoveryAxis.sectorShape[firm.industryId], 1);
  const consumerExtra = firm.industryId === 'CONSUMER' ? finite(candidateSpec.consumerYieldScale, 1) : 1;
  return finite(candidateSpec.valueScale, 1) * shape * consumerExtra;
}

function applyShadow(firm, candidateSpec) {
  if (firm.__r4CuD3dB5?.applied === true) return firm;
  const baseProductivity = finite(firm.productivity);
  const factor = candidateFactor(firm, candidateSpec);
  firm.productivity = baseProductivity * factor;
  firm.__r4CuD3dB5 = {
    applied: true,
    candidateId: candidateSpec.id,
    baseProductivity,
    factor,
    valueScale: candidateSpec.valueScale,
    consumerYieldScale: candidateSpec.consumerYieldScale,
    industryId: firm.industryId
  };
  return firm;
}

class ShadowWorld extends EconomicWorld {
  constructor(seedText, candidateSpec) {
    super(seedText, { scaleProfile: contract.stage1Execution.scaleProfile, healthCheckInterval: 0 });
    this.__r4CuD3dB5Candidate = candidateSpec;
    for (const country of this.countries) {
      for (const firm of country.firms) applyShadow(firm, candidateSpec);
    }
  }

  createEntrant(country, industryId) {
    const firm = super.createEntrant(country, industryId);
    applyShadow(firm, this.__r4CuD3dB5Candidate);
    return firm;
  }
}

function protectedSurface(world) {
  return world.countries.map((country) => ({
    id: country.id,
    name: country.name,
    demandLevel: country.demandLevel,
    financialAccess: country.financialAccess,
    productivity: country.productivity,
    humanCapital: country.humanCapital,
    capitalDepth: country.capitalDepth,
    resourceBase: country.resourceBase,
    openness: country.openness,
    initialWage: country.initialWage,
    initialPrice: country.initialPrice,
    householdWealth: country.householdWealth,
    firmCash: country.firmCash,
    households: country.households.map((household) => ({
      id: household.id,
      accountId: household.accountId,
      wage: household.wage,
      reservationWage: household.reservationWage,
      wealth: household.wealth,
      desiredConsumptionBudget: household.desiredConsumptionBudget,
      ledgerBalance: world.ledger.balance(household.accountId)
    })),
    firms: country.firms.map((firm) => ({
      id: firm.id,
      accountId: firm.accountId,
      industryId: firm.industryId,
      product: firm.product,
      inputProduct: firm.inputProduct,
      inputPerOutput: firm.inputPerOutput,
      consumerFacing: firm.consumerFacing,
      price: firm.price,
      wage: firm.wage,
      cash: firm.cash,
      safeCash: firm.safeCash,
      ledgerBalance: world.ledger.balance(firm.accountId)
    }))
  }));
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

function settlementAmount(entries, kind, predicate = () => true) {
  return sum(entries.filter((entry) => entry.kind === kind && predicate(entry)).map((entry) => entry.amount));
}

function measureCountryMonth(world, country, opening) {
  const month = world.month;
  const entries = world.ledger.entriesFor({ month, countryId: country.id });
  const householdIds = new Set(country.households.map((household) => String(household.id)));
  const firmJournals = currentJournals(world, country.firms.map((firm) => firm.id), month);
  const householdJournals = currentJournals(world, country.households.map((household) => household.id), month);
  const closingFinishedInventoryBook = sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'inventory')));
  const closingInputInventoryBook = sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'input_inventory')));
  const closingWagesPayable = sum(country.firms.map((firm) => naturalBalance(world, firm.id, 'wages_payable')));
  const closingWageReceivable = sum(country.households.map((household) => naturalBalance(world, household.id, 'wage_receivable')));
  const closingHouseholdCash = sum(country.households.map((household) => world.ledger.balance(household.accountId)));

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

  const finishedInventoryBookChange = closingFinishedInventoryBook - opening.finishedInventoryBook;
  const inputInventoryBookChange = closingInputInventoryBook - opening.inputInventoryBook;
  const gvaBasicPriceProxy = salesRevenue + finishedInventoryBookChange - intermediateConsumptionBook;
  const gvaIncomeApproachProxy = employeeCompensationAccrued + salesRevenue - costOfGoodsSold;

  const wagesSettled = settlementAmount(entries, 'wage');
  const unemploymentTransfers = settlementAmount(entries, 'unemployment_transfer');
  const incomeTaxes = settlementAmount(entries, 'income_tax');
  const consumptionTaxes = settlementAmount(entries, 'consumption_tax');
  const domesticGoodsPurchases = settlementAmount(entries, 'goods_purchase');
  const consumerImportBase = settlementAmount(entries, 'fx_import_payment', (entry) =>
    householdIds.has(String(entry.meta?.buyerId)) && String(entry.meta?.product) === 'consumer_good');
  const consumerImportTariffs = settlementAmount(entries, 'tariff_payment', (entry) =>
    householdIds.has(String(entry.meta?.payerId)) && String(entry.meta?.product) === 'consumer_good');
  const householdConsumptionExpense = sum(householdJournals
    .map((journal) => journalAmount(journal, 'consumption_expense', 'debit')));
  const cashDisposableHouseholdIncome = wagesSettled + unemploymentTransfers - incomeTaxes;
  const realizedHouseholdConsumptionPurchaserOutlay = householdConsumptionExpense + consumptionTaxes;
  const netHouseholdSavingFlowProxy = cashDisposableHouseholdIncome - realizedHouseholdConsumptionPurchaserOutlay;
  const desiredConsumptionBudget = sum(country.households.map((household) => household.desiredConsumptionBudget));
  const householdCashChange = closingHouseholdCash - opening.householdCash;
  const wageArrears = sum(country.households.map((household) => Math.max(0, finite(household.wageArrears))));
  const activeFirms = country.firms.filter((firm) => firm.active !== false);

  const residualScales = {
    labourAccrual: scaledResidual(
      employeeCompensationAccrued - householdWageIncomeAccrued,
      employeeCompensationAccrued,
      householdWageIncomeAccrued
    ),
    wagesPayable: scaledResidual(
      closingWagesPayable - opening.wagesPayable - employeeCompensationAccrued + wagesSettled,
      closingWagesPayable,
      opening.wagesPayable,
      employeeCompensationAccrued,
      wagesSettled
    ),
    wageReceivable: scaledResidual(
      closingWageReceivable - opening.wageReceivable - householdWageIncomeAccrued + wagesSettled,
      closingWageReceivable,
      opening.wageReceivable,
      householdWageIncomeAccrued,
      wagesSettled
    ),
    finishedInventory: scaledResidual(
      finishedInventoryBookChange - (intermediateConsumptionBook + employeeCompensationAccrued - costOfGoodsSold),
      finishedInventoryBookChange,
      intermediateConsumptionBook,
      employeeCompensationAccrued,
      costOfGoodsSold
    ),
    inputInventory: scaledResidual(
      inputInventoryBookChange - (inputPurchasesBook - intermediateConsumptionBook),
      inputInventoryBookChange,
      inputPurchasesBook,
      intermediateConsumptionBook
    ),
    gvaApproach: scaledResidual(gvaBasicPriceProxy - gvaIncomeApproachProxy, gvaBasicPriceProxy, gvaIncomeApproachProxy),
    consumptionComposition: scaledResidual(
      householdConsumptionExpense - (domesticGoodsPurchases + consumerImportBase + consumerImportTariffs),
      householdConsumptionExpense,
      domesticGoodsPurchases,
      consumerImportBase,
      consumerImportTariffs
    )
  };

  return {
    month,
    countryId: country.id,
    gvaBasicPriceProxy,
    employeeCompensationAccrued,
    employeeCompensationShareOfGva: ratio(employeeCompensationAccrued, gvaBasicPriceProxy),
    cashDisposableHouseholdIncome,
    realizedHouseholdConsumptionPurchaserOutlay,
    realizedConsumptionShareOfCashDisposableIncome: ratio(realizedHouseholdConsumptionPurchaserOutlay, cashDisposableHouseholdIncome),
    netHouseholdSavingFlowProxy,
    netSavingShareOfCashDisposableIncome: ratio(netHouseholdSavingFlowProxy, cashDisposableHouseholdIncome),
    desiredConsumptionBudget,
    desiredBudgetShareOfCashDisposableIncome: ratio(desiredConsumptionBudget, cashDisposableHouseholdIncome),
    householdCashChange,
    goodsFulfillmentRate: ratio(country.lastMarkets?.goods?.nominalConsumption, country.lastMarkets?.goods?.desiredBudget),
    payrollSettlementRate: ratio(
      country.lastMarkets?.payroll?.payroll,
      finite(country.lastMarkets?.payroll?.payroll) + finite(country.lastMarkets?.payroll?.unpaid)
    ),
    payrollPaid: finite(country.lastMarkets?.payroll?.payroll),
    payrollUnpaid: finite(country.lastMarkets?.payroll?.unpaid),
    wageArrears,
    activeFirms: activeFirms.length,
    totalFirms: country.firms.length,
    exits: finite(country.lastIndustry?.exits),
    entries: finite(country.lastIndustry?.entries),
    inputShortageUnits: finite(country.lastIndustry?.inputShortageUnits),
    b2bSpend: finite(country.lastIndustry?.b2bSpend),
    unemployment: finite(country.macro?.unemployment),
    priceIndex: finite(country.macro?.priceIndex),
    averageWage: finite(country.macro?.avgWage),
    nominalPurchasingPowerProxy: ratio(country.macro?.avgWage, country.macro?.priceIndex),
    firmCash: sum(country.firms.map((firm) => world.ledger.balance(firm.accountId))),
    householdCash: closingHouseholdCash,
    gdp: finite(country.macro?.gdp),
    realOutput: finite(country.macro?.realOutput),
    nominalSales: finite(country.macro?.nominalSales),
    residualScales
  };
}

function runOnce() {
  const control = new EconomicWorld(seed, { scaleProfile: contract.stage1Execution.scaleProfile, healthCheckInterval: 0 });
  const world = new ShadowWorld(seed, candidate);
  const controlSurface = protectedSurface(control);
  const candidateSurface = protectedSurface(world);
  const protectedNominalSurfaceExact = JSON.stringify(controlSurface) === JSON.stringify(candidateSurface);
  const rows = [];

  for (let index = 0; index < months; index += 1) {
    const openings = new Map(world.countries.map((country) => [country.id, countryOpening(world, country)]));
    world.stepMonth();
    for (const country of world.countries) rows.push(measureCountryMonth(world, country, openings.get(country.id)));
  }

  const health = world.forceHealthCheck();
  const hardAccountingHealthy =
    health.ok === true &&
    world.countries.every((country) => world.ledger.verifyCountry(country.id)?.ok === true) &&
    world.countries.every((country) => world.accounting.verifyCountry(country, world.ledger, world.month)?.ok === true) &&
    world.countries.every((country) => world.fiscal.verifyCountry(country)?.accountingOk === true) &&
    world.countries.every((country) => world.international.verifyCountry(country, world.countries)?.accountingOk === true);

  const firms = world.countries.flatMap((country) => country.firms);
  const allFirmsTagged = firms.every((firm) => firm.__r4CuD3dB5?.applied === true && firm.__r4CuD3dB5?.candidateId === candidate.id);
  const factorsCorrect = firms.every((firm) => {
    const tag = firm.__r4CuD3dB5;
    if (!tag) return false;
    const expected = candidateFactor(firm, candidate);
    return Math.abs(finite(tag.factor) - expected) <= 1e-12 &&
      Math.abs(finite(firm.productivity) - finite(tag.baseProductivity) * expected) <= 1e-8 * Math.max(1, Math.abs(finite(firm.productivity)));
  });

  return {
    world,
    rows,
    digest: digest(world),
    protectedNominalSurfaceExact,
    hardAccountingHealthy,
    allFirmsTagged,
    factorsCorrect
  };
}

function summarize(rows) {
  const positiveGvaRows = rows.filter((row) => finite(row.gvaBasicPriceProxy) > EPS);
  const positiveDisposableRows = rows.filter((row) => finite(row.cashDisposableHouseholdIncome) > EPS);
  const values = (field, source = rows) => source.map((row) => finite(row[field], Number.NaN)).filter(Number.isFinite);
  return {
    countryMonths: rows.length,
    expectedCountryMonths: months * 4,
    positiveGvaCountryMonths: positiveGvaRows.length,
    nonPositiveGvaCountryMonths: rows.length - positiveGvaRows.length,
    nonPositiveGvaShare: rows.length ? (rows.length - positiveGvaRows.length) / rows.length : null,
    positiveDisposableIncomeCountryMonths: positiveDisposableRows.length,
    employeeCompensationShareOfPositiveGva: statistics(values('employeeCompensationShareOfGva', positiveGvaRows)),
    realizedConsumptionShareOfCashDisposableIncome: statistics(values('realizedConsumptionShareOfCashDisposableIncome', positiveDisposableRows)),
    netSavingShareOfCashDisposableIncome: statistics(values('netSavingShareOfCashDisposableIncome', positiveDisposableRows)),
    desiredBudgetShareOfCashDisposableIncome: statistics(values('desiredBudgetShareOfCashDisposableIncome', positiveDisposableRows)),
    goodsFulfillmentRate: statistics(values('goodsFulfillmentRate')),
    payrollSettlementRate: statistics(values('payrollSettlementRate')),
    wageArrears: statistics(values('wageArrears')),
    activeFirms: statistics(values('activeFirms')),
    finalActiveFirms: sum(rows.filter((row) => row.month === months).map((row) => row.activeFirms)),
    totalExits: sum(values('exits')),
    totalEntries: sum(values('entries')),
    inputShortageUnits: statistics(values('inputShortageUnits')),
    totalInputShortageUnits: sum(values('inputShortageUnits')),
    b2bSpend: statistics(values('b2bSpend')),
    unemployment: statistics(values('unemployment')),
    nominalPurchasingPowerProxy: statistics(values('nominalPurchasingPowerProxy')),
    firmCash: statistics(values('firmCash')),
    householdCash: statistics(values('householdCash')),
    gdp: statistics(values('gdp')),
    realOutput: statistics(values('realOutput')),
    nominalSales: statistics(values('nominalSales')),
    maxScaledReconstructionResidual: Math.max(...rows.flatMap((row) => Object.values(row.residualScales).filter(Number.isFinite)))
  };
}

const first = runOnce();
const second = runOnce();
const summary = summarize(first.rows);
const reconstructionIdentitiesHold = first.rows.every((row) =>
  Object.values(row.residualScales).every((value) => Number.isFinite(value) && value <= TOL));
const finiteCoreMeasurements = first.rows.every((row) => [
  row.gvaBasicPriceProxy,
  row.employeeCompensationAccrued,
  row.cashDisposableHouseholdIncome,
  row.realizedHouseholdConsumptionPurchaserOutlay,
  row.netHouseholdSavingFlowProxy,
  row.activeFirms,
  row.firmCash,
  row.householdCash
].every(Number.isFinite));

const gates = {
  contractFrontCorrect: contract.front === 'R4-CU-D3D-B5-S1',
  candidatePreregistered: Boolean(candidate),
  seedPreregistered: Boolean(seedSpec),
  noCanonicalMutation: contract.canonicalMutationAuthorized === false,
  exactCanonicalReplay: first.digest === second.digest,
  exactDiagnosticReplay: JSON.stringify(first.rows) === JSON.stringify(second.rows),
  hardAccountingHealthy: first.hardAccountingHealthy && second.hardAccountingHealthy,
  protectedNominalSurfaceExact: first.protectedNominalSurfaceExact && second.protectedNominalSurfaceExact,
  allFirmsAndEntrantsTagged: first.allFirmsTagged && second.allFirmsTagged,
  productivityFactorsCorrect: first.factorsCorrect && second.factorsCorrect,
  allCountryMonthsObserved: summary.countryMonths === summary.expectedCountryMonths,
  finiteCoreMeasurements,
  reconstructionIdentitiesHold,
  desiredBudgetMutationBlocked: contract.mechanisms.consumerYieldAxis.desiredBudgetMutation === false,
  priceAndWageMutationBlocked:
    contract.mechanisms.valueRecoveryAxis.initialPriceMutation === false &&
    contract.mechanisms.valueRecoveryAxis.initialWageMutation === false,
  inputCoefficientMutationBlocked: contract.mechanisms.consumerYieldAxis.inputCoefficientMutation === false,
  financialAndMarketRuleMutationsBlocked:
    contract.blockedMutations.includes('procurement cash cap') &&
    contract.blockedMutations.includes('trade-credit rules') &&
    contract.blockedMutations.includes('bank-credit rules') &&
    contract.blockedMutations.includes('goods-market rules')
};
gates.ok = Object.values(gates).every(Boolean);

const result = {
  schemaVersion: 'r4-cu-d3d-b5-s1-shadow-screen-v0.1',
  front: 'R4-CU-D3D-B5-S1',
  generatedAt: new Date().toISOString(),
  candidate,
  seed,
  seedCase: seedSpec.case,
  months,
  contract: {
    path: 'economic-lab/diagnostics/reality-validation/r4-cu-d3d-b5-shadow-repair-family-contract.json',
    sha256: createHash('sha256').update(contractText).digest('hex')
  },
  gates,
  status: gates.ok ? 'SCREENED_PENDING_CROSS_CANDIDATE_AGGREGATION' : 'INTEGRITY_FAIL',
  summary,
  worldDigest: first.digest,
  rows: first.rows
};

console.log('WP_RV08_R4_CU_D3D_B5_S1_GATES', JSON.stringify(gates));
console.log('WP_RV08_R4_CU_D3D_B5_S1_SUMMARY', JSON.stringify({ candidateId, seed, summary }));
console.log('WP_RV08_R4_CU_D3D_B5_S1_WORLD_DIGEST', first.digest);
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(result, null, 2));
  console.log('WP_RV08_R4_CU_D3D_B5_S1_OUTPUT', outputJson);
}
assert.equal(gates.ok, true, `${candidateId}/${seed}: B5 Stage-1 integrity gate failed`);
