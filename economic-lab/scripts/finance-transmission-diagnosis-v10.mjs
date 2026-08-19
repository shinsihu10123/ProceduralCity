import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const scaleProfile = process.env.DIAG_SCALE || 'baseline';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const seedText = process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const EPS = 1e-9;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > EPS ? finite(a) / finite(b) : 0;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, finite(value)));

function creditStressFormula(credit = {}) {
  const applications = finite(credit.applications);
  const rejectionRatio = applications > 0 ? finite(credit.rejected) / applications : 0;
  const outstanding = finite(credit.outstandingLoans);
  const defaultRatio = outstanding > 0 ? finite(credit.chargeOffs) / outstanding : 0;
  return clamp(rejectionRatio * 0.62 + Math.min(1, defaultRatio * 5) * 0.38, 0, 1.5);
}

function compactCredit(credit = {}) {
  return {
    applications: finite(credit.applications),
    approved: finite(credit.approved),
    rejected: finite(credit.rejected),
    newCredit: finite(credit.newCredit),
    payments: finite(credit.payments),
    principalRepaid: finite(credit.principalRepaid),
    interestPaid: finite(credit.interestPaid),
    missedPayments: finite(credit.missedPayments),
    defaults: finite(credit.defaults),
    chargeOffs: finite(credit.chargeOffs),
    outstandingLoans: finite(credit.outstandingLoans)
  };
}

function compactTrace(trace = {}) {
  return {
    borrowerId: trace.borrowerId || null,
    borrowerKind: trace.borrowerKind || null,
    requestedAmount: finite(trace.requestedAmount),
    selected: trace.selected || null,
    reason: trace.reason || null,
    estimatedDefaultProbability: finite(trace.forecast?.estimatedDefaultProbability),
    projectedCapitalRatio: finite(trace.forecast?.projectedCapitalRatio),
    paymentBurden: finite(trace.forecast?.paymentBurden),
    annualRate: finite(trace.forecast?.annualRate),
    affordable: Boolean(trace.constraints?.affordable),
    capitalSafe: Boolean(trace.constraints?.capitalSafe),
    riskAcceptable: Boolean(trace.constraints?.riskAcceptable),
    riskLimit: finite(trace.constraints?.riskLimit),
    affordabilityLimit: finite(trace.constraints?.affordabilityLimit)
  };
}

function stateFingerprint(world) {
  return {
    month: world.month,
    rng: structuredClone(world.rng),
    countries: structuredClone(world.countries),
    ledgerEntries: structuredClone(world.ledger.entries),
    accounting: world.countries.map(country => ({
      id: country.id,
      report: world.accountingReport(country.id)
    }))
  };
}

function installFinanceObservers(world, applicationEvents, debtEvents) {
  const banking = world.banking;
  const originalBuild = banking.buildApplications.bind(banking);
  const originalOriginate = banking.originateCredit.bind(banking);
  const originalServiceDebt = banking.serviceDebt.bind(banking);
  let originateContext = null;

  banking.buildApplications = country => {
    const apps = originalBuild(country);
    if (originateContext && originateContext.countryId === country.id) {
      originateContext.applications = apps.map((app, index) => ({
        index,
        borrowerId: app.borrower.id,
        borrowerKind: app.kind,
        requestedAmount: finite(app.amount),
        cash: finite(app.cash),
        debt: finite(app.debt),
        arrears: finite(app.arrears),
        incomeBase: finite(app.incomeBase),
        termMonths: finite(app.termMonths)
      }));
    }
    return apps;
  };

  banking.originateCredit = (country, month, signals) => {
    const bank = country.banks[0];
    const priorLoanIds = new Set((country.loans || []).map(loan => loan.id));
    const context = {
      countryId: country.id,
      month,
      applications: [],
      bankStatements: [],
      traces: [],
      capCalls: []
    };
    originateContext = context;

    const originalEntityStatement = world.accounting.entityStatement.bind(world.accounting);
    const originalCap = banking.capByBankCapital.bind(banking);
    const descriptor = Object.getOwnPropertyDescriptor(bank, 'lastTrace');
    let traceBacking = bank.lastTrace;

    world.accounting.entityStatement = (entityId, statementMonth) => {
      const statement = originalEntityStatement(entityId, statementMonth);
      if (originateContext === context && entityId === bank.id) {
        context.bankStatements.push({
          assets: finite(statement.balanceSheet?.assets),
          equity: finite(statement.balanceSheet?.equity),
          liabilities: finite(statement.balanceSheet?.liabilities)
        });
      }
      return statement;
    };

    banking.capByBankCapital = (bankArg, bankStatement, requested) => {
      const capped = originalCap(bankArg, bankStatement, requested);
      context.capCalls.push({
        applicationIndex: Math.max(0, context.bankStatements.length - 1),
        requested: finite(requested),
        capped: finite(capped)
      });
      return capped;
    };

    Object.defineProperty(bank, 'lastTrace', {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get() { return traceBacking; },
      set(value) {
        traceBacking = value;
        if (originateContext === context) context.traces.push(compactTrace(value));
      }
    });

    let result;
    try {
      result = originalOriginate(country, month, signals);
    } finally {
      world.accounting.entityStatement = originalEntityStatement;
      banking.capByBankCapital = originalCap;
      if (descriptor) Object.defineProperty(bank, 'lastTrace', { ...descriptor, value: traceBacking });
      else {
        delete bank.lastTrace;
        bank.lastTrace = traceBacking;
      }
      originateContext = null;
    }

    assert.equal(context.applications.length, context.bankStatements.length, `${country.id} M${month}: one bank statement per credit application required`);
    assert.equal(context.applications.length, context.traces.length, `${country.id} M${month}: one decision trace per credit application required`);

    const newLoans = (country.loans || []).filter(loan => !priorLoanIds.has(loan.id));
    const approvedByBorrower = new Map();
    for (const loan of newLoans) {
      if (!approvedByBorrower.has(loan.borrowerId)) approvedByBorrower.set(loan.borrowerId, []);
      approvedByBorrower.get(loan.borrowerId).push(loan);
    }
    const capByIndex = new Map(context.capCalls.map(call => [call.applicationIndex, call]));

    for (let i = 0; i < context.applications.length; i++) {
      const app = context.applications[i];
      const bankState = context.bankStatements[i];
      const trace = context.traces[i];
      const approvedLoan = (approvedByBorrower.get(app.borrowerId) || []).shift() || null;
      const capCall = capByIndex.get(i) || null;
      const minCapitalRatio = finite(bank.minCapitalRatio);
      const projectedCapitalRatioFormula = (bankState.assets + app.requestedAmount) > EPS
        ? bankState.equity / (bankState.assets + app.requestedAmount)
        : 1;
      const capitalCapacityBefore = Math.max(0, bankState.equity / Math.max(0.01, minCapitalRatio) - Math.max(0, bankState.assets));
      const capitalUnsafeByFormula = projectedCapitalRatioFormula < minCapitalRatio - 1e-12;
      const actualApproved = Boolean(approvedLoan);
      const selectedApproved = trace.selected === '대출 승인';

      assert.equal(Boolean(trace.capitalSafe), !capitalUnsafeByFormula, `${country.id} M${month} app ${i}: capital-safety formula must match decision trace`);
      assert.equal(Boolean(capCall), selectedApproved, `${country.id} M${month} app ${i}: capital-cap call must match approved decision trace`);
      if (actualApproved) assert.ok(selectedApproved, `${country.id} M${month} app ${i}: originated loan requires approved decision`);

      applicationEvents.push({
        month,
        countryId: country.id,
        index: i,
        ...app,
        bankState,
        minCapitalRatio,
        projectedCapitalRatioFormula,
        capitalCapacityBefore,
        capitalUnsafeByFormula,
        trace,
        selectedApproved,
        capRequested: finite(capCall?.requested),
        capAmount: finite(capCall?.capped),
        postDecisionCapitalCapRejected: selectedApproved && finite(capCall?.capped) <= EPS,
        actualApproved,
        approvedAmount: finite(approvedLoan?.originalPrincipal),
        actualAnnualRate: finite(approvedLoan?.annualRate),
        actualEstimatedDefaultProbability: finite(approvedLoan?.estimatedDefaultProbabilityAtOrigination)
      });
    }

    return result;
  };

  banking.serviceDebt = (country, month) => {
    const borrowerMap = new Map([
      ...(country.households || []).map(x => [x.id, x]),
      ...(country.firms || []).map(x => [x.id, x])
    ]);
    const due = (country.loans || [])
      .filter(loan => loan.status === 'active' && month >= loan.nextPaymentMonth)
      .map(loan => ({
        loanId: loan.id,
        borrowerId: loan.borrowerId,
        borrowerKind: loan.borrowerKind,
        outstanding: finite(loan.outstanding),
        originalPrincipal: finite(loan.originalPrincipal),
        monthlyRate: finite(loan.monthlyRate),
        termMonths: Math.max(1, finite(loan.termMonths, 1)),
        arrears: finite(loan.arrears),
        missedPayments: finite(loan.missedPayments),
        borrowerCreditMisses: finite(borrowerMap.get(loan.borrowerId)?.creditMisses)
      }));

    const result = originalServiceDebt(country, month);
    const payments = world.ledger.entriesFor({ month, countryId: country.id, kind: 'bank_loan_payment' });
    const paymentByLoan = new Map();
    for (const entry of payments) {
      if (entry.meta?.loanId) paymentByLoan.set(entry.meta.loanId, (paymentByLoan.get(entry.meta.loanId) || 0) + finite(entry.amount));
    }
    const loanById = new Map((country.loans || []).map(loan => [loan.id, loan]));

    for (const pre of due) {
      const post = loanById.get(pre.loanId);
      const borrower = borrowerMap.get(pre.borrowerId);
      const scheduledPrincipal = Math.min(pre.outstanding, pre.originalPrincipal / pre.termMonths);
      const interestDue = pre.outstanding * pre.monthlyRate;
      const requestedCatchUp = Math.min(pre.arrears, scheduledPrincipal * 0.5);
      const totalDue = Math.min(pre.outstanding + interestDue, scheduledPrincipal + interestDue + requestedCatchUp);
      const paid = paymentByLoan.get(pre.loanId) || 0;
      debtEvents.push({
        month,
        countryId: country.id,
        loanId: pre.loanId,
        borrowerId: pre.borrowerId,
        borrowerKind: pre.borrowerKind,
        totalDue,
        paid,
        paymentCoverage: ratio(paid, totalDue),
        preArrears: pre.arrears,
        postArrears: finite(post?.arrears),
        preMissedPayments: pre.missedPayments,
        postMissedPayments: finite(post?.missedPayments),
        missedThisMonth: finite(borrower?.creditMisses) > pre.borrowerCreditMisses,
        defaultedThisMonth: post?.status === 'defaulted' && Number(post?.defaultMonth) === Number(month),
        repaidThisMonth: post?.status === 'repaid',
        postStatus: post?.status || 'missing'
      });
    }
    return result;
  };
}

function summarizeApplications(events) {
  const count = predicate => events.filter(predicate).length;
  const requested = sum(events.map(event => event.requestedAmount));
  const approvedAmount = sum(events.map(event => event.approvedAmount));
  const rejected = events.filter(event => !event.actualApproved);
  const reasons = {};
  for (const event of rejected) reasons[event.trace.reason || 'unknown'] = (reasons[event.trace.reason || 'unknown'] || 0) + 1;
  return {
    applications: events.length,
    requested,
    actualApprovals: count(event => event.actualApproved),
    actualRejections: rejected.length,
    approvalRate: ratio(count(event => event.actualApproved), events.length),
    approvedAmount,
    creditCoverage: ratio(approvedAmount, requested),
    firmApplications: count(event => event.borrowerKind === 'firm'),
    householdApplications: count(event => event.borrowerKind === 'household'),
    capitalUnsafeApplications: count(event => event.capitalUnsafeByFormula),
    capitalUnsafeRejections: count(event => !event.actualApproved && event.capitalUnsafeByFormula),
    capitalSafeRejections: count(event => !event.actualApproved && !event.capitalUnsafeByFormula),
    unaffordableRejections: count(event => !event.actualApproved && !event.trace.affordable),
    riskLimitRejections: count(event => !event.actualApproved && event.trace.affordable && event.trace.capitalSafe && !event.trace.riskAcceptable),
    counterfactualRejections: count(event => !event.actualApproved && event.trace.affordable && event.trace.capitalSafe && event.trace.riskAcceptable && event.trace.selected === '대출 거절'),
    selectedApprovals: count(event => event.selectedApproved),
    postDecisionCapitalCapRejected: count(event => event.postDecisionCapitalCapRejected),
    meanEstimatedDefaultProbability: mean(events.map(event => event.trace.estimatedDefaultProbability)),
    meanRiskLimit: mean(events.map(event => event.trace.riskLimit)),
    meanAnnualRate: mean(events.map(event => event.trace.annualRate)),
    meanPaymentBurden: mean(events.map(event => event.trace.paymentBurden)),
    rejectionReasons: reasons
  };
}

function summarizeDebt(events) {
  const count = predicate => events.filter(predicate).length;
  return {
    dueLoans: events.length,
    totalDue: sum(events.map(event => event.totalDue)),
    paid: sum(events.map(event => event.paid)),
    paymentCoverage: ratio(sum(events.map(event => event.paid)), sum(events.map(event => event.totalDue))),
    misses: count(event => event.missedThisMonth),
    defaults: count(event => event.defaultedThisMonth),
    repaid: count(event => event.repaidThisMonth),
    firmDueLoans: count(event => event.borrowerKind === 'firm'),
    firmMisses: count(event => event.borrowerKind === 'firm' && event.missedThisMonth),
    firmDefaults: count(event => event.borrowerKind === 'firm' && event.defaultedThisMonth),
    householdDueLoans: count(event => event.borrowerKind === 'household'),
    householdMisses: count(event => event.borrowerKind === 'household' && event.missedThisMonth),
    householdDefaults: count(event => event.borrowerKind === 'household' && event.defaultedThisMonth)
  };
}

function bankSnapshot(world, country) {
  const bank = country.banks[0];
  const gl = world.accounting.gl;
  const bs = gl.balanceSheet(bank.id);
  const deposits = Math.max(0, finite(gl.naturalBalance(bank.id, 'deposits')));
  const reserves = Math.max(0, finite(gl.naturalBalance(bank.id, 'reserves')));
  const cbBorrowing = Math.max(0, finite(gl.naturalBalance(bank.id, 'central_bank_borrowing')));
  const assets = Math.max(0, finite(bs.assets));
  const equity = finite(bs.equity);
  const capitalRatio = assets > EPS ? Math.max(0, equity) / assets : 1;
  const capitalCapacity = Math.max(0, Math.max(0, equity) / Math.max(0.01, finite(bank.minCapitalRatio)) - assets);
  return {
    assets,
    equity,
    liabilities: finite(bs.liabilities),
    capitalRatio,
    minCapitalRatio: finite(bank.minCapitalRatio),
    capitalCapacity,
    deposits,
    reserves,
    reserveRatio: deposits > EPS ? reserves / deposits : 0,
    centralBankBorrowing: cbBorrowing,
    baseAnnualRate: finite(bank.baseAnnualRate),
    policyRate: finite(bank.policyRate),
    cumulativeChargeOffs: finite(bank.cumulativeChargeOffs),
    defaults: finite(bank.defaults)
  };
}

function runObserved(seed, horizon, collect = true) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const applicationEvents = [];
  const debtEvents = [];
  installFinanceObservers(world, applicationEvents, debtEvents);
  const rows = [];
  let maxCreditStressLagError = 0;
  let maxCreditMetricReconciliationError = 0;

  for (let i = 0; i < horizon; i++) {
    const priorCredit = new Map(world.countries.map(country => [country.id, compactCredit(country.lastCredit || {})]));
    const priorApplicationCount = applicationEvents.length;
    const priorDebtCount = debtEvents.length;
    world.stepMonth();

    if (!collect) continue;
    for (const country of world.countries) {
      const apps = applicationEvents.slice(priorApplicationCount).filter(event => event.countryId === country.id && event.month === world.month);
      const debts = debtEvents.slice(priorDebtCount).filter(event => event.countryId === country.id && event.month === world.month);
      const applicationSummary = summarizeApplications(apps);
      const debtSummary = summarizeDebt(debts);
      const currentCredit = compactCredit(country.lastCredit || {});
      const prior = priorCredit.get(country.id) || compactCredit({});
      const expectedLaggedStress = creditStressFormula(prior);
      const actualMonetaryStress = finite(country.lastMonetary?.creditStress);
      const lagError = actualMonetaryStress - expectedLaggedStress;
      maxCreditStressLagError = Math.max(maxCreditStressLagError, Math.abs(lagError));

      const creditMetricErrors = {
        applications: currentCredit.applications - applicationSummary.applications,
        approved: currentCredit.approved - applicationSummary.actualApprovals,
        rejected: currentCredit.rejected - applicationSummary.actualRejections,
        newCredit: currentCredit.newCredit - applicationSummary.approvedAmount,
        payments: currentCredit.payments - debts.filter(event => event.paid > EPS).length,
        missedPayments: currentCredit.missedPayments - debtSummary.misses,
        defaults: currentCredit.defaults - debtSummary.defaults
      };
      maxCreditMetricReconciliationError = Math.max(maxCreditMetricReconciliationError, ...Object.values(creditMetricErrors).map(Math.abs));

      rows.push({
        seed,
        month: world.month,
        countryId: country.id,
        economy: {
          unemployment: finite(country.macro?.unemployment),
          consumption: finite(country.macro?.consumption),
          nominalSales: finite(country.macro?.nominalSales),
          activeFirms: (country.firms || []).filter(firm => firm.active !== false).length,
          totalFirms: (country.firms || []).length
        },
        applications: applicationSummary,
        debt: debtSummary,
        bank: bankSnapshot(world, country),
        monetary: {
          policyRate: finite(country.lastMonetary?.policyRate),
          stance: country.lastMonetary?.stance || null,
          creditStress: actualMonetaryStress,
          bankStress: finite(country.lastMonetary?.bankStress),
          openMarketPurchases: finite(country.lastMonetary?.openMarketPurchases),
          openMarketSales: finite(country.lastMonetary?.openMarketSales),
          centralBankLending: finite(country.lastMonetary?.centralBankLending),
          outstandingFacilities: finite(country.lastMonetary?.outstandingFacilities),
          bankReserveRatio: finite(country.lastMonetary?.bankReserveRatio),
          reserveTargetRatio: finite(country.lastMonetary?.reserveTargetRatio)
        },
        credit: currentCredit,
        priorCredit: prior,
        expectedLaggedCreditStress: expectedLaggedStress,
        currentCreditImpliedNextStress: creditStressFormula(currentCredit),
        creditStressLagError: lagError,
        creditMetricErrors
      });
    }
  }

  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  if (!collect) return { world, fingerprint: stateFingerprint(world) };
  assert.equal(rows.length, horizon * world.countries.length, `${seed}: complete country-month coverage required`);
  assert.ok(maxCreditStressLagError <= 1e-12, `${seed}: monetary creditStress must equal previous lastCredit formula`);
  assert.ok(maxCreditMetricReconciliationError <= 1e-7, `${seed}: observer credit events must reconcile with lastCredit metrics`);
  return {
    seed,
    health,
    rows,
    applicationEvents,
    debtEvents,
    reconciliation: { maxCreditStressLagError, maxCreditMetricReconciliationError },
    scale: world.scaleReport()
  };
}

function runPlain(seed, horizon) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  for (let i = 0; i < horizon; i++) world.stepMonth();
  return stateFingerprint(world);
}

const nonInterferenceSeed = 'ECON-RV06-NONINTERFERENCE';
const nonInterferenceMonths = Math.min(3, months);
const controlFingerprint = runPlain(nonInterferenceSeed, nonInterferenceMonths);
const observedFingerprint = runObserved(nonInterferenceSeed, nonInterferenceMonths, false).fingerprint;
assert.deepStrictEqual(observedFingerprint, controlFingerprint, 'WP-RV06 observers must not change RNG, economy, accounting, cognition or settlement state');

const runs = seeds.map(seed => runObserved(seed, months, true));
const rows = runs.flatMap(run => run.rows);
const applicationEvents = runs.flatMap(run => run.applicationEvents);
const debtEvents = runs.flatMap(run => run.debtEvents);

for (const countryId of [...new Set(rows.map(row => row.countryId))]) {
  for (const seed of seeds) {
    const path = rows.filter(row => row.seed === seed && row.countryId === countryId).sort((a, b) => a.month - b.month);
    for (let i = 1; i < path.length; i++) {
      assert.ok(Math.abs(path[i].monetary.creditStress - path[i - 1].currentCreditImpliedNextStress) <= 1e-12,
        `${seed} ${countryId} M${path[i].month}: one-month creditStress propagation must reconcile`);
    }
  }
}

function summarizeRows(windowRows) {
  const apps = applicationEvents.filter(event => windowRows.some(row => row.seed === event.seed && row.month === event.month && row.countryId === event.countryId));
  // applicationEvents receive seed below after each run, so use row-level summaries for stable aggregation.
  const totalApplications = sum(windowRows.map(row => row.applications.applications));
  const totalApprovals = sum(windowRows.map(row => row.applications.actualApprovals));
  const totalRequested = sum(windowRows.map(row => row.applications.requested));
  const totalApprovedAmount = sum(windowRows.map(row => row.applications.approvedAmount));
  const totalDue = sum(windowRows.map(row => row.debt.totalDue));
  const totalPaid = sum(windowRows.map(row => row.debt.paid));
  return {
    countryMonths: windowRows.length,
    applications: totalApplications,
    approvals: totalApprovals,
    rejections: sum(windowRows.map(row => row.applications.actualRejections)),
    approvalRate: ratio(totalApprovals, totalApplications),
    requestedCredit: totalRequested,
    newCredit: totalApprovedAmount,
    creditAmountCoverage: ratio(totalApprovedAmount, totalRequested),
    capitalUnsafeApplications: sum(windowRows.map(row => row.applications.capitalUnsafeApplications)),
    capitalUnsafeRejections: sum(windowRows.map(row => row.applications.capitalUnsafeRejections)),
    capitalSafeRejections: sum(windowRows.map(row => row.applications.capitalSafeRejections)),
    unaffordableRejections: sum(windowRows.map(row => row.applications.unaffordableRejections)),
    riskLimitRejections: sum(windowRows.map(row => row.applications.riskLimitRejections)),
    counterfactualRejections: sum(windowRows.map(row => row.applications.counterfactualRejections)),
    postDecisionCapitalCapRejected: sum(windowRows.map(row => row.applications.postDecisionCapitalCapRejected)),
    debtDue: totalDue,
    debtPaid: totalPaid,
    debtPaymentCoverage: ratio(totalPaid, totalDue),
    debtMisses: sum(windowRows.map(row => row.debt.misses)),
    defaults: sum(windowRows.map(row => row.debt.defaults)),
    chargeOffs: sum(windowRows.map(row => row.credit.chargeOffs)),
    meanCreditStress: mean(windowRows.map(row => row.monetary.creditStress)),
    meanBankStress: mean(windowRows.map(row => row.monetary.bankStress)),
    meanCapitalRatio: mean(windowRows.map(row => row.bank.capitalRatio)),
    minCapitalRatioObserved: windowRows.length ? Math.min(...windowRows.map(row => row.bank.capitalRatio)) : 0,
    meanCapitalCapacity: mean(windowRows.map(row => row.bank.capitalCapacity)),
    meanReserveRatio: mean(windowRows.map(row => row.bank.reserveRatio)),
    totalOpenMarketPurchases: sum(windowRows.map(row => row.monetary.openMarketPurchases)),
    totalCentralBankLending: sum(windowRows.map(row => row.monetary.centralBankLending)),
    meanUnemployment: mean(windowRows.map(row => row.economy.unemployment)),
    totalConsumption: sum(windowRows.map(row => row.economy.consumption)),
    totalNominalSales: sum(windowRows.map(row => row.economy.nominalSales))
  };
}

// Add seed labels to compact events after run collection; no model state is touched.
for (const run of runs) {
  for (const event of run.applicationEvents) event.seed = run.seed;
  for (const event of run.debtEvents) event.seed = run.seed;
}

const reasonCounts = {};
for (const event of applicationEvents.filter(event => !event.actualApproved)) {
  const reason = event.trace.reason || 'unknown';
  reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
}

function firstMonth(path, predicate) {
  return path.find(predicate)?.month ?? null;
}

const paths = [];
for (const seed of seeds) {
  for (const countryId of [...new Set(rows.map(row => row.countryId))].sort()) {
    const path = rows.filter(row => row.seed === seed && row.countryId === countryId).sort((a, b) => a.month - b.month);
    paths.push({
      seed,
      countryId,
      firstApplicationMonth: firstMonth(path, row => row.applications.applications > 0),
      firstRejectionRateAbove50Month: firstMonth(path, row => row.applications.applications > 0 && ratio(row.applications.actualRejections, row.applications.applications) > 0.5),
      firstZeroApprovalMonth: firstMonth(path, row => row.applications.applications > 0 && row.applications.actualApprovals === 0),
      firstDebtMissMonth: firstMonth(path, row => row.debt.misses > 0),
      firstDefaultMonth: firstMonth(path, row => row.debt.defaults > 0),
      firstCreditStress50Month: firstMonth(path, row => row.monetary.creditStress >= 0.5),
      firstBankStress50Month: firstMonth(path, row => row.monetary.bankStress >= 0.5),
      firstUnemployment25Month: firstMonth(path, row => row.economy.unemployment >= 0.25),
      firstUnemployment50Month: firstMonth(path, row => row.economy.unemployment >= 0.5),
      terminal: path.at(-1)
    });
  }
}

const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv06-finance-credit-transmission-diagnosis',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  methodology: {
    mechanismChanges: 0,
    parameterTuning: 0,
    observerNonInterference: { seed: nonInterferenceSeed, months: nonInterferenceMonths, exact: true },
    creditStressLag: 'Central-bank creditStress at month t is tested against the exact formula applied to country.lastCredit from month t-1.',
    rejectionAttribution: 'Per-application decision traces are copied from the bank.lastTrace assignment; bank capital state is captured at the exact application evaluation boundary. No credit decision is rerun.',
    caution: 'Association/timing is diagnostic evidence. No causal repair or empirical calibration is inferred from this panel alone.'
  },
  runs: runs.map(run => ({ seed: run.seed, health: run.health, rows: run.rows, reconciliation: run.reconciliation, scale: run.scale })),
  applicationEvents,
  debtEvents,
  windows: {
    months1to3: summarizeRows(rows.filter(row => row.month <= 3)),
    months4to6: summarizeRows(rows.filter(row => row.month >= 4 && row.month <= 6)),
    months7to9: summarizeRows(rows.filter(row => row.month >= 7 && row.month <= 9)),
    months10to12: summarizeRows(rows.filter(row => row.month >= 10)),
    full: summarizeRows(rows)
  },
  rejectionReasonCounts: reasonCounts,
  paths,
  gates: {
    observerNonInterferenceExact: true,
    allHealthy: runs.every(run => run.health.ok),
    completeCountryMonthCoverage: rows.length === seeds.length * months * 4,
    creditStressLagReconciled: runs.every(run => run.reconciliation.maxCreditStressLagError <= 1e-12),
    creditEventsReconciled: runs.every(run => run.reconciliation.maxCreditMetricReconciliationError <= 1e-7),
    allApplicationsHaveDecisionTrace: applicationEvents.every(event => event.trace?.selected),
    capitalFormulaMatchesTrace: applicationEvents.every(event => Boolean(event.trace.capitalSafe) === !event.capitalUnsafeByFormula),
    noUnexplainedPostDecisionCapitalFailure: applicationEvents.every(event => !event.postDecisionCapitalCapRejected)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV06 finance transmission gates must pass');

console.table(Object.entries(report.windows).map(([window, value]) => ({
  window,
  applications: value.applications,
  approvalRate: Number(value.approvalRate.toFixed(4)),
  creditCoverage: Number(value.creditAmountCoverage.toFixed(4)),
  capitalUnsafeRejects: value.capitalUnsafeRejections,
  capitalSafeRejects: value.capitalSafeRejections,
  riskRejects: value.riskLimitRejections,
  counterfactualRejects: value.counterfactualRejections,
  debtMisses: value.debtMisses,
  defaults: value.defaults,
  meanCreditStress: Number(value.meanCreditStress.toFixed(4)),
  meanBankStress: Number(value.meanBankStress.toFixed(4)),
  meanUnemployment: Number(value.meanUnemployment.toFixed(4))
})));
console.log('WP_RV06_REJECTION_REASONS', JSON.stringify(report.rejectionReasonCounts));
console.log('WP_RV06_GATES', JSON.stringify(report.gates));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV06_JSON ${outputJson}`);
}

console.log('Economic Lab WP-RV06 finance / credit transmission diagnosis PASS');
