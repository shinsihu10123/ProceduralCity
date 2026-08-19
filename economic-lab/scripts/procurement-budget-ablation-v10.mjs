import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;

const VARIANTS = Object.freeze([
  Object.freeze({ id: 'unit-basis-control', fullCashProcurement: false }),
  Object.freeze({ id: 'unit-basis-full-cash-procurement', fullCashProcurement: true })
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1))),
    __rv07P7: {
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

function activeFirms(country) {
  return (country.firms || []).filter(f => f.active !== false);
}

function chooseSupplier(candidates, rng, sampleSize = 7) {
  if (!candidates.length) return null;
  let best = null;
  let bestScore = Infinity;
  const pool = candidates.filter(f => f.active !== false && f.inventory > EPS);
  if (!pool.length) return null;
  const tries = Math.min(sampleSize, pool.length);
  const seen = new Set();
  for (let k = 0; k < tries; k++) {
    let i = rng.int(0, pool.length);
    let guard = 0;
    while (seen.has(i) && guard++ < pool.length * 2) i = (i + 1) % pool.length;
    seen.add(i);
    const f = pool[i];
    const reliability = 0.78 + Math.min(0.35, f.productivity * 0.18);
    const score = f.price / Math.max(0.1, reliability) * (0.97 + rng.next() * 0.06);
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function installFullCashProcurement(world) {
  world.__rv07P7Procurement = new Map();

  world.supply.procureInputs = (country, month) => {
    const metrics = world.supply.emptyMetrics(country);
    const firms = activeFirms(country);
    const suppliersByProduct = new Map();
    for (const seller of firms) {
      if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
      suppliersByProduct.get(seller.product).push(seller);
    }

    const buyers = firms.filter(f => f.inputProduct).sort((a, b) => a.id.localeCompare(b.id));
    let totalStartingNeed = 0;
    let totalStartingCash = 0;
    let totalSpend = 0;
    let totalShortage = 0;
    let budgetExhaustedCases = 0;
    let noSellerCases = 0;
    let roundCapCases = 0;

    for (const buyer of buyers) {
      const product = buyer.inputProduct;
      const required = Math.max(0, buyer.desiredProduction * buyer.inputPerOutput);
      let onHand = Math.max(0, buyer.inputInventory[product] || 0);
      let remainingNeed = Math.max(0, required - onHand);
      const startingNeed = remainingNeed;
      const startingCash = Math.max(0, world.ledger.balance(buyer.accountId));
      let budgetRemaining = startingCash;
      let rounds = 0;
      let stoppedForNoSeller = false;

      totalStartingNeed += startingNeed;
      totalStartingCash += startingCash;

      for (let round = 0; round < 5 && remainingNeed > EPS && budgetRemaining > EPS; round++) {
        rounds += 1;
        const seller = chooseSupplier(suppliersByProduct.get(product) || [], world.rng, 6 + round * 2);
        if (!seller || seller.id === buyer.id) {
          stoppedForNoSeller = true;
          break;
        }
        const affordableUnits = budgetRemaining / Math.max(0.01, seller.price);
        const desiredUnits = Math.min(remainingNeed, seller.inventory, affordableUnits);
        if (desiredUnits <= EPS) break;
        const requested = desiredUnits * seller.price;
        const paid = world.ledger.transfer({
          month,
          countryId: country.id,
          from: buyer.accountId,
          to: seller.accountId,
          amount: requested,
          kind: 'interfirm_purchase',
          meta: { buyerId: buyer.id, sellerId: seller.id, product, units: desiredUnits }
        });
        if (paid <= EPS) break;

        const units = paid / seller.price;
        const sellerUnitCost = Math.max(0, seller.bookUnitCost || seller.price * 0.45);
        const sellerCost = Math.min(
          Math.max(0, world.accounting.gl.naturalBalance(seller.id, 'inventory')),
          units * sellerUnitCost
        );
        seller.inventory = Math.max(0, seller.inventory - units);
        seller.b2bSales += units;
        seller.b2bRevenue += paid;
        seller.revenue += paid;
        seller.sales += units;
        buyer.inputInventory[product] = (buyer.inputInventory[product] || 0) + units;
        buyer.inputBookValues[product] = (buyer.inputBookValues[product] || 0) + paid;
        buyer.inputSpend += paid;
        budgetRemaining = Math.max(0, budgetRemaining - paid);
        remainingNeed = Math.max(0, remainingNeed - units);
        totalSpend += paid;

        world.accounting.recordInterfirmPurchase({ buyer, seller, month, amount: paid, units, cost: sellerCost, product });
        metrics.b2bTransactions += 1;
        metrics.b2bSpend += paid;
        metrics.b2bUnits += units;
      }

      buyer.supplyShortage = Math.max(0, remainingNeed);
      metrics.inputShortageUnits += Math.max(0, startingNeed > 0 ? remainingNeed : 0);
      totalShortage += Math.max(0, remainingNeed);

      if (remainingNeed > EPS) {
        if (budgetRemaining <= EPS) budgetExhaustedCases += 1;
        else if (rounds >= 5) roundCapCases += 1;
        else if (stoppedForNoSeller) noSellerCases += 1;
      }
    }

    world.__rv07P7Procurement.set(`${month}|${country.id}`, {
      buyers: buyers.length,
      totalStartingNeed,
      totalStartingCash,
      totalSpend,
      totalShortage,
      budgetExhaustedCases,
      noSellerCases,
      roundCapCases
    });
    return metrics;
  };
}

function gdpResidual(macro) {
  const reconstructed =
    finite(macro?.consumption) +
    finite(macro?.grossInvestment) +
    finite(macro?.publicInvestment) +
    finite(macro?.governmentConsumption) +
    finite(macro?.inventoryInvestment) +
    finite(macro?.netExports);
  return finite(macro?.gdp) - reconstructed;
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

function rowFor(world, variant, scaleProfile, seed, country) {
  const macro = country.macro || {};
  const goods = country.lastMarkets?.goods || {};
  const industry = country.lastIndustry || {};
  const procurement = world.__rv07P7Procurement?.get(`${world.month}|${country.id}`) || null;
  const firmShortage = sum((country.firms || []).map(f => Math.max(0, finite(f.supplyShortage))));
  return {
    variant: variant.id,
    scaleProfile,
    seed,
    month: world.month,
    countryId: country.id,
    economy: {
      unemployment: finite(macro.unemployment),
      firmExits: finite(macro.firmExits),
      activeFirms: finite(macro.activeFirms),
      wageArrears: finite(macro.wageArrears),
      goodsFulfillmentRate: ratio(finite(goods.nominalConsumption ?? macro.consumption), finite(goods.desiredBudget)),
      inputShortageUnits: finite(industry.inputShortageUnits ?? macro.inputShortageUnits),
      grossInvestment: finite(macro.grossInvestment),
      gdp: finite(macro.gdp),
      gdpIdentityResidual: gdpResidual(macro)
    },
    procurement,
    reconciliation: {
      firmShortage,
      industryShortage: finite(industry.inputShortageUnits),
      shortageError: firmShortage - finite(industry.inputShortageUnits)
    },
    ledger: world.ledger.verifyCountry(country.id)
  };
}

function runVariant(variant, scaleProfile, seed, horizon, collect = true) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  if (variant.fullCashProcurement) installFullCashProcurement(world);
  else world.__rv07P7Procurement = new Map();

  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (collect) for (const country of world.countries) rows.push(rowFor(world, variant, scaleProfile, seed, country));
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seed}: health gate failed`);
  return { variant: variant.id, scaleProfile, seed, rows, health, fingerprint: stateFingerprint(world) };
}

const determinism = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    const seed = `ECON-RV07-P7-DETERMINISM-${variant.id}-${scaleProfile}`;
    const horizon = Math.min(3, months);
    const a = runVariant(variant, scaleProfile, seed, horizon, false).fingerprint;
    const b = runVariant(variant, scaleProfile, seed, horizon, false).fingerprint;
    const exact = JSON.stringify(a) === JSON.stringify(b);
    assert.ok(exact, `${variant.id}/${scaleProfile}: deterministic replay must be exact`);
    determinism.push({ variant: variant.id, scaleProfile, exact });
  }
}

const runs = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    for (const seed of seeds) runs.push(runVariant(variant, scaleProfile, seed, months, true));
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
  return {
    countryMonths: rs.length,
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)),
    totalFirmExits: sum(rs.map(r => r.economy.firmExits)),
    meanWageArrears: mean(rs.map(r => r.economy.wageArrears)),
    meanGoodsFulfillmentRate: mean(rs.map(r => r.economy.goodsFulfillmentRate)),
    meanInputShortageUnits: mean(rs.map(r => r.economy.inputShortageUnits)),
    totalInputShortageUnits: sum(rs.map(r => r.economy.inputShortageUnits)),
    meanGdp: mean(rs.map(r => r.economy.gdp)),
    maxAbsGdpResidual: Math.max(0, ...rs.map(r => Math.abs(r.economy.gdpIdentityResidual))),
    meanProcurementSpend: mean(rs.filter(r => r.procurement).map(r => r.procurement.totalSpend)),
    meanProcurementStartingCash: mean(rs.filter(r => r.procurement).map(r => r.procurement.totalStartingCash)),
    procurementSpendToStartingCash: ratio(sum(rs.filter(r => r.procurement).map(r => r.procurement.totalSpend)), sum(rs.filter(r => r.procurement).map(r => r.procurement.totalStartingCash)))
  };
}

const summary = [];
for (const variant of VARIANTS) {
  for (const scaleProfile of scales) {
    for (const window of windows) {
      const selected = rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= window.from && r.month <= window.to);
      summary.push({ variant: variant.id, scaleProfile, window: window.id, ...aggregate(selected) });
    }
  }
}

const comparisons = {};
for (const scaleProfile of scales) {
  comparisons[scaleProfile] = {};
  for (const window of windows) {
    const control = summary.find(x => x.variant === 'unit-basis-control' && x.scaleProfile === scaleProfile && x.window === window.id);
    const candidate = summary.find(x => x.variant === 'unit-basis-full-cash-procurement' && x.scaleProfile === scaleProfile && x.window === window.id);
    comparisons[scaleProfile][window.id] = {
      unemploymentDifference: candidate.meanUnemployment - control.meanUnemployment,
      firmExitDifference: candidate.totalFirmExits - control.totalFirmExits,
      wageArrearsDifference: candidate.meanWageArrears - control.meanWageArrears,
      goodsFulfillmentDifference: candidate.meanGoodsFulfillmentRate - control.meanGoodsFulfillmentRate,
      inputShortageDifference: candidate.meanInputShortageUnits - control.meanInputShortageUnits,
      inputShortageRatio: ratio(candidate.meanInputShortageUnits, control.meanInputShortageUnits),
      gdpDifference: candidate.meanGdp - control.meanGdp
    };
  }
}

const maxShortageError = Math.max(0, ...rows.map(r => Math.abs(r.reconciliation.shortageError)));
const maxGdpResidual = Math.max(0, ...rows.map(r => Math.abs(r.economy.gdpIdentityResidual)));
const allLedgerOk = rows.every(r => r.ledger?.ok === true);
const gates = {
  deterministicReplayExact: determinism.every(x => x.exact),
  allHealthy: runs.every(run => run.health?.ok === true),
  completeCoverage: rows.length === VARIANTS.length * scales.length * seeds.length * months * COUNTRY_SEEDS.length,
  supplyShortageReconciled: maxShortageError <= 1e-7,
  ledgerCountriesOk: allLedgerOk,
  gdpIdentityReconciled: maxGdpResidual <= 1e-7,
  finiteRows: rows.every(r => Object.values(r.economy).every(v => Number.isFinite(Number(v))))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `WP-RV07-P7 hard gate failure: ${JSON.stringify(gates)}`);

const report = {
  generatedAt: new Date().toISOString(),
  workPackage: 'WP-RV07-P7',
  description: 'Single-mechanism upper-bound ablation of the 42% procurement cash reservation rule under the experimental unit-basis candidate.',
  canonicalEconomicChanges: 0,
  canonicalParameterTuning: 0,
  productionRepairAuthorized: false,
  empiricalRealismClaim: false,
  scales,
  seeds,
  months,
  variants: VARIANTS,
  determinism,
  gates,
  reconciliation: { maxShortageError, maxGdpResidual },
  summary,
  comparisons,
  rows
};

const table = summary.filter(x => x.window === 'FULL').map(x => ({
  variant: x.variant,
  scale: x.scaleProfile,
  unemployment: Number(x.meanUnemployment.toFixed(4)),
  exits: x.totalFirmExits,
  wageArrears: Number(x.meanWageArrears.toFixed(1)),
  goodsFulfillment: Number(x.meanGoodsFulfillmentRate.toFixed(4)),
  inputShortage: Number(x.meanInputShortageUnits.toFixed(3)),
  spendToCash: Number(x.procurementSpendToStartingCash.toFixed(4)),
  maxGdpResidual: Number(x.maxAbsGdpResidual.toExponential(3))
}));
console.table(table);
console.log('WP_RV07_P7_COMPARISON', JSON.stringify(comparisons));
console.log('WP_RV07_P7_GATES', JSON.stringify(gates));
console.log('WP_RV07_P7_RECONCILIATION', JSON.stringify(report.reconciliation));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(report, null, 2));
  console.log('WP_RV07_P7_OUTPUT', outputJson);
}
