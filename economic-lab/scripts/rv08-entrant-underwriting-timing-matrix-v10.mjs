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
const CL = (x, l, h) => Math.max(l, Math.min(h, F(x)));

const variants = [
  { id: 'control', timing: 'canonical', risk: false, afford: false, capital: false, cf: false },
  { id: 'postplan', timing: 'postplan', risk: false, afford: false, capital: false, cf: false },
  { id: 'postplan-risk', timing: 'postplan', risk: true, afford: false, capital: false, cf: false },
  { id: 'postplan-afford', timing: 'postplan', risk: false, afford: true, capital: false, cf: false },
  { id: 'postplan-capital', timing: 'postplan', risk: false, afford: false, capital: true, cf: false },
  { id: 'postplan-risk-afford', timing: 'postplan', risk: true, afford: true, capital: false, cf: false },
  { id: 'postplan-risk-capital', timing: 'postplan', risk: true, afford: false, capital: true, cf: false },
  { id: 'postplan-afford-capital', timing: 'postplan', risk: false, afford: true, capital: true, cf: false },
  { id: 'postplan-all-hard', timing: 'postplan', risk: true, afford: true, capital: true, cf: false },
  { id: 'postplan-all-hard-cf', timing: 'postplan', risk: true, afford: true, capital: true, cf: true },
  { id: 'canonical-all-hard', timing: 'canonical', risk: true, afford: true, capital: true, cf: false },
  { id: 'canonical-all-hard-cf', timing: 'canonical', risk: true, afford: true, capital: true, cf: true }
];

function transformedSeeds() {
  return COUNTRY_SEEDS.map(seed => ({ ...seed, initialPrice: Math.max(EPS, F(seed.initialWage, F(seed.initialPrice, 1))) }));
}

function makeWorld(scaleProfile, seedText) {
  const original = COUNTRY_SEEDS.map(C);
  COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...transformedSeeds());
  try {
    return new EconomicWorld(seedText, { scaleProfile, healthCheckInterval: 0 });
  } finally {
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...original);
  }
}

function supplierMean(country, product, fallback = 0) {
  const firms = country.firms.filter(f => f.active !== false && f.product === product && F(f.price) > EPS);
  return firms.length ? M(firms.map(f => f.price)) : fallback;
}

function exactInputRequirement(country, f) {
  if (!f.inputProduct) return { units: 0, value: 0 };
  const onHand = Math.max(0, F(f.inputInventory?.[f.inputProduct]));
  const units = Math.max(0, F(f.desiredProduction) * F(f.inputPerOutput) - onHand);
  const supplierPrice = supplierMean(country, f.inputProduct, Math.max(0.1, F(f.price)));
  return { units, value: units * supplierPrice };
}

function installExactApplications(world, variant) {
  if (variant.timing !== 'postplan') return;
  world.banking.buildApplications = country => {
    const apps = [];
    for (const f of country.firms) {
      if (f.active === false) continue;
      const cash = world.ledger.balance(f.accountId);
      const payrollNeed = Math.max(1, F(f.wage) * Math.max(1, F(f.desiredWorkers)));
      const inputNeed = exactInputRequirement(country, f).value;
      const workingCapitalTarget = Math.max(payrollNeed * 1.8 + inputNeed * 0.6, F(f.safeCash) * 0.72);
      const shortfall = Math.max(0, workingCapitalTarget - cash);
      const expansionNeed = f.currentPlan?.selected === '확장' ? payrollNeed * 0.45 : 0;
      const amount = Math.min(Math.max(shortfall, expansionNeed), F(f.safeCash) * 0.75);
      if (amount > payrollNeed * 0.12) {
        apps.push({
          borrower: f,
          kind: 'firm',
          amount,
          cash,
          debt: F(f.loanBalance),
          arrears: F(f.wageArrears),
          incomeBase: Math.max(payrollNeed, F(f.revenue, payrollNeed)),
          termMonths: 18 + world.rng.int(0, 19)
        });
      }
    }
    for (const h of country.households) {
      const cash = world.ledger.balance(h.accountId);
      const incomeBase = Math.max(8, F(h.income, F(h.wage) * (h.employed ? 1 : 0.16)));
      const stressTarget = h.employed ? F(h.wage) * 0.65 : F(h.wage) * 1.25;
      const shortfall = Math.max(0, stressTarget - cash);
      if (shortfall > F(h.wage) * 0.18 && F(h.creditMisses) < 5) {
        apps.push({ borrower: h, kind: 'household', amount: Math.min(shortfall, F(h.wage) * 1.6), cash, debt: F(h.loanBalance), arrears: F(h.wageArrears), incomeBase, termMonths: 10 + world.rng.int(0, 15) });
      }
    }
    apps.sort((a, b) => b.amount - a.amount);
    return apps.slice(0, Math.max(18, Math.round((country.firms.length + country.households.length) * 0.08)));
  };
}

function installEntrantTracking(world, variant, scaleProfile, seedText) {
  world.__r2Entrants = new Map();
  world.__r2Lifecycle = [];
  const originalCreate = world.createEntrant.bind(world);
  world.createEntrant = (country, industryId) => {
    const f = originalCreate(country, industryId);
    world.__r2Entrants.set(f.id, { firmId: f.id, countryId: country.id, industryId: f.industryId, birthMonth: world.month, firstCreditMonth: null, firstOutputMonth: null, firstRevenueMonth: null, reexitMonth: null });
    return f;
  };
  world.__r2CaptureLifecycle = () => {
    for (const country of world.countries) {
      const originations = world.ledger.entriesFor({ month: world.month, countryId: country.id, kind: 'bank_loan_origination' });
      const byBorrower = new Map();
      for (const e of originations) {
        const id = e.meta?.borrowerId;
        if (id) byBorrower.set(id, F(byBorrower.get(id)) + F(e.amount));
      }
      for (const f of country.firms.filter(x => world.__r2Entrants.has(x.id))) {
        const meta = world.__r2Entrants.get(f.id);
        const credit = F(byBorrower.get(f.id));
        if (credit > EPS && meta.firstCreditMonth === null) meta.firstCreditMonth = world.month;
        if (F(f.output) > EPS && meta.firstOutputMonth === null) meta.firstOutputMonth = world.month;
        if (F(f.revenue) > EPS && meta.firstRevenueMonth === null) meta.firstRevenueMonth = world.month;
        if (f.active === false && meta.reexitMonth === null) meta.reexitMonth = world.month;
        world.__r2Lifecycle.push({ variant: variant.id, scaleProfile, seed: seedText, month: world.month, countryId: country.id, firmId: f.id, industryId: f.industryId, birthMonth: meta.birthMonth, active: f.active !== false, workers: F(f.workers), cash: world.ledger.balance(f.accountId), credit, loanBalance: F(f.loanBalance), inputSpend: F(f.inputSpend), supplyShortage: F(f.supplyShortage), output: F(f.output), revenue: F(f.revenue), wageArrears: F(f.wageArrears) });
      }
    }
  };
}

function preferredApprove(trace) {
  const rows = Array.isArray(trace?.counterfactuals) ? trace.counterfactuals : [];
  if (!rows.length) return true;
  return rows[0]?.name === '대출 승인';
}

function installUnderwritingMatrix(world, variant) {
  world.__r2Supplements = [];
  world.__r2TraceRows = [];
  world.__r2ApplicationQueue = new Map();
  world.__r2ActiveCountry = null;

  for (const country of world.countries) {
    const bank = country.banks[0];
    let value = bank.lastTrace;
    Object.defineProperty(bank, 'lastTrace', {
      enumerable: true,
      configurable: true,
      get() { return value; },
      set(v) {
        value = v;
        if (world.__r2ActiveCountry === country.id && v?.borrowerId) {
          world.__r2TraceRows.push({ variant: variant.id, month: world.month, countryId: country.id, borrowerId: v.borrowerId, trace: C(v) });
        }
      }
    });
  }

  const originalBuild = world.banking.buildApplications.bind(world.banking);
  world.banking.buildApplications = country => {
    const apps = originalBuild(country);
    world.__r2ApplicationQueue.set(country.id, apps.slice());
    return apps;
  };

  const originalOriginate = world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit = (country, month, signals) => {
    world.__r2ActiveCountry = country.id;
    const traceStart = world.__r2TraceRows.length;
    const metrics = originalOriginate(country, month, signals);
    world.__r2ActiveCountry = null;

    if (!(variant.risk || variant.afford || variant.capital || variant.cf)) return metrics;

    const apps = world.__r2ApplicationQueue.get(country.id) || [];
    const traces = world.__r2TraceRows.slice(traceStart).filter(x => x.countryId === country.id && x.month === month);
    const traceByBorrower = new Map(traces.map(x => [x.borrowerId, x.trace]));
    const originated = new Set(world.ledger.entriesFor({ month, countryId: country.id, kind: 'bank_loan_origination' }).map(e => e.meta?.borrowerId).filter(Boolean));
    const bank = country.banks[0];

    for (const application of apps) {
      if (application.kind !== 'firm') continue;
      const borrower = application.borrower;
      if (!world.__r2Entrants?.has(borrower.id) || originated.has(borrower.id)) continue;
      const trace = traceByBorrower.get(borrower.id);
      if (!trace) continue;
      const constraints = trace.constraints || {};
      const passRisk = constraints.riskAcceptable === true || variant.risk;
      const passAfford = constraints.affordable === true || variant.afford;
      const passCapital = constraints.capitalSafe === true || variant.capital;
      const passCF = preferredApprove(trace) || variant.cf;
      if (!(passRisk && passAfford && passCapital && passCF)) continue;

      const statement = world.accounting.entityStatement(bank.id, month).balanceSheet;
      const requested = Math.max(0, F(application.amount));
      const amount = variant.capital ? requested : world.banking.capByBankCapital(bank, statement, requested);
      if (amount <= EPS) continue;
      const created = world.ledger.adjustMoney({ month, countryId: country.id, accountId: borrower.accountId, amount, kind: 'bank_loan_origination', meta: { bankId: bank.id, borrowerId: borrower.id, rv08R2: true, variant: variant.id } });
      if (created <= EPS) continue;

      const annualRate = Math.max(0, F(trace.forecast?.annualRate, F(bank.baseAnnualRate) + F(bank.loanMarkup)));
      const loan = {
        id: `LN-R2-${String(world.banking.loanSequence++).padStart(8, '0')}`,
        countryId: country.id,
        bankId: bank.id,
        borrowerId: borrower.id,
        borrowerKind: 'firm',
        originalPrincipal: created,
        outstanding: created,
        annualRate,
        monthlyRate: annualRate / 12,
        termMonths: application.termMonths,
        originatedMonth: month,
        nextPaymentMonth: month + 1,
        missedPayments: 0,
        arrears: 0,
        status: 'active',
        estimatedDefaultProbabilityAtOrigination: F(trace.forecast?.estimatedDefaultProbability)
      };
      country.loans.push(loan);
      borrower.loanBalance = F(borrower.loanBalance) + created;
      world.accounting.recordLoanOrigination({ country, bank, borrower, loan, month, amount: created });
      metrics.approved += 1;
      metrics.newCredit += created;
      metrics.moneyCreated += created;
      originated.add(borrower.id);
      world.__r2Supplements.push({ variant: variant.id, month, countryId: country.id, firmId: borrower.id, industryId: borrower.industryId, amount: created, requested, relaxedRisk: variant.risk, relaxedAffordability: variant.afford, relaxedCapital: variant.capital, relaxedCounterfactual: variant.cf, originalRiskAcceptable: constraints.riskAcceptable === true, originalAffordable: constraints.affordable === true, originalCapitalSafe: constraints.capitalSafe === true, originalPreferredApprove: preferredApprove(trace) });
    }
    metrics.outstandingLoans = country.loans.reduce((s, l) => s + (l.status === 'active' ? F(l.outstanding) : 0), 0);
    return metrics;
  };
}

function installDeferredCredit(world, variant) {
  world.__r2DeferredCalls = 0;
  world.__r2DeferredMetrics = new Map();
  if (variant.timing !== 'postplan') return;
  const originalOriginate = world.banking.originateCredit.bind(world.banking);
  const originalCombine = world.banking.combineMetrics.bind(world.banking);
  const originalPlan = world.supply.planProduction.bind(world.supply);
  const pending = new Map();
  world.banking.originateCredit = (country, month, signals) => {
    pending.set(country.id, { month, signals: C(signals) });
    return world.banking.emptyMetrics();
  };
  world.supply.planProduction = country => {
    const out = originalPlan(country);
    const request = pending.get(country.id);
    if (request) {
      const metrics = originalOriginate(country, request.month, request.signals);
      world.syncBalances(country);
      world.__r2DeferredMetrics.set(`${request.month}|${country.id}`, metrics);
      world.__r2DeferredCalls += 1;
      pending.delete(country.id);
    }
    return out;
  };
  world.banking.combineMetrics = (service, originations, country) => originalCombine(service, world.__r2DeferredMetrics.get(`${world.month}|${country.id}`) || originations, country);
}

function gdpResidual(m) {
  return F(m?.gdp) - (F(m?.consumption) + F(m?.grossInvestment) + F(m?.publicInvestment) + F(m?.governmentConsumption) + F(m?.inventoryInvestment) + F(m?.netExports));
}

function digest(world) {
  const h = createHash('sha256');
  const put = v => h.update(JSON.stringify(v));
  put({ month: world.month, rng: world.rng });
  for (const c of world.countries) { put(c); put(world.accountingReport(c.id)); }
  for (const e of world.ledger.entries) put(e);
  return h.digest('hex');
}

function macroRow(world, variant, scaleProfile, seedText, country) {
  const m = country.macro || {};
  return { variant: variant.id, scaleProfile, seed: seedText, month: world.month, countryId: country.id, unemployment: F(m.unemployment), exits: F(m.firmExits), entries: F(m.firmEntries), wageArrears: F(m.wageArrears), goodsFulfillment: 1 - F(m.unmetDemandRatio), inputShortage: F(m.inputShortageUnits), resourceOutput: F(m.resourceOutput), materialsOutput: F(m.materialsOutput), consumerOutput: F(m.consumerGoodsOutput), firmCash: F(m.firmCash), creditApplications: F(m.creditApplications), creditApproved: F(m.creditApproved), newCredit: F(m.newCredit), loanDefaults: F(m.loanDefaults), chargeOffs: F(m.chargeOffs) };
}

function makeConfiguredWorld(variant, scaleProfile, seedText, instrument = true) {
  const world = makeWorld(scaleProfile, seedText);
  if (!instrument) return world;
  installExactApplications(world, variant);
  installEntrantTracking(world, variant, scaleProfile, seedText);
  installUnderwritingMatrix(world, variant);
  installDeferredCredit(world, variant);
  return world;
}

function runVariant(variant, scaleProfile, seedText, horizon, instrument = true, captureFingerprint = false) {
  const world = makeConfiguredWorld(variant, scaleProfile, seedText, instrument);
  const rows = [];
  for (let i = 0; i < horizon; i++) {
    world.stepMonth();
    if (instrument) world.__r2CaptureLifecycle();
    for (const country of world.countries) rows.push(macroRow(world, variant, scaleProfile, seedText, country));
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${variant.id}/${scaleProfile}/${seedText}: health`);
  const ledgerOk = world.countries.every(c => world.ledger.verifyCountry(c.id)?.ok === true);
  const generalOk = world.countries.every(c => world.accounting.verifyCountry(c, world.ledger, world.month)?.ok !== false);
  const maxGdpResidual = Math.max(0, ...world.countries.map(c => Math.abs(gdpResidual(c.macro))));
  return { variant: variant.id, scaleProfile, seed: seedText, rows, health, ledgerOk, generalOk, maxGdpResidual, entrants: instrument ? [...world.__r2Entrants.values()].map(C) : [], lifecycle: instrument ? world.__r2Lifecycle.map(C) : [], supplements: instrument ? world.__r2Supplements.map(C) : [], traceRows: instrument ? world.__r2TraceRows.map(C) : [], deferredCalls: world.__r2DeferredCalls || 0, fingerprint: captureFingerprint ? digest(world) : null };
}

const niScale = scales[0];
const niSeed = 'ECON-RV08-R2-NI';
const niH = Math.min(5, months);
const niRaw = runVariant(variants[0], niScale, niSeed, niH, false, true).fingerprint;
const niObserved = runVariant(variants[0], niScale, niSeed, niH, true, true).fingerprint;
const controlObserverNonInterferenceExact = niRaw === niObserved;
assert.ok(controlObserverNonInterferenceExact, 'R2 control instrumentation must be exact non-interference');

const deterministic = [];
for (const variant of variants) {
  for (const scaleProfile of scales) {
    const seedText = `ECON-RV08-R2-DET-${variant.id}-${scaleProfile}`;
    const h = Math.min(4, months);
    const a = runVariant(variant, scaleProfile, seedText, h, true, true).fingerprint;
    const b = runVariant(variant, scaleProfile, seedText, h, true, true).fingerprint;
    assert.equal(a, b, `${variant.id}/${scaleProfile}: deterministic replay`);
    deterministic.push({ variant: variant.id, scaleProfile, exact: true });
  }
}

const runs = [];
for (const variant of variants) for (const scaleProfile of scales) for (const seedText of seeds) runs.push(runVariant(variant, scaleProfile, seedText, months, true, false));
const rows = runs.flatMap(r => r.rows);
const entrants = runs.flatMap(r => r.entrants.map(e => ({ ...e, variant: r.variant, scaleProfile: r.scaleProfile, seed: r.seed })));
const lifecycle = runs.flatMap(r => r.lifecycle);
const supplements = runs.flatMap(r => r.supplements.map(s => ({ ...s, scaleProfile: r.scaleProfile, seed: r.seed })));
const traceRows = runs.flatMap(r => r.traceRows.map(t => ({ ...t, scaleProfile: r.scaleProfile, seed: r.seed })));
const windows = [['M1-3',1,3],['M4-6',4,6],['M7-9',7,9],['M10-12',10,months],['FULL',1,months]].filter(x => x[1] <= x[2]);

function aggMacro(rs) {
  return { observations: rs.length, unemployment: M(rs.map(x => x.unemployment)), exits: S(rs.map(x => x.exits)), entries: S(rs.map(x => x.entries)), wageArrears: M(rs.map(x => x.wageArrears)), goodsFulfillment: M(rs.map(x => x.goodsFulfillment)), inputShortage: M(rs.map(x => x.inputShortage)), resourceOutput: M(rs.map(x => x.resourceOutput)), materialsOutput: M(rs.map(x => x.materialsOutput)), consumerOutput: M(rs.map(x => x.consumerOutput)), firmCash: M(rs.map(x => x.firmCash)), creditApplications: S(rs.map(x => x.creditApplications)), creditApproved: S(rs.map(x => x.creditApproved)), newCredit: S(rs.map(x => x.newCredit)), loanDefaults: S(rs.map(x => x.loanDefaults)), chargeOffs: S(rs.map(x => x.chargeOffs)) };
}

function entrantAgg(variantId, scaleProfile) {
  const es = entrants.filter(e => e.variant === variantId && e.scaleProfile === scaleProfile);
  const ids = new Set(es.map(e => `${e.seed}|${e.countryId}|${e.firmId}`));
  const ls = lifecycle.filter(x => x.variant === variantId && x.scaleProfile === scaleProfile && ids.has(`${x.seed}|${x.countryId}|${x.firmId}`));
  const ss = supplements.filter(x => x.variant === variantId && x.scaleProfile === scaleProfile && ids.has(`${x.seed}|${x.countryId}|${x.firmId}`));
  const ever = pred => es.length ? es.filter(e => ls.filter(x => `${x.seed}|${x.countryId}|${x.firmId}` === `${e.seed}|${e.countryId}|${e.firmId}`).some(pred)).length / es.length : 0;
  const downstream = es.filter(e => e.industryId !== 'RESOURCE');
  const everDownstream = pred => downstream.length ? downstream.filter(e => ls.filter(x => `${x.seed}|${x.countryId}|${x.firmId}` === `${e.seed}|${e.countryId}|${e.firmId}`).some(pred)).length / downstream.length : 0;
  return { variant: variantId, scaleProfile, births: es.length, supplementalLoans: ss.length, supplementalCredit: S(ss.map(x => x.amount)), everCreditShare: ever(x => x.credit > EPS), everOutputShare: ever(x => x.output > EPS), everRevenueShare: ever(x => x.revenue > EPS), reexitShare: ever(x => x.active === false), downstreamBirths: downstream.length, downstreamEverCreditShare: everDownstream(x => x.credit > EPS), downstreamEverOutputShare: everDownstream(x => x.output > EPS), downstreamEverRevenueShare: everDownstream(x => x.revenue > EPS) };
}

const summary = [];
for (const variant of variants) for (const scaleProfile of scales) for (const [window,a,b] of windows) summary.push({ variant: variant.id, scaleProfile, window, ...aggMacro(rows.filter(r => r.variant === variant.id && r.scaleProfile === scaleProfile && r.month >= a && r.month <= b)) });
const entrantSummary = variants.flatMap(v => scales.map(sc => entrantAgg(v.id, sc)));

const supplementalIds = new Set(supplements.map(x => `${x.seed}|${x.countryId}|${x.firmId}`));
const entrantIds = new Set(entrants.map(x => `${x.seed}|${x.countryId}|${x.firmId}`));
const nonEntrantSupplementCount = [...supplementalIds].filter(id => !entrantIds.has(id)).length;
const supplementalLedgerTotal = runs.reduce((sum, r) => sum + S(r.supplements.map(x => x.amount)), 0);
const postplanVariants = new Set(variants.filter(v => v.timing === 'postplan').map(v => v.id));
const gates = {
  controlObserverNonInterferenceExact,
  deterministicReplayExact: deterministic.every(x => x.exact),
  allHealthy: runs.every(r => r.health.ok),
  completeCoverage: runs.length === variants.length * scales.length * seeds.length,
  ledgerCountriesOk: runs.every(r => r.ledgerOk),
  generalAccountingOk: runs.every(r => r.generalOk),
  gdpIdentityReconciled: runs.every(r => r.maxGdpResidual <= TOL),
  postplanActivated: runs.filter(r => postplanVariants.has(r.variant)).every(r => r.deferredCalls === months * COUNTRY_SEEDS.length),
  entrantBirthsObserved: entrants.length > 0,
  entrantTraceCoverageObserved: traceRows.some(t => entrantIds.has(`${t.seed}|${t.countryId}|${t.borrowerId}`)),
  underwritingReliefActivated: supplements.length > 0,
  noSupplementToNonEntrants: nonEntrantSupplementCount === 0,
  supplementalCreditPositive: supplementalLedgerTotal > EPS,
  finiteRows: rows.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v))),
  finiteEntrantLifecycle: lifecycle.every(r => Object.values(r).every(v => typeof v !== 'number' || Number.isFinite(v)))
};
gates.ok = Object.values(gates).every(Boolean);
assert.ok(gates.ok, `R2 gates ${JSON.stringify(gates)}`);

console.table(summary.filter(x => x.scaleProfile === 'baseline' && x.window === 'FULL').map(x => ({ variant: x.variant, u:+x.unemployment.toFixed(4), exits:x.exits, arrears:+x.wageArrears.toFixed(0), fulfill:+x.goodsFulfillment.toFixed(3), shortage:+x.inputShortage.toFixed(1), consumer:+x.consumerOutput.toFixed(1), approvals:x.creditApproved, credit:+x.newCredit.toFixed(0), defaults:x.loanDefaults })));
console.table(entrantSummary.filter(x => x.scaleProfile === 'baseline').map(x => ({ variant:x.variant, births:x.births, loans:x.supplementalLoans, credit:+x.supplementalCredit.toFixed(0), everCredit:+x.everCreditShare.toFixed(3), downstreamOutput:+x.downstreamEverOutputShare.toFixed(3), downstreamRevenue:+x.downstreamEverRevenueShare.toFixed(3), reexit:+x.reexitShare.toFixed(3) })));
console.log('WP_RV08_R2_GATES', JSON.stringify(gates));
console.log('WP_RV08_R2_SUMMARY', JSON.stringify(summary));
console.log('WP_RV08_R2_ENTRANTS', JSON.stringify(entrantSummary));
console.log('WP_RV08_R2_SUPPLEMENTS', JSON.stringify(supplements));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, JSON.stringify({ workPackage:'WP-RV08-R2', title:'Entrant underwriting constraint × current-plan timing matrix', generatedAt:new Date().toISOString(), configuration:{ variants, scales, seeds, months }, gates, summary, entrantSummary, supplements, traceRows, rows, lifecycle }, null, 2));
  console.log('WP_RV08_R2_OUTPUT', outputJson);
}
