import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const variant = (process.env.DIAG_VARIANT || 'control').trim();
const months = Math.max(24, Number(process.env.DIAG_MONTHS || 24));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const allowed = new Set(['control', 'full-replacement']);
assert.ok(allowed.has(variant), `unknown variant ${variant}`);

const EPS = 1e-8;
const TOL = 1e-7;
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const C = v => structuredClone(v);
const S = a => a.reduce((s, v) => s + F(v), 0);
const M = a => a.length ? S(a) / a.length : 0;
const CL = (x, lo, hi) => Math.max(lo, Math.min(hi, F(x)));

function transformedSeeds() {
  return COUNTRY_SEEDS.map(s => ({ ...s, initialPrice: Math.max(EPS, F(s.initialWage, F(s.initialPrice, 1))) }));
}
function makeWorld() {
  const old = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try { return new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 }); }
  finally { COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...old); }
}
function supplierMean(c, product) {
  const rows = c.firms.filter(f => f.active !== false && f.product === product && F(f.price) > EPS);
  return rows.length ? M(rows.map(f => f.price)) : 0;
}
function unconstrainedPlan(f) {
  const anchor = Math.max(2, F(f.previousSales), F(f.targetInventory) * 0.42);
  const expected = anchor * (1 + CL(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
  const replenishment = Math.max(0, F(f.targetInventory) - F(f.inventory));
  return Math.max(0, expected * 0.72 + replenishment);
}
function installNormalization(w) {
  const target = new Set(['MATERIALS', 'CONSUMER']);
  const done = new Set();
  w.__blNorm = 0;
  const original = w.supply.planProduction.bind(w.supply);
  w.supply.planProduction = c => {
    const out = original(c);
    if (done.has(c.id)) return out;
    const prices = { raw_material: supplierMean(c, 'raw_material'), processed_material: supplierMean(c, 'processed_material') };
    for (const f of c.firms.filter(x => x.active !== false && target.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(prices[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const cap = F(f.capacity);
      const required = margin > EPS && cap > EPS ? payroll / (margin * cap) : Infinity;
      const factor = Number.isFinite(required) ? Math.max(1, required) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = cap * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        w.__blNorm += 1;
      }
    }
    done.add(c.id);
    return out;
  };
}
function gdpResidual(m) {
  return F(m?.gdp) - (F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) + F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports));
}

const w = makeWorld();
for (const c of w.countries) Object.defineProperty(c, '__diagnosticExactLaborRuntime', { value: true, writable: true, configurable: true, enumerable: false });
installNormalization(w);

w.__extraReplacementEntries = 0;
if (variant === 'full-replacement') {
  const originalEvaluate = w.supply.evaluateExits.bind(w.supply);
  w.supply.evaluateExits = c => {
    const exitIndustries = originalEvaluate(c);
    for (const industryId of exitIndustries.slice(2)) {
      w.createEntrant(c, industryId);
      w.__extraReplacementEntries += 1;
    }
    return exitIndustries;
  };
}

const initialIds = new Map(w.countries.map(c => [c.id, new Set(c.firms.map(f => f.id))]));
const priorActive = new Map();
for (const c of w.countries) for (const f of c.firms) priorActive.set(f.id, f.active !== false);
const rows = [];
let actualExits = 0;
let actualBirths = 0;
let entrantWorkerMonths = 0;
let entrantOutput = 0;
let entrantRevenue = 0;

for (let i = 0; i < months; i++) {
  w.stepMonth();
  for (const c of w.countries) {
    const initial = initialIds.get(c.id);
    let monthExits = 0;
    let monthBirths = 0;
    for (const f of c.firms) {
      const before = priorActive.get(f.id);
      const now = f.active !== false;
      if (before === true && !now) { actualExits += 1; monthExits += 1; }
      if (before === undefined && !initial.has(f.id)) { actualBirths += 1; monthBirths += 1; }
      priorActive.set(f.id, now);
      if (!initial.has(f.id) && now) {
        entrantWorkerMonths += F(f.workers);
        entrantOutput += F(f.output);
        entrantRevenue += F(f.revenue);
      }
    }
    const m = c.macro || {};
    rows.push({
      month: w.month,
      countryId: c.id,
      monthExits,
      monthBirths,
      actualActive: c.firms.filter(f => f.active !== false).length,
      unemployment: F(m.unemployment),
      gdp: F(m.gdp),
      output: F(m.realOutput),
      arrears: F(m.wageArrears),
      reportedExits: F(m.firmExits),
      reportedEntries: F(m.firmEntries)
    });
  }
}

const health = w.forceHealthCheck();
const accountingOk = w.countries.every(c => w.accounting.verifyCountry(c, w.ledger, w.month)?.ok !== false);
const ledgerOk = w.countries.every(c => w.ledger.verifyCountry(c.id)?.ok === true);
const gdpOk = w.countries.every(c => Math.abs(gdpResidual(c.macro)) < 1e-5);
const finiteOk = rows.every(r => Object.values(r).every(v => typeof v === 'string' || Number.isFinite(v)));
assert.ok(accountingOk && ledgerOk && gdpOk && finiteOk && w.__blNorm > 0, `${seed}/${variant}: hard gate`);

const terminal = rows.filter(r => r.month === months);
const late = rows.filter(r => r.month >= 13);
const compact = {
  seed,
  variant,
  months,
  extraReplacementEntries: w.__extraReplacementEntries,
  actualExits,
  actualBirths,
  actualReplacementRatio: actualBirths / Math.max(EPS, actualExits),
  meanUnemployment: M(rows.map(r => r.unemployment)),
  lateUnemployment: M(late.map(r => r.unemployment)),
  terminalUnemployment: M(terminal.map(r => r.unemployment)),
  terminalGdp: M(terminal.map(r => r.gdp)),
  terminalOutput: M(terminal.map(r => r.output)),
  terminalArrears: M(terminal.map(r => r.arrears)),
  terminalActiveFirms: M(terminal.map(r => r.actualActive)),
  entrantWorkerMonths,
  entrantOutput,
  entrantRevenue,
  meanMonthlyActualExits: M(rows.map(r => r.monthExits)),
  meanMonthlyActualBirths: M(rows.map(r => r.monthBirths)),
  monthsWithExitBurstAbove2: rows.filter(r => r.monthExits > 2).length
};

const report = {
  workPackage: 'WP-RV08-R4-BL',
  title: 'Firm Regeneration Capacity Ablation',
  generatedAt: new Date().toISOString(),
  note: 'Diagnostic full-replacement intervention uses canonical entrant creation for exit events beyond the existing monthly cap of two. No entrant quality change.',
  configuration: { seed, variant, months, base: 'materials-consumer' },
  gates: { healthOk: health.ok, accountingOk, ledgerOk, gdpIdentityArithmetic: gdpOk, finiteOk, normalizationActivated: w.__blNorm > 0, completeMonths: rows.length === months * w.countries.length, ok: true },
  compact
};
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
