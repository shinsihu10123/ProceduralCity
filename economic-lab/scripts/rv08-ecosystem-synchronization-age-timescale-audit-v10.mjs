import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed = (process.env.DIAG_SEED || 'ECON-RV02-A').trim();
const base = (process.env.DIAG_BASE || 'raw').trim();
const months = Math.max(24, Number(process.env.DIAG_MONTHS || 36));
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-8;
const TOL = 1e-7;
const F = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const C = v => structuredClone(v);
const S = a => a.reduce((s, v) => s + F(v), 0);
const M = a => a.length ? S(a) / a.length : 0;
const CL = (x, lo, hi) => Math.max(lo, Math.min(hi, F(x)));
const SD = a => {
  if (!a.length) return 0;
  const m = M(a);
  return Math.sqrt(M(a.map(x => (F(x) - m) ** 2)));
};
const sorted = a => [...a].filter(Number.isFinite).sort((x, y) => x - y);
const quantile = (a, q) => {
  const x = sorted(a);
  if (!x.length) return 0;
  const p = (x.length - 1) * q;
  const i = Math.floor(p), j = Math.ceil(p);
  return i === j ? x[i] : x[i] * (j - p) + x[j] * (p - i);
};
const corr = (xs, ys) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const x = xs.slice(0, n), y = ys.slice(0, n), mx = M(x), my = M(y);
  const num = S(x.map((v, i) => (v - mx) * (y[i] - my)));
  const den = Math.sqrt(S(x.map(v => (v - mx) ** 2)) * S(y.map(v => (v - my) ** 2)));
  return den > EPS ? num / den : 0;
};

function transformedSeeds() {
  return COUNTRY_SEEDS.map(s => ({ ...s, initialPrice: Math.max(EPS, F(s.initialWage, F(s.initialPrice, 1))) }));
}
function makeWorld() {
  if (base === 'raw') return new EconomicWorld(seed, { scaleProfile: 'baseline', healthCheckInterval: 0 });
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
  if (base !== 'materials-consumer') { w.__ecoNorm = 0; return; }
  const target = new Set(['MATERIALS', 'CONSUMER']);
  const done = new Set();
  w.__ecoNorm = 0;
  const original = w.supply.planProduction.bind(w.supply);
  w.supply.planProduction = c => {
    const out = original(c);
    if (done.has(c.id)) return out;
    const prices = { raw_material: supplierMean(c, 'raw_material'), processed_material: supplierMean(c, 'processed_material') };
    for (const f of c.firms.filter(x => x.active !== false && target.has(x.industryId))) {
      const inputCost = F(f.inputPerOutput) * (f.inputProduct ? F(prices[f.inputProduct]) : 0);
      const margin = F(f.price) - inputCost;
      const payroll = F(f.wage) * F(f.workers);
      const baseCapacity = F(f.capacity);
      const required = margin > EPS && baseCapacity > EPS ? payroll / (margin * baseCapacity) : Infinity;
      const factor = Number.isFinite(required) ? Math.max(1, required) : 1;
      if (factor > 1 + TOL) {
        f.productivity *= factor;
        f.capacity = baseCapacity * factor;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        w.__ecoNorm++;
      }
    }
    done.add(c.id);
    return out;
  };
}
function gdpResidual(m) {
  return F(m?.gdp) - (F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) + F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports));
}
function catStats(values, categories) {
  const counts = Object.fromEntries(categories.map(x => [x, 0]));
  let other = 0;
  for (const v of values) {
    if (Object.prototype.hasOwnProperty.call(counts, v)) counts[v]++;
    else other++;
  }
  const n = values.length;
  const arr = [...Object.values(counts), other].filter(x => x > 0);
  const entropy = n > 0 ? -S(arr.map(k => { const p = k / n; return p * Math.log(p); })) : 0;
  const maxEntropy = n > 0 ? Math.log(Math.max(2, categories.length + (other > 0 ? 1 : 0))) : 1;
  const top = n > 0 ? Math.max(0, ...arr) / n : 0;
  return { n, counts, other, topShare: top, normalizedEntropy: maxEntropy > 0 ? entropy / maxEntropy : 0 };
}
function latestDecision(agent) {
  const d = agent?.cognition?.decisions || [];
  return d.length ? d[d.length - 1]?.selected || null : null;
}
function cognitiveBelief(agent, key, fallback = 0) {
  return F(agent?.cognition?.beliefs?.[key]?.mean, F(agent?.beliefs?.[key], fallback));
}
function activePublicShare(c) {
  const active = c.firms.filter(f => f.active !== false && f.equityMarket);
  const pub = S(active.map(f => F(f.equityMarket?.publicShares)));
  const total = S(active.map(f => F(f.equityMarket?.sharesOutstanding)));
  return total > EPS ? pub / total : 0;
}
function portfolioOwnerShare(c) {
  return c.households.length ? c.households.filter(h => Object.keys(h.portfolio || {}).length > 0).length / c.households.length : 0;
}
function meanEpisodes(c) {
  const agents = [...c.households, ...c.firms.filter(f => f.active !== false), ...(c.banks || []), ...(c.governments || []), ...(c.centralBanks || [])];
  return M(agents.map(a => a?.cognition?.memory?.episodes?.length || 0));
}
function staffingFeasibility(c) {
  const processed = supplierMean(c, 'processed_material');
  const rows = [];
  for (const f of c.firms.filter(x => x.active !== false && x.industryId === 'CONSUMER')) {
    const capitalEffect = 0.72 + Math.log1p(Math.max(0, F(f.capitalStock))) * 0.105;
    const humanEffect = 0.82 + F(c.humanCapital) * 0.30;
    const planEffect = 1 + CL(f.currentPlan?.productionChange || 0, -0.12, 0.15);
    const oneWorker = Math.max(EPS, F(f.productivity) * capitalEffect * humanEffect * planEffect);
    const rawPlan = unconstrainedPlan(f);
    const physical = Math.max(0, Math.ceil(rawPlan / oneWorker));
    const inputCost = F(f.inputPerOutput) * (f.inputProduct === 'processed_material' ? processed : 0);
    const contribution = Math.max(0, F(f.price) - inputCost) * rawPlan;
    const viable = physical > 0 && contribution + TOL >= physical * F(f.wage);
    if (!viable) continue;
    const current = Math.max(1, F(f.workers));
    const target = Math.max(0, F(f.desiredWorkers));
    const catchup = physical <= current ? 0 : Math.ceil(Math.log(physical / current) / Math.log(1.12));
    rows.push({ targetPhysical: physical > 0 ? target / physical : 0, actualPhysical: physical > 0 ? F(f.workers) / physical : 0, catchup });
  }
  return {
    n: rows.length,
    meanTargetPhysical: M(rows.map(r => r.targetPhysical)),
    meanActualPhysical: M(rows.map(r => r.actualPhysical)),
    meanMaxRampCatchupMonths: M(rows.map(r => r.catchup)),
    shareCatchupOver4: rows.length ? rows.filter(r => r.catchup > 4).length / rows.length : 0,
    shareCatchupOver8: rows.length ? rows.filter(r => r.catchup > 8).length / rows.length : 0
  };
}
function durationStats(a) {
  return { n: a.length, mean: M(a), p50: quantile(a, 0.5), p90: quantile(a, 0.9), max: a.length ? Math.max(...a) : 0 };
}

const w = makeWorld();
for (const c of w.countries) Object.defineProperty(c, '__diagnosticExactLaborRuntime', { value: true, writable: true, configurable: true, enumerable: false });
installNormalization(w);

const pairCounts = new Map();
const pairTransactions = new Map();
const priorFirmAction = new Map();
const firmActionRunStart = new Map();
const firmActionRuns = [];
const priorHouseAction = new Map();
const houseActionRunStart = new Map();
const houseActionRuns = [];
const priorEmployment = new Map();
const unemploymentStart = new Map();
const unemploymentSpells = [];
const priorFirmActive = new Map();
const firstArrears = new Map();
const firstDistress = new Map();
const arrearsToExit = [];
const distressToExit = [];
const loanSeenStatus = new Map();
const loanDurations = { repaid: [], defaulted: [] };
const monthly = [];
const checkpoints = [];

for (const c of w.countries) {
  for (const f of c.firms) {
    priorFirmActive.set(f.id, f.active !== false);
    const a = f.currentPlan?.selected || latestDecision(f);
    if (a) { priorFirmAction.set(f.id, a); firmActionRunStart.set(f.id, 0); }
  }
  for (const h of c.households) {
    priorEmployment.set(h.id, !!h.employed);
    if (!h.employed) unemploymentStart.set(h.id, 0);
    const a = latestDecision(h);
    if (a) { priorHouseAction.set(h.id, a); houseActionRunStart.set(h.id, 0); }
  }
}

function openingRow(c) {
  const active = c.firms.filter(f => f.active !== false);
  const govDebt = S((c.governmentBonds || []).filter(b => b.status === 'active').map(b => F(b.outstanding)));
  const capital = S(active.map(f => F(f.capitalStock)));
  const finishedInventoryUnits = S(active.map(f => F(f.inventory)));
  const finishedInventoryValueProxy = S(active.map(f => F(f.inventory) * F(f.price)));
  const inputInventoryUnits = S(active.flatMap(f => Object.values(f.inputInventory || {})).map(F));
  const bank = c.banks?.[0];
  const bankSecurities = bank ? Math.max(0, F(w.accounting.gl.naturalBalance(bank.id, 'securities'))) : 0;
  return {
    month: 0,
    countryId: c.id,
    households: c.households.length,
    activeFirms: active.length,
    inheritedCapital: capital,
    inheritedFinishedInventoryUnits: finishedInventoryUnits,
    inheritedFinishedInventoryValueProxy: finishedInventoryValueProxy,
    inheritedInputInventoryUnits: inputInventoryUnits,
    inheritedGovernmentDebt: govDebt,
    inheritedBankSecurities: bankSecurities,
    activePrivateLoans: (c.loans || []).filter(l => l.status === 'active').length,
    publicShareRatio: activePublicShare(c),
    portfolioOwnerShare: portfolioOwnerShare(c),
    meanCognitiveEpisodes: meanEpisodes(c),
    internationalTradeRecords: w.international?.trades?.length || 0,
    uniqueB2BPairs: 0
  };
}
const opening = w.countries.map(openingRow);

function recordActionDurations(c, month) {
  for (const f of c.firms) {
    const a = f.currentPlan?.selected || latestDecision(f);
    if (!a) continue;
    const prev = priorFirmAction.get(f.id);
    if (prev === undefined) { priorFirmAction.set(f.id, a); firmActionRunStart.set(f.id, month); }
    else if (prev !== a) {
      firmActionRuns.push(month - F(firmActionRunStart.get(f.id), month - 1));
      priorFirmAction.set(f.id, a);
      firmActionRunStart.set(f.id, month);
    }
  }
  for (const h of c.households) {
    const a = latestDecision(h);
    if (!a) continue;
    const prev = priorHouseAction.get(h.id);
    if (prev === undefined) { priorHouseAction.set(h.id, a); houseActionRunStart.set(h.id, month); }
    else if (prev !== a) {
      houseActionRuns.push(month - F(houseActionRunStart.get(h.id), month - 1));
      priorHouseAction.set(h.id, a);
      houseActionRunStart.set(h.id, month);
    }
  }
}
function recordEmployment(c, month) {
  for (const h of c.households) {
    const prev = priorEmployment.get(h.id) ?? !!h.employed;
    const now = !!h.employed;
    if (prev && !now) unemploymentStart.set(h.id, month);
    if (!prev && now) {
      const start = unemploymentStart.get(h.id);
      if (start !== undefined) unemploymentSpells.push(month - start);
      unemploymentStart.delete(h.id);
    }
    priorEmployment.set(h.id, now);
  }
}
function recordFirmStress(c, month) {
  for (const f of c.firms) {
    if (F(f.wageArrears) > 0.01 && !firstArrears.has(f.id)) firstArrears.set(f.id, month);
    if (F(f.distressMonths) > 0 && !firstDistress.has(f.id)) firstDistress.set(f.id, month);
    const prev = priorFirmActive.get(f.id) ?? true;
    const now = f.active !== false;
    if (prev && !now) {
      if (firstArrears.has(f.id)) arrearsToExit.push(month - firstArrears.get(f.id));
      if (firstDistress.has(f.id)) distressToExit.push(month - firstDistress.get(f.id));
    }
    priorFirmActive.set(f.id, now);
  }
}
function recordLoans(c, month) {
  for (const l of c.loans || []) {
    const prev = loanSeenStatus.get(l.id);
    if (prev === undefined) loanSeenStatus.set(l.id, l.status);
    else if (prev !== l.status) {
      if ((l.status === 'repaid' || l.status === 'defaulted') && Number.isFinite(F(l.originatedMonth))) loanDurations[l.status].push(month - F(l.originatedMonth));
      loanSeenStatus.set(l.id, l.status);
    }
  }
}
function recordPairs(c, month) {
  const entries = w.ledger.entriesFor({ month, countryId: c.id, kind: 'interfirm_purchase' });
  for (const e of entries) {
    const buyer = e.meta?.buyerId || '', seller = e.meta?.sellerId || '';
    const key = `${c.id}|${buyer}|${seller}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    pairTransactions.set(c.id, (pairTransactions.get(c.id) || 0) + 1);
  }
}
function monthRow(c, month) {
  const active = c.firms.filter(f => f.active !== false);
  const firmActions = active.map(f => f.currentPlan?.selected || latestDecision(f)).filter(Boolean);
  const consumerActions = active.filter(f => f.industryId === 'CONSUMER').map(f => f.currentPlan?.selected || latestDecision(f)).filter(Boolean);
  const houseActions = c.households.map(latestDecision).filter(Boolean);
  const firmCats = ['확장', '방어', '가격 경쟁', '현금 보존', '유지'];
  const houseCats = ['유동성 방어', '강한 절약', '소비 절제', '소비 유지', '소비 확대'];
  const fs = catStats(firmActions, firmCats), cs = catStats(consumerActions, firmCats), hs = catStats(houseActions, houseCats);
  const staffing = staffingFeasibility(c);
  const firmDemandBeliefs = active.map(f => cognitiveBelief(f, 'demandGrowth', F(f.beliefs?.demandGrowth)));
  const houseUnempBeliefs = c.households.map(h => cognitiveBelief(h, 'unemployment', 0));
  return {
    month,
    countryId: c.id,
    unemployment: F(c.macro?.unemployment),
    gdp: F(c.macro?.gdp),
    output: F(c.macro?.realOutput),
    arrears: F(c.macro?.wageArrears),
    activeFirms: active.length,
    firmTopActionShare: fs.topShare,
    firmActionEntropy: fs.normalizedEntropy,
    consumerTopActionShare: cs.topShare,
    consumerActionEntropy: cs.normalizedEntropy,
    householdTopActionShare: hs.topShare,
    householdActionEntropy: hs.normalizedEntropy,
    firmDemandBeliefSd: SD(firmDemandBeliefs),
    householdUnemploymentBeliefSd: SD(houseUnempBeliefs),
    firmRiskAversionSd: SD(active.map(f => F(f.riskAversion))),
    householdRiskAversionSd: SD(c.households.map(h => F(h.riskAversion))),
    firmOptimismSd: SD(active.map(f => F(f.optimism))),
    householdOptimismSd: SD(c.households.map(h => F(h.optimism))),
    activeLoans: (c.loans || []).filter(l => l.status === 'active').length,
    publicShareRatio: activePublicShare(c),
    portfolioOwnerShare: portfolioOwnerShare(c),
    meanCognitiveEpisodes: meanEpisodes(c),
    uniqueB2BPairs: [...pairCounts.keys()].filter(k => k.startsWith(`${c.id}|`)).length,
    b2bTransactions: pairTransactions.get(c.id) || 0,
    internationalTradeRecords: w.international?.trades?.length || 0,
    ...staffing
  };
}

for (let i = 0; i < months; i++) {
  w.stepMonth();
  for (const c of w.countries) {
    recordPairs(c, w.month);
    recordActionDurations(c, w.month);
    recordEmployment(c, w.month);
    recordFirmStress(c, w.month);
    recordLoans(c, w.month);
    const r = monthRow(c, w.month);
    monthly.push(r);
    if ([1, 3, 6, 12, 24, 36].includes(w.month) || w.month === months) checkpoints.push(r);
  }
}

for (const [id, start] of firmActionRunStart.entries()) if (priorFirmAction.has(id)) firmActionRuns.push(months + 1 - start);
for (const [id, start] of houseActionRunStart.entries()) if (priorHouseAction.has(id)) houseActionRuns.push(months + 1 - start);
for (const [id, start] of unemploymentStart.entries()) if (priorEmployment.has(id)) unemploymentSpells.push(months + 1 - start);

const health = w.forceHealthCheck();
const accountingOk = w.countries.every(c => w.accounting.verifyCountry(c, w.ledger, w.month)?.ok !== false);
const ledgerOk = w.countries.every(c => w.ledger.verifyCountry(c.id)?.ok === true);
const gdpOk = w.countries.every(c => Math.abs(gdpResidual(c.macro)) < 1e-5);
assert.ok(accountingOk && ledgerOk && gdpOk, `${seed}/${base}: accounting or GDP identity gate failed`);

const macroByCountry = new Map();
for (const c of w.countries) macroByCountry.set(c.id, monthly.filter(r => r.countryId === c.id));
const synchronizationByCountry = [];
for (const [countryId, rows] of macroByCountry.entries()) {
  const du = rows.map((r, i) => i ? r.unemployment - rows[i - 1].unemployment : 0);
  const da = rows.map((r, i) => i ? r.arrears - rows[i - 1].arrears : 0);
  const defense = rows.map(r => r.firmTopActionShare);
  synchronizationByCountry.push({
    countryId,
    meanFirmTopActionShare: M(rows.map(r => r.firmTopActionShare)),
    meanFirmActionEntropy: M(rows.map(r => r.firmActionEntropy)),
    meanConsumerTopActionShare: M(rows.map(r => r.consumerTopActionShare)),
    meanConsumerActionEntropy: M(rows.map(r => r.consumerActionEntropy)),
    meanHouseholdTopActionShare: M(rows.map(r => r.householdTopActionShare)),
    meanHouseholdActionEntropy: M(rows.map(r => r.householdActionEntropy)),
    corrModalFirmShareWithUnemploymentChange: corr(defense, du),
    corrModalFirmShareWithArrearsChange: corr(defense, da),
    meanFirmDemandBeliefSd: M(rows.map(r => r.firmDemandBeliefSd)),
    meanHouseholdUnemploymentBeliefSd: M(rows.map(r => r.householdUnemploymentBeliefSd))
  });
}

const openingPlanning = (() => {
  const firms = w.countries.flatMap(c => c.firms).map(f => F(f.cognition?.profile?.planningHorizon)).filter(x => x > 0);
  const households = w.countries.flatMap(c => c.households).map(h => F(h.cognition?.profile?.planningHorizon)).filter(x => x > 0);
  const banks = w.countries.flatMap(c => c.banks || []).map(a => F(a.cognition?.profile?.planningHorizon)).filter(x => x > 0);
  const governments = w.countries.flatMap(c => c.governments || []).map(a => F(a.cognition?.profile?.planningHorizon)).filter(x => x > 0);
  const centralBanks = w.countries.flatMap(c => c.centralBanks || []).map(a => F(a.cognition?.profile?.planningHorizon)).filter(x => x > 0);
  return { firm: durationStats(firms), household: durationStats(households), bank: durationStats(banks), government: durationStats(governments), centralBank: durationStats(centralBanks) };
})();

const loanTerms = w.countries.flatMap(c => c.loans || []).reduce((acc, l) => {
  const k = l.borrowerKind === 'firm' ? 'firm' : 'household';
  acc[k].push(F(l.termMonths));
  return acc;
}, { firm: [], household: [] });

const report = {
  workPackage: 'WP-RV08-R4-AZ-BA-BB',
  title: 'Economic Ecosystem Structural Dynamics Audit — Behavioral Synchronization / Historical-Age Mismatch / Timescale Compatibility',
  note: 'Diagnostic-only observational audit. It does not change canonical decisions, prices, credit, labor matching, settlement, bankruptcy, ownership, demographics or institutional rules. MATERIALS+CONSUMER remains the prior diagnostic normalization base, not an authorized production repair.',
  generatedAt: new Date().toISOString(),
  configuration: { seed, base, months },
  gates: {
    healthOk: health.ok,
    accountingOk,
    ledgerOk,
    gdpIdentityArithmetic: gdpOk,
    normalizationActivated: base === 'materials-consumer' ? w.__ecoNorm > 0 : true,
    completeMonths: monthly.length === months * w.countries.length,
    ok: accountingOk && ledgerOk && gdpOk && monthly.length === months * w.countries.length
  },
  openingHistoricalAgeMismatch: opening,
  synchronization: {
    byCountry: synchronizationByCountry,
    firmActionRunMonths: durationStats(firmActionRuns),
    householdActionRunMonths: durationStats(houseActionRuns),
    meanFirmTopActionShare: M(monthly.map(r => r.firmTopActionShare)),
    meanFirmActionEntropy: M(monthly.map(r => r.firmActionEntropy)),
    meanConsumerTopActionShare: M(monthly.map(r => r.consumerTopActionShare)),
    meanHouseholdTopActionShare: M(monthly.map(r => r.householdTopActionShare)),
    meanFirmDemandBeliefSd: M(monthly.map(r => r.firmDemandBeliefSd)),
    meanHouseholdUnemploymentBeliefSd: M(monthly.map(r => r.householdUnemploymentBeliefSd))
  },
  historicalMaturity: {
    checkpoints,
    terminal: checkpoints.filter(r => r.month === months)
  },
  timescales: {
    canonicalDistressExitThresholdMonths: 4,
    cognitivePlanningHorizonMonths: openingPlanning,
    consumerPlanViableMeanMaxRampCatchupMonths: M(monthly.map(r => r.meanMaxRampCatchupMonths)),
    consumerPlanViableShareCatchupOver4: M(monthly.map(r => r.shareCatchupOver4)),
    consumerPlanViableShareCatchupOver8: M(monthly.map(r => r.shareCatchupOver8)),
    arrearsToExitMonths: durationStats(arrearsToExit),
    distressToExitMonths: durationStats(distressToExit),
    unemploymentSpellMonths: durationStats(unemploymentSpells),
    loanTermMonths: { firm: durationStats(loanTerms.firm), household: durationStats(loanTerms.household) },
    realizedLoanDurationMonths: { repaid: durationStats(loanDurations.repaid), defaulted: durationStats(loanDurations.defaulted) }
  },
  terminalMacro: {
    unemployment: M(w.countries.map(c => F(c.macro?.unemployment))),
    gdp: M(w.countries.map(c => F(c.macro?.gdp))),
    output: M(w.countries.map(c => F(c.macro?.realOutput))),
    arrears: M(w.countries.map(c => F(c.macro?.wageArrears))),
    activeFirms: M(w.countries.map(c => c.firms.filter(f => f.active !== false).length))
  }
};

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ workPackage: report.workPackage, configuration: report.configuration, gates: report.gates, synchronization: report.synchronization, timescales: report.timescales, terminalMacro: report.terminalMacro }, null, 2));
