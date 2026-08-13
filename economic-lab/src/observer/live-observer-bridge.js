const LAYOUT = Object.freeze({
  AST: Object.freeze({ x: -12, y: 0, z: -8 }),
  BRN: Object.freeze({ x: 10, y: 0, z: -7 }),
  CYR: Object.freeze({ x: -7, y: 0, z: 10 }),
  DRN: Object.freeze({ x: 11, y: 0, z: 9 })
});

const SECTORS = ['RESOURCE', 'MATERIALS', 'CAPITAL', 'CONSUMER'];
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = value => Math.max(0, Math.min(1, finite(value)));

function inflation(country) {
  const history = country.history || [];
  if (history.length < 2) return 0;
  const now = finite(history[history.length - 1]?.priceIndex);
  const before = finite(history[history.length - 2]?.priceIndex);
  return before > 0 ? now / before - 1 : 0;
}

function sectorCounts(country) {
  const counts = Object.fromEntries(SECTORS.map(id => [id, 0]));
  for (const firm of country.firms || []) {
    if (firm.active !== false && firm.industryId in counts) counts[firm.industryId] += 1;
  }
  return counts;
}

function regimeCounts(country) {
  const macro = country.macro || {};
  return {
    normal: finite(macro.regimeNormalAgents),
    recession: finite(macro.regimeRecessionAgents),
    inflation: finite(macro.regimeInflationAgents),
    overheating: finite(macro.regimeOverheatingAgents),
    credit_crisis: finite(macro.regimeCreditCrisisAgents),
    external_crisis: finite(macro.regimeExternalCrisisAgents)
  };
}

function countryRow(country) {
  const macro = country.macro || {};
  const intl = country.lastInternational || {};
  const regimes = regimeCounts(country);
  const agents = Math.max(0, finite(macro.cognitiveAgents));
  const shares = Object.fromEntries(Object.entries(regimes).map(([key, value]) => [key, agents ? value / agents : 0]));
  const sectors = {
    RESOURCE: Math.max(0, finite(macro.resourceOutput)),
    MATERIALS: Math.max(0, finite(macro.materialsOutput)),
    CAPITAL: Math.max(0, finite(macro.capitalGoodsOutput)),
    CONSUMER: Math.max(0, finite(macro.consumerGoodsOutput))
  };
  return {
    id: country.id,
    name: country.name,
    position: { ...(LAYOUT[country.id] || { x: 0, y: 0, z: 0 }) },
    populationProxy: country.households?.length || 0,
    firms: {
      total: country.firms?.length || 0,
      active: country.firms?.filter(firm => firm.active !== false).length || 0
    },
    macro: {
      gdp: finite(macro.gdp),
      realOutput: finite(macro.realOutput),
      consumption: finite(macro.consumption),
      investment: finite(macro.grossInvestment),
      governmentDemand: finite(macro.governmentDemand),
      unemployment: clamp01(macro.unemployment),
      priceIndex: finite(macro.priceIndex, 1),
      inflation: inflation(country),
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
      totalOutput: Object.values(sectors).reduce((sum, value) => sum + value, 0),
      activeFirmBySector: sectorCounts(country),
      inputShortageUnits: Math.max(0, finite(macro.inputShortageUnits)),
      b2bTrade: Math.max(0, finite(macro.b2bTrade))
    },
    international: {
      currency: country.fx?.currency || '',
      fxRate: finite(country.fx?.rate, finite(macro.exchangeRate, 1)),
      fxChange: finite(country.fx?.lastChange, finite(macro.exchangeRateChange)),
      exportsWXU: finite(intl.exportsWXU, finite(macro.exportsWXU)),
      importsWXU: finite(intl.importsWXU, finite(macro.importsWXU)),
      currentAccountWXU: finite(intl.currentAccountWXU, finite(macro.currentAccountWXU)),
      foreignDebtWXU: finite(intl.foreignDebtWXU, finite(macro.foreignDebtWXU)),
      netForeignAssetsWXU: finite(intl.netForeignAssetsWXU, finite(macro.netForeignAssetsWXU)),
      formalFundingInflowWXU: finite(intl.formalFundingInflowWXU, finite(macro.formalForeignFundingInflowWXU)),
      formalFundingOutflowWXU: finite(intl.formalFundingOutflowWXU, finite(macro.formalForeignFundingOutflowWXU)),
      externalStress: Math.max(0, finite(intl.externalStress, finite(macro.externalStress))),
      tariffRate: Math.max(0, finite(country.tradePolicy?.tariffRate, finite(macro.tariffRate)))
    },
    cognition: {
      agents,
      regimeCounts: regimes,
      regimeShares: shares,
      crisisShare: agents ? (regimes.credit_crisis + regimes.external_crisis) / agents : 0,
      l3Agents: Math.max(0, finite(macro.cognitiveL3)),
      l4Agents: Math.max(0, finite(macro.cognitiveL4)),
      hypothesisTests: Math.max(0, finite(macro.cognitiveHypothesisTests)),
      causalUpdates: Math.max(0, finite(macro.cognitiveCausalUpdates))
    },
    integrity: {
      settlement: true,
      generalAccounting: country.lastAccounting?.ok !== false,
      fiscalAccounting: country.lastFiscal?.accountingOk !== false,
      monetaryAccounting: country.lastMonetary?.accountingOk !== false,
      internationalAccounting: country.lastInternational?.accountingOk !== false
    }
  };
}

function visualise(countries) {
  const max = key => Math.max(1e-9, ...countries.map(key));
  const maxGdp = max(c => Math.max(0, c.macro.gdp));
  const maxFirms = max(c => c.firms.active);
  const maxIndustry = max(c => c.industry.totalOutput);
  const maxTrade = max(c => Math.max(0, c.international.exportsWXU) + Math.max(0, c.international.importsWXU));
  return countries.map(country => ({
    ...country,
    visual: {
      economyScale: clamp01(Math.max(0, country.macro.gdp) / maxGdp),
      firmScale: clamp01(country.firms.active / maxFirms),
      industryScale: clamp01(country.industry.totalOutput / maxIndustry),
      tradeActivity: clamp01((Math.max(0, country.international.exportsWXU) + Math.max(0, country.international.importsWXU)) / maxTrade),
      unemployment: country.macro.unemployment,
      externalStress: clamp01(country.international.externalStress / 1.6),
      crisisShare: clamp01(country.cognition.crisisShare),
      policyRate: country.macro.policyRate,
      fxChange: country.international.fxChange
    }
  }));
}

function tradeFlows(world) {
  if (!world.international?.recentTrades) return [];
  const map = new Map();
  for (const country of world.countries || []) {
    for (const trade of world.international.recentTrades(world.month, country.id, 18) || []) {
      if (!trade?.id || map.has(trade.id)) continue;
      map.set(trade.id, trade);
    }
  }
  const pairs = new Map();
  for (const trade of map.values()) {
    const from = trade.exporterId;
    const to = trade.importerId;
    if (!from || !to || from === to) continue;
    const id = `${from}->${to}`;
    if (!pairs.has(id)) pairs.set(id, { id, kind: 'trade', from, to, transactions: 0, worldValueWXU: 0, units: 0, products: {} });
    const row = pairs.get(id);
    row.transactions += 1;
    row.worldValueWXU += Math.max(0, finite(trade.worldValue));
    row.units += Math.max(0, finite(trade.units));
  }
  return [...pairs.values()].sort((a, b) => b.worldValueWXU - a.worldValueWXU);
}

function fundingFlows(world) {
  return (world.international?.fundingContracts || [])
    .filter(row => row.lenderCountryId && row.borrowerCountryId && finite(row.outstandingWXU) > 0)
    .slice(-12)
    .map(row => ({
      id: String(row.id),
      kind: 'foreign_funding_exposure',
      from: String(row.lenderCountryId),
      to: String(row.borrowerCountryId),
      status: String(row.status || 'unknown'),
      outstandingWXU: Math.max(0, finite(row.outstandingWXU)),
      originalPrincipalWXU: Math.max(0, finite(row.originalPrincipalWXU)),
      annualRate: Math.max(0, finite(row.annualRate)),
      originatedMonth: Math.max(0, Math.round(finite(row.originatedMonth)))
    }));
}

export function buildLiveObserverSnapshot(world) {
  const countries = visualise((world.countries || []).map(countryRow));
  return {
    schema: 'economic-lab.observer.live.v1',
    sourceVersion: String(world.version || '0.10'),
    month: Math.max(0, Math.round(finite(world.month))),
    layout: { kind: 'abstract-four-country-v1', semanticGeography: false, coordinateSystem: 'observer-local-xz' },
    countries,
    flows: { trade: tradeFlows(world), foreignFunding: fundingFlows(world) },
    world: { scaleProfile: world.scaleProfile?.id || world.scaleProfile?.name || null, globalInternationalOk: true, healthOk: true, emergence: null }
  };
}
