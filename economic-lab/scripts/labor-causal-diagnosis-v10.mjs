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

function plannedTargetWorkers(preWorkers, plan) {
  const hiringChange = clamp(plan?.hiringChange, -0.10, 0.12);
  return Math.max(0, Math.round(Math.max(1, finite(preWorkers)) * (1 + hiringChange)));
}

function planDiagnostics(country, preFirms) {
  const current = new Map((country.firms || []).map(firm => [firm.id, firm]));
  const values = {
    activeAtStart: 0,
    priorWorkers: 0,
    desiredWorkersBeforeLabor: 0,
    plannedVacancies: 0,
    plannedLayoffSlots: 0,
    positiveHiringPlans: 0,
    negativeHiringPlans: 0,
    zeroHiringPlans: 0,
    expansionPlans: 0,
    defensivePlans: 0,
    cashPreservationPlans: 0,
    priceCompetitionPlans: 0,
    maintainPlans: 0
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

    values.activeAtStart += 1;
    values.priorWorkers += pre.workers;
    values.desiredWorkersBeforeLabor += target;
    values.plannedVacancies += Math.max(0, target - pre.workers);
    values.plannedLayoffSlots += Math.max(0, pre.workers - target);
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

function separationAttribution(diagnostic) {
  const total = finite(diagnostic.labor.separations);
  const marketLayoffs = finite(diagnostic.labor.layoffs);
  const exitAssociatedSeparations = finite(diagnostic.labor.exitSeparations);
  const exitResidualSeparations = Math.max(0, total - marketLayoffs);
  return {
    marketLayoffs,
    exitAssociatedSeparations,
    exitResidualSeparations,
    exitAssociatedMarketLayoffOverlap: Math.max(0, exitAssociatedSeparations - exitResidualSeparations),
    exitResidualShare: ratio(exitResidualSeparations, total),
    layoffsExceedSeparationsError: Math.max(0, marketLayoffs - total),
    exitResidualExceedsAssociatedError: Math.max(0, exitResidualSeparations - exitAssociatedSeparations),
    residualWithoutExitError: finite(diagnostic.firms.newExits) === 0 ? exitResidualSeparations : 0
  };
}

function aggregateMonthly(rows) {
  return [...new Set(rows.map(row => row.month))].sort((a, b) => a - b).map(month => {
    const group = rows.filter(row => row.month === month);
    const plannedVacancies = sum(group.map(row => row.firmPlans.plannedVacancies));
    const hires = sum(group.map(row => row.labor.hires));
    const totalSeparations = sum(group.map(row => row.labor.separations));
    const exitResidualSeparations = sum(group.map(row => row.attribution.exitResidualSeparations));
    const desiredBudget = sum(group.map(row => row.goods.goodsDesiredBudget));
    const actualConsumption = sum(group.map(row => row.goods.actualConsumption));
    const unmetBudget = sum(group.map(row => row.goods.unmetBudget));
    return {
      month,
      countryPaths: group.length,
      meanUnemployment: mean(group.map(row => row.macro.unemployment)),
      totalPriorWorkers: sum(group.map(row => row.firmPlans.priorWorkers)),
      totalDesiredWorkersBeforeLabor: sum(group.map(row => row.firmPlans.desiredWorkersBeforeLabor)),
      totalNetDesiredWorkerChange: sum(group.map(row => row.firmPlans.netDesiredWorkerChange)),
      plannedVacancies,
      plannedLayoffSlots: sum(group.map(row => row.firmPlans.plannedLayoffSlots)),
      hires,
      vacancyFillRate: ratio(hires, plannedVacancies),
      marketLayoffs: sum(group.map(row => row.attribution.marketLayoffs)),
      exitResidualSeparations,
      totalSeparations,
      exitResidualShare: ratio(exitResidualSeparations, totalSeparations),
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
      unmetBudget,
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
  const causalRows = [];
  const maxima = {
    vacancy: 0,
    layoff: 0,
    layoffsExceedSeparations: 0,
    exitResidualExceedsAssociated: 0,
    residualWithoutExit: 0,
    desiredBudget: 0,
    goodsBudgetIdentity: 0
  };

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
        const attribution = separationAttribution(diagnostic);
        const vacancyError = firmPlans.plannedVacancies - diagnostic.labor.vacancies;
        const layoffError = firmPlans.plannedLayoffSlots - diagnostic.labor.layoffs;

        maxima.vacancy = Math.max(maxima.vacancy, Math.abs(vacancyError));
        maxima.layoff = Math.max(maxima.layoff, Math.abs(layoffError));
        maxima.layoffsExceedSeparations = Math.max(maxima.layoffsExceedSeparations, attribution.layoffsExceedSeparationsError);
        maxima.exitResidualExceedsAssociated = Math.max(maxima.exitResidualExceedsAssociated, attribution.exitResidualExceedsAssociatedError);
        maxima.residualWithoutExit = Math.max(maxima.residualWithoutExit, attribution.residualWithoutExitError);
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
          attribution,
          reconciliation: { vacancyError, layoffError }
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
  assert.ok(maxima.layoffsExceedSeparations <= 1e-9, `${seed}: market layoffs cannot exceed observed separations`);
  assert.ok(maxima.exitResidualExceedsAssociated <= 1e-9, `${seed}: residual exit separations must be associated with an exiting employer`);
  assert.ok(maxima.residualWithoutExit <= 1e-9, `${seed}: residual separation requires at least one firm exit`);
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
  const separations = sum(rows.map(row => row.labor.separations));
  const exitResidual = sum(rows.map(row => row.attribution.exitResidualSeparations));
  return {
    countryMonths: rows.length,
    meanUnemployment: mean(rows.map(row => row.macro.unemployment)),
    plannedVacancies: sum(rows.map(row => row.firmPlans.plannedVacancies)),
    plannedLayoffSlots: sum(rows.map(row => row.firmPlans.plannedLayoffSlots)),
    marketLayoffs: sum(rows.map(row => row.attribution.marketLayoffs)),
    exitResidualSeparations: exitResidual,
    totalSeparations: separations,
    exitResidualShare: ratio(exitResidual, separations),
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
  schemaVersion: 2,
  kind: 'economic-lab-wp-rv03-extreme-unemployment-causal-decomposition',
  frozenEconomicBaseline: '698d10749e2897d711e5bcee61913ac34e0650a0',
  scaleProfile,
  months,
  seeds,
  runs,
  monthly,
  hypothesisEvidence: {
    preExitWindow: windowEvidence(preExitWindow),
    collapseWindow: windowEvidence(collapseWindow)
  },
  attributionNote: 'RealityDiagnosticRecorder.exitSeparations is exit-associated and can overlap with labor-market layoffs when the same employer exits later that month. WP-RV03 therefore attributes post-labor exit separations as total separations minus labor-market layoffs, and separately retains the broader exit-associated count.',
  gates: {
    allHealthy: runs.every(run => run.health.ok),
    allWpRv01DiagnosticsReconciled: runs.every(run => run.diagnosticGates.ok),
    completeCountryMonthCoverage: allRows.length === seeds.length * months * 4,
    laborDemandReconciled: runs.every(run => run.reconciliation.vacancy <= 1e-9 && run.reconciliation.layoff <= 1e-9),
    separationAttributionConsistent: runs.every(run => run.reconciliation.layoffsExceedSeparations <= 1e-9 && run.reconciliation.exitResidualExceedsAssociated <= 1e-9 && run.reconciliation.residualWithoutExit <= 1e-9),
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
  exitSeparations: row.exitResidualSeparations,
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
