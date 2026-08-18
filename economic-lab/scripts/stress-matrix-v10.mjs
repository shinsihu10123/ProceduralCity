import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { DEFAULT_ENSEMBLE_METRICS, runPairedEnsemble } from '../src/research/ensemble-experiment.js';

const outputJson = process.env.OUTPUT_JSON ? resolve(process.env.OUTPUT_JSON) : null;
const seeds = ['ECON-V10-STRESS-A', 'ECON-V10-STRESS-B'];
const months = Math.max(4, Number(process.env.STRESS_MONTHS || 6));
const scaleProfile = process.env.STRESS_SCALE || 'compact';

function meanActiveFirmProductivity(country) {
  const firms = (country.firms || []).filter(firm => firm.active !== false);
  return firms.reduce((sum, firm) => sum + Number(firm.productivity || 0), 0) / Math.max(1, firms.length);
}

function meanFirmDemandBelief(country) {
  const firms = (country.firms || []).filter(firm => firm.active !== false && firm.cognition?.beliefs?.demandGrowth);
  return firms.reduce((sum, firm) => sum + Number(firm.cognition.beliefs.demandGrowth.mean || 0), 0) / Math.max(1, firms.length);
}

function meanBankRiskAversion(country) {
  const banks = country.banks || [];
  return banks.reduce((sum, bank) => sum + Number(bank.riskAversion || 0), 0) / Math.max(1, banks.length);
}

const metrics = {
  ...DEFAULT_ENSEMBLE_METRICS,
  meanProductivity: meanActiveFirmProductivity,
  meanFirmDemandBelief,
  bankRiskAversion: meanBankRiskAversion,
  tariffRate: country => Number(country.tradePolicy?.tariffRate || 0)
};

const scenarios = [
  {
    id: 'supply-productivity',
    directMetric: 'meanProductivity',
    directDirection: -1,
    schedule: [{ id: 'stress-productivity', month: 3, countryId: 'AST', kind: 'productivity_shock', factor: 0.72 }]
  },
  {
    id: 'demand-expectations',
    directMetric: 'meanFirmDemandBelief',
    directDirection: -1,
    schedule: [{
      id: 'stress-demand-belief',
      month: 3,
      countryId: 'AST',
      kind: 'belief_shift',
      key: 'demandGrowth',
      delta: -0.12,
      uncertaintyFactor: 1.15,
      agentKinds: ['firm']
    }]
  },
  {
    id: 'bank-risk',
    directMetric: 'bankRiskAversion',
    directDirection: 1,
    schedule: [{ id: 'stress-bank-risk', month: 3, countryId: 'AST', kind: 'bank_risk_shock', delta: 0.55 }]
  },
  {
    id: 'tariff-friction',
    directMetric: 'tariffRate',
    directDirection: 1,
    schedule: [{ id: 'stress-tariff', month: 3, countryId: 'AST', kind: 'tariff_shock', rate: 0.35 }]
  }
];

const macroMetrics = ['gdp', 'gdpGrowth', 'priceIndex', 'inflation', 'unemployment', 'externalStress', 'loanDefaults', 'activeFirms'];

function summaryValue(result, countryId, metric) {
  return Number(result.summary.find(row => row.countryId === countryId && row.metric === metric)?.meanEffect || 0);
}

function signature(result) {
  const values = [];
  for (const countryId of ['AST', 'BRN', 'CYR', 'DRN']) {
    for (const metric of macroMetrics) values.push(summaryValue(result, countryId, metric));
  }
  return values;
}

function l1(values) {
  return values.reduce((sum, value) => sum + Math.abs(Number(value || 0)), 0);
}

function signatureDistance(a, b) {
  let total = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) total += Math.abs(Number(a[i] || 0) - Number(b[i] || 0));
  return total;
}

const results = [];
for (const scenario of scenarios) {
  const ensemble = runPairedEnsemble({
    WorldClass: EconomicWorld,
    seeds,
    months,
    scaleProfile,
    treatmentSchedule: scenario.schedule,
    metrics,
    healthCheckInterval: 0
  });

  assert.ok(ensemble.allHealthy, `${scenario.id}: every control/treatment world must remain healthy`);
  assert.equal(ensemble.pairs.length, seeds.length, `${scenario.id}: missing paired seeds`);
  for (const pair of ensemble.pairs) {
    assert.equal(pair.treatmentExperiments?.applied, 1, `${scenario.id}:${pair.seed}: shock must apply exactly once`);
    assert.equal(pair.treatmentExperiments?.pending, 0, `${scenario.id}:${pair.seed}: shock must not remain pending`);
  }

  const directEffect = summaryValue(ensemble, 'AST', scenario.directMetric);
  const astMacro = macroMetrics.map(metric => summaryValue(ensemble, 'AST', metric));
  const spillover = ['BRN', 'CYR', 'DRN'].flatMap(countryId => macroMetrics.map(metric => summaryValue(ensemble, countryId, metric)));
  const astMacroResponseL1 = l1(astMacro);
  const spilloverResponseL1 = l1(spillover);

  console.log(`STRESS_SCENARIO ${scenario.id} direct=${directEffect} astMacroL1=${astMacroResponseL1} spilloverL1=${spilloverResponseL1}`);

  assert.ok(
    scenario.directDirection * directEffect > 1e-12,
    `${scenario.id}: direct intervention metric ${scenario.directMetric} must move in the configured direction`
  );
  assert.ok(astMacroResponseL1 > 1e-10, `${scenario.id}: treatment must produce a non-zero endogenous AST macro response`);

  results.push({
    id: scenario.id,
    schedule: scenario.schedule,
    directMetric: scenario.directMetric,
    directEffect,
    astMacroResponseL1,
    spilloverResponseL1,
    signature: signature(ensemble),
    summary: ensemble.summary,
    pairs: ensemble.pairs.map(pair => ({ seed: pair.seed, effect: pair.effect, health: pair.health }))
  });
}

const pairwiseDistances = [];
for (let i = 0; i < results.length; i++) {
  for (let j = i + 1; j < results.length; j++) {
    const distance = signatureDistance(results[i].signature, results[j].signature);
    assert.ok(distance > 1e-10, `${results[i].id} and ${results[j].id} must not collapse to the same macro response signature`);
    pairwiseDistances.push({ a: results[i].id, b: results[j].id, l1Distance: distance });
  }
}

const report = {
  schemaVersion: 2,
  kind: 'economic-lab-v10-stress-matrix',
  generatedAt: new Date().toISOString(),
  node: process.version,
  scaleProfile,
  months,
  seeds,
  scenarios: results,
  pairwiseDistances,
  allHealthy: true,
  gates: {
    directInterventionsMovedConfiguredState: true,
    endogenousMacroResponseObserved: true,
    scenarioSignaturesDistinct: true
  }
};

console.table(results.map(row => ({
  scenario: row.id,
  directMetric: row.directMetric,
  directEffect: row.directEffect,
  astMacroResponseL1: row.astMacroResponseL1,
  spilloverResponseL1: row.spilloverResponseL1
})));
console.table(pairwiseDistances);
console.log(JSON.stringify(report, null, 2));

if (outputJson) {
  mkdirSync(dirname(outputJson), { recursive: true });
  writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`STRESS_MATRIX_JSON ${outputJson}`);
}

console.log('Economic Lab v0.10 multi-shock stress matrix gate PASS');
