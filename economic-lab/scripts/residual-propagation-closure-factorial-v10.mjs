import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales = (process.env.DIAG_SCALES || 'compact,baseline').split(',').map(x => x.trim()).filter(Boolean);
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;
const TOL = 1e-7;
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const C = v => structuredClone(v);
const S = a => a.reduce((s, v) => s + F(v), 0);
const M = a => a.length ? S(a) / a.length : 0;
const R = (a, b) => Math.abs(F(b)) > EPS ? F(a) / F(b) : 0;
const CL = (x, l, h) => Math.max(l, Math.min(h, F(x)));

const bases = ['consumer', 'materials-consumer'];
const variants = [];
for (const base of bases) {
  for (const supplyJoint of [false, true]) {
    for (const noLayoffs of [false, true]) {
      for (const noExits of [false, true]) {
        variants.push({
          id: `${base}-${supplyJoint ? 'joint-supply' : 'canonical-supply'}-${noLayoffs ? 'no-layoffs' : 'labor-canonical'}-${noExits ? 'no-exits' : 'exit-canonical'}`,
          base,
          supplyJoint,
          noLayoffs,
          noExits
        });
      }
    }
  }
}

function sectors(base) {
  return base === 'consumer' ? new Set(['CONSUMER']) : new Set(['MATERIALS', 'CONSUMER']);
}

function transformedSeeds() {
  return COUNTRY_SEEDS.map(s => ({ ...s, initialPrice: Math.max(EPS, F(s.initialWage, F(s.initialPrice, 1))) }));
}

function makeWorld(scale, seed) {
  const old = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seed, { scaleProfile: scale, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...old);
  }
}

function supplierMean(c, p) {
  const a = c.firms.filter(f => f.active !== false && f.product === p && F(f.price) > EPS);
  return a.length ? M(a.map(f => f.price)) : 0;
}

function unconstrainedPlan(f) {
  const anchor = Math.max(2, F(f.previousSales), F(f.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  const replenishment = Math.max(0, F(f.targetInventory) - F(f.inventory));
  return Math.max(0, expected * 0.72 + replenishment);
}

function installNormalization(w, base) {
  const target = sectors(base);
  const done = new Set();
  w.__p73NormalizationApps = [];
  const original = w.supply.planProduction.bind(w.supply);
  w.supply.planProduction = c => {
    const out = original(c);
    if (done.has(c.id)) return out;
    const upstream = {
      raw_material: supplierMean(c, 'raw_material'),
      processed_material: supplierMean(c, 'processed_material')
    };
    for (const f of c.firms.filter(x => x.active !== false && target.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(upstream[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const baseCapacity = F(f.capacity);
      const requiredFactor = margin > EPS && baseCapacity > EPS ? payroll / (margin * baseCapacity) : Infinity;
      const factor = Number.isFinite(requiredFactor) ? Math.max(1, requiredFactor) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = baseCapacity * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        w.__p73NormalizationApps.push({ countryId: c.id, firmId: f.id, industryId: f.industryId, factor });
      }
    }
    done.add(c.id);
    return out;
  };
}

function chooseSupplier(candidates, rng, sampleSize = 7) {
  const pool = (candidates || []).filter(f => f.active !== false && F(f.inventory) > EPS);
  if (!pool.length) return null;
  let best = null;
  let bestScore = Infinity;
  const tries = Math.min(sampleSize, pool.length);
  const seen = new Set();
  for (let k = 0; k < tries; k++) {
    let i = rng.int(0, pool.length);
    let guard = 0;
    while (seen.has(i) && guard++ < pool.length * 2) i = (i + 1) % pool.length;
    seen.add(i);
    const f = pool[i];
    const reliability = 0.78 + Math.min(0.35, F(f.productivity) * 0.18);
    const score = F(f.price) / Math.max(0.1, reliability) * (0.97 + rng.next() * 0.06);
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function procureGroup(w, c, month, metrics, buyers) {
  const firms = c.firms.filter(f => f.active !== false);
  const byProduct = new Map();
  for (const seller of firms) {
    if (!byProduct.has(seller.product)) byProduct.set(seller.product, []);
    byProduct.get(seller.product).push(seller);
  }
  let startingNeed = 0;
  let shortage = 0;
  let spend = 0;
  for (const buyer of [...buyers].sort((a, b) => a.id.localeCompare(b.id))) {
    const product = buyer.inputProduct;
    if (!product) continue;
    const required = Math.max(0, F(buyer.desiredProduction) * F(buyer.inputPerOutput));
    const onHand = Math.max(0, F(buyer.inputInventory?.[product]));
    let remaining = Math.max(0, required - onHand);
    let budget = Math.max(0, w.ledger.balance(buyer.accountId));
    const initial = remaining;
    startingNeed += initial;
    for (let round = 0; round < 5 && remaining > EPS && budget > EPS; round++) {
      const seller = chooseSupplier(byProduct.get(product), w.rng, 6 + round * 2);
      if (!seller || seller.id === buyer.id) break;
      const units = Math.min(remaining, F(seller.inventory), budget / Math.max(0.01, F(seller.price)));
      if (units <= EPS) break;
      const requested = units * F(seller.price);
      const paid = w.ledger.transfer({
        month,
        countryId: c.id,
        from: buyer.accountId,
        to: seller.accountId,
        amount: requested,
        kind: 'interfirm_purchase',
        meta: { buyerId: buyer.id, sellerId: seller.id, product, units }
      });
      if (paid <= EPS) break;
      const settled = paid / F(seller.price);
      const unitCost = Math.max(0, F(seller.bookUnitCost, F(seller.price) * 0.45));
      const sellerCost = Math.min(Math.max(0, w.accounting.gl.naturalBalance(seller.id, 'inventory')), settled * unitCost);
      seller.inventory = Math.max(0, F(seller.inventory) - settled);
      seller.b2bSales += settled;
      seller.b2bRevenue += paid;
      seller.revenue += paid;
      seller.sales += settled;
      buyer.inputInventory[product] = F(buyer.inputInventory?.[product]) + settled;
      buyer.inputBookValues[product] = F(buyer.inputBookValues?.[product]) + paid;
      buyer.inputSpend += paid;
      budget = Math.max(0, budget - paid);
      remaining = Math.max(0, remaining - settled);
      spend += paid;
      w.accounting.recordInterfirmPurchase({ buyer, seller, month, amount: paid, units: settled, cost: sellerCost, product });
      metrics.b2bTransactions += 1;
      metrics.b2bSpend += paid;
      metrics.b2bUnits += settled;
    }
    buyer.supplyShortage = Math.max(0, remaining);
    metrics.inputShortageUnits += initial > 0 ? Math.max(0, remaining) : 0;
    shortage += Math.max(0, remaining);
  }
  return { startingNeed, shortage, spend };
}

function produceFirm(w, month, metrics, f) {
  let output = Math.max(0, Math.min(F(f.desiredProduction), F(f.capacity)));
  if (f.inputProduct) {
    const p = f.inputProduct;
    const available = Math.max(0, F(f.inputInventory?.[p]));
    output = Math.min(output, available / Math.max(EPS, F(f.inputPerOutput)));
    const used = output * F(f.inputPerOutput);
    if (used > EPS && available > EPS) {
      const book = Math.max(0, F(f.inputBookValues?.[p]));
      const value = Math.min(book, book * (used / available));
      f.inputInventory[p] = Math.max(0, available - used);
      f.inputBookValues[p] = Math.max(0, book - value);
      if (value > EPS) w.accounting.recordInputConsumption({ firm: f, month, amount: value, product: p, units: used });
    }
  }
  f.output = Math.max(0, output);
  f.inventory = F(f.inventory) + f.output;
  metrics.sectorOutputs[f.industryId] = (metrics.sectorOutputs[f.industryId] || 0) + f.output;
  return f.output;
}

function installJointSupply(w) {
  w.__p73JointFlow = new Map();
  w.supply.procureInputs = (c, month) => {
    const metrics = w.supply.emptyMetrics(c);
    const firms = c.firms.filter(f => f.active !== false);
    const resources = firms.filter(f => f.industryId === 'RESOURCE').sort((a, b) => a.id.localeCompare(b.id));
    const materials = firms.filter(f => f.industryId === 'MATERIALS').sort((a, b) => a.id.localeCompare(b.id));
    const downstream = firms.filter(f => f.industryId === 'CAPITAL' || f.industryId === 'CONSUMER').sort((a, b) => a.id.localeCompare(b.id));
    let resourceOutput = 0;
    let materialsOutput = 0;
    let consumerOutput = 0;
    let capitalOutput = 0;
    for (const f of resources) resourceOutput += produceFirm(w, month, metrics, f);
    const m = procureGroup(w, c, month, metrics, materials);
    for (const f of materials) materialsOutput += produceFirm(w, month, metrics, f);
    const d = procureGroup(w, c, month, metrics, downstream);
    for (const f of downstream) {
      const out = produceFirm(w, month, metrics, f);
      if (f.industryId === 'CONSUMER') consumerOutput += out;
      else capitalOutput += out;
    }
    w.__p73JointFlow.set(`${month}|${c.id}`, {
      startingNeed: m.startingNeed + d.startingNeed,
      shortage: m.shortage + d.shortage,
      spend: m.spend + d.spend,
      resourceOutput,
      materialsOutput,
      consumerOutput,
      capitalOutput
    });
    return metrics;
  };
  w.supply.produce = (c, month, metrics) => metrics;
}

function installNoLayoffs(w) {
  w.__p73LayoffFloors = 0;
  w.__p73WorkersSaved = 0;
  const original = w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit = (c, m, s) => {
    const out = original(c, m, s);
    for (const f of c.firms.filter(x => x.active !== false)) {
      const desired = F(f.desiredWorkers);
      const workers = F(f.workers);
      if (desired < workers) {
        f.desiredWorkers = workers;
        w.__p73LayoffFloors += 1;
        w.__p73WorkersSaved += workers - desired;
      }
    }
    return out;
  };
}

function installNoExits(w) {
  w.__p73SuppressedExits = 0;
  w.supply.evaluateExits = c => {
    let candidates = 0;
    for (const f of c.firms.filter(x => x.active !== false)) {
      const cash = w.ledger.balance(f.accountId);
      const payrollStress = F(f.wageArrears) > Math.max(100, F(f.wage) * Math.max(1, F(f.workers)) * 1.35);
      const creditStress = F(f.creditMisses) >= 5;
      const liquidityFailure = cash < F(f.safeCash) * 0.025 && payrollStress;
      if (liquidityFailure || creditStress) f.distressMonths = F(f.distressMonths) + 1;
      else f.distressMonths = Math.max(0, F(f.distressMonths) - 1);
      if (f.distressMonths >= 4) {
        candidates += 1;
        f.distressMonths = 3;
      }
    }
    w.__p73SuppressedExits += candidates;
    return [];
  };
}

function gdpResidual(m) {
  return F(m?.gdp) - (F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) + F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports));
}

function digest(w) {
  const h = createHash('sha256');
  const put = v => h.update(JSON.stringify(v));
  put({ month: w.month, rng: w.rng });
  for (const c of w.countries) {
    put(c);
    put(w.accountingReport(c.id));
  }
  for (const e of w.ledger.entries) put(e);
  return h.digest('hex');
}

function run(v, scale, seed, horizon, capture = false) {
  const w = makeWorld(scale, seed);
  installNormalization(w, v.base);
  w.__p73JointFlow = new Map();
  if (v.supplyJoint) installJointSupply(w);
  if (v.noLayoffs) installNoLayoffs(w);
  if (v.noExits) installNoExits(w);
  const rows = [];
  for (let i = 0; i < horizon; i++) {
    w.stepMonth();
    for (const c of w.countries) {
      const ind = c.lastIndustry || {};
      const sec = ind.sectorOutputs || {};
      rows.push({
        variant: v.id,
        base: v.base,
        supplyJoint: v.supplyJoint,
        noLayoffs: v.noLayoffs,
        noExits: v.noExits,
        scaleProfile: scale,
        seed,
        month: w.month,
        countryId: c.id,
        unemployment: F(c.macro?.unemployment),
        exits: F(c.macro?.firmExits),
        activeFirms: F(c.macro?.activeFirms),
        arrears: F(c.macro?.wageArrears),
        fulfillment: 1 - F(c.macro?.unmetDemandRatio),
        shortage: F(ind.inputShortageUnits, c.macro?.inputShortageUnits),
        hires: F(c.macro?.hires),
        layoffs: F(c.macro?.layoffs),
        unfilled: F(c.macro?.unfilledJobs),
        resource: F(sec.RESOURCE, c.macro?.resourceOutput),
        materials: F(sec.MATERIALS, c.macro?.materialsOutput),
        consumer: F(sec.CONSUMER, c.macro?.consumerGoodsOutput),
        cash: F(c.macro?.firmCash),
        sales: F(c.macro?.nominalSales),
        gdp: F(c.macro?.gdp),
        gdpResidual: gdpResidual(c.macro),
        ledgerOk: w.ledger.verifyCountry(c.id)?.ok === true
      });
    }
  }
  const health = w.forceHealthCheck();
  assert.ok(health.ok, `${v.id}/${scale}/${seed}: health`);
  return {
    rows,
    health,
    normalizationApps: w.__p73NormalizationApps.length,
    jointFlowCount: w.__p73JointFlow.size,
    layoffFloors: w.__p73LayoffFloors || 0,
    workersSaved: w.__p73WorkersSaved || 0,
    suppressedExits: w.__p73SuppressedExits || 0,
    fingerprint: capture ? digest(w) : null
  };
}

const determinism = [];
for (const v of variants) {
  for (const scale of scales) {
    const seed = `ECON-RV07-P73-DET-${v.id}-${scale}`;
    const h = Math.min(3, months);
    const a = run(v, scale, seed, h, true).fingerprint;
    const b = run(v, scale, seed, h, true).fingerprint;
    assert.equal(a, b, `${v.id}/${scale}: deterministic replay`);
    determinism.push({ variant: v.id, scaleProfile: scale, exact: true });
  }
}

const runs = [];
for (const v of variants) {
  for (const scale of scales) {
    for (const seed of seeds) runs.push({ variant: v, scaleProfile: scale, seed, ...run(v, scale, seed, months) });
  }
}
const rows = runs.flatMap(x => x.rows);
const windows = [
  ['M1-3', 1, Math.min(3, months)],
  ['M4-6', 4, Math.min(6, months)],
  ['M7-9', 7, Math.min(9, months)],
  ['M10-12', 10, months],
  ['FULL', 1, months]
].filter(x => x[1] <= x[2]);

function agg(a) {
  return {
    u: M(a.map(x => x.unemployment)),
    exits: S(a.map(x => x.exits)),
    active: M(a.map(x => x.activeFirms)),
    arrears: M(a.map(x => x.arrears)),
    fulfill: M(a.map(x => x.fulfillment)),
    shortage: M(a.map(x => x.shortage)),
    hires: S(a.map(x => x.hires)),
    layoffs: S(a.map(x => x.layoffs)),
    unfilled: S(a.map(x => x.unfilled)),
    resource: M(a.map(x => x.resource)),
    materials: M(a.map(x => x.materials)),
    consumer: M(a.map(x => x.consumer)),
    cash: M(a.map(x => x.cash)),
    sales: M(a.map(x => x.sales)),
    gdp: M(a.map(x => x.gdp))
  };
}

const summary = [];
for (const v of variants) {
  for (const scale of scales) {
    for (const [window, from, to] of windows) {
      summary.push({
        variant: v.id,
        base: v.base,
        supplyJoint: v.supplyJoint,
        noLayoffs: v.noLayoffs,
        noExits: v.noExits,
        scaleProfile: scale,
        window,
        ...agg(rows.filter(x => x.variant === v.id && x.scaleProfile === scale && x.month >= from && x.month <= to))
      });
    }
  }
}

const effects = {};
for (const scale of scales) {
  effects[scale] = {};
  for (const base of bases) {
    effects[scale][base] = {};
    for (const [window] of windows) {
      const q = (supplyJoint, noLayoffs, noExits) => summary.find(x => x.scaleProfile === scale && x.base === base && x.supplyJoint === supplyJoint && x.noLayoffs === noLayoffs && x.noExits === noExits && x.window === window);
      const control = q(false, false, false);
      const supply = q(true, false, false);
      const labor = q(false, true, false);
      const exit = q(false, false, true);
      const supplyLabor = q(true, true, false);
      const supplyExit = q(true, false, true);
      const laborExit = q(false, true, true);
      const all = q(true, true, true);
      const delta = x => ({
        du: x.u - control.u,
        dexits: x.exits - control.exits,
        darrears: x.arrears - control.arrears,
        dfulfill: x.fulfill - control.fulfill,
        dshort: x.shortage - control.shortage,
        consumerRatio: R(x.consumer, control.consumer),
        cashDifference: x.cash - control.cash
      });
      effects[scale][base][window] = {
        supply: delta(supply),
        noLayoffs: delta(labor),
        noExits: delta(exit),
        supplyNoLayoffs: delta(supplyLabor),
        supplyNoExits: delta(supplyExit),
        noLayoffsNoExits: delta(laborExit),
        all: delta(all)
      };
    }
  }
}

const maxGdp = Math.max(0, ...rows.map(x => Math.abs(x.gdpResidual)));
const gates = {
  deterministicReplayExact: determinism.every(x => x.exact),
  allHealthy: runs.every(x => x.health.ok),
  completeCoverage: rows.length === variants.length * scales.length * seeds.length * months * 4,
  normalizationActivated: runs.every(x => x.normalizationApps > 0),
  jointSupplyActivated: runs.filter(x => x.variant.supplyJoint).every(x => x.jointFlowCount > 0),
  noLayoffActivated: S(runs.filter(x => x.variant.noLayoffs).map(x => x.layoffFloors)) > 0,
  noExitActivated: S(runs.filter(x => x.variant.noExits).map(x => x.suppressedExits)) > 0,
  noLayoffVariantsReportZeroLayoffs: rows.filter(x => x.noLayoffs).every(x => Math.abs(x.layoffs) < TOL),
  noExitVariantsReportZeroExits: rows.filter(x => x.noExits).every(x => Math.abs(x.exits) < TOL),
  ledgerCountriesOk: rows.every(x => x.ledgerOk),
  gdpIdentityReconciled: maxGdp < TOL,
  finiteRows: rows.every(x => Number.isFinite(x.unemployment) && Number.isFinite(x.shortage) && Number.isFinite(x.cash))
};
gates.ok = Object.values(gates).every(Boolean);

console.table(summary.filter(x => x.scaleProfile === 'baseline' && x.window === 'FULL').map(x => ({
  variant: x.variant,
  u: +x.u.toFixed(4),
  exits: x.exits,
  active: +x.active.toFixed(1),
  arrears: +x.arrears.toFixed(0),
  fulfill: +x.fulfill.toFixed(3),
  short: +x.shortage.toFixed(1),
  layoffs: x.layoffs,
  consumer: +x.consumer.toFixed(1),
  cash: +x.cash.toFixed(0)
})));
console.log('WP_RV07_P73_EFFECTS', JSON.stringify(effects));
console.log('WP_RV07_P73_GATES', JSON.stringify(gates));

const payload = {
  workPackage: 'WP-RV07-P73',
  title: 'Residual propagation closure factorial after physical and throughput relief',
  generatedAt: new Date().toISOString(),
  configuration: { variants, scales, seeds, months },
  gates,
  deterministicReplay: determinism,
  interventions: runs.map(x => ({
    variant: x.variant.id,
    scaleProfile: x.scaleProfile,
    seed: x.seed,
    normalizationApps: x.normalizationApps,
    jointFlowCount: x.jointFlowCount,
    layoffFloors: x.layoffFloors,
    workersSaved: x.workersSaved,
    suppressedExits: x.suppressedExits
  })),
  summary,
  effects,
  rows
};
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(payload, null, 2));
  console.log('WP_RV07_P73_OUTPUT', outputJson);
}
assert.ok(gates.ok, `WP-RV07-P73 gates failed ${JSON.stringify(gates)}`);
