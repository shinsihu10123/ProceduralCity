import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setGoodsMarketDiagnosticObserver } from '../src/markets/goods-market.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 3));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;

function consumerSnapshot(country) {
  const firms = (country.firms || []).filter(f => f.active !== false && f.consumerFacing === true);
  return {
    firms: firms.length,
    inventoryUnits: sum(firms.map(f => Math.max(0, finite(f.inventory)))),
    inventoryValue: sum(firms.map(f => Math.max(0, finite(f.inventory)) * Math.max(0, finite(f.price)))),
    outputUnits: sum(firms.map(f => Math.max(0, finite(f.output)))),
    outputValueAtCurrentPrice: sum(firms.map(f => Math.max(0, finite(f.output)) * Math.max(0, finite(f.price)))),
    workers: sum(firms.map(f => Math.max(0, finite(f.workers)))),
    desiredWorkers: sum(firms.map(f => Math.max(0, finite(f.desiredWorkers)))),
    desiredProduction: sum(firms.map(f => Math.max(0, finite(f.desiredProduction)))),
    capacity: sum(firms.map(f => Math.max(0, finite(f.capacity)))),
    inputShortage: sum(firms.map(f => Math.max(0, finite(f.supplyShortage))))
  };
}

function countryOpening(country) {
  const consumer = consumerSnapshot(country);
  return {
    households: country.households?.length || 0,
    employed: (country.households || []).filter(h => h.employed).length,
    totalHouseholdCash: sum((country.households || []).map(h => Math.max(0, finite(h.wealth)))),
    firms: country.firms?.length || 0,
    activeFirms: (country.firms || []).filter(f => f.active !== false).length,
    consumer
  };
}

function fingerprint(world) {
  return {
    month: world.month,
    rng: structuredClone(world.rng),
    countries: structuredClone(world.countries),
    ledgerEntries: structuredClone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function installBoundaryObservers(world, boundary) {
  const originalProduce = world.supply.produce.bind(world.supply);
  world.supply.produce = (country, month, metrics) => {
    const before = consumerSnapshot(country);
    const result = originalProduce(country, month, metrics);
    const after = consumerSnapshot(country);
    boundary.production.push({
      month,
      countryId: country.id,
      before,
      after,
      inventoryUnitsAdded: after.inventoryUnits - before.inventoryUnits,
      inventoryValueAddedAtCurrentPrice: after.inventoryValue - before.inventoryValue
    });
    return result;
  };

  const originalGovernmentDemand = world.fiscal.executeGovernmentDemand.bind(world.fiscal);
  world.fiscal.executeGovernmentDemand = (country, month, previousMacro) => {
    const before = consumerSnapshot(country);
    const fiscalBefore = structuredClone(world.fiscal.metrics.get(country.id) || {});
    const result = originalGovernmentDemand(country, month, previousMacro);
    const after = consumerSnapshot(country);
    const fiscalAfter = structuredClone(world.fiscal.metrics.get(country.id) || {});
    boundary.government.push({
      month,
      countryId: country.id,
      before,
      after,
      consumerInventoryUnitsRemoved: before.inventoryUnits - after.inventoryUnits,
      consumerInventoryValueRemoved: before.inventoryValue - after.inventoryValue,
      governmentConsumptionAdded: finite(fiscalAfter.governmentConsumption) - finite(fiscalBefore.governmentConsumption),
      publicInvestmentAdded: finite(fiscalAfter.publicInvestment) - finite(fiscalBefore.publicInvestment)
    });
    return result;
  };
}

function runObserved(scaleProfile, seed, horizon, collect = true) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const opening = Object.fromEntries(world.countries.map(country => [country.id, countryOpening(country)]));
  const boundary = { production: [], government: [], goods: [] };
  installBoundaryObservers(world, boundary);
  setGoodsMarketDiagnosticObserver(event => boundary.goods.push(structuredClone(event)));
  const rows = [];
  let maxProductionUnitError = 0;
  let maxGovernmentValueError = 0;
  let maxHouseholdBoundaryUnitError = 0;
  let maxHouseholdBoundaryValueError = 0;
  let maxGoodsBudgetIdentityError = 0;

  try {
    for (let i = 0; i < horizon; i++) {
      world.stepMonth();
      if (!collect) continue;
      for (const country of world.countries) {
        const production = boundary.production.find(x => x.month === world.month && x.countryId === country.id);
        const government = boundary.government.find(x => x.month === world.month && x.countryId === country.id);
        const goods = boundary.goods.find(x => x.month === world.month && x.countryId === country.id);
        assert.ok(production && government && goods, `${scaleProfile}/${seed}/${country.id}/M${world.month}: exact boundary observations required`);

        const productionUnitError = production.inventoryUnitsAdded - production.after.outputUnits;
        const governmentValueError = government.consumerInventoryValueRemoved - government.governmentConsumptionAdded;
        const householdBoundaryUnitError = government.after.inventoryUnits - finite(goods.diagnostics?.initialInventoryUnits);
        const householdBoundaryValueError = government.after.inventoryValue - finite(goods.diagnostics?.initialInventoryValue);
        const goodsBudgetIdentityError = finite(goods.result?.desiredBudget) - finite(goods.result?.nominalConsumption) - finite(goods.result?.unmetBudget);

        maxProductionUnitError = Math.max(maxProductionUnitError, Math.abs(productionUnitError));
        maxGovernmentValueError = Math.max(maxGovernmentValueError, Math.abs(governmentValueError));
        maxHouseholdBoundaryUnitError = Math.max(maxHouseholdBoundaryUnitError, Math.abs(householdBoundaryUnitError));
        maxHouseholdBoundaryValueError = Math.max(maxHouseholdBoundaryValueError, Math.abs(householdBoundaryValueError));
        maxGoodsBudgetIdentityError = Math.max(maxGoodsBudgetIdentityError, Math.abs(goodsBudgetIdentityError));

        const desiredBudget = finite(goods.result?.desiredBudget);
        const householdStartInventoryValue = finite(goods.diagnostics?.initialInventoryValue);
        const openingCountry = opening[country.id];
        rows.push({
          scaleProfile,
          seed,
          month: world.month,
          countryId: country.id,
          population: {
            households: country.households.length,
            employed: country.households.filter(h => h.employed).length,
            totalFirms: country.firms.length,
            activeFirms: country.firms.filter(f => f.active !== false).length,
            activeConsumerFirms: country.firms.filter(f => f.active !== false && f.consumerFacing === true).length
          },
          opening: openingCountry,
          production,
          government,
          householdMarket: {
            desiredBudget,
            actualConsumption: finite(goods.result?.nominalConsumption),
            unmetBudget: finite(goods.result?.unmetBudget),
            budgetFulfillmentRate: ratio(goods.result?.nominalConsumption, desiredBudget),
            initialEligibleSellers: finite(goods.diagnostics?.initialEligibleSellers),
            startInventoryUnits: finite(goods.diagnostics?.initialInventoryUnits),
            startInventoryValue: householdStartInventoryValue,
            endEligibleSellers: finite(goods.diagnostics?.endEligibleSellers),
            endInventoryUnits: finite(goods.diagnostics?.endInventoryUnits),
            endInventoryValue: finite(goods.diagnostics?.endInventoryValue),
            householdsWithPositiveBudget: finite(goods.diagnostics?.householdsWithPositiveBudget),
            householdsWithUnmetBudget: finite(goods.diagnostics?.householdsWithUnmetBudget),
            noEligibleSellerStops: finite(goods.diagnostics?.noEligibleSellerStops),
            roundLimitStops: finite(goods.diagnostics?.roundLimitStops),
            settlementFailureStops: finite(goods.diagnostics?.settlementFailureStops)
          },
          scaleRatios: {
            openingInventoryValuePerHousehold: ratio(openingCountry.consumer.inventoryValue, openingCountry.households),
            desiredBudgetPerHousehold: ratio(desiredBudget, country.households.length),
            openingInventoryValueToDesiredBudget: ratio(openingCountry.consumer.inventoryValue, desiredBudget),
            postProductionInventoryValueToDesiredBudget: ratio(production.after.inventoryValue, desiredBudget),
            governmentConsumptionToPostProductionInventoryValue: ratio(government.governmentConsumptionAdded, production.after.inventoryValue),
            householdStartInventoryValueToDesiredBudget: ratio(householdStartInventoryValue, desiredBudget),
            consumerOutputValueToDesiredBudget: ratio(production.after.outputValueAtCurrentPrice, desiredBudget),
            consumerWorkersPer100Households: ratio(production.after.workers * 100, country.households.length),
            consumerCapacityUnitsPer100Households: ratio(production.after.capacity * 100, country.households.length),
            inputShortageToDesiredProduction: ratio(production.after.inputShortage, production.after.desiredProduction)
          },
          economy: {
            unemployment: finite(country.macro?.unemployment),
            nominalSales: finite(country.macro?.nominalSales),
            consumption: finite(country.macro?.consumption),
            realOutput: finite(country.macro?.realOutput),
            firmExits: finite(country.macro?.firmExits),
            creditStress: finite(country.lastMonetary?.creditStress)
          },
          reconciliation: {
            productionUnitError,
            governmentValueError,
            householdBoundaryUnitError,
            householdBoundaryValueError,
            goodsBudgetIdentityError
          }
        });
      }
    }
  } finally {
    setGoodsMarketDiagnosticObserver(null);
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${scaleProfile}/${seed}: health gate must pass`);
  if (!collect) return { fingerprint: fingerprint(world) };
  assert.equal(rows.length, horizon * world.countries.length, `${scaleProfile}/${seed}: complete country-month coverage required`);
  assert.ok(maxProductionUnitError <= 1e-7, `${scaleProfile}/${seed}: production must add physical consumer inventory equal to consumer output`);
  assert.ok(maxGovernmentValueError <= 1e-6, `${scaleProfile}/${seed}: government consumer inventory depletion must reconcile to government consumption`);
  assert.ok(maxHouseholdBoundaryUnitError <= 1e-7, `${scaleProfile}/${seed}: household market physical opening must equal post-government consumer inventory`);
  assert.ok(maxHouseholdBoundaryValueError <= 1e-6, `${scaleProfile}/${seed}: household market value opening must equal post-government consumer inventory value`);
  assert.ok(maxGoodsBudgetIdentityError <= 1e-6, `${scaleProfile}/${seed}: household desired budget must equal consumption plus unmet budget`);
  return {
    scaleProfile,
    seed,
    health,
    rows,
    reconciliation: { maxProductionUnitError, maxGovernmentValueError, maxHouseholdBoundaryUnitError, maxHouseholdBoundaryValueError, maxGoodsBudgetIdentityError },
    scale: world.scaleReport()
  };
}

function runPlain(scaleProfile, seed, horizon) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return fingerprint(world);
}

for (const scaleProfile of scales) {
  const seed = `ECON-RV07-NONINTERFERENCE-${scaleProfile}`;
  const control = runPlain(scaleProfile, seed, 1);
  const observed = runObserved(scaleProfile, seed, 1, false).fingerprint;
  assert.deepStrictEqual(observed, control, `WP-RV07 observers must be exactly non-interfering at ${scaleProfile} scale`);
}

const runs = [];
for (const scaleProfile of scales) for (const seed of seeds) runs.push(runObserved(scaleProfile, seed, months, true));
const rows = runs.flatMap(run => run.rows);

function aggregate(rs) {
  return {
    countryMonths: rs.length,
    meanHouseholds: mean(rs.map(r => r.population.households)),
    meanConsumerFirms: mean(rs.map(r => r.population.activeConsumerFirms)),
    meanDesiredBudgetPerHousehold: mean(rs.map(r => r.scaleRatios.desiredBudgetPerHousehold)),
    meanOpeningInventoryValuePerHousehold: mean(rs.map(r => r.scaleRatios.openingInventoryValuePerHousehold)),
    meanOpeningInventoryCoverage: mean(rs.map(r => r.scaleRatios.openingInventoryValueToDesiredBudget)),
    meanPostProductionInventoryCoverage: mean(rs.map(r => r.scaleRatios.postProductionInventoryValueToDesiredBudget)),
    meanGovernmentDepletionShareOfPostProductionValue: mean(rs.map(r => r.scaleRatios.governmentConsumptionToPostProductionInventoryValue)),
    meanHouseholdStartInventoryCoverage: mean(rs.map(r => r.scaleRatios.householdStartInventoryValueToDesiredBudget)),
    meanConsumerOutputValueCoverage: mean(rs.map(r => r.scaleRatios.consumerOutputValueToDesiredBudget)),
    meanBudgetFulfillmentRate: mean(rs.map(r => r.householdMarket.budgetFulfillmentRate)),
    meanConsumerWorkersPer100Households: mean(rs.map(r => r.scaleRatios.consumerWorkersPer100Households)),
    meanConsumerCapacityUnitsPer100Households: mean(rs.map(r => r.scaleRatios.consumerCapacityUnitsPer100Households)),
    meanInputShortageToDesiredProduction: mean(rs.map(r => r.scaleRatios.inputShortageToDesiredProduction)),
    shareCountryMonthsEndWithZeroEligibleSellers: ratio(rs.filter(r => r.householdMarket.endEligibleSellers === 0).length, rs.length),
    sharePositiveBudgetHouseholdsUnmet: ratio(sum(rs.map(r => r.householdMarket.householdsWithUnmetBudget)), sum(rs.map(r => r.householdMarket.householdsWithPositiveBudget))),
    totalGovernmentConsumption: sum(rs.map(r => r.government.governmentConsumptionAdded)),
    totalHouseholdDesiredBudget: sum(rs.map(r => r.householdMarket.desiredBudget)),
    totalHouseholdConsumption: sum(rs.map(r => r.householdMarket.actualConsumption))
  };
}

const byScale = Object.fromEntries(scales.map(scale => [scale, aggregate(rows.filter(r => r.scaleProfile === scale))]));
const month1ByScale = Object.fromEntries(scales.map(scale => [scale, aggregate(rows.filter(r => r.scaleProfile === scale && r.month === 1))]));

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv07-stock-flow-scale-audit',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scales,
  seeds,
  months,
  methodology: {
    mechanismChanges: 0,
    parameterTuning: 0,
    purpose: 'Discriminate initialization/unit-scale shortage, production/input shortage, government pre-emption, and later demand-signal feedback before selecting a structural repair.',
    boundaries: ['post-production consumer inventory', 'pre/post government final demand', 'household goods-market opening/closing'],
    caution: 'This is an internal structural audit, not an empirical calibration target.'
  },
  runs,
  aggregates: { byScale, month1ByScale },
  gates: {
    observerNonInterferenceExact: true,
    allHealthy: runs.every(run => run.health.ok),
    completeCoverage: rows.length === scales.length * seeds.length * months * 4,
    productionPhysicalFlowReconciled: runs.every(run => run.reconciliation.maxProductionUnitError <= 1e-7),
    governmentConsumerPurchaseReconciled: runs.every(run => run.reconciliation.maxGovernmentValueError <= 1e-6),
    householdMarketBoundaryReconciled: runs.every(run => run.reconciliation.maxHouseholdBoundaryUnitError <= 1e-7 && run.reconciliation.maxHouseholdBoundaryValueError <= 1e-6),
    goodsBudgetIdentityReconciled: runs.every(run => run.reconciliation.maxGoodsBudgetIdentityError <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV07 stock-flow scale audit gates must pass');

console.table(scales.map(scale => ({
  scale,
  month1OpeningCoverage: Number(month1ByScale[scale].meanOpeningInventoryCoverage.toFixed(5)),
  month1PostProductionCoverage: Number(month1ByScale[scale].meanPostProductionInventoryCoverage.toFixed(5)),
  month1HouseholdStartCoverage: Number(month1ByScale[scale].meanHouseholdStartInventoryCoverage.toFixed(5)),
  month1OutputCoverage: Number(month1ByScale[scale].meanConsumerOutputValueCoverage.toFixed(5)),
  month1BudgetFulfillment: Number(month1ByScale[scale].meanBudgetFulfillmentRate.toFixed(5)),
  consumerWorkersPer100HH: Number(month1ByScale[scale].meanConsumerWorkersPer100Households.toFixed(3)),
  inputShortageRatio: Number(month1ByScale[scale].meanInputShortageToDesiredProduction.toFixed(5))
})));
console.log('WP_RV07_GATES', JSON.stringify(report.gates));
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV07_JSON ${outputJson}`);
}
console.log('Economic Lab WP-RV07 stock-flow scale audit PASS');
