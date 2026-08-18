import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';
import { RealityDiagnosticRecorder } from '../src/research/reality-diagnostics.js';

const scaleProfile = process.env.DIAG_SCALE || 'baseline';
const months = Math.max(1, Number(process.env.DIAG_MONTHS || 12));
const seedText = process.env.DIAG_SEEDS || 'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C';
const seeds = seedText.split(',').map(seed => seed.trim()).filter(Boolean);
const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, finite(value)));
const sum = values => values.reduce((total, value) => total + finite(value), 0);
const mean = values => values.length ? sum(values) / values.length : 0;
const ratio = (a, b) => Math.abs(finite(b)) > 1e-9 ? finite(a) / finite(b) : 0;

function firmSnapshot(world) {
  const result = new Map();
  for (const country of world.countries || []) {
    result.set(country.id, new Map((country.firms || []).map(firm => [firm.id, {
      active: firm.active !== false,
      workers: finite(firm.workers),
      inventory: finite(firm.inventory),
      consumerFacing: firm.consumerFacing === true
    }])));
  }
  return result;
}

function installExitBoundaryObserver(world) {
  const events = [];
  const original = world.supply.evaluateExits.bind(world.supply);
  world.supply.evaluateExits = country => {
    const before = new Map();
    for (const firm of country.firms || []) {
      if (firm.active === false) continue;
      before.set(firm.id, {
        industryId: firm.industryId,
        workers: finite(firm.workers),
        employedHouseholds: (country.households || []).filter(h => h.employed && h.employerId === firm.id).length,
        distressMonths: finite(firm.distressMonths),
        cash: finite(world.ledger?.balance?.(firm.accountId), finite(firm.cash)),
        safeCash: finite(firm.safeCash),
        wageArrears: finite(firm.wageArrears),
        creditMisses: finite(firm.creditMisses)
      });
    }
    const exitedIndustries = original(country);
    const current = new Map((country.firms || []).map(firm => [firm.id, firm]));
    for (const [firmId, preExit] of before) {
      const firm = current.get(firmId);
      if (!firm || firm.active !== false) continue;
      events.push({
        month: world.month,
        countryId: country.id,
        firmId,
        industryId: preExit.industryId,
        displacedWorkers: preExit.employedHouseholds,
        workersAtExitBoundary: preExit.workers,
        distressMonthsBeforeEvaluation: preExit.distressMonths,
        cashAtExitBoundary: preExit.cash,
        safeCash: preExit.safeCash,
        wageArrears: preExit.wageArrears,
        creditMisses: preExit.creditMisses
      });
    }
    return exitedIndustries;
  };
  return events;
}

function plannedTargetWorkers(preWorkers, plan) {
  return Math.max(0, Math.round(Math.max(1, finite(preWorkers)) * (1 + clamp(plan?.hiringChange, -0.10, 0.12))));
}

function planDiagnostics(country, preFirms) {
  const current = new Map((country.firms || []).map(firm => [firm.id, firm]));
  const values = {
    activeAtStart: 0,
    priorWorkers: 0,
    desiredWorkersBeforeLabor: 0,
    plannedVacancies: 0,
    plannedLayoffSlots: 0,
    plannedLayoffsAtContinuingFirms: 0,
    plannedLayoffsAtExitingFirms: 0,
    positiveHiringPlans: 0,
    negativeHiringPlans: 0,
    zeroHiringPlans: 0,
    expansionPlans: 0,
    defensivePlans: 0,
    cashPreservationPlans: 0,
    priceCompetitionPlans: 0,
    maintainPlans: 0,
    firmsExitingThisMonth: 0
  };
  const hiringChanges = [];
  const expectedDemandGrowth = [];
  const cashStress = [];
  const inventoryPressure = [];
  const supplyStress = [];
  const debtBurden = [];

  for (const [firmId, pre] of preFirms || []) {
    if (!pre.active) continue;
    const firm = current.get(firmId);
    assert.ok(firm, `${country.id}:${firmId}: firm must remain addressable after monthly step`);
    const plan = firm.currentPlan || {};
    const target = plannedTargetWorkers(pre.workers, plan);
    const change = clamp(plan.hiringChange, -0.10, 0.12);
    const plannedLayoffs = Math.max(0, pre.workers - target);
    const exited = firm.active === false;

    values.activeAtStart += 1;
    values.priorWorkers += pre.workers;
    values.desiredWorkersBeforeLabor += target;
    values.plannedVacancies += Math.max(0, target - pre.workers);
    values.plannedLayoffSlots += plannedLayoffs;
    if (exited) {
      values.firmsExitingThisMonth += 1;
      values.plannedLayoffsAtExitingFirms += plannedLayoffs;
    } else {
      values.plannedLayoffsAtContinuingFirms += plannedLayoffs;
    }
    if (change > 1e-12) values.positiveHiringPlans += 1;
    else if (change < -1e-12) values.negativeHiringPlans += 1;
    else values.zeroHiringPlans += 1;
    hiringChanges.push(change);

    const selected = String(plan.selected || plan.name || plan.trace?.selected || 'unknown');
    if (selected === '확장') values.expansionPlans += 1;
    else if (selected === '방어') values.defensivePlans += 1;
    else if (selected === '현금 보존') values.cashPreservationPlans += 1;
    else if (selected === '가격 경쟁') values.priceCompetitionPlans += 1;
    else if (selected === '유지') values.maintainPlans += 1;

    const perception = plan.trace?.perception || {};
    expectedDemandGrowth.push(finite(perception.expectedDemandGrowth));
    cashStress.push(finite(perception.cashStress));
    inventoryPressure.push(finite(perception.inventoryPressure));
    supplyStress.push(finite(perception.supplyStress));
    debtBurden.push(finite(perception.debtBurden));
  }

  return {
    ...values,
    netDesiredWorkerChange: values.desiredWorkersBeforeLabor - values.priorWorkers,
    positiveHiringPlanShare: ratio(values.positiveHiringPlans, values.activeAtStart),
    negativeHiringPlanShare: ratio(values.negativeHiringPlans, values.activeAtStart),
    meanHiringChange: mean(hiringChanges),
    meanExpectedDemandGrowth: mean(expectedDemandGrowth),
    meanCashStress: mean(cashStress),
    meanInventoryPressure: mean(inventoryPressure),
    meanSupplyStress: mean(supplyStress),
    meanDebtBurden: mean(debtBurden)
  };
}

function goodsDiagnostics(country, preFirms) {
  const goods = country.lastMarkets?.goods || {};
  const households = country.households || [];
  const desiredHouseholdBudget = sum(households.map(h => h.desiredConsumptionBudget));
  const disposableIncome = sum(households.map(h => h.disposableIncome));
  const actualConsumption = finite(goods.nominalConsumption, sum(households.map(h => h.consumption)));
  const desiredBudget = finite(goods.desiredBudget);
  const unmetBudget = finite(goods.unmetBudget);
  const activeConsumers = (country.firms || []).filter(firm => firm.active !== false && firm.consumerFacing === true);
  const preConsumers = [...(preFirms || new Map()).values()].filter(firm => firm.active && firm.consumerFacing);
  return {
    disposableIncome,
    desiredHouseholdBudget,
    goodsDesiredBudget: desiredBudget,
    actualConsumption,
    unmetBudget,
    budgetFulfillmentRate: ratio(actualConsumption, desiredBudget),
    unmetBudgetRate: ratio(unmetBudget, desiredBudget),
    desiredBudgetToDisposableIncome: ratio(desiredBudget, disposableIncome),
    desiredBudgetReconciliationError: desiredHouseholdBudget - desiredBudget,
    goodsBudgetIdentityError: desiredBudget - actualConsumption - unmetBudget,
    transactions: finite(goods.transactions),
    units: finite(goods.units),
    preConsumerFirmCount: preConsumers.length,
    activeConsumerFirmCount: activeConsumers.length,
    preConsumerInventory: sum(preConsumers.map(firm => firm.inventory)),
    consumerOutput: sum(activeConsumers.map(firm => firm.output)),
    consumerSalesUnits: sum(activeConsumers.map(firm => firm.consumerSales)),
    consumerRevenue: sum(activeConsumers.map(firm => firm.consumerRevenue)),
    postConsumerInventory: sum(activeConsumers.map(firm => firm.inventory)),
    sellersWithPostInventory: activeConsumers.filter(firm => finite(firm.inventory) > 1e-8).length
  };
}

function aggregateMonthly(rows) {
  return [...new Set(rows.map(row => row.month))].sort((a, b) => a - b).map(month => {
    const group = rows.filter(row => row.month === month);
    const plannedVacancies = sum(group.map(row => row.firmPlans.plannedVacancies));
    const hires = sum(group.map(row => row.labor.hires));
    const grossMarketLayoffs = sum(group.map(row => row.labor.layoffs));
    const exitDisplacements = sum(group.map(row => row.exitBoundary.displacedWorkers));
    const desiredBudget = sum(group.map(row => row.goods.goodsDesiredBudget));
    const actualConsumption = sum(group.map(row => row.goods.actualConsumption));
    return {
      month,
      countryPaths: group.length,
      meanUnemployment: mean(group.map(row => row.macro.unemployment)),
      totalPriorWorkers: sum(group.map(row => row.firmPlans.priorWorkers)),
      totalDesiredWorkersBeforeLabor: sum(group.map(row => row.firmPlans.desiredWorkersBeforeLabor)),
      totalNetDesiredWorkerChange: sum(group.map(row => row.firmPlans.netDesiredWorkerChange)),
      plannedVacancies,
      plannedLayoffSlots: sum(group.map(row => row.firmPlans.plannedLayoffSlots)),
      plannedLayoffsAtContinuingFirms: sum(group.map(row => row.firmPlans.plannedLayoffsAtContinuingFirms)),
      plannedLayoffsAtExitingFirms: sum(group.map(row => row.firmPlans.plannedLayoffsAtExitingFirms)),
      hires,
      vacancyFillRate: ratio(hires, plannedVacancies),
      grossMarketLayoffs,
      exitDisplacements,
      grossJobDestructionEvents: grossMarketLayoffs + exitDisplacements,
      netObservedSeparations: sum(group.map(row => row.labor.separations)),
      jobFindingsFromPriorUnemployment: sum(group.map(row => row.labor.jobFindings)),
      meanPositiveHiringPlanShare: mean(group.map(row => row.firmPlans.positiveHiringPlanShare)),
      meanNegativeHiringPlanShare: mean(group.map(row => row.firmPlans.negativeHiringPlanShare)),
      meanExpectedDemandGrowth: mean(group.map(row => row.firmPlans.meanExpectedDemandGrowth)),
      meanCashStress: mean(group.map(row => row.firmPlans.meanCashStress)),
      meanInventoryPressure: mean(group.map(row => row.firmPlans.meanInventoryPressure)),
      meanJobFindingRate: mean(group.map(row => row.labor.jobFindingRate)),
      meanSeparationRate: mean(group.map(row => row.labor.separationRate)),
      reservationWageRejections: sum(group.map(row => row.labor.reservationWageRejections)),
      stochasticMatchRejections: sum(group.map(row => row.labor.stochasticMatchRejections)),
      hiringCapacityBoundVacancies: sum(group.map(row => row.labor.hiringCapacityBoundVacancies)),
      scanLimitBoundVacancies: sum(group.map(row => row.labor.scanLimitBoundVacancies)),
      noApplicantVacancies: sum(group.map(row => row.labor.noApplicantVacancies)),
      desiredBudget,
      actualConsumption,
      unmetBudget: sum(group.map(row => row.goods.unmetBudget)),
      budgetFulfillmentRate: ratio(actualConsumption, desiredBudget),
      desiredBudgetToDisposableIncome: ratio(desiredBudget, sum(group.map(row => row.goods.disposableIncome))),
      postConsumerInventory: sum(group.map(row => row.goods.postConsumerInventory)),
      consumerOutput: sum(group.map(row => row.goods.consumerOutput)),
      firmExits: sum(group.map(row => row.firms.newExits)),
      creditStress: mean(group.map(row => row.banking.creditStress))
    };
  });
}

function runSeed(seed) {
  const world = new EconomicWorld(seed, { scaleProfile, healthCheckInterval: 0 });
  const recorder = new RealityDiagnosticRecorder(world);
  const exitEvents = installExitBoundaryObserver(world);
  const causalRows = [];
  const maxima = { vacancy: 0, layoff: 0, exitCount: 0, exitWorkerCount: 0, desiredBudget: 0, goodsBudgetIdentity: 0 };

  setLaborMarketDiagnosticObserver(event => recorder.recordLaborMarket(event));
  try {
    for (let step = 0; step < months; step++) {
      const pre = firmSnapshot(world);
      world.stepMonth();
      recorder.captureMonth(world);
      const diagnosticByCountry = new Map(recorder.records.slice(-world.countries.length).map(row => [row.countryId, row]));

      for (const country of world.countries) {
        const diagnostic = diagnosticByCountry.get(country.id);
        assert.ok(diagnostic, `${seed}:${world.month}:${country.id}: diagnostic row required`);
        const firmPlans = planDiagnostics(country, pre.get(country.id));
        const goods = goodsDiagnostics(country, pre.get(country.id));
        const exits = exitEvents.filter(event => event.month === world.month && event.countryId === country.id);
        const exitBoundary = {
          exits: exits.length,
          displacedWorkers: sum(exits.map(event => event.displacedWorkers)),
          workersAtExitBoundary: sum(exits.map(event => event.workersAtExitBoundary)),
          events: structuredClone(exits)
        };
        const vacancyError = firmPlans.plannedVacancies - diagnostic.labor.vacancies;
        const layoffError = firmPlans.plannedLayoffSlots - diagnostic.labor.layoffs;
        const exitCountError = exitBoundary.exits - diagnostic.firms.newExits;
        const exitWorkerCountError = exitBoundary.displacedWorkers - exitBoundary.workersAtExitBoundary;

        maxima.vacancy = Math.max(maxima.vacancy, Math.abs(vacancyError));
        maxima.layoff = Math.max(maxima.layoff, Math.abs(layoffError));
        maxima.exitCount = Math.max(maxima.exitCount, Math.abs(exitCountError));
        maxima.exitWorkerCount = Math.max(maxima.exitWorkerCount, Math.abs(exitWorkerCountError));
        maxima.desiredBudget = Math.max(maxima.desiredBudget, Math.abs(goods.desiredBudgetReconciliationError));
        maxima.goodsBudgetIdentity = Math.max(maxima.goodsBudgetIdentity, Math.abs(goods.goodsBudgetIdentityError));

        causalRows.push({
          seed,
          month: world.month,
          countryId: country.id,
          macro: structuredClone(diagnostic.macro),
          labor: structuredClone(diagnostic.labor),
          firms: structuredClone(diagnostic.firms),
          banking: structuredClone(diagnostic.banking),
          firmPlans,
          goods,
          exitBoundary,
          reconciliation: { vacancyError, layoffError, exitCountError, exitWorkerCountError }
        });
      }
    }
  } finally {
    setLaborMarketDiagnosticObserver(null);
  }

  const health = world.forceHealthCheck();
  const diagnostics = recorder.report();
  assert.ok(health.ok, `${seed}: v0.10 health gate must pass`);
  assert.ok(diagnostics.gates.ok, `${seed}: WP-RV01 diagnostic gates must pass`);
  assert.equal(causalRows.length, months * world.countries.length, `${seed}: complete causal country-month coverage`);
  assert.ok(maxima.vacancy <= 1e-9, `${seed}: planned vacancies must reconcile`);
  assert.ok(maxima.layoff <= 1e-9, `${seed}: planned layoff slots must reconcile`);
  assert.ok(maxima.exitCount <= 1e-9, `${seed}: exit-boundary events must reconcile to firm exits`);
  assert.ok(maxima.exitWorkerCount <= 1e-9, `${seed}: exit-boundary worker count must equal displaced employed households`);
  assert.ok(maxima.desiredBudget <= 1e-6, `${seed}: household desired budgets must reconcile`);
  assert.ok(maxima.goodsBudgetIdentity <= 1e-6, `${seed}: goods budget identity must reconcile`);
  return { seed, health, diagnosticGates: diagnostics.gates, causalRows, reconciliation: maxima, scale: world.scaleReport() };
}

const runs = seeds.map(runSeed);
const allRows = runs.flatMap(run => run.causalRows);
const monthly = aggregateMonthly(allRows);
const preExitWindow = allRows.filter(row => row.month <= 6);
const collapseWindow = allRows.filter(row => row.month >= 7 && row.month <= Math.min(months, 9));

function windowEvidence(rows) {
  const desired = sum(rows.map(row => row.goods.goodsDesiredBudget));
  const consumption = sum(rows.map(row => row.goods.actualConsumption));
  const marketLayoffs = sum(rows.map(row => row.labor.layoffs));
  const exitDisplacements = sum(rows.map(row => row.exitBoundary.displacedWorkers));
  return {
    countryMonths: rows.length,
    meanUnemployment: mean(rows.map(row => row.macro.unemployment)),
    plannedVacancies: sum(rows.map(row => row.firmPlans.plannedVacancies)),
    plannedLayoffSlots: sum(rows.map(row => row.firmPlans.plannedLayoffSlots)),
    plannedLayoffsAtContinuingFirms: sum(rows.map(row => row.firmPlans.plannedLayoffsAtContinuingFirms)),
    plannedLayoffsAtExitingFirms: sum(rows.map(row => row.firmPlans.plannedLayoffsAtExitingFirms)),
    marketLayoffs,
    exitDisplacements,
    grossJobDestructionEvents: marketLayoffs + exitDisplacements,
    netObservedSeparations: sum(rows.map(row => row.labor.separations)),
    firmExits: sum(rows.map(row => row.firms.newExits)),
    meanNegativeHiringPlanShare: mean(rows.map(row => row.firmPlans.negativeHiringPlanShare)),
    meanExpectedDemandGrowth: mean(rows.map(row => row.firmPlans.meanExpectedDemandGrowth)),
    reservationWageRejections: sum(rows.map(row => row.labor.reservationWageRejections)),
    stochasticMatchRejections: sum(rows.map(row => row.labor.stochasticMatchRejections)),
    bindingVacancies: sum(rows.map(row => row.labor.hiringCapacityBoundVacancies + row.labor.scanLimitBoundVacancies + row.labor.noApplicantVacancies)),
    goodsDesiredBudget: desired,
    actualConsumption: consumption,
    unmetBudget: sum(rows.map(row => row.goods.unmetBudget)),
    budgetFulfillmentRate: ratio(consumption, desired),
    desiredBudgetToDisposableIncome: ratio(desired, sum(rows.map(row => row.goods.disposableIncome))),
    postConsumerInventory: sum(rows.map(row => row.goods.postConsumerInventory))
  };
}

const report = {
  schemaVersion: 3,
  kind: 'economic-lab-wp-rv03-extreme-unemployment-causal-decomposition',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  runs,
  monthly,
  hypothesisEvidence: { preExitWindow: windowEvidence(preExitWindow), collapseWindow: windowEvidence(collapseWindow) },
  flowSemantics: {
    grossMarketLayoffs: 'labor-market layoff events; a worker may be rehired in the same month',
    netObservedSeparations: 'households employed before the month and unemployed after the full month',
    jobFindingsFromPriorUnemployment: 'households unemployed before the month and employed after the full month',
    exitDisplacements: 'workers still employed at a firm immediately before evaluateExits and displaced by that exit',
    note: 'Gross labor-market hires/layoffs are event flows and therefore are not forced to equal the pre/post household stock-transition flows.'
  },
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    allWpRv01DiagnosticsReconciled: runs.every(run => run.diagnosticGates.ok),
    completeCountryMonthCoverage: allRows.length === seeds.length * months * 4,
    laborDemandReconciled: runs.every(run => run.reconciliation.vacancy <= 1e-9 && run.reconciliation.layoff <= 1e-9),
    firmExitBoundaryReconciled: runs.every(run => run.reconciliation.exitCount <= 1e-9 && run.reconciliation.exitWorkerCount <= 1e-9),
    householdGoodsBudgetReconciled: runs.every(run => run.reconciliation.desiredBudget <= 1e-6 && run.reconciliation.goodsBudgetIdentity <= 1e-6)
  }
};
report.gates.ok = Object.values(report.gates).every(Boolean);
assert.ok(report.gates.ok, 'WP-RV03 causal decomposition gates must pass');

console.table(monthly.map(row => ({
  month: row.month,
  unemployment: row.meanUnemployment,
  desiredWorkerChange: row.totalNetDesiredWorkerChange,
  vacancies: row.plannedVacancies,
  plannedLayoffs: row.plannedLayoffSlots,
  exitDisplacements: row.exitDisplacements,
  firmExits: row.firmExits,
  negativePlanShare: row.meanNegativeHiringPlanShare,
  desiredBudget: row.desiredBudget,
  consumption: row.actualConsumption,
  fulfillment: row.budgetFulfillmentRate
})));
console.log(JSON.stringify(report, null, 2));
if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`WP_RV03_JSON ${outputJson}`);
}
console.log('Economic Lab WP-RV03 extreme-unemployment causal decomposition evidence PASS');
