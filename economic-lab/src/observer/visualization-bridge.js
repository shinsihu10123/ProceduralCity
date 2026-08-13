const OBSERVER_SCHEMA = 'economic-lab.observer.v1';

const COUNTRY_LAYOUT = Object.freeze({
  AST: Object.freeze({ x: -12, y: 0, z: -8 }),
  BRN: Object.freeze({ x: 10, y: 0, z: -7 }),
  CYR: Object.freeze({ x: -7, y: 0, z: 10 }),
  DRN: Object.freeze({ x: 11, y: 0, z: 9 })
});

const FALLBACK_LAYOUT = Object.freeze([
  Object.freeze({ x: -12, y: 0, z: -8 }),
  Object.freeze({ x: 10, y: 0, z: -7 }),
  Object.freeze({ x: -7, y: 0, z: 10 }),
  Object.freeze({ x: 11, y: 0, z: 9 })
]);

const SECTORS = Object.freeze(['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER']);

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value) {
  return Math.max(0, finite(value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function ratioToMax(value, maxValue) {
  const max = nonNegative(maxValue);
  return max > 0 ? clamp01(nonNegative(value) / max) : 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isLiveWorld(source) {
  return Boolean(
    source &&
    Array.isArray(source.countries) &&
    typeof source.step === 'function' &&
    typeof source.snapshot === 'function'
  );
}

function liveCountryView(world, country) {
  const firms = Array.isArray(country.firms) ? country.firms : [];
  const households = Array.isArray(country.households) ? country.households : [];
  const recentInternationalTrades = world.international?.recentTrades
    ? world.international.recentTrades(world.month, country.id, 18)
    : [];
  const recentForeignFunding = world.international?.recentFunding
    ? world.international.recentFunding(country.id, 12)
    : [];

  return {
    ...country,
    households: households.length,
    firms: firms.length,
    activeFirms: firms.filter(firm => firm.active !== false).length,
    cognitive: country.lastCognitive || country.cognitive || null,
    international: country.lastInternational || country.international || null,
    recentInternationalTrades,
    recentForeignFunding
  };
}

function sourceSnapshot(source) {
  if (isLiveWorld(source)) {
    return {
      version: source.version || 'unknown',
      month: source.month,
      countries: source.countries.map(country => liveCountryView(source, country)),
      scale: { profile: source.scaleProfile || null },
      globalInternational: null,
      health: null,
      emergence: null
    };
  }
  if (source && Array.isArray(source.countries)) return source;
  if (source && typeof source.snapshot === 'function') return source.snapshot();
  throw new TypeError('Observer bridge requires EconomicWorld or an EconomicWorld snapshot.');
}

function inflationFromHistory(country) {
  const history = Array.isArray(country.history) ? country.history : [];
  if (history.length < 2) return 0;
  const current = finite(history[history.length - 1]?.priceIndex);
  const previous = finite(history[history.length - 2]?.priceIndex);
  if (!(previous > 0)) return 0;
  return current / previous - 1;
}

function sectorOutput(country, sector) {
  const industry = country.industry || {};
  const macro = country.macro || {};
  if (industry.sectorOutputs && sector in industry.sectorOutputs) {
    return nonNegative(industry.sectorOutputs[sector]);
  }
  const fallback = {
    RESOURCE: macro.resourceOutput,
    MATERIALS: macro.materialsOutput,
    CAPITAL: macro.capitalGoodsOutput,
    CONSUMER: macro.consumerGoodsOutput
  };
  return nonNegative(fallback[sector]);
}

function regimeShares(country) {
  const cognitive = country.cognitive || country.lastCognitive || {};
  const regimes = cognitive.regimes || {};
  const agents = Math.max(0, finite(cognitive.agents, finite(country.macro?.cognitiveAgents)));
  const keys = ['normal', 'recession', 'inflation', 'overheating', 'credit_crisis', 'external_crisis'];
  const counts = Object.fromEntries(keys.map(key => [key, nonNegative(regimes[key])]));
  const shares = Object.fromEntries(keys.map(key => [key, agents > 0 ? counts[key] / agents : 0]));
  return {
    agents,
    counts,
    shares,
    crisisShare: agents > 0 ? (counts.credit_crisis + counts.external_crisis) / agents : 0
  };
}

function rawCountry(country, index) {
  const macro = country.macro || {};
  const intl = country.international || country.lastInternational || {};
  const position = COUNTRY_LAYOUT[country.id] || FALLBACK_LAYOUT[index % FALLBACK_LAYOUT.length];
  const regimes = regimeShares(country);
  const sectors = Object.fromEntries(SECTORS.map(sector => [sector, sectorOutput(country, sector)]));
  const industryOutput = Object.values(sectors).reduce((sum, value) => sum + value, 0);

  const householdCount = Array.isArray(country.households) ? country.households.length : finite(country.households);
  const firmCount = Array.isArray(country.firms) ? country.firms.length : finite(country.firms);
  const activeFirmCount = Array.isArray(country.firms)
    ? country.firms.filter(firm => firm.active !== false).length
    : finite(country.activeFirms);

  return {
    id: String(country.id || `COUNTRY-${index + 1}`),
    name: String(country.name || country.id || `Country ${index + 1}`),
    position: { ...position },
    populationProxy: Math.max(0, Math.round(householdCount)),
    firms: {
      total: Math.max(0, Math.round(firmCount)),
      active: Math.max(0, Math.round(activeFirmCount))
    },
    macro: {
      gdp: finite(macro.gdp),
      realOutput: finite(macro.realOutput),
      consumption: finite(macro.consumption),
      investment: finite(macro.grossInvestment),
      governmentDemand: finite(macro.governmentDemand),
      unemployment: clamp01(macro.unemployment),
      priceIndex: finite(macro.priceIndex, 1),
      inflation: inflationFromHistory(country),
      averageWage: finite(macro.avgWage),
      moneySupply: finite(macro.moneySupply),
      outstandingLoans: finite(macro.outstandingLoans),
      publicDebt: finite(macro.publicDebt),
      publicDebtRatio: finite(macro.publicDebtRatio),
      policyRate: finite(macro.policyRate),
      equityMarketCap: finite(macro.equityMarketCap)
    },
    industry: {
      sectors,
      totalOutput: industryOutput,
      activeFirmBySector: { ...(country.sectorFirms || {}) },
      inputShortageUnits: nonNegative(macro.inputShortageUnits),
      b2bTrade: nonNegative(macro.b2bTrade)
    },
    international: {
      currency: String(country.fx?.currency || ''),
      fxRate: finite(country.fx?.rate, finite(macro.exchangeRate, 1)),
      fxChange: finite(country.fx?.lastChange, finite(macro.exchangeRateChange)),
      exportsWXU: finite(intl.exportsWXU, finite(macro.exportsWXU)),
      importsWXU: finite(intl.importsWXU, finite(macro.importsWXU)),
      currentAccountWXU: finite(intl.currentAccountWXU, finite(macro.currentAccountWXU)),
      foreignDebtWXU: finite(intl.foreignDebtWXU, finite(macro.foreignDebtWXU)),
      netForeignAssetsWXU: finite(intl.netForeignAssetsWXU, finite(macro.netForeignAssetsWXU)),
      formalFundingInflowWXU: finite(intl.formalFundingInflowWXU, finite(macro.formalForeignFundingInflowWXU)),
      formalFundingOutflowWXU: finite(intl.formalFundingOutflowWXU, finite(macro.formalForeignFundingOutflowWXU)),
      externalStress: nonNegative(intl.externalStress, finite(macro.externalStress)),
      tariffRate: nonNegative(country.tradePolicy?.tariffRate, finite(macro.tariffRate))
    },
    cognition: {
      agents: regimes.agents,
      regimeCounts: regimes.counts,
      regimeShares: regimes.shares,
      crisisShare: regimes.crisisShare,
      l3Agents: nonNegative(macro.cognitiveL3),
      l4Agents: nonNegative(macro.cognitiveL4),
      hypothesisTests: nonNegative(country.cognitive?.hypothesisTests, country.lastCognitive?.hypothesisTests),
      causalUpdates: nonNegative(country.cognitive?.causalUpdates, country.lastCognitive?.causalUpdates)
    },
    integrity: {
      settlement: country.accounting?.ok !== false,
      generalAccounting: country.generalAccounting?.ok !== false,
      fiscalAccounting: country.fiscalAccounting?.accountingOk !== false,
      monetaryAccounting: country.monetaryAccounting?.accountingOk !== false,
      internationalAccounting: country.internationalAccounting?.accountingOk !== false
    }
  };
}

function uniqueRows(countries, key) {
  const map = new Map();
  for (const country of countries) {
    for (const row of country[key] || []) {
      if (!row?.id || map.has(row.id)) continue;
      map.set(row.id, row);
    }
  }
  return [...map.values()];
}

function aggregateTradeFlows(countries) {
  const trades = uniqueRows(countries, 'recentInternationalTrades');
  const pairs = new Map();
  for (const trade of trades) {
    const from = String(trade.exporterId || '');
    const to = String(trade.importerId || '');
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        id: key,
        kind: 'trade',
        from,
        to,
        transactions: 0,
        worldValueWXU: 0,
        units: 0,
        products: {}
      });
    }
    const row = pairs.get(key);
    row.transactions += 1;
    row.worldValueWXU += nonNegative(trade.worldValue);
    row.units += nonNegative(trade.units);
    const product = String(trade.product || 'unknown');
    row.products[product] = (row.products[product] || 0) + nonNegative(trade.worldValue);
  }
  return [...pairs.values()].sort((a, b) => b.worldValueWXU - a.worldValueWXU || a.id.localeCompare(b.id));
}

function aggregateFundingExposures(countries) {
  const contracts = uniqueRows(countries, 'recentForeignFunding');
  return contracts
    .filter(contract => contract.lenderCountryId && contract.borrowerCountryId)
    .map(contract => ({
      id: String(contract.id),
      kind: 'foreign_funding_exposure',
      from: String(contract.lenderCountryId),
      to: String(contract.borrowerCountryId),
      status: String(contract.status || 'unknown'),
      outstandingWXU: nonNegative(contract.outstandingWXU),
      originalPrincipalWXU: nonNegative(contract.originalPrincipalWXU),
      annualRate: nonNegative(contract.annualRate),
      originatedMonth: Math.max(0, Math.round(finite(contract.originatedMonth)))
    }))
    .sort((a, b) => b.outstandingWXU - a.outstandingWXU || a.id.localeCompare(b.id));
}

function applyVisualEncodings(countries) {
  const maxima = {
    gdp: Math.max(0, ...countries.map(c => nonNegative(c.macro.gdp))),
    activeFirms: Math.max(0, ...countries.map(c => nonNegative(c.firms.active))),
    industryOutput: Math.max(0, ...countries.map(c => nonNegative(c.industry.totalOutput))),
    tradeActivity: Math.max(0, ...countries.map(c => nonNegative(c.international.exportsWXU) + nonNegative(c.international.importsWXU)))
  };

  return countries.map(country => ({
    ...country,
    visual: {
      economyScale: ratioToMax(country.macro.gdp, maxima.gdp),
      firmScale: ratioToMax(country.firms.active, maxima.activeFirms),
      industryScale: ratioToMax(country.industry.totalOutput, maxima.industryOutput),
      tradeActivity: ratioToMax(
        nonNegative(country.international.exportsWXU) + nonNegative(country.international.importsWXU),
        maxima.tradeActivity
      ),
      unemployment: clamp01(country.macro.unemployment),
      externalStress: clamp01(nonNegative(country.international.externalStress) / 1.6),
      crisisShare: clamp01(country.cognition.crisisShare),
      policyRate: finite(country.macro.policyRate),
      fxChange: finite(country.international.fxChange)
    }
  }));
}

export function buildObserverSnapshot(source) {
  const snapshot = sourceSnapshot(source);
  const rawCountries = (snapshot.countries || []).map(rawCountry);
  const countries = applyVisualEncodings(rawCountries);
  const tradeFlows = aggregateTradeFlows(snapshot.countries || []);
  const fundingExposures = aggregateFundingExposures(snapshot.countries || []);

  const output = {
    schema: OBSERVER_SCHEMA,
    sourceVersion: String(snapshot.version || 'unknown'),
    month: Math.max(0, Math.round(finite(snapshot.month))),
    layout: {
      kind: 'abstract-four-country-v1',
      semanticGeography: false,
      coordinateSystem: 'observer-local-xz'
    },
    countries,
    flows: {
      trade: tradeFlows,
      foreignFunding: fundingExposures
    },
    world: {
      scaleProfile: snapshot.scale?.profile?.id || snapshot.scale?.profile?.name || snapshot.scale?.profile?.id || null,
      globalInternationalOk: snapshot.globalInternational?.ok !== false,
      healthOk: snapshot.health?.ok !== false,
      emergence: snapshot.emergence ? structuredClone(snapshot.emergence) : null
    }
  };

  return deepFreeze(output);
}

export { OBSERVER_SCHEMA, COUNTRY_LAYOUT };
