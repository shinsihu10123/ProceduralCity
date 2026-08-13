import { clamp } from '../core/rng.js';

const BELIEF_KEYS = ['inflation', 'unemployment', 'demandGrowth', 'wageGrowth', 'incomeGrowth', 'externalStress', 'creditStress'];
const MAX_HISTORY = 36;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uniqueSample(pool, selfId, count, rng) {
  const candidates = pool.filter(x => x.id !== selfId);
  if (!candidates.length) return [];
  const picked = [];
  const available = candidates.slice();
  while (picked.length < count && available.length) {
    const index = rng.int(0, available.length);
    picked.push(available.splice(index, 1)[0]);
  }
  return picked;
}

function peerCountFor(agent) {
  if (agent.kind === 'household') return 4;
  if (agent.kind === 'firm') return 4;
  if (agent.kind === 'bank') return 6;
  if (agent.kind === 'government' || agent.kind === 'central_bank') return 8;
  return 3;
}

function candidatePool(country, agent) {
  if (agent.kind === 'household') return country.households || [];
  if (agent.kind === 'firm') {
    const sameIndustry = (country.firms || []).filter(f => f.industryId === agent.industryId && f.active !== false);
    return sameIndustry.length >= 3 ? sameIndustry : (country.firms || []).filter(f => f.active !== false);
  }
  if (agent.kind === 'bank') return [
    ...(country.firms || []).filter(f => f.active !== false),
    ...(country.households || []).slice(0, 80)
  ];
  if (agent.kind === 'government' || agent.kind === 'central_bank') return [
    ...(country.banks || []),
    ...(country.firms || []).filter(f => f.active !== false),
    ...(country.households || []).slice(0, 120)
  ];
  return [];
}

function ensureSocialState(country, agent, rng) {
  const cognition = agent?.cognition;
  if (!cognition?.enabled) return null;
  if (!cognition.social) {
    const peers = uniqueSample(candidatePool(country, agent), agent.id, peerCountFor(agent), rng);
    cognition.social = {
      conformity: clamp(0.22 + rng.normal(0, 0.09), 0.04, 0.58),
      sourceTrust: clamp(0.52 + rng.normal(0, 0.10), 0.20, 0.82),
      independence: clamp(0.55 + rng.normal(0, 0.10), 0.22, 0.88),
      peerIds: peers.map(x => x.id),
      sourceWeights: Object.fromEntries(peers.map(x => [x.id, clamp(0.65 + rng.normal(0, 0.17), 0.25, 1)])),
      lastInfluence: null,
      history: [],
      cumulativeInfluence: 0,
      cascadeMonths: 0
    };
  }
  return cognition.social;
}

function beliefSnapshot(agents) {
  const out = new Map();
  for (const agent of agents) {
    const beliefs = {};
    for (const key of BELIEF_KEYS) {
      const b = agent.cognition?.beliefs?.[key];
      if (!b) continue;
      beliefs[key] = {
        mean: finite(b.mean),
        uncertainty: clamp(finite(b.uncertainty, 0.3), 0.02, 1.5)
      };
    }
    out.set(agent.id, beliefs);
  }
  return out;
}

function weightedPeerSignal(agent, key, snapshot, agentMap) {
  const social = agent.cognition?.social;
  if (!social?.peerIds?.length) return null;
  let weighted = 0;
  let weightTotal = 0;
  const values = [];
  for (const peerId of social.peerIds) {
    const peer = agentMap.get(peerId);
    if (!peer) continue;
    const peerBelief = snapshot.get(peerId)?.[key];
    if (!peerBelief) continue;
    const baseWeight = finite(social.sourceWeights?.[peerId], 0.5);
    const confidenceWeight = 1 / (0.10 + peerBelief.uncertainty);
    const weight = baseWeight * confidenceWeight;
    weighted += peerBelief.mean * weight;
    weightTotal += weight;
    values.push({ id: peerId, value: peerBelief.mean, weight });
  }
  if (weightTotal <= 0 || !values.length) return null;
  const mean = weighted / weightTotal;
  const variance = values.reduce((sum, row) => sum + row.weight * (row.value - mean) ** 2, 0) / weightTotal;
  return {
    mean,
    dispersion: Math.sqrt(Math.max(0, variance)),
    sources: values.length,
    strongestSources: values.sort((a, b) => b.weight - a.weight).slice(0, 3)
  };
}

function influenceOne(agent, key, signal, month) {
  const cognition = agent.cognition;
  const social = cognition.social;
  const belief = cognition.beliefs?.[key];
  if (!belief || !signal) return null;
  const ownBefore = finite(belief.mean);
  const ownUncertainty = clamp(finite(belief.uncertainty, 0.3), 0.02, 1.5);
  const disagreement = Math.abs(signal.mean - ownBefore);
  const agreement = 1 / (1 + signal.dispersion * 12);
  const uncertaintyOpenness = clamp(ownUncertainty / 0.5, 0.15, 1.3);
  const disagreementResistance = 1 / (1 + disagreement * 5 * social.independence);
  const cascadePressure = clamp(agreement * uncertaintyOpenness * social.conformity, 0, 1);
  const baseInfluence = social.conformity * social.sourceTrust * uncertaintyOpenness * disagreementResistance;
  const influence = clamp(baseInfluence * (0.55 + agreement * 0.65), 0.01, 0.36);
  const after = ownBefore + influence * (signal.mean - ownBefore);
  belief.mean = after;

  // Agreement among peers can create overconfidence even when the group is wrong.
  const confidenceCompression = 1 - influence * agreement * 0.18;
  const disagreementPenalty = Math.min(0.12, disagreement * 0.05);
  belief.uncertainty = clamp(ownUncertainty * confidenceCompression + disagreementPenalty, 0.025, 1.2);
  social.cumulativeInfluence += Math.abs(after - ownBefore);
  if (cascadePressure > 0.34 && influence > 0.12) social.cascadeMonths += 1;

  return {
    key,
    ownBefore,
    peerMean: signal.mean,
    after,
    shift: after - ownBefore,
    peerDispersion: signal.dispersion,
    sources: signal.sources,
    influence,
    agreement,
    cascadePressure,
    strongestSources: signal.strongestSources
  };
}

function recordEntryRegistration(social, month) {
  const row = {
    month,
    updates: [],
    meanInfluence: 0,
    meanDispersion: 0,
    herdingIndex: 0,
    cascade: false,
    entryRegistration: true
  };
  social.lastInfluence = row;
  social.history.push({
    month,
    meanInfluence: 0,
    meanDispersion: 0,
    herdingIndex: 0,
    cascade: false,
    entryRegistration: true
  });
  if (social.history.length > MAX_HISTORY) social.history.shift();
}

export class InformationNetworkSystem {
  constructor({ rng }) {
    this.rng = rng;
  }

  initializeWorld(countries) {
    for (const country of countries) this.initializeCountry(country);
  }

  initializeCountry(country) {
    for (const agent of this.agents(country)) ensureSocialState(country, agent, this.rng);
  }

  initializeAgent(country, agent) {
    const social = ensureSocialState(country, agent, this.rng);
    const entryMonth = Number(agent?.cognition?.lastObservation?.month || 0);
    // Firms are created after the month's information-spread phase. Record an explicit
    // zero-influence entry cycle so lifecycle state is complete without pretending that
    // the entrant observed peers before it existed. The next month uses normal propagation.
    if (social && entryMonth > 0 && !social.lastInfluence) recordEntryRegistration(social, entryMonth);
    return social;
  }

  agents(country) {
    return [
      ...(country.households || []),
      ...(country.firms || []).filter(f => f.active !== false),
      ...(country.banks || []),
      ...(country.governments || []),
      ...(country.centralBanks || [])
    ];
  }

  refreshEntrantPeers(country) {
    for (const agent of this.agents(country)) {
      const social = ensureSocialState(country, agent, this.rng);
      if (!social || social.peerIds.length >= Math.min(2, peerCountFor(agent))) continue;
      const peers = uniqueSample(candidatePool(country, agent), agent.id, peerCountFor(agent), this.rng);
      social.peerIds = peers.map(x => x.id);
      social.sourceWeights = Object.fromEntries(peers.map(x => [x.id, clamp(0.65 + this.rng.normal(0, 0.17), 0.25, 1)]));
    }
  }

  spreadWorld(countries, month) {
    for (const country of countries) this.spreadCountry(country, month);
  }

  spreadCountry(country, month) {
    this.refreshEntrantPeers(country);
    const agents = this.agents(country);
    const agentMap = new Map(agents.map(a => [a.id, a]));
    const snapshot = beliefSnapshot(agents);

    for (const agent of agents) {
      const social = ensureSocialState(country, agent, this.rng);
      if (!social) continue;
      const updates = [];
      for (const key of BELIEF_KEYS) {
        const signal = weightedPeerSignal(agent, key, snapshot, agentMap);
        const row = influenceOne(agent, key, signal, month);
        if (row) updates.push(row);
      }
      const meanInfluence = updates.length ? updates.reduce((s, x) => s + x.influence, 0) / updates.length : 0;
      const meanDispersion = updates.length ? updates.reduce((s, x) => s + x.peerDispersion, 0) / updates.length : 0;
      const herdingIndex = updates.length
        ? updates.reduce((s, x) => s + x.influence * x.agreement, 0) / updates.length
        : 0;
      social.lastInfluence = {
        month,
        updates,
        meanInfluence,
        meanDispersion,
        herdingIndex,
        cascade: updates.some(x => x.cascadePressure > 0.34 && x.influence > 0.12)
      };
      social.history.push({
        month,
        meanInfluence,
        meanDispersion,
        herdingIndex,
        cascade: social.lastInfluence.cascade
      });
      if (social.history.length > MAX_HISTORY) social.history.shift();
    }
  }

  summary(country) {
    const agents = this.agents(country).filter(a => a.cognition?.social);
    if (!agents.length) return {
      agents: 0,
      meanInfluence: 0,
      meanDispersion: 0,
      meanHerdingIndex: 0,
      cascadeAgents: 0
    };
    let influence = 0;
    let dispersion = 0;
    let herding = 0;
    let cascades = 0;
    for (const agent of agents) {
      const last = agent.cognition.social.lastInfluence || {};
      influence += finite(last.meanInfluence);
      dispersion += finite(last.meanDispersion);
      herding += finite(last.herdingIndex);
      if (last.cascade) cascades += 1;
    }
    return {
      agents: agents.length,
      meanInfluence: influence / agents.length,
      meanDispersion: dispersion / agents.length,
      meanHerdingIndex: herding / agents.length,
      cascadeAgents: cascades
    };
  }
}
