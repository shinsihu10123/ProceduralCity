import { EconomicWorld as CognitiveEconomicWorld } from './world-v09.js';
import { COUNTRY_SEEDS } from '../config/countries.js';
import { resolveScaleProfile, scaledCountrySeeds, seedScaleSummary } from '../config/scale-profiles.js';
import { ExperimentSystem } from '../research/experiment-system.js';
import { LongRunHealthMonitor } from '../research/long-run-health.js';
import { analyzeWorldEmergence } from '../research/emergence-metrics.js';

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
    this.runtime = {
      totalStepMs: 0,
      measuredMonths: 0,
      meanStepMs: 0,
      maxStepMs: 0,
      lastStepMs: 0,
      recentStepMs: []
    };
    this.lastExperimentEvents = [];
  }

  stepMonth() {
    const nextMonth = this.month + 1;
    this.lastExperimentEvents = this.experiments.beforeMonth(this, nextMonth);
    const started = nowMs();
    super.stepMonth();
    const elapsed = Math.max(0, nowMs() - started);

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
      runtime: structuredClone(this.runtime)
    };
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
    base.experiments = this.experimentReport();
    base.health = this.health.summary();
    base.emergence = this.emergenceReport();
    base.lastExperimentEvents = structuredClone(this.lastExperimentEvents);
    return base;
  }
}
