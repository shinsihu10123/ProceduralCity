function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + finite(value), 0) / values.length;
}

function variance(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, value) => sum + (finite(value) - m) ** 2, 0) / values.length;
}

function std(values) {
  return Math.sqrt(Math.max(0, variance(values)));
}

function growthSeries(history, key) {
  const out = [];
  for (let i = 1; i < history.length; i++) {
    const prev = finite(history[i - 1]?.[key]);
    const current = finite(history[i]?.[key]);
    if (Math.abs(prev) < 1e-12) out.push(0);
    else out.push(current / prev - 1);
  }
  return out;
}

function autocorrelation(values, lag = 1) {
  if (values.length <= lag + 1) return 0;
  const left = values.slice(lag);
  const right = values.slice(0, -lag);
  const ml = mean(left);
  const mr = mean(right);
  let covariance = 0;
  let vl = 0;
  let vr = 0;
  for (let i = 0; i < left.length; i++) {
    const dl = finite(left[i]) - ml;
    const dr = finite(right[i]) - mr;
    covariance += dl * dr;
    vl += dl * dl;
    vr += dr * dr;
  }
  const denom = Math.sqrt(vl * vr);
  return denom > 1e-12 ? covariance / denom : 0;
}

function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = mean(x);
  const my = mean(y);
  let covariance = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = finite(x[i]) - mx;
    const dy = finite(y[i]) - my;
    covariance += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  const denom = Math.sqrt(vx * vy);
  return denom > 1e-12 ? covariance / denom : 0;
}

function maxDrawdown(values) {
  let peak = -Infinity;
  let max = 0;
  for (const raw of values) {
    const value = finite(raw);
    peak = Math.max(peak, value);
    if (peak > 1e-12) max = Math.max(max, (peak - value) / peak);
  }
  return max;
}

export function analyzeCountryEmergence(country) {
  const history = country.history || [];
  const gdp = history.map(row => finite(row.gdp));
  const gdpGrowth = growthSeries(history, 'gdp');
  const inflation = growthSeries(history, 'priceIndex');
  const unemployment = history.slice(1).map(row => finite(row.unemployment));
  const creditStress = history.slice(1).map(row => finite(row.creditStress));
  const exits = history.slice(1).map(row => finite(row.firmExits));
  const recessionMonths = gdpGrowth.filter(value => value < -0.02).length;
  const highInflationMonths = inflation.filter(value => value > 0.04).length;
  const stressMonths = creditStress.filter(value => value > 0.35).length;

  return {
    countryId: country.id,
    observations: history.length,
    gdpGrowthMean: mean(gdpGrowth),
    gdpGrowthVolatility: std(gdpGrowth),
    gdpGrowthPersistence: autocorrelation(gdpGrowth, 1),
    gdpMaxDrawdown: maxDrawdown(gdp),
    inflationMean: mean(inflation),
    inflationVolatility: std(inflation),
    inflationPersistence: autocorrelation(inflation, 1),
    unemploymentMean: mean(unemployment),
    unemploymentVolatility: std(unemployment),
    unemploymentPersistence: autocorrelation(unemployment, 1),
    recessionMonths,
    highInflationMonths,
    creditStressMonths: stressMonths,
    firmExitMonths: exits.filter(value => value > 0).length,
    totalFirmExits: exits.reduce((sum, value) => sum + value, 0)
  };
}

export function analyzeWorldEmergence(world) {
  const countries = world.countries.map(analyzeCountryEmergence);
  const growthByCountry = new Map(world.countries.map(country => [country.id, growthSeries(country.history || [], 'gdp')]));
  const pairwise = [];
  for (let i = 0; i < world.countries.length; i++) {
    for (let j = i + 1; j < world.countries.length; j++) {
      const a = world.countries[i].id;
      const b = world.countries[j].id;
      pairwise.push({ a, b, correlation: correlation(growthByCountry.get(a) || [], growthByCountry.get(b) || []) });
    }
  }

  return {
    month: world.month,
    countries,
    crossCountryGrowthCorrelation: pairwise.length ? mean(pairwise.map(row => row.correlation)) : 0,
    pairwiseGrowthCorrelations: pairwise,
    totalRecessionMonths: countries.reduce((sum, row) => sum + row.recessionMonths, 0),
    totalHighInflationMonths: countries.reduce((sum, row) => sum + row.highInflationMonths, 0),
    totalFirmExits: countries.reduce((sum, row) => sum + row.totalFirmExits, 0),
    meanGrowthVolatility: mean(countries.map(row => row.gdpGrowthVolatility)),
    meanInflationVolatility: mean(countries.map(row => row.inflationVolatility))
  };
}

export { mean, std, autocorrelation, correlation, growthSeries };
