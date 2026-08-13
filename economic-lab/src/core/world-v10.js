import { EconomicWorld as CognitiveEconomicWorld } from './world-v09.js';
import { COUNTRY_SEEDS } from '../config/countries.js';
import { resolveScaleProfile, scaledCountrySeeds, seedScaleSummary } from '../config/scale-profiles.js';
import { ExperimentSystem } from '../research/experiment-system.js';
import { LongRunHealthMonitor } from '../research/long-run-health.js';
import { analyzeWorldEmergence } from '../research/emergence-metrics.js';
import { RuntimeProfiler } from '../research/runtime-profiler.js';
import { compactWorldDecisionHistories } from '../research/decision-history.js';

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function actualPopulation(countries) {
  const households = countries.reduce((sum, country) => sum + (country.households?.length || 0), 0);
  const firms = countries.reduce((sum, country) => sum + (country.firms?.length || 0), 0);
  const activeFirms = countries.reduce((sum, country) => sum + (country.firms?.filter(f => f.active !== false).length || 0), 0);
  const banks = countries.reduce((sum, country) => sum + (country.banks?.length || 0), 0);
  const governments = countries.reduce((sum, country) => sum + (country.governments?.length || 0), 0);
  const centralBanks = countries.reduce((sum, country) => sum + (country.centralBanks?.length || 0), 0);
  return {
    households,
    firms,
    activeFirms,
    banks,
    governments,
    centralBanks,
    cognitiveAgents: households + activeFirms + banks + governments + centralBanks
  };
}

export class EconomicWorld extends CognitiveEconomicWorld {
  constructor(seedText = 'ECON-4-001', options = {}) {
    const profile = resolveScaleProfile(options.scaleProfile || 'baseline');
    const scaledSeeds = scaledCountrySeeds(profile);
    const originalSeeds = COUNTRY_SEEDS.slice();
    COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...scaledSeeds);
    try {
      super(seedText);
    } finally {
      COUNTRY_SEEDS.splice(0, COUNTRY_SEEDS.length, ...originalSeeds);
    }

    this.version = '0.10';
    this.scaleProfile = profile;
    this.scaleSeedSummary = seedScaleSummary(profile);
    this.initialPopulation = actualPopulation(this.countries);
    this.experiments = new ExperimentSystem({ schedule: options.experimentSchedule || [] });
    this.health = new LongRunHealthMonitor({ maxRecords: options.healthRecordLimit || 240 });
    this.healthCheckInterval = Math.max(0, Math.round(Number(options.healthCheckInterval ?? 6)));
    this.runtime = this.emptyRuntimeMetrics();
    this.profiler = new RuntimeProfiler({ historyLimit: options.profileHistoryLimit || 60 });
    this.decisionHistory = { monthsCompacted: 0, recordsConverted: 0, last: null };
    for (const country of this.countries) {
      Object.defineProperty(country, '__runtimeProfiler', {
        value: this.profiler,
        enumerable: false,
        configurable: true,
        writable: false
      });
    }
    this.installSubsystemProfiling();
    this.lastExperimentEvents = [];
  }

  emptyRuntimeMetrics() {
    return {
      totalStepMs: 0,
      measuredMonths: 0,
      meanStepMs: 0,
      maxStepMs: 0,
      lastStepMs: 0,
      recentStepMs: []
    };
  }

  installSubsystemProfiling() {
    const wrap = (target, method, label) => this.profiler.wrap(target, method, label);

    wrap(this.cognitive, 'beginWorldMonth', 'cognition.begin');
    wrap(this.information, 'spreadWorld', 'information.spread');
    wrap(this, 'inferAgentRegimes', 'cognition.regime');
    wrap(this.international, 'beginMonth', 'international.begin');

    wrap(this.monetary, 'beginMonth', 'monetary.policy');
    wrap(this.assetMarket, 'runMarket', 'asset.market');
    wrap(this.banking, 'serviceDebt', 'banking.debt_service');
    wrap(this.banking, 'originateCredit', 'banking.credit');
    wrap(this.banking, 'combineMetrics', 'banking.aggregate');

    wrap(this, 'syncBalances', 'settlement.sync_balances');
    wrap(this.ledger, 'entriesFor', 'ledger.query');
    wrap(this.ledger, 'verifyCountry', 'ledger.verify');
    wrap(this.ledger, 'totalBalance', 'ledger.total_balance');

    wrap(this.supply, 'beginMonth', 'supply.reset');
    wrap(this.supply, 'planProduction', 'supply.plan');
    wrap(this.supply, 'procureInputs', 'supply.inputs');
    wrap(this.supply, 'produce', 'supply.production');
    wrap(this.supply, 'clearInvestmentMarket', 'supply.investment');
    wrap(this.supply, 'finalizeMetrics', 'supply.finalize');
    wrap(this.supply, 'evaluateExits', 'supply.exits');

    wrap(this.accounting, 'accrueMonthlyWages', 'accounting.wage_accrual');
    wrap(this.accounting, 'ingestSettlementEntries', 'accounting.settlement_ingest');
    wrap(this.accounting, 'closeCountryMonth', 'accounting.close');
    wrap(this.accounting, 'verifyCountry', 'accounting.verify');

    wrap(this.fiscal, 'beginMonth', 'fiscal.policy');
    wrap(this.fiscal, 'collectIncomeTaxes', 'fiscal.income_tax');
    wrap(this.fiscal, 'payAutomaticTransfers', 'fiscal.transfers');
    wrap(this.fiscal, 'collectConsumptionTaxes', 'fiscal.consumption_tax');
    wrap(this.fiscal, 'executeGovernmentDemand', 'fiscal.demand');
    wrap(this.fiscal, 'collectCorporateTaxes', 'fiscal.corporate_tax');
    wrap(this.fiscal, 'finalizeMonth', 'fiscal.finalize');

    wrap(this, 'rebaseLegacySecurities', 'monetary.rebase_securities');
    wrap(this.monetary, 'manageLiquidity', 'monetary.liquidity');
    wrap(this.cognitive, 'endWorldMonth', 'cognition.end');
    wrap(this, 'closeCognitiveLearningLoop', 'cognition.learning');
    wrap(this, 'refreshV09Macro', 'cognition.aggregate');
  }

  resetRuntimeMetrics() {
    this.runtime = this.emptyRuntimeMetrics();
    this.profiler.reset();
  }

  compactDecisionHistory() {
    const result = compactWorldDecisionHistories(this.countries);
    this.decisionHistory.monthsCompacted += 1;
    this.decisionHistory.recordsConverted += Number(result.converted || 0);
    this.decisionHistory.last = { month: this.month, ...result };
    return result;
  }

  stepMonth() {
    const nextMonth = this.month + 1;
    const started = nowMs();
    this.profiler.beginMonth(nextMonth);
    this.lastExperimentEvents = this.profiler.measure(
      'experiment.apply',
      () => this.experiments.beforeMonth(this, nextMonth)
    );

    super.stepMonth();
    this.profiler.measure('cognition.compact_history', () => this.compactDecisionHistory());
    const elapsed = Math.max(0, nowMs() - started);
    this.profiler.endMonth(elapsed);

    this.runtime.totalStepMs += elapsed;
    this.runtime.measuredMonths += 1;
    this.runtime.meanStepMs = this.runtime.totalStepMs / Math.max(1, this.runtime.measuredMonths);
    this.runtime.maxStepMs = Math.max(this.runtime.maxStepMs, elapsed);
    this.runtime.lastStepMs = elapsed;
    this.runtime.recentStepMs.push(elapsed);
    if (this.runtime.recentStepMs.length > 60) this.runtime.recentStepMs.shift();

    if (this.healthCheckInterval > 0 && this.month % this.healthCheckInterval === 0) {
      this.health.record(this, elapsed);
    }
  }

  forceHealthCheck() {
    return this.health.record(this, this.runtime.lastStepMs);
  }

  scaleReport() {
    return {
      version: this.version,
      profile: { ...this.scaleProfile },
      seedSummary: structuredClone(this.scaleSeedSummary),
      initialPopulation: structuredClone(this.initialPopulation),
      currentPopulation: actualPopulation(this.countries),
      runtime: structuredClone(this.runtime),
      decisionHistory: structuredClone(this.decisionHistory)
    };
  }

  profilingReport() {
    return this.profiler.report();
  }

  experimentReport() {
    return this.experiments.summary();
  }

  emergenceReport() {
    return analyzeWorldEmergence(this);
  }

  snapshot() {
    const base = super.snapshot();
    base.version = this.version;
    base.scale = this.scaleReport();
    base.profiling = this.profilingReport();
    base.experiments = this.experimentReport();
    base.health = this.health.summary();
    base.emergence = this.emergenceReport();
    base.lastExperimentEvents = structuredClone(this.lastExperimentEvents);
    return base;
  }
}
