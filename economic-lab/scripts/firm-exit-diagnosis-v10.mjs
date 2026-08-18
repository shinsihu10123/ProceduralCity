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

function key(month, countryId, firmId) {
  return `${month}:${countryId}:${firmId}`;
}

function installCreditObserver(world, creditEvents) {
  const original = world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit = (country, month, signals) => {
    const applications = world.banking.buildApplications(country)
      .filter(app => app.kind === 'firm')
      .map(app => ({ firmId: app.borrower.id, requestedAmount: finite(app.amount), termMonths: finite(app.termMonths) }));
    const priorLoanIds = new Set((country.loans || []).map(loan => loan.id));
    const result = original(country, month, signals);
    const newLoans = (country.loans || []).filter(loan => !priorLoanIds.has(loan.id) && loan.borrowerKind === 'firm');
    const approved = new Map();
    for (const loan of newLoans) approved.set(loan.borrowerId, (approved.get(loan.borrowerId) || 0) + finite(loan.originalPrincipal));
    for (const app of applications) {
      const approvedAmount = approved.get(app.firmId) || 0;
      creditEvents.push({
        month,
        countryId: country.id,
        firmId: app.firmId,
        requestedAmount: app.requestedAmount,
        approvedAmount,
        rejected: approvedAmount <= EPS,
        approvalRatio: ratio(approvedAmount, app.requestedAmount)
      });
    }
    return result;
  };
}

function installDebtObserver(world, debtEvents) {
  const original = world.banking.serviceDebt.bind(world.banking);
  world.banking.serviceDebt = (country, month) => {
    const firmById = new Map((country.firms || []).map(firm => [firm.id, firm]));
    const due = (country.loans || [])
      .filter(loan => loan.borrowerKind === 'firm' && loan.status === 'active' && month >= loan.nextPaymentMonth)
      .map(loan => ({
        loanId: loan.id,
        firmId: loan.borrowerId,
        outstanding: finite(loan.outstanding),
        originalPrincipal: finite(loan.originalPrincipal),
        monthlyRate: finite(loan.monthlyRate),
        termMonths: Math.max(1, finite(loan.termMonths, 1)),
        arrears: finite(loan.arrears),
        missedPayments: finite(loan.missedPayments),
        borrowerCreditMisses: finite(firmById.get(loan.borrowerId)?.creditMisses)
      }));
    const result = original(country, month);
    const paymentEntries = world.ledger.entriesFor({ month, countryId: country.id, kind: 'bank_loan_payment' });
    const paymentByLoan = new Map();
    for (const entry of paymentEntries) {
      const loanId = entry.meta?.loanId;
      if (loanId) paymentByLoan.set(loanId, (paymentByLoan.get(loanId) || 0) + finite(entry.amount));
    }
    const loanById = new Map((country.loans || []).map(loan => [loan.id, loan]));
    for (const pre of due) {
      const post = loanById.get(pre.loanId);
      const firm = firmById.get(pre.firmId);
      const scheduledPrincipal = Math.min(pre.outstanding, pre.originalPrincipal / pre.termMonths);
      const interestDue = pre.outstanding * pre.monthlyRate;
      const requestedCatchUp = Math.min(pre.arrears, scheduledPrincipal * 0.5);
      const totalDue = Math.min(pre.outstanding + interestDue, scheduledPrincipal + interestDue + requestedCatchUp);
      const paymentAmount = paymentByLoan.get(pre.loanId) || 0;
      debtEvents.push({
        month,
        countryId: country.id,
        firmId: pre.firmId,
        loanId: pre.loanId,
        totalDue,
        interestDue,
        paymentAmount,
        paymentCoverage: ratio(paymentAmount, totalDue),
        preArrears: pre.arrears,
        postArrears: finite(post?.arrears),
        preMissedPayments: pre.missedPayments,
        postMissedPayments: finite(post?.missedPayments),
        borrowerCreditMissesBefore: pre.borrowerCreditMisses,
        borrowerCreditMissesAfter: finite(firm?.creditMisses),
        missedThisMonth: finite(firm?.creditMisses) > pre.borrowerCreditMisses,
        defaultedThisMonth: post?.status === 'defaulted' && post?.defaultMonth === month,
        repaidThisMonth: post?.status === 'repaid',
        postStatus: post?.status || 'missing'
      });
    }
    return result;
  };
}

function aggregateDebtForFirm(debtEvents, month, countryId, firmId) {
  const rows = debtEvents.filter(event => event.month === month && event.countryId === countryId && event.firmId === firmId);
  return {
    dueLoans: rows.length,
    totalDue: sum(rows.map(row => row.totalDue)),
    interestDue: sum(rows.map(row => row.interestDue)),
    paymentAmount: sum(rows.map(row => row.paymentAmount)),
    missedPayments: rows.filter(row => row.missedThisMonth).length,
    defaults: rows.filter(row => row.defaultedThisMonth).length,
    arrearsAfter: sum(rows.map(row => row.postArrears)),
    maxLoanMissedPayments: rows.length ? Math.max(...rows.map(row => row.postMissedPayments)) : 0
  };
}

function aggregateCreditForFirm(creditEvents, month, countryId, firmId) {
  const rows = creditEvents.filter(event => event.month === month && event.countryId === countryId && event.firmId === firmId);
  return {
    applications: rows.length,
    requestedAmount: sum(rows.map(row => row.requestedAmount)),
    approvedAmount: sum(rows.map(row => row.approvedAmount)),
    rejections: rows.filter(row => row.rejected).length
  };
}

function installExitObserver(world, creditEvents, debtEvents, evaluations) {
  const original = world.supply.evaluateExits.bind(world.supply);
  world.supply.evaluateExits = country => {
    const before = [];
    for (const firm of country.firms || []) {
      if (firm.active === false) continue;
      const cash = finite(world.ledger.balance(firm.accountId));
      const workers = finite(firm.workers);
      const payrollObligation = finite(firm.wage) * Math.max(1, workers);
      const wageArrears = finite(firm.wageArrears);
      const severePayrollStress = wageArrears > Math.max(100, payrollObligation * 1.35);
      const severeCreditStress = finite(firm.creditMisses) >= 5;
      const liquidityFailure = cash < finite(firm.safeCash) * 0.025 && severePayrollStress;
      const directFailure = liquidityFailure || severeCreditStress;
      const distressBefore = finite(firm.distressMonths);
      const expectedDistressAfter = directFailure ? distressBefore + 1 : Math.max(0, distressBefore - 1);
      const planPerception = firm.currentPlan?.trace?.perception || {};
      const loanRows = (country.loans || []).filter(loan => loan.borrowerKind === 'firm' && loan.borrowerId === firm.id && loan.status === 'active');
      const debt = aggregateDebtForFirm(debtEvents, world.month, country.id, firm.id);
      const credit = aggregateCreditForFirm(creditEvents, world.month, country.id, firm.id);
      before.push({
        month: world.month,
        countryId: country.id,
        firmId: firm.id,
        industryId: firm.industryId,
        workers,
        desiredWorkers: finite(firm.desiredWorkers),
        wage: finite(firm.wage),
        payrollObligation,
        wageArrears,
        wageArrearsToPayroll: ratio(wageArrears, payrollObligation),
        cash,
        safeCash: finite(firm.safeCash),
        cashToSafeCash: ratio(cash, firm.safeCash),
        revenue: finite(firm.revenue),
        sales: finite(firm.sales),
        output: finite(firm.output),
        price: finite(firm.price),
        inventory: finite(firm.inventory),
        targetInventory: finite(firm.targetInventory),
        inventoryToTarget: ratio(firm.inventory, firm.targetInventory),
        inputShortage: finite(firm.supplyShortage),
        desiredProduction: finite(firm.desiredProduction),
        inputShortageToDesiredProduction: ratio(firm.supplyShortage, firm.desiredProduction),
        loanBalance: finite(firm.loanBalance),
        activeLoanOutstanding: sum(loanRows.map(loan => loan.outstanding)),
        activeLoanArrears: sum(loanRows.map(loan => loan.arrears)),
        activeLoanCount: loanRows.length,
        creditMisses: finite(firm.creditMisses),
        expectedDemandGrowth: finite(planPerception.expectedDemandGrowth),
        cashStress: finite(planPerception.cashStress),
        inventoryPressure: finite(planPerception.inventoryPressure),
        supplyStress: finite(planPerception.supplyStress),
        debtBurden: finite(planPerception.debtBurden),
        plan: String(firm.currentPlan?.selected || firm.currentPlan?.name || 'unknown'),
        hiringChange: finite(firm.currentPlan?.hiringChange),
        productionChange: finite(firm.currentPlan?.productionChange),
        distressBefore,
        directFailure,
        liquidityFailure,
        severePayrollStress,
        severeCreditStress,
        expectedDistressAfter,
        credit,
        debt
      });
    }

    const exitedIndustries = original(country);
    const current = new Map((country.firms || []).map(firm => [firm.id, firm]));
    for (const row of before) {
      const firm = current.get(row.firmId);
      const exited = firm?.active === false;
      evaluations.push({
        ...row,
        distressAfter: finite(firm?.distressMonths),
        exited,
        exitCause: exited
          ? row.liquidityFailure && row.severeCreditStress
            ? 'BOTH'
            : row.liquidityFailure
              ? 'LIQUIDITY_PAYROLL'
              : row.severeCreditStress
                ? 'SEVERE_CREDIT'
                : 'UNEXPLAINED'
          : null
      });
    }
    return exitedIndustries;
  };
}

function enrichRevenueChanges(evaluations) {
  const lastByFirm = new Map();
  for (const row of evaluations.sort((a, b) => a.month - b.month || a.countryId.localeCompare(b.countryId) || a.firmId.localeCompare(b.firmId))) {
    const k = `${row.countryId}:${row.firmId}`;
    const previous = lastByFirm.get(k);
    row.previousRevenue = previous ? previous.revenue : null;
    row.revenueGrowth = previous && previous.revenue > EPS ? row.revenue / previous.revenue - 1 : null;
    row.revenueDeclined = previous ? row.revenue < previous.revenue - EPS : false;
    lastByFirm.set(k, row);
  }
  return evaluations;
}

function buildExitWindows(evaluations) {
  const byFirm = new Map();
  for (const row of evaluations) {
    const k = `${row.countryId}:${row.firmId}`;
    if (!byFirm.has(k)) byFirm.set(k, []);
    byFirm.get(k).push(row);
  }
  const windows = [];
  for (const row of evaluations.filter(row => row.exited)) {
    const history = (byFirm.get(`${row.countryId}:${row.firmId}`) || [])
      .filter(x => x.month <= row.month && x.month >= row.month - 3)
      .sort((a, b) => a.month - b.month);
    windows.push({
      seed: row.seed,
      month: row.month,
      countryId: row.countryId,
      firmId: row.firmId,
      industryId: row.industryId,
      exitCause: row.exitCause,
      direct: {
        liquidityFailure: row.liquidityFailure,
        severePayrollStress: row.severePayrollStress,
        severeCreditStress: row.severeCreditStress,
        distressBefore: row.distressBefore,
        distressAfter: row.distressAfter
      },
      history,
      antecedents: {
        monthsObserved: history.length,
        negativeExpectedDemandMonths: history.filter(x => x.expectedDemandGrowth < 0).length,
        revenueDeclineMonths: history.filter(x => x.revenueDeclined).length,
        cashBelowSafeMonths: history.filter(x => x.cash < x.safeCash).length,
        nearDirectLiquidityThresholdMonths: history.filter(x => x.cash < x.safeCash * 0.10).length,
        wageArrearsMonths: history.filter(x => x.wageArrears > EPS).length,
        severePayrollStressMonths: history.filter(x => x.severePayrollStress).length,
        inventoryAboveTargetMonths: history.filter(x => x.inventory > x.targetInventory + EPS).length,
        inputShortageMonths: history.filter(x => x.inputShortage > EPS).length,
        creditApplications: sum(history.map(x => x.credit.applications)),
        creditRejections: sum(history.map(x => x.credit.rejections)),
        debtServiceDueLoans: sum(history.map(x => x.debt.dueLoans)),
        debtServiceMisses: sum(history.map(x => x.debt.missedPayments)),
        loanDefaults: sum(history.map(x => x.debt.defaults)),
        monthsWithCreditMisses: history.filter(x => x.creditMisses > 0).length,
        meanInterestDueToRevenue: mean(history.map(x => ratio(x.debt.interestDue, x.revenue))),
        meanWageArrearsToPayroll: mean(history.map(x => x.wageArrearsToPayroll)),
        meanCashToSafeCash: mean(history.map(x => x.cashToSafeCash)),
        meanInventoryToTarget: mean(history.map(x => x.inventoryToTarget)),
        meanInputShortageToDesiredProduction: mean(history.map(x => x.inputShortageToDesiredProduction))
      }
    });
  }
  return windows;
}

function summarizeWindows(windows) {
  const exits = windows.length;
  const count = predicate => windows.filter(predicate).length;
  const direct = {
    LIQUIDITY_PAYROLL: count(w => w.exitCause === 'LIQUIDITY_PAYROLL'),
    SEVERE_CREDIT: count(w => w.exitCause === 'SEVERE_CREDIT'),
    BOTH: count(w => w.exitCause === 'BOTH'),
    UNEXPLAINED: count(w => w.exitCause === 'UNEXPLAINED')
  };
  return {
    exits,
    direct,
    directShares: Object.fromEntries(Object.entries(direct).map(([k, v]) => [k, ratio(v, exits)])),
    antecedentPrevalence: {
      negativeExpectedDemand: ratio(count(w => w.antecedents.negativeExpectedDemandMonths > 0), exits),
      revenueDecline: ratio(count(w => w.antecedents.revenueDeclineMonths > 0), exits),
      cashBelowSafe: ratio(count(w => w.antecedents.cashBelowSafeMonths > 0), exits),
      nearDirectLiquidityThreshold: ratio(count(w => w.antecedents.nearDirectLiquidityThresholdMonths > 0), exits),
      wageArrears: ratio(count(w => w.antecedents.wageArrearsMonths > 0), exits),
      severePayrollStress: ratio(count(w => w.antecedents.severePayrollStressMonths > 0), exits),
      inventoryAboveTarget: ratio(count(w => w.antecedents.inventoryAboveTargetMonths > 0), exits),
      inputShortage: ratio(count(w => w.antecedents.inputShortageMonths > 0), exits),
      creditApplication: ratio(count(w => w.antecedents.creditApplications > 0), exits),
      creditRejection: ratio(count(w => w.antecedents.creditRejections > 0), exits),
      debtServiceMiss: ratio(count(w => w.antecedents.debtServiceMisses > 0), exits),
      loanDefault: ratio(count(w => w.antecedents.loanDefaults > 0), exits),
      creditMissState: ratio(count(w => w.antecedents.monthsWithCreditMisses > 0), exits)
    },
    means: {
      observedWindowMonths: mean(windows.map(w => w.antecedents.monthsObserved)),
      negativeExpectedDemandMonths: mean(windows.map(w => w.antecedents.negativeExpectedDemandMonths)),
      revenueDeclineMonths: mean(windows.map(w => w.antecedents.revenueDeclineMonths)),
      cashBelowSafeMonths: mean(windows.map(w => w.antecedents.cashBelowSafeMonths)),
      wageArrearsMonths: mean(windows.map(w => w.antecedents.wageArrearsMonths)),
      creditRejections: mean(windows.map(w => w.antecedents.creditRejections)),
      debtServiceMisses: mean(windows.map(w => w.antecedents.debtServiceMisses)),
      interestDueToRevenue: mean(windows.map(w => w.antecedents.meanInterestDueToRevenue)),
      wageArrearsToPayroll: mean(windows.map(w => w.antecedents.meanWageArrearsToPayroll)),
      cashToSafeCash: mean(windows.map(w => w.antecedents.meanCashToSafeCash)),
      inventoryToTarget: mean(windows.map(w => w.antecedents.meanInventoryToTarget)),
      inputShortageToDesiredProduction: mean(windows.map(w => w.antecedents.meanInputShortageToDesiredProduction))
    }
  };
}

function runSeed(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const creditEvents = [];
  const debtEvents = [];
  const evaluations = [];
  installCreditObserver(world, creditEvents);
  installDebtObserver(world, debtEvents);
  installExitObserver(world, creditEvents, debtEvents, evaluations);

  for (let i = 0; i < months; i++) world.stepMonth();
  const health = world.forceHealthCheck();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);

  for (const row of evaluations) row.seed = seed;
  enrichRevenueChanges(evaluations);
  const exitRows = evaluations.filter(row => row.exited);
  assert.equal(exitRows.length, sum(world.countries.map(country => country.history.slice(1).reduce((s, row) => s + finite(row.firmExits), 0))), `${seed}: attributed exits must reconcile to macro history`);
  assert.ok(exitRows.every(row => row.exitCause !== 'UNEXPLAINED'), `${seed}: every exit must match a coded direct trigger`);
  assert.ok(exitRows.every(row => row.distressBefore === 3 && row.distressAfter >= 4), `${seed}: exits must occur on the fourth consecutive/retained distress step`);

  const windows = buildExitWindows(evaluations);
  return {
    seed,
    health,
    evaluations,
    creditEvents,
    debtEvents,
    exitWindows: windows,
    summary: summarizeWindows(windows),
    scale: world.scaleReport()
  };
}

const runs = seeds.map(runSeed);
const windows = runs.flatMap(run => run.exitWindows);
const report = {
  schemaVersion: 1,
  kind: 'economic-lab-wp-rv04-firm-distress-exit-attribution',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  runs,
  combined: summarizeWindows(windows),
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    exitsPresent: windows.length > 0,
    allExitsDirectlyAttributed: windows.every(window => window.exitCause !== 'UNEXPLAINED'),
    distressDurationReconciled: windows.every(window => window.direct.distressBefore === 3 && window.direct.distressAfter >= 4),
    completeFourMonthWindowWhenObservable: windows.every(window => window.month < 4 || window.antecedents.monthsObserved === 4)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV04 firm-exit attribution gates must pass');

console.table(runs.map(run => ({
  seed: run.seed,
  exits: run.summary.exits,
  liquidityPayroll: run.summary.direct.LIQUIDITY_PAYROLL,
  severeCredit: run.summary.direct.SEVERE_CREDIT,
  both: run.summary.direct.BOTH,
  wageArrearsPrevalence: run.summary.antecedentPrevalence.wageArrears,
  creditRejectionPrevalence: run.summary.antecedentPrevalence.creditRejection,
  debtMissPrevalence: run.summary.antecedentPrevalence.debtServiceMiss
})));
console.log(JSON.stringify(report, null, 2));
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV04_JSON ${outputJson}`);
}
console.log('Economic Lab WP-RV04 firm distress and exit attribution PASS');
