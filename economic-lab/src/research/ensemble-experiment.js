function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + finite(value), 0) / values.length;
}

function std(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (finite(value) - m) ** 2, 0) / values.length);
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = values.map(value => finite(value)).sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.max(0, Math.min(1, q));
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  if (lo === hi) return sorted[lo];
  const weight = position - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function growth(current, prior) {
  const p = finite(prior);
  if (Math.abs(p) < 1e-12) return 0;
  return finite(current) / p - 1;
}

export const DEFAULT_ENSEMBLE_METRICS = Object.freeze({
  gdp: country => finite(country.macro?.gdp),
  priceIndex: country => finite(country.macro?.priceIndex),
  unemployment: country => finite(country.macro?.unemployment),
  policyRate: country => finite(country.macro?.policyRate),
  publicDebtRatio: country => finite(country.macro?.publicDebtRatio),
  externalStress: country => finite(country.macro?.externalStress),
  outstandingLoans: country => finite(country.macro?.outstandingLoans),
  loanDefaults: country => finite(country.macro?.loanDefaults),
  activeFirms: country => finite(country.macro?.activeFirms),
  gdpGrowth: country => {
    const history = country.history || [];
    const current = history[history.length - 1] || country.macro || {};
    const prior = history[history.length - 2] || country.previousMacro || current;
    return growth(current.gdp, prior.gdp);
  },
  inflation: country => {
    const history = country.history || [];
    const current = history[history.length - 1] || country.macro || {};
    const prior = history[history.length - 2] || country.previousMacro || current;
    return growth(current.priceIndex, prior.priceIndex);
  }
});

function countryVector(world, metrics) {
  const result = {};
  for (const country of world.countries) {
    result[country.id] = {};
    for (const [key, extractor] of Object.entries(metrics)) {
      result[country.id][key] = finite(extractor(country, world));
    }
  }
  return result;
}

function effectVector(control, treatment) {
  const result = {};
  for (const countryId of Object.keys(control)) {
    result[countryId] = {};
    for (const metric of Object.keys(control[countryId])) {
      result[countryId][metric] = finite(treatment[countryId]?.[metric]) - finite(control[countryId]?.[metric]);
    }
  }
  return result;
}

function flattenEffects(rows) {
  const groups = new Map();
  for (const row of rows) {
    for (const [countryId, metrics] of Object.entries(row.effect)) {
      for (const [metric, value] of Object.entries(metrics)) {
        const key = `${countryId}:${metric}`;
        if (!groups.has(key)) groups.set(key, { countryId, metric, values: [] });
        groups.get(key).values.push(finite(value));
      }
    }
  }
  return [...groups.values()];
}

function summarizeEffects(rows) {
  return flattenEffects(rows).map(group => {
    const values = group.values;
    const positive = values.filter(value => value > 0).length;
    const negative = values.filter(value => value < 0).length;
    return {
      countryId: group.countryId,
      metric: group.metric,
      n: values.length,
      meanEffect: mean(values),
      stdEffect: std(values),
      medianEffect: quantile(values, 0.5),
      p10Effect: quantile(values, 0.1),
      p90Effect: quantile(values, 0.9),
      positiveShare: values.length ? positive / values.length : 0,
      negativeShare: values.length ? negative / values.length : 0,
      values: values.slice()
    };
  }).sort((a, b) => a.countryId.localeCompare(b.countryId) || a.metric.localeCompare(b.metric));
}

export function runPairedEnsemble({
  WorldClass,
  seeds,
  months,
  scaleProfile = 'compact',
  treatmentSchedule = [],
  controlSchedule = [],
  metrics = DEFAULT_ENSEMBLE_METRICS,
  healthCheckInterval = 0
}) {
  if (typeof WorldClass !== 'function') throw new Error('WorldClass is required');
  const seedList = [...new Set((seeds || []).map(String))];
  if (!seedList.length) throw new Error('ensemble requires at least one seed');
  const horizon = Math.max(1, Math.round(Number(months || 1)));
  const pairs = [];

  for (const seed of seedList) {
    const control = new WorldClass(seed, {
      scaleProfile,
      healthCheckInterval,
      experimentSchedule: controlSchedule.map(event => ({ ...event }))
    });
    const treatment = new WorldClass(seed, {
      scaleProfile,
      healthCheckInterval,
      experimentSchedule: treatmentSchedule.map(event => ({ ...event }))
    });

    control.step(horizon);
    treatment.step(horizon);

    const controlHealth = control.forceHealthCheck();
    const treatmentHealth = treatment.forceHealthCheck();
    const controlVector = countryVector(control, metrics);
    const treatmentVector = countryVector(treatment, metrics);

    pairs.push({
      seed,
      months: horizon,
      control: controlVector,
      treatment: treatmentVector,
      effect: effectVector(controlVector, treatmentVector),
      health: {
        controlOk: controlHealth.ok,
        treatmentOk: treatmentHealth.ok,
        controlFailures: controlHealth.failures,
        treatmentFailures: treatmentHealth.failures
      },
      controlExperiments: control.experimentReport?.() || null,
      treatmentExperiments: treatment.experimentReport?.() || null
    });
  }

  const summary = summarizeEffects(pairs);
  return {
    scaleProfile,
    months: horizon,
    seeds: seedList,
    pairs,
    summary,
    allHealthy: pairs.every(pair => pair.health.controlOk && pair.health.treatmentOk),
    metricKeys: Object.keys(metrics)
  };
}

export function ensembleDigest(result) {
  return {
    scaleProfile: result.scaleProfile,
    months: result.months,
    seeds: result.seeds.slice(),
    allHealthy: result.allHealthy,
    pairs: result.pairs.map(pair => ({
      seed: pair.seed,
      control: pair.control,
      treatment: pair.treatment,
      effect: pair.effect,
      health: pair.health
    })),
    summary: result.summary.map(row => ({ ...row }))
  };
}
