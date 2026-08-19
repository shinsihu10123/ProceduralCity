import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const scaleProfile = process.env.DIAG_SCALE || 'baseline';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const seeds = (process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x => x.trim()).filter(Boolean);
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const sum = xs => xs.reduce((s, x) => s + finite(x), 0);
const mean = xs => xs.length ? sum(xs) / xs.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, finite(v)));

function compactCredit(c = {}) {
  return {
    applications: finite(c.applications), approved: finite(c.approved), rejected: finite(c.rejected),
    newCredit: finite(c.newCredit), payments: finite(c.payments), principalRepaid: finite(c.principalRepaid),
    interestPaid: finite(c.interestPaid), missedPayments: finite(c.missedPayments), defaults: finite(c.defaults),
    chargeOffs: finite(c.chargeOffs), outstandingLoans: finite(c.outstandingLoans)
  };
}

function creditStressFormula(c = {}) {
  const applications = finite(c.applications);
  const rejectionRatio = applications > 0 ? finite(c.rejected) / applications : 0;
  const outstanding = finite(c.outstandingLoans);
  const defaultRatio = outstanding > 0 ? finite(c.chargeOffs) / outstanding : 0;
  return clamp(rejectionRatio * 0.62 + Math.min(1, defaultRatio * 5) * 0.38, 0, 1.5);
}

function compactTrace(t = {}) {
  return {
    borrowerId: t.borrowerId || null,
    borrowerKind: t.borrowerKind || null,
    requestedAmount: finite(t.requestedAmount),
    selected: t.selected || null,
    reason: t.reason || null,
    estimatedDefaultProbability: finite(t.forecast?.estimatedDefaultProbability),
    projectedCapitalRatio: finite(t.forecast?.projectedCapitalRatio),
    paymentBurden: finite(t.forecast?.paymentBurden),
    annualRate: finite(t.forecast?.annualRate),
    affordable: Boolean(t.constraints?.affordable),
    capitalSafe: Boolean(t.constraints?.capitalSafe),
    riskAcceptable: Boolean(t.constraints?.riskAcceptable),
    riskLimit: finite(t.constraints?.riskLimit),
    affordabilityLimit: finite(t.constraints?.affordabilityLimit)
  };
}

function fingerprint(world) {
  return {
    month: world.month,
    rng: structuredClone(world.rng),
    countries: structuredClone(world.countries),
    ledgerEntries: structuredClone(world.ledger.entries),
    accounting: world.countries.map(c => [c.id, world.accountingReport(c.id)])
  };
}

function bankSnapshot(world, country) {
  const bank = country.banks[0];
  const gl = world.accounting.gl;
  const bs = gl.balanceSheet(bank.id);
  const deposits = Math.max(0, finite(gl.naturalBalance(bank.id, 'deposits')));
  const reserves = Math.max(0, finite(gl.naturalBalance(bank.id, 'reserves')));
  const borrowing = gl.hasEntity(bank.id) ? Math.max(0, finite(gl.naturalBalance(bank.id, 'central_bank_borrowing'))) : 0;
  const capitalRatio = bs.assets > EPS ? Math.max(0, bs.equity) / bs.assets : 1;
  const capitalCapacity = Math.max(0, Math.max(0, bs.equity) / Math.max(0.01, finite(bank.minCapitalRatio)) - Math.max(0, bs.assets));
  return {
    assets: finite(bs.assets), equity: finite(bs.equity), deposits, reserves, capitalRatio, capitalCapacity,
    minCapitalRatio: finite(bank.minCapitalRatio), reserveRatio: deposits > EPS ? reserves / deposits : 0,
    centralBankBorrowing: borrowing, baseAnnualRate: finite(bank.baseAnnualRate), policyRate: finite(bank.policyRate),
    cumulativeChargeOffs: finite(bank.cumulativeChargeOffs), defaults: finite(bank.defaults)
  };
}

function installObservers(world, seed, originationEvents, serviceEvents, decisionEvents) {
  const banking = world.banking;
  const originalBuild = banking.buildApplications.bind(banking);
  const originalOriginate = banking.originateCredit.bind(banking);
  const originalService = banking.serviceDebt.bind(banking);
  let context = null;

  banking.buildApplications = country => {
    const apps = originalBuild(country);
    if (context && context.countryId === country.id) {
      context.apps = apps.map((app, index) => ({
        index, borrowerId: app.borrower.id, borrowerKind: app.kind,
        requestedAmount: finite(app.amount), cash: finite(app.cash), debt: finite(app.debt),
        arrears: finite(app.arrears), incomeBase: finite(app.incomeBase), termMonths: finite(app.termMonths)
      }));
    }
    return apps;
  };

  banking.originateCredit = (country, month, signals) => {
    const bank = country.banks[0];
    const ctx = { countryId: country.id, month, apps: [], traces: [] };
    context = ctx;
    const descriptor = Object.getOwnPropertyDescriptor(bank, 'lastTrace');
    let backing = bank.lastTrace;
    Object.defineProperty(bank, 'lastTrace', {
      configurable: true, enumerable: descriptor?.enumerable ?? true,
      get() { return backing; },
      set(value) { backing = value; if (context === ctx) ctx.traces.push(compactTrace(value)); }
    });
    let result;
    try {
      result = originalOriginate(country, month, signals);
    } finally {
      if (descriptor) Object.defineProperty(bank, 'lastTrace', { ...descriptor, value: backing });
      else { delete bank.lastTrace; bank.lastTrace = backing; }
      context = null;
    }
    assert.equal(ctx.apps.length, ctx.traces.length, `${seed} ${country.id} M${month}: one decision trace per application required`);
    for (let i = 0; i < ctx.apps.length; i++) decisionEvents.push({ seed, month, countryId: country.id, ...ctx.apps[i], trace: ctx.traces[i] });
    originationEvents.push({ seed, month, countryId: country.id, metrics: compactCredit(result), requestedAmount: sum(ctx.apps.map(a => a.requestedAmount)), applications: ctx.apps.length });
    return result;
  };

  banking.serviceDebt = (country, month) => {
    const before = new Map((country.loans || []).filter(l => l.status === 'active' && month >= l.nextPaymentMonth).map(l => [l.id, {
      missedPayments: finite(l.missedPayments), status: l.status, outstanding: finite(l.outstanding), borrowerKind: l.borrowerKind
    }]));
    const result = originalService(country, month);
    const after = new Map((country.loans || []).map(l => [l.id, l]));
    const transitions = [];
    for (const [loanId, pre] of before) {
      const post = after.get(loanId);
      transitions.push({
        loanId, borrowerKind: pre.borrowerKind,
        missedThisMonth: finite(post?.missedPayments) > pre.missedPayments,
        defaultedThisMonth: post?.status === 'defaulted' && Number(post?.defaultMonth) === Number(month),
        repaidThisMonth: post?.status === 'repaid'
      });
    }
    serviceEvents.push({ seed, month, countryId: country.id, metrics: compactCredit(result), dueLoans: before.size, transitions });
    return result;
  };
}

function aggregateExpected(service, origin, currentOutstanding) {
  const s = service?.metrics || compactCredit({});
  const o = origin?.metrics || compactCredit({});
  return {
    applications: o.applications,
    approved: o.approved,
    rejected: o.rejected,
    newCredit: o.newCredit,
    payments: s.payments,
    principalRepaid: s.principalRepaid,
    interestPaid: s.interestPaid,
    missedPayments: s.missedPayments,
    defaults: s.defaults,
    chargeOffs: s.chargeOffs,
    outstandingLoans: finite(currentOutstanding)
  };
}

function summarizeDecisions(events) {
  const rejected = events.filter(e => e.trace.selected !== '대출 승인');
  const requested = sum(events.map(e => e.requestedAmount));
  const counts = {};
  for (const e of rejected) counts[e.trace.reason || 'unknown'] = (counts[e.trace.reason || 'unknown'] || 0) + 1;
  return {
    applications: events.length, requested,
    selectedApprovals: events.filter(e => e.trace.selected === '대출 승인').length,
    selectedRejections: rejected.length,
    firmApplications: events.filter(e => e.borrowerKind === 'firm').length,
    householdApplications: events.filter(e => e.borrowerKind === 'household').length,
    capitalUnsafe: events.filter(e => !e.trace.capitalSafe).length,
    unaffordable: events.filter(e => !e.trace.affordable).length,
    riskUnacceptable: events.filter(e => e.trace.affordable && e.trace.capitalSafe && !e.trace.riskAcceptable).length,
    counterfactualRejections: events.filter(e => e.trace.affordable && e.trace.capitalSafe && e.trace.riskAcceptable && e.trace.selected !== '대출 승인').length,
    meanDefaultProbability: mean(events.map(e => e.trace.estimatedDefaultProbability)),
    meanAnnualRate: mean(events.map(e => e.trace.annualRate)),
    rejectionReasons: counts
  };
}

function run(seed, horizon, collect = true) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const originations = [], services = [], decisions = [], rows = [];
  installObservers(world, seed, originations, services, decisions);
  let maxCreditMetricError = 0;
  let maxCreditStressLagError = 0;

  for (let step = 0; step < horizon; step++) {
    const priorCredit = new Map(world.countries.map(c => [c.id, compactCredit(c.lastCredit || {})]));
    world.stepMonth();
    if (!collect) continue;
    for (const country of world.countries) {
      const origin = originations.find(e => e.month === world.month && e.countryId === country.id);
      const service = services.find(e => e.month === world.month && e.countryId === country.id);
      assert.ok(origin && service, `${seed} ${country.id} M${world.month}: exact finance events required`);
      const current = compactCredit(country.lastCredit || {});
      const expected = aggregateExpected(service, origin, current.outstandingLoans);
      const errors = Object.fromEntries(Object.keys(current).map(k => [k, finite(current[k]) - finite(expected[k])]));
      maxCreditMetricError = Math.max(maxCreditMetricError, ...Object.values(errors).map(Math.abs));
      const prior = priorCredit.get(country.id) || compactCredit({});
      const expectedStress = creditStressFormula(prior);
      const actualStress = finite(country.lastMonetary?.creditStress);
      maxCreditStressLagError = Math.max(maxCreditStressLagError, Math.abs(actualStress - expectedStress));
      const monthDecisions = decisions.filter(e => e.month === world.month && e.countryId === country.id);
      rows.push({
        seed, month: world.month, countryId: country.id,
        economy: { unemployment: finite(country.macro?.unemployment), consumption: finite(country.macro?.consumption), nominalSales: finite(country.macro?.nominalSales), activeFirms: country.firms.filter(f => f.active !== false).length },
        decisions: summarizeDecisions(monthDecisions),
        credit: current,
        service: service.metrics,
        origination: origin.metrics,
        requestedCredit: origin.requestedAmount,
        creditAmountCoverage: ratio(origin.metrics.newCredit, origin.requestedAmount),
        bank: bankSnapshot(world, country),
        monetary: {
          policyRate: finite(country.lastMonetary?.policyRate), stance: country.lastMonetary?.stance || null,
          creditStress: actualStress, bankStress: finite(country.lastMonetary?.bankStress),
          openMarketPurchases: finite(country.lastMonetary?.openMarketPurchases), openMarketSales: finite(country.lastMonetary?.openMarketSales),
          centralBankLending: finite(country.lastMonetary?.centralBankLending), outstandingFacilities: finite(country.lastMonetary?.outstandingFacilities)
        },
        priorCredit: prior, expectedLaggedCreditStress: expectedStress, currentCreditImpliedNextStress: creditStressFormula(current),
        creditMetricErrors: errors
      });
    }
  }
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  if (!collect) return { fingerprint: fingerprint(world) };
  assert.equal(rows.length, horizon * world.countries.length, `${seed}: complete country-month coverage required`);
  assert.ok(maxCreditMetricError <= 1e-7, `${seed}: returned finance metrics must reconcile exactly to lastCredit`);
  assert.ok(maxCreditStressLagError <= 1e-12, `${seed}: monetary creditStress must equal prior-month lastCredit formula`);
  return { seed, health, rows, decisions, originations, services, reconciliation: { maxCreditMetricError, maxCreditStressLagError }, scale: world.scaleReport() };
}

const niSeed = 'ECON-RV06-NONINTERFERENCE';
const niMonths = Math.min(3, months);
const control = (() => { const w = new EconomicWorld(niSeed, { scaleProfile, healthCheckInterval: 0 }); for (let i = 0; i < niMonths; i++) w.stepMonth(); return fingerprint(w); })();
const observed = run(niSeed, niMonths, false).fingerprint;
assert.deepStrictEqual(observed, control, 'WP-RV06 observers must be exactly non-interfering');

const runs = seeds.map(seed => run(seed, months, true));
const rows = runs.flatMap(r => r.rows);
const decisions = runs.flatMap(r => r.decisions);

for (const seed of seeds) for (const countryId of [...new Set(rows.map(r => r.countryId))]) {
  const path = rows.filter(r => r.seed === seed && r.countryId === countryId).sort((a, b) => a.month - b.month);
  for (let i = 1; i < path.length; i++) assert.ok(Math.abs(path[i].monetary.creditStress - path[i - 1].currentCreditImpliedNextStress) <= 1e-12, `${seed} ${countryId} M${path[i].month}: creditStress lag propagation mismatch`);
}

function summarizeWindow(rs) {
  const appCount = sum(rs.map(r => r.credit.applications));
  const approved = sum(rs.map(r => r.credit.approved));
  const requested = sum(rs.map(r => r.requestedCredit));
  const newCredit = sum(rs.map(r => r.credit.newCredit));
  const reasonCounts = {};
  const ds = decisions.filter(d => rs.some(r => r.seed === d.seed && r.month === d.month && r.countryId === d.countryId));
  for (const d of ds.filter(x => x.trace.selected !== '대출 승인')) reasonCounts[d.trace.reason || 'unknown'] = (reasonCounts[d.trace.reason || 'unknown'] || 0) + 1;
  return {
    countryMonths: rs.length, applications: appCount, approvals: approved, rejections: sum(rs.map(r => r.credit.rejected)), approvalRate: ratio(approved, appCount),
    requestedCredit: requested, newCredit, creditAmountCoverage: ratio(newCredit, requested),
    capitalUnsafeDecisions: ds.filter(d => !d.trace.capitalSafe).length,
    unaffordableDecisions: ds.filter(d => !d.trace.affordable).length,
    riskUnacceptableDecisions: ds.filter(d => d.trace.affordable && d.trace.capitalSafe && !d.trace.riskAcceptable).length,
    counterfactualRejections: ds.filter(d => d.trace.affordable && d.trace.capitalSafe && d.trace.riskAcceptable && d.trace.selected !== '대출 승인').length,
    debtPayments: sum(rs.map(r => r.credit.payments)), debtMisses: sum(rs.map(r => r.credit.missedPayments)), defaults: sum(rs.map(r => r.credit.defaults)), chargeOffs: sum(rs.map(r => r.credit.chargeOffs)),
    meanCreditStress: mean(rs.map(r => r.monetary.creditStress)), meanBankStress: mean(rs.map(r => r.monetary.bankStress)),
    meanCapitalRatio: mean(rs.map(r => r.bank.capitalRatio)), minCapitalRatio: rs.length ? Math.min(...rs.map(r => r.bank.capitalRatio)) : 0,
    meanCapitalCapacity: mean(rs.map(r => r.bank.capitalCapacity)), totalCentralBankLending: sum(rs.map(r => r.monetary.centralBankLending)), totalOpenMarketPurchases: sum(rs.map(r => r.monetary.openMarketPurchases)),
    meanUnemployment: mean(rs.map(r => r.economy.unemployment)), rejectionReasons: reasonCounts
  };
}

const windows = {
  months1to3: summarizeWindow(rows.filter(r => r.month <= 3)),
  months4to6: summarizeWindow(rows.filter(r => r.month >= 4 && r.month <= 6)),
  months7to9: summarizeWindow(rows.filter(r => r.month >= 7 && r.month <= 9)),
  months10to12: summarizeWindow(rows.filter(r => r.month >= 10)),
  full: summarizeWindow(rows)
};

const report = {
  schemaVersion: 2,
  kind: 'economic-lab-wp-rv06-finance-credit-transmission-diagnosis',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile, months, seeds,
  methodology: {
    mechanismChanges: 0, parameterTuning: 0,
    observerNonInterference: { seed: niSeed, months: niMonths, exact: true },
    correction: 'The first RV06 attempt inferred missed-payment counts from borrower-level creditMisses. This corrected runner reconciles lastCredit to the exact return values of serviceDebt/originateCredit and uses loan-level missedPayments only as diagnostic detail.',
    creditStressLag: 'Month t monetary creditStress is tested against the exact formula applied to lastCredit from t-1.'
  },
  runs: runs.map(r => ({ seed: r.seed, health: r.health, reconciliation: r.reconciliation, scale: r.scale, rows: r.rows })),
  windows,
  rejectionReasonCounts: windows.full.rejectionReasons,
  gates: {
    observerNonInterferenceExact: true,
    allHealthy: runs.every(r => r.health.ok),
    completeCountryMonthCoverage: rows.length === seeds.length * months * 4,
    exactFinanceMetricReconciliation: runs.every(r => r.reconciliation.maxCreditMetricError <= 1e-7),
    exactCreditStressLagReconciliation: runs.every(r => r.reconciliation.maxCreditStressLagError <= 1e-12),
    allApplicationsHaveDecisionTrace: decisions.every(d => d.trace?.selected)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV06 corrected finance diagnosis gates must pass');

console.table(Object.entries(windows).map(([window, v]) => ({ window, applications: v.applications, approvalRate: Number(v.approvalRate.toFixed(4)), creditCoverage: Number(v.creditAmountCoverage.toFixed(4)), capitalUnsafe: v.capitalUnsafeDecisions, riskUnacceptable: v.riskUnacceptableDecisions, counterfactualRejects: v.counterfactualRejections, debtMisses: v.debtMisses, defaults: v.defaults, creditStress: Number(v.meanCreditStress.toFixed(4)), bankStress: Number(v.meanBankStress.toFixed(4)), unemployment: Number(v.meanUnemployment.toFixed(4)) })));
console.log('WP_RV06_REJECTION_REASONS', JSON.stringify(report.rejectionReasonCounts));
console.log('WP_RV06_GATES', JSON.stringify(report.gates));
if (outputJson) { mkdirSync(dirname(outputJson), { recursive: true }); writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); console.log(`WP_RV06_JSON ${outputJson}`); }
console.log('Economic Lab WP-RV06 corrected finance transmission diagnosis PASS');
