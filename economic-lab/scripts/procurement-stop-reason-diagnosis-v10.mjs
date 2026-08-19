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

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clone = value => structuredClone(value);

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    initialPrice: Math.max(EPS, finite(seed.initialWage, finite(seed.initialPrice, 1))),
    __rv07P6: {
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

function fingerprint(world) {
  return {
    month: world.month,
    rng: clone(world.rng),
    countries: clone(world.countries),
    ledgerEntries: clone(world.ledger.entries),
    accounting: world.countries.map(country => ({ id: country.id, report: world.accountingReport(country.id) }))
  };
}

function activeFirms(country) {
  return (country.firms || []).filter(f => f.active !== false);
}

function chooseSupplierExact(candidates, rng, sampleSize = 7) {
  if (!candidates.length) return { seller: null, branch: 'EMPTY_CANDIDATE_LIST', poolSize: 0, tries: 0 };
  let best = null;
  let bestScore = Infinity;
  const pool = candidates.filter(f => f.active !== false && f.inventory > EPS);
  if (!pool.length) return { seller: null, branch: 'NO_SELLABLE_STOCK', poolSize: 0, tries: 0 };
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
  return { seller: best, branch: best ? 'SELECTED' : 'NO_SELECTION', poolSize: pool.length, tries };
}

function postStopContext(country, buyer, product, remainingNeed, budgetRemaining) {
  const eligible = activeFirms(country).filter(f => f.product === product && f.inventory > EPS && f.id !== buyer.id);
  const stock = sum(eligible.map(f => Math.max(0, finite(f.inventory))));
  const minPrice = eligible.length ? Math.min(...eligible.map(f => Math.max(EPS, finite(f.price)))) : 0;
  const affordableUnits = minPrice > EPS ? budgetRemaining / minPrice : 0;
  return {
    eligibleSuppliersExSelf: eligible.length,
    eligibleStockExSelf: stock,
    minEligiblePriceExSelf: minPrice,
    affordableUnitsAtStop: affordableUnits,
    physicalCouldCoverAtStop: stock + 1e-8 >= remainingNeed,
    budgetCouldCoverAtStop: minPrice > EPS && affordableUnits + 1e-8 >= remainingNeed
  };
}

function installExactProcurementTracer(world) {
  world.__rv07P6BuyerStops = [];
  world.__rv07P6CountryMonth = new Map();

  world.supply.procureInputs = (country, month) => {
    const metrics = world.supply.emptyMetrics(country);
    const firms = activeFirms(country);
    const suppliersByProduct = new Map();
    for (const seller of firms) {
      if (!suppliersByProduct.has(seller.product)) suppliersByProduct.set(seller.product, []);
      suppliersByProduct.get(seller.product).push(seller);
    }

    const buyers = firms.filter(f => f.inputProduct).sort((a, b) => a.id.localeCompare(b.id));
    const localStops = [];

    for (const buyer of buyers) {
      const product = buyer.inputProduct;
      const required = Math.max(0, buyer.desiredProduction * buyer.inputPerOutput);
      let onHand = Math.max(0, buyer.inputInventory[product] || 0);
      let remainingNeed = Math.max(0, required - onHand);
      const startingNeed = remainingNeed;
      const startingCash = world.ledger.balance(buyer.accountId);
      let budgetRemaining = startingCash * 0.42;
      const startingBudget = budgetRemaining;
      let roundsEntered = 0;
      let transactions = 0;
      let paidTotal = 0;
      let explicitBreak = null;
      let lastSelectionBranch = null;
      let lastPoolSize = 0;
      let lastSampleTries = 0;
      let selectedSelf = false;

      for (let round = 0; round < 5 && remainingNeed > EPS && budgetRemaining > EPS; round++) {
        roundsEntered += 1;
        const selection = chooseSupplierExact(suppliersByProduct.get(product) || [], world.rng, 6 + round * 2);
        const seller = selection.seller;
        lastSelectionBranch = selection.branch;
        lastPoolSize = selection.poolSize;
        lastSampleTries = selection.tries;
        if (!seller) {
          explicitBreak = selection.branch;
          break;
        }
        if (seller.id === buyer.id) {
          selectedSelf = true;
          explicitBreak = 'SELF_SUPPLIER_SELECTED';
          break;
        }
        const affordableUnits = budgetRemaining / Math.max(0.01, seller.price);
        const desiredUnits = Math.min(remainingNeed, seller.inventory, affordableUnits);
        if (desiredUnits <= EPS) {
          explicitBreak = 'NEGLIGIBLE_DESIRED_UNITS';
          break;
        }
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
        if (paid <= EPS) {
          explicitBreak = 'TRANSFER_FAILED';
          break;
        }

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
        paidTotal += paid;
        transactions += 1;

        world.accounting.recordInterfirmPurchase({ buyer, seller, month, amount: paid, units, cost: sellerCost, product });
        metrics.b2bTransactions += 1;
        metrics.b2bSpend += paid;
        metrics.b2bUnits += units;
      }

      buyer.supplyShortage = Math.max(0, remainingNeed);
      metrics.inputShortageUnits += Math.max(0, startingNeed > 0 ? remainingNeed : 0);

      let terminalBranch = explicitBreak;
      if (!terminalBranch) {
        if (startingNeed <= EPS) terminalBranch = 'NO_STARTING_NEED';
        else if (remainingNeed <= EPS) terminalBranch = 'FILLED';
        else if (budgetRemaining <= EPS) terminalBranch = 'BUDGET_EXHAUSTED';
        else if (roundsEntered >= 5) terminalBranch = 'ROUND_CAP';
        else terminalBranch = 'UNCLASSIFIED_TERMINATION';
      }

      const stopContext = postStopContext(country, buyer, product, remainingNeed, budgetRemaining);
      const stop = {
        month,
        countryId: country.id,
        buyerId: buyer.id,
        industryId: buyer.industryId,
        inputProduct: product,
        startingNeed,
        remainingNeed,
        fillRate: startingNeed > EPS ? (startingNeed - remainingNeed) / startingNeed : 1,
        startingCash,
        startingBudget,
        budgetSpent: paidTotal,
        budgetUseRate: startingBudget > EPS ? paidTotal / startingBudget : 0,
        budgetRemaining,
        roundsEntered,
        transactions,
        terminalBranch,
        lastSelectionBranch,
        lastPoolSize,
        lastSampleTries,
        selectedSelf,
        ...stopContext
      };
      localStops.push(stop);
      world.__rv07P6BuyerStops.push(stop);
    }

    world.__rv07P6CountryMonth.set(`${month}|${country.id}`, localStops);
    return metrics;
  };
}

function runPlain(scaleProfile, seed, horizon) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return fingerprint(world);
}

function runObserved(scaleProfile, seed, horizon, collect = true) {
  const world = createUnitBasisWorld(scaleProfile, seed);
  installExactProcurementTracer(world);
  const rows = [];

  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (!collect) continue;
    for (const country of world.countries) {
      const stops = world.__rv07P6CountryMonth.get(`${world.month}|${country.id}`) || [];
      const shortage = sum(stops.map(x => x.remainingNeed));
      const branchCounts = {};
      for (const stop of stops) branchCounts[stop.terminalBranch] = (branchCounts[stop.terminalBranch] || 0) + 1;
      const macro = country.macro || {};
      const goods = country.lastMarkets?.goods || {};
      rows.push({
        scaleProfile,
        seed,
        month: world.month,
        countryId: country.id,
        buyerCases: stops.length,
        shortage,
        industryShortage: finite(country.lastIndustry?.inputShortageUnits),
        shortageError: shortage - finite(country.lastIndustry?.inputShortageUnits),
        branchCounts,
        stoppedShortCases: stops.filter(x => x.remainingNeed > EPS),
        economy: {
          unemployment: finite(macro.unemployment),
          goodsFulfillmentRate: ratio(finite(goods.nominalConsumption ?? macro.consumption), finite(goods.desiredBudget)),
          firmExits: finite(macro.firmExits),
          wageArrears: finite(macro.wageArrears)
        }
      });
    }
  }

  const health = world.forceHealthCheck();
  return { scaleProfile, seed, rows, health, fingerprint: fingerprint(world) };
}

const nonInterference = [];
for (const scaleProfile of scales) {
  const seed = `ECON-RV07-P6-NI-${scaleProfile}`;
  const horizon = Math.min(3, months);
  const plain = runPlain(scaleProfile, seed, horizon);
  const observed = runObserved(scaleProfile, seed, horizon, false).fingerprint;
  const exact = JSON.stringify(plain) === JSON.stringify(observed);
  assert.ok(exact, `${scaleProfile}: exact traced procurement must reproduce the uninstrumented state`);
  nonInterference.push({ scaleProfile, seed, months: horizon, exact });
}

const runs = [];
for (const scaleProfile of scales) {
  for (const seed of seeds) runs.push(runObserved(scaleProfile, seed, months, true));
}
const rows = runs.flatMap(run => run.rows);
const allStops = rows.flatMap(row => row.stoppedShortCases.map(stop => ({ ...stop, scaleProfile: row.scaleProfile, seed: row.seed })));

const windows = [
  { id: 'M1-3', from: 1, to: Math.min(3, months) },
  { id: 'M4-6', from: 4, to: Math.min(6, months) },
  { id: 'M7-9', from: 7, to: Math.min(9, months) },
  { id: 'M10-12', from: 10, to: months },
  { id: 'FULL', from: 1, to: months }
].filter(w => w.from <= months && w.to >= w.from);

function aggregateRows(rs) {
  const stops = rs.flatMap(row => row.stoppedShortCases);
  const branchCounts = {};
  const branchShortage = {};
  for (const stop of stops) {
    branchCounts[stop.terminalBranch] = (branchCounts[stop.terminalBranch] || 0) + 1;
    branchShortage[stop.terminalBranch] = (branchShortage[stop.terminalBranch] || 0) + finite(stop.remainingNeed);
  }
  const totalShortage = sum(stops.map(x => x.remainingNeed));
  const roundCapStops = stops.filter(x => x.terminalBranch === 'ROUND_CAP');
  const selfStops = stops.filter(x => x.terminalBranch === 'SELF_SUPPLIER_SELECTED');
  const noStockStops = stops.filter(x => x.terminalBranch === 'NO_SELLABLE_STOCK' || x.terminalBranch === 'EMPTY_CANDIDATE_LIST');
  const budgetStops = stops.filter(x => x.terminalBranch === 'BUDGET_EXHAUSTED');
  const affordableAlgorithmic = stops.filter(x =>
    x.remainingNeed > EPS &&
    x.physicalCouldCoverAtStop &&
    x.budgetCouldCoverAtStop &&
    ['ROUND_CAP', 'SELF_SUPPLIER_SELECTED', 'NO_SELECTION', 'UNCLASSIFIED_TERMINATION'].includes(x.terminalBranch)
  );
  return {
    countryMonths: rs.length,
    shortBuyerCases: stops.length,
    totalShortage,
    branchCounts,
    branchShortage,
    budgetExhaustedCases: budgetStops.length,
    budgetExhaustedShortageShare: ratio(sum(budgetStops.map(x => x.remainingNeed)), totalShortage),
    roundCapCases: roundCapStops.length,
    roundCapShortageShare: ratio(sum(roundCapStops.map(x => x.remainingNeed)), totalShortage),
    selfSupplierCases: selfStops.length,
    selfSupplierShortageShare: ratio(sum(selfStops.map(x => x.remainingNeed)), totalShortage),
    noSellableStockCases: noStockStops.length,
    noSellableStockShortageShare: ratio(sum(noStockStops.map(x => x.remainingNeed)), totalShortage),
    affordableAlgorithmicStopCases: affordableAlgorithmic.length,
    affordableAlgorithmicShortageShare: ratio(sum(affordableAlgorithmic.map(x => x.remainingNeed)), totalShortage),
    meanStoppedBudgetUseRate: mean(stops.map(x => x.budgetUseRate)),
    meanUnemployment: mean(rs.map(x => x.economy.unemployment)),
    meanGoodsFulfillmentRate: mean(rs.map(x => x.economy.goodsFulfillmentRate)),
    totalFirmExits: sum(rs.map(x => x.economy.firmExits))
  };
}

const aggregates = {};
for (const scaleProfile of scales) {
  aggregates[scaleProfile] = {};
  for (const window of windows) {
    const rs = rows.filter(x => x.scaleProfile === scaleProfile && x.month >= window.from && x.month <= window.to);
    aggregates[scaleProfile][window.id] = aggregateRows(rs);
  }
}

const maxShortageError = rows.length ? Math.max(...rows.map(x => Math.abs(x.shortageError))) : 0;
const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv07-p6-procurement-stop-reason-diagnosis',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  residualCandidateBasis: 'price-wage unit-basis candidate; not merged canonically',
  scales,
  seeds,
  months,
  methodology: {
    canonicalEconomicMechanismChanges: 0,
    canonicalParameterTuning: 0,
    diagnosticIntervention: 'replace procureInputs with a source-equivalent traced implementation; exact non-interference replay is a hard gate',
    decisionRule: 'classify the actual terminal branch of the five-round procurement loop before admitting any causal repair ablation'
  },
  nonInterference,
  runs: runs.map(({ fingerprint: fp, ...rest }) => rest),
  aggregates,
  reconciliation: { maxShortageError },
  gates: {
    exactSourceEquivalentReplay: nonInterference.every(x => x.exact),
    allHealthy: runs.every(run => run.health?.ok),
    completeCoverage: rows.length === scales.length * seeds.length * months * 4,
    industryShortageReconciled: maxShortageError <= 1e-6,
    allShortStopsClassified: allStops.every(x => typeof x.terminalBranch === 'string' && x.terminalBranch.length > 0),
    maxFiveTransactions: allStops.every(x => x.transactions <= 5),
    finiteShortage: allStops.every(x => Number.isFinite(x.remainingNeed) && x.remainingNeed >= -EPS)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);

console.table(scales.flatMap(scaleProfile => windows.map(window => {
  const a = aggregates[scaleProfile][window.id];
  return {
    scale: scaleProfile,
    window: window.id,
    shortCases: a.shortBuyerCases,
    shortage: Number(a.totalShortage.toFixed(2)),
    budgetStops: a.budgetExhaustedCases,
    budgetShare: Number(a.budgetExhaustedShortageShare.toFixed(4)),
    roundCap: a.roundCapCases,
    roundShare: Number(a.roundCapShortageShare.toFixed(4)),
    selfStops: a.selfSupplierCases,
    noStock: a.noSellableStockCases,
    algorithmicAffordable: a.affordableAlgorithmicStopCases,
    algorithmicShare: Number(a.affordableAlgorithmicShortageShare.toFixed(4))
  };
})));
console.log('WP_RV07_P6_GATES', JSON.stringify(report.gates));
console.log('WP_RV07_P6_RECONCILIATION', JSON.stringify(report.reconciliation));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('WP_RV07_P6_OUTPUT', outputJson);
}

if (!report.gates.ok) process.exitCode = 1;
