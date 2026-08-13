import { clamp } from '../core/rng.js';

function normalizeSchedule(schedule = []) {
  return schedule.map((event, index) => ({
    id: String(event.id || `event-${index + 1}`),
    month: Math.max(1, Math.round(Number(event.month || 1))),
    countryId: event.countryId || '*',
    kind: String(event.kind || ''),
    ...event,
    applied: false
  })).sort((a, b) => a.month - b.month || a.id.localeCompare(b.id));
}

function targetCountries(world, countryId) {
  if (!countryId || countryId === '*') return world.countries;
  const country = world.countries.find(c => c.id === countryId);
  if (!country) throw new Error(`experiment country not found: ${countryId}`);
  return [country];
}

function targetAgents(country, kinds = ['household', 'firm', 'bank', 'government', 'central_bank']) {
  const wanted = new Set(kinds);
  const out = [];
  if (wanted.has('household')) out.push(...(country.households || []));
  if (wanted.has('firm')) out.push(...(country.firms || []).filter(f => f.active !== false));
  if (wanted.has('bank')) out.push(...(country.banks || []));
  if (wanted.has('government')) out.push(...(country.governments || []));
  if (wanted.has('central_bank')) out.push(...(country.centralBanks || []));
  return out;
}

function snapshotTarget(country) {
  return {
    activeFirms: (country.firms || []).filter(f => f.active !== false).length,
    meanProductivity: (country.firms || []).filter(f => f.active !== false).reduce((s, f) => s + Number(f.productivity || 0), 0) /
      Math.max(1, (country.firms || []).filter(f => f.active !== false).length),
    tariffRate: Number(country.tradePolicy?.tariffRate || 0),
    meanOptimism: [
      ...(country.households || []),
      ...(country.firms || []).filter(f => f.active !== false)
    ].reduce((s, a) => s + Number(a.optimism || 0), 0) /
      Math.max(1, (country.households || []).length + (country.firms || []).filter(f => f.active !== false).length)
  };
}

export class ExperimentSystem {
  constructor({ schedule = [] } = {}) {
    this.schedule = normalizeSchedule(schedule);
    this.log = [];
  }

  beforeMonth(world, month) {
    const applied = [];
    for (const event of this.schedule) {
      if (event.applied || event.month !== month) continue;
      const countries = targetCountries(world, event.countryId);
      for (const country of countries) {
        const before = snapshotTarget(country);
        const details = this.applyEvent(country, event);
        const after = snapshotTarget(country);
        const row = {
          id: event.id,
          month,
          countryId: country.id,
          kind: event.kind,
          before,
          after,
          details
        };
        this.log.push(row);
        applied.push(row);
      }
      event.applied = true;
    }
    return applied;
  }

  applyEvent(country, event) {
    if (event.kind === 'productivity_shock') {
      const factor = Math.max(0.05, Number(event.factor ?? 1));
      let affected = 0;
      for (const firm of country.firms || []) {
        if (firm.active === false) continue;
        if (event.industryId && firm.industryId !== event.industryId) continue;
        firm.productivity = Math.max(0.01, Number(firm.productivity || 0) * factor);
        affected += 1;
      }
      return { affected, factor, industryId: event.industryId || null };
    }

    if (event.kind === 'belief_shift') {
      const key = String(event.key || 'demandGrowth');
      const delta = Number(event.delta || 0);
      const kinds = Array.isArray(event.agentKinds) ? event.agentKinds : ['household', 'firm'];
      const agents = targetAgents(country, kinds);
      let affected = 0;
      for (const agent of agents) {
        if (agent.cognition?.beliefs?.[key]) {
          agent.cognition.beliefs[key].mean = Number(agent.cognition.beliefs[key].mean || 0) + delta;
          agent.cognition.beliefs[key].uncertainty = clamp(
            Number(agent.cognition.beliefs[key].uncertainty || 0.3) * Number(event.uncertaintyFactor || 1),
            0.025,
            1.5
          );
          affected += 1;
        }
        if (agent.beliefs && key in agent.beliefs) agent.beliefs[key] = Number(agent.beliefs[key] || 0) + delta;
      }
      return { affected, key, delta, kinds };
    }

    if (event.kind === 'confidence_shock') {
      const delta = Number(event.delta || 0);
      const kinds = Array.isArray(event.agentKinds) ? event.agentKinds : ['household', 'firm', 'bank'];
      const agents = targetAgents(country, kinds);
      for (const agent of agents) agent.optimism = clamp(Number(agent.optimism || 0) + delta, -1.5, 1.5);
      return { affected: agents.length, delta, kinds };
    }

    if (event.kind === 'tariff_shock') {
      if (!country.tradePolicy) throw new Error(`country ${country.id} has no trade policy`);
      const rate = clamp(Number(event.rate ?? country.tradePolicy.tariffRate), 0, 1.5);
      country.tradePolicy.tariffRate = rate;
      return { rate };
    }

    if (event.kind === 'bank_risk_shock') {
      const delta = Number(event.delta || 0);
      for (const bank of country.banks || []) bank.riskAversion = clamp(Number(bank.riskAversion || 0) + delta, 0, 1.5);
      return { affected: (country.banks || []).length, delta };
    }

    throw new Error(`unknown experiment event kind: ${event.kind}`);
  }

  pending() {
    return this.schedule.filter(event => !event.applied).map(event => ({ ...event }));
  }

  summary() {
    return {
      scheduled: this.schedule.length,
      applied: this.log.length,
      pending: this.schedule.filter(event => !event.applied).length,
      log: this.log.map(row => structuredClone(row))
    };
  }
}
