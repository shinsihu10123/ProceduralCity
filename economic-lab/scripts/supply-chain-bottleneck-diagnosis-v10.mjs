import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);
const key = (month, countryId) => `${month}|${countryId}`;

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1))),
    __rv07P5: {
      originalInitialPrice: Math.max(EPS, finite(seed.initialPrice, 1)),
      derivedPriceBasis: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1)))
    }
  }));
}

function createUnitBasisWorld(scaleProfile, seedText) {
  const originals = COUNTRY_SEEDS.map(seed => clone(seed));
  const replacement = transformedSeeds();
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...replacement);
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...originals);
  }
}

function stateFingerprint(world) {
  return {
    month: world.month,
    rng: clone(world.rng),
    countries: clone(world.countries),
    ledgerEntries: clone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function productSuppliers(country) {
  const out = new Map();
  for (const firm of country.firms || []) {
    if (firm.active === false) continue;
    const product = String(firm.product || 'unknown');
    if (!out.has(product)) out.set(product, []);
    out.get(product).push(firm);
  }
  return out;
}

function installSupplyObserver(world) {
  world.__rv07P5Records = new Map();
  const originalPlan = world.supply.planProduction.bind(world.supply);
  const originalProcure = world.supply.procureInputs.bind(world.supply);
  const originalProduce = world.supply.produce.bind(world.supply);

  world.supply.planProduction = country => {
    const result = originalPlan(country);
    const month = world.month;
    const rec = {
      month,
      countryId: country.id,
      firms: new Map(),
      products: {},
      reconciliation: { procurementMaxError: 0, productionMaxError: 0 }
    };
    for (const firm of country.firms || []) {
      if (firm.active === false) continue;
      rec.firms.set(firm.id, {
        firmId: firm.id,
        industryId: firm.industryId,
        product: firm.product,
        inputProduct: firm.inputProduct,
        inputPerOutput: finite(firm.inputPerOutput),
        workers: finite(firm.workers),
        cashAtPlan: finite(world.ledger.balance(firm.accountId)),
        price: finite(firm.price),
        wage: finite(firm.wage),
        inventoryAtPlan: finite(firm.inventory),
        targetInventory: finite(firm.targetInventory),
        previousSales: finite(firm.previousSales),
        demandBelief: finite(firm.beliefs?.demandGrowth),
        planName: String(firm.currentPlan?.selected || ''),
        capacity: finite(firm.capacity),
        desiredProduction: finite(firm.desiredProduction),
        inputOnHandBeforeProcure: firm.inputProduct ? finite(firm.inputInventory?.[firm.inputProduct]) : 0,
        requiredInput: firm.inputProduct ? Math.max(0, finite(firm.desiredProduction) * finite(firm.inputPerOutput)) : 0,
        startingNeed: 0,
        procurementBudget: 0,
        supplierStockBefore: 0,
        minSupplierPriceBefore: 0,
        affordableUnitsAtMinPrice: 0,
        procuredUnits: 0,
        procurementSpend: 0,
        shortageAfterProcure: 0,
        inputAvailableBeforeProduce: 0,
        noInputPotentialOutput: 0,
        expectedOutputByInputs: 0,
        actualOutput: 0,
        outputLostToInput: 0,
        definitelyBudgetInsufficient: false,
        definitelyPhysicalStockInsufficient: false,
        upperBoundsCouldCoverButShort: false
      });
    }
    world.__rv07P5Records.set(key(month, country.id), rec);
    return result;
  };

  world.supply.procureInputs = (country, month) => {
    const rec = world.__rv07P5Records.get(key(month, country.id));
    assert.ok(rec, `${country.id}/M${month}: plan observer record must exist`);
    const suppliers = productSuppliers(country);

    for (const firmRec of rec.firms.values()) {
      if (!firmRec.inputProduct) continue;
      const buyer = (country.firms || []).find(f => f.id === firmRec.firmId);
      const pool = suppliers.get(firmRec.inputProduct) || [];
      const sellable = pool.filter(f => f.active !== false && finite(f.inventory) > EPS);
      const stock = sum(sellable.map(f => Math.max(0, finite(f.inventory))));
      const prices = sellable.map(f => Math.max(EPS, finite(f.price))).filter(x => x > EPS);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const onHand = Math.max(0, finite(buyer?.inputInventory?.[firmRec.inputProduct]));
      const startingNeed = Math.max(0, firmRec.requiredInput - onHand);
      const cash = Math.max(0, finite(world.ledger.balance(buyer.accountId)));
      const budget = cash * 0.42;
      const affordable = minPrice > EPS ? budget / minPrice : 0;

      firmRec.inputOnHandBeforeProcure = onHand;
      firmRec.startingNeed = startingNeed;
      firmRec.procurementBudget = budget;
      firmRec.supplierStockBefore = stock;
      firmRec.minSupplierPriceBefore = minPrice;
      firmRec.affordableUnitsAtMinPrice = affordable;
      firmRec.definitelyPhysicalStockInsufficient = startingNeed > EPS && stock + 1e-8 < startingNeed;
      firmRec.definitelyBudgetInsufficient = startingNeed > EPS && minPrice > EPS && affordable + 1e-8 < startingNeed;
    }

    const result = originalProcure(country, month);

    for (const firmRec of rec.firms.values()) {
      if (!firmRec.inputProduct) continue;
      const buyer = (country.firms || []).find(f => f.id === firmRec.firmId);
      const after = Math.max(0, finite(buyer?.inputInventory?.[firmRec.inputProduct]));
      const procured = Math.max(0, after - firmRec.inputOnHandBeforeProcure);
      const shortage = Math.max(0, finite(buyer?.supplyShortage));
      firmRec.procuredUnits = procured;
      firmRec.procurementSpend = Math.max(0, finite(buyer?.inputSpend));
      firmRec.shortageAfterProcure = shortage;
      firmRec.inputAvailableBeforeProduce = after;
      firmRec.upperBoundsCouldCoverButShort =
        shortage > 1e-8 &&
        !firmRec.definitelyPhysicalStockInsufficient &&
        !firmRec.definitelyBudgetInsufficient;
      const err = firmRec.startingNeed - procured - shortage;
      rec.reconciliation.procurementMaxError = Math.max(rec.reconciliation.procurementMaxError, Math.abs(err));
    }

    const products = new Set([...suppliers.keys(), ...[...rec.firms.values()].map(x => x.inputProduct).filter(Boolean)]);
    for (const product of products) {
      const buyers = [...rec.firms.values()].filter(x => x.inputProduct === product);
      const pool = suppliers.get(product) || [];
      const sellable = pool.filter(f => f.active !== false && finite(f.inventory) > EPS);
      rec.products[product] = {
        inputProduct: product,
        buyers: buyers.length,
        totalStartingNeed: sum(buyers.map(x => x.startingNeed)),
        totalProcuredUnits: sum(buyers.map(x => x.procuredUnits)),
        totalShortageAfterProcure: sum(buyers.map(x => x.shortageAfterProcure)),
        totalBuyerBudget: sum(buyers.map(x => x.procurementBudget)),
        supplierStockAfterProcure: sum(sellable.map(f => Math.max(0, finite(f.inventory)))),
        definitelyBudgetInsufficientBuyers: buyers.filter(x => x.definitelyBudgetInsufficient).length,
        definitelyPhysicalInsufficientBuyers: buyers.filter(x => x.definitelyPhysicalStockInsufficient).length,
        upperBoundsCouldCoverButShortBuyers: buyers.filter(x => x.upperBoundsCouldCoverButShort).length,
        sameMonthSupplierOutput: 0,
        sameMonthOutputToShortageRatio: 0
      };
    }
    return result;
  };

  world.supply.produce = (country, month, metrics) => {
    const rec = world.__rv07P5Records.get(key(month, country.id));
    assert.ok(rec, `${country.id}/M${month}: procurement observer record must exist`);

    for (const firmRec of rec.firms.values()) {
      const firm = (country.firms || []).find(f => f.id === firmRec.firmId);
      const noInputPotential = Math.max(0, Math.min(finite(firm?.desiredProduction), finite(firm?.capacity)));
      const inputAvailable = firmRec.inputProduct ? Math.max(0, finite(firm?.inputInventory?.[firmRec.inputProduct])) : 0;
      const maxByInput = firmRec.inputProduct
        ? inputAvailable / Math.max(EPS, firmRec.inputPerOutput)
        : Number.POSITIVE_INFINITY;
      firmRec.inputAvailableBeforeProduce = inputAvailable;
      firmRec.noInputPotentialOutput = noInputPotential;
      firmRec.expectedOutputByInputs = Math.max(0, Math.min(noInputPotential, maxByInput));
    }

    const result = originalProduce(country, month, metrics);

    for (const firmRec of rec.firms.values()) {
      const firm = (country.firms || []).find(f => f.id === firmRec.firmId);
      firmRec.actualOutput = Math.max(0, finite(firm?.output));
      firmRec.outputLostToInput = Math.max(0, firmRec.noInputPotentialOutput - firmRec.actualOutput);
      const err = firmRec.actualOutput - firmRec.expectedOutputByInputs;
      rec.reconciliation.productionMaxError = Math.max(rec.reconciliation.productionMaxError, Math.abs(err));
    }

    for (const [product, productRec] of Object.entries(rec.products)) {
      const supplierOutput = sum([...rec.firms.values()].filter(x => x.product === product).map(x => x.actualOutput));
      productRec.sameMonthSupplierOutput = supplierOutput;
      productRec.sameMonthOutputToShortageRatio = ratio(supplierOutput, productRec.totalShortageAfterProcure);
    }
    return result;
  };
}

function productAggregate(records) {
  const out = {};
  for (const rec of records) {
    for (const [product, row] of Object.entries(rec.products || {})) {
      const target = out[product] ||= {
        startingNeed: 0,
        procured: 0,
        shortage: 0,
        buyerBudget: 0,
        sameMonthSupplierOutput: 0,
        definitelyBudgetInsufficientBuyers: 0,
        definitelyPhysicalInsufficientBuyers: 0,
        upperBoundsCouldCoverButShortBuyers: 0,
        buyerCases: 0
      };
      target.startingNeed += finite(row.totalStartingNeed);
      target.procured += finite(row.totalProcuredUnits);
      target.shortage += finite(row.totalShortageAfterProcure);
      target.buyerBudget += finite(row.totalBuyerBudget);
      target.sameMonthSupplierOutput += finite(row.sameMonthSupplierOutput);
      target.definitelyBudgetInsufficientBuyers += finite(row.definitelyBudgetInsufficientBuyers);
      target.definitelyPhysicalInsufficientBuyers += finite(row.definitelyPhysicalInsufficientBuyers);
      target.upperBoundsCouldCoverButShortBuyers += finite(row.upperBoundsCouldCoverButShortBuyers);
      target.buyerCases += finite(row.buyers);
    }
  }
  for (const row of Object.values(out)) {
    row.shortageRate = ratio(row.shortage, row.startingNeed);
    row.procurementFillRate = ratio(row.procured, row.startingNeed);
    row.sameMonthSupplierOutputToShortage = ratio(row.sameMonthSupplierOutput, row.shortage);
  }
  return out;
}

function rowFor(world, scaleProfile, seed, country) {
  const rec = world.__rv07P5Records.get(key(world.month, country.id));
  assert.ok(rec, `${country.id}/M${world.month}: diagnostic record missing`);
  const firms = [...rec.firms.values()];
  const inputFirms = firms.filter(x => x.inputProduct);
  const startingNeed = sum(inputFirms.map(x => x.startingNeed));
  const procured = sum(inputFirms.map(x => x.procuredUnits));
  const shortage = sum(inputFirms.map(x => x.shortageAfterProcure));
  const noInputPotentialOutput = sum(inputFirms.map(x => x.noInputPotentialOutput));
  const actualInputFirmOutput = sum(inputFirms.map(x => x.actualOutput));
  const outputLostToInput = sum(inputFirms.map(x => x.outputLostToInput));
  const industryShortage = finite(country.lastIndustry?.inputShortageUnits);
  const sectorOutputSum = sum(Object.values(country.lastIndustry?.sectorOutputs || {}));
  const observedOutputSum = sum(firms.map(x => x.actualOutput));
  const goods = country.lastMarkets?.goods || {};
  const macro = country.macro || {};

  return {
    scaleProfile,
    seed,
    month: world.month,
    countryId: country.id,
    supply: {
      startingNeed,
      procured,
      shortage,
      shortageRate: ratio(shortage, startingNeed),
      procurementFillRate: ratio(procured, startingNeed),
      inputFirmNoInputPotentialOutput: noInputPotentialOutput,
      inputFirmActualOutput: actualInputFirmOutput,
      outputLostToInput,
      inputOutputLossRate: ratio(outputLostToInput, noInputPotentialOutput),
      definitelyBudgetInsufficientBuyers: inputFirms.filter(x => x.definitelyBudgetInsufficient).length,
      definitelyPhysicalInsufficientBuyers: inputFirms.filter(x => x.definitelyPhysicalStockInsufficient).length,
      upperBoundsCouldCoverButShortBuyers: inputFirms.filter(x => x.upperBoundsCouldCoverButShort).length,
      inputBuyerCases: inputFirms.length,
      meanBudgetUseRate: mean(inputFirms.filter(x => x.procurementBudget > EPS).map(x => ratio(x.procurementSpend, x.procurementBudget))),
      industryShortage,
      industryShortageError: industryShortage - shortage,
      sectorOutputError: sectorOutputSum - observedOutputSum,
      products: clone(rec.products)
    },
    economy: {
      unemployment: finite(macro.unemployment),
      firmExits: finite(macro.firmExits),
      wageArrears: finite(macro.wageArrears),
      goodsFulfillmentRate: ratio(finite(goods.nominalConsumption ?? macro.consumption), finite(goods.desiredBudget)),
      activeFirms: finite(macro.activeFirms)
    },
    reconciliation: clone(rec.reconciliation)
  };
}

function runObserved(scaleProfile, seed, horizon, collect = true) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  installSupplyObserver(world);
  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (collect) for (const country of world.countries) rows.push(rowFor(world, scaleProfile, seed, country));
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${scaleProfile}/${seed}: health gate must pass`);
  return { world, rows, health, fingerprint: stateFingerprint(world) };
}

function runPlain(scaleProfile, seed, horizon) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return stateFingerprint(world);
}

const nonInterference = [];
for (const scaleProfile of scales) {
  const seed = `ECON-RV07-P5-NONINTERFERENCE-${scaleProfile}`;
  const horizon = Math.min(3, months);
  const plain = runPlain(scaleProfile, seed, horizon);
  const observed = runObserved(scaleProfile, seed, horizon, false).fingerprint;
  const exact = JSON.stringify(plain) === JSON.stringify(observed);
  assert.ok(exact, `${scaleProfile}: observer must be exactly non-interfering`);
  nonInterference.push({ scaleProfile, seed, months: horizon, exact });
}

const runs = [];
for (const scaleProfile of scales) {
  for (const seed of seeds) {
    const run = runObserved(scaleProfile, seed, months, true);
    runs.push({ scaleProfile, seed, rows: run.rows, health: run.health });
  }
}
const rows = runs.flatMap(run => run.rows);

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= months && w.to >= w.from);

function aggregate(rs) {
  const startingNeed = sum(rs.map(r => r.supply.startingNeed));
  const procured = sum(rs.map(r => r.supply.procured));
  const shortage = sum(rs.map(r => r.supply.shortage));
  const noInputPotential = sum(rs.map(r => r.supply.inputFirmNoInputPotentialOutput));
  const outputLost = sum(rs.map(r => r.supply.outputLostToInput));
  const records = rs.map(r => ({ products: r.supply.products }));
  return {
    countryMonths: rs.length,
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)),
    totalFirmExits: sum(rs.map(r => r.economy.firmExits)),
    meanGoodsFulfillmentRate: mean(rs.map(r => r.economy.goodsFulfillmentRate)),
    meanWageArrears: mean(rs.map(r => r.economy.wageArrears)),
    totalStartingInputNeed: startingNeed,
    totalProcuredInputUnits: procured,
    totalInputShortageUnits: shortage,
    procurementFillRate: ratio(procured, startingNeed),
    inputShortageRate: ratio(shortage, startingNeed),
    inputOutputLossRate: ratio(outputLost, noInputPotential),
    totalOutputLostToInput: outputLost,
    definitelyBudgetInsufficientBuyerCases: sum(rs.map(r => r.supply.definitelyBudgetInsufficientBuyers)),
    definitelyPhysicalInsufficientBuyerCases: sum(rs.map(r => r.supply.definitelyPhysicalInsufficientBuyers)),
    upperBoundsCouldCoverButShortBuyerCases: sum(rs.map(r => r.supply.upperBoundsCouldCoverButShortBuyers)),
    inputBuyerCases: sum(rs.map(r => r.supply.inputBuyerCases)),
    meanBudgetUseRate: mean(rs.map(r => r.supply.meanBudgetUseRate)),
    products: productAggregate(records)
  };
}

const aggregates = {};
for (const scaleProfile of scales) {
  aggregates[scaleProfile] = {};
  for (const window of windows) {
    const rs = rows.filter(r => r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to);
    aggregates[scaleProfile][window.id] = aggregate(rs);
  }
}

const maxProcurementError = rows.length ? Math.max(...rows.map(r => Math.abs(r.reconciliation.procurementMaxError))) : 0;
const maxProductionError = rows.length ? Math.max(...rows.map(r => Math.abs(r.reconciliation.productionMaxError))) : 0;
const maxIndustryShortageError = rows.length ? Math.max(...rows.map(r => Math.abs(r.supply.industryShortageError))) : 0;
const maxSectorOutputError = rows.length ? Math.max(...rows.map(r => Math.abs(r.supply.sectorOutputError))) : 0;

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv07-p5-supply-chain-bottleneck-diagnosis',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  residualCandidateBasis: 'price-wage unit-basis ablation from WP-RV07-P2; not merged canonically',
  scales,
  seeds,
  months,
  methodology: {
    canonicalEconomicMechanismChanges: 0,
    canonicalParameterTuning: 0,
    diagnosticIntervention: 'none',
    observedProcurementBudgetRule: 'existing implementation uses 42% of buyer cash',
    classificationNote: 'budget/physical flags are necessary-condition diagnostics; they do not by themselves prove causal dominance. Same-month supplier output is a timing counterfactual lead, not an admitted mechanism change.'
  },
  nonInterference,
  runs,
  aggregates,
  reconciliation: {
    maxProcurementError,
    maxProductionError,
    maxIndustryShortageError,
    maxSectorOutputError
  },
  gates: {
    observerNonInterferenceExact: nonInterference.every(x => x.exact),
    allHealthy: runs.every(run => run.health?.ok),
    completeCoverage: rows.length === scales.length * seeds.length * months * 4,
    procurementReconciled: maxProcurementError <= 1e-7,
    productionInputConstraintReconciled: maxProductionError <= 1e-7,
    industryShortageReconciled: maxIndustryShortageError <= 1e-7,
    sectorOutputReconciled: maxSectorOutputError <= 1e-7,
    finiteRows: rows.every(r => Number.isFinite(r.supply.shortageRate) && Number.isFinite(r.supply.inputOutputLossRate) && Number.isFinite(r.economy.unemployment))
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(scales.flatMap(scaleProfile => windows.map(window => {
  const a = aggregates[scaleProfile][window.id];
  const processed = a.products.processed_material || {};
  return {
    scale: scaleProfile,
    window: window.id,
    unemployment: Number(a.meanUnemployment.toFixed(4)),
    fulfillment: Number(a.meanGoodsFulfillmentRate.toFixed(4)),
    inputShortageRate: Number(a.inputShortageRate.toFixed(4)),
    inputOutputLossRate: Number(a.inputOutputLossRate.toFixed(4)),
    budgetBoundCases: a.definitelyBudgetInsufficientBuyerCases,
    physicalBoundCases: a.definitelyPhysicalInsufficientBuyerCases,
    residualCases: a.upperBoundsCouldCoverButShortBuyerCases,
    processedSameMonthOutputToShortage: Number(finite(processed.sameMonthSupplierOutputToShortage).toFixed(3)),
    exits: a.totalFirmExits
  };
})));
console.log('WP_RV07_P5_GATES', JSON.stringify(report.gates));
console.log('WP_RV07_P5_RECONCILIATION', JSON.stringify(report.reconciliation));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('WP_RV07_P5_OUTPUT', outputJson);
}

if (!report.gates.ok) process.exitCode = 1;
