const HISTORY_FORMAT = 'compact-v2';

function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function primitiveRecord(source, limit = 16) {
  if (!source || typeof source !== 'object') return null;
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(source)) {
    if (count >= limit) break;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
      count += 1;
    } else if (typeof value === 'string' || typeof value === 'boolean') {
      out[key] = value;
      count += 1;
    }
  }
  return Object.keys(out).length ? out : null;
}

function compactHypotheses(rows, limit = 3) {
  return (rows || []).slice(0, limit).map(row => {
    const out = {};
    if (typeof row?.name === 'string') out.name = row.name;
    const confidence = finite(row?.confidence);
    if (confidence !== null) out.confidence = confidence;
    const reliability = finite(row?.learnedReliability);
    if (reliability !== null) out.learnedReliability = reliability;
    return out;
  });
}

function compactCandidates(rows, limit = 3) {
  return (rows || []).slice(0, limit).map(row => {
    const out = {};
    if (typeof row?.name === 'string') out.name = row.name;
    const utility = finite(row?.cognitiveUtility, finite(row?.utility));
    if (utility !== null) out.utility = utility;
    for (const key of [
      'consumeShare',
      'productionChange',
      'priceChange',
      'hiringChange',
      'approved',
      'rateChange',
      'rateShift',
      'spendingMultiplier',
      'investmentMultiplier',
      'taxShift',
      'benefitMultiplier',
      'spendingChange',
      'taxChange',
      'transferChange'
    ]) {
      const value = row?.[key];
      if (typeof value === 'boolean') out[key] = value;
      else if (Number.isFinite(Number(value))) out[key] = Number(value);
    }
    return out;
  });
}

function compactAnalogies(rows, limit = 2) {
  return (rows || []).slice(0, limit).map(row => {
    const out = {};
    const month = finite(row?.month);
    const similarity = finite(row?.similarity);
    const reward = finite(row?.reward);
    if (month !== null) out.month = month;
    if (similarity !== null) out.similarity = similarity;
    if (reward !== null) out.reward = reward;
    if (typeof row?.decision === 'string') out.decision = row.decision;
    const topHypothesis = row?.topHypothesis?.name || row?.topHypothesis;
    if (typeof topHypothesis === 'string') out.topHypothesis = topHypothesis;
    return out;
  });
}

function compactCausalReasoning(causal) {
  if (!causal || typeof causal !== 'object') return null;
  const out = {};
  if (typeof causal.target === 'string') out.target = causal.target;
  const forecast = primitiveRecord(causal.forecast, 4);
  if (forecast) out.forecast = forecast;
  const explanations = (causal.explanations || []).slice(0, 3).map(row => {
    const item = {};
    const cause = row?.cause || row?.source || row?.name;
    if (typeof cause === 'string') item.cause = cause;
    for (const key of ['contribution', 'coefficient', 'confidence']) {
      const value = finite(row?.[key]);
      if (value !== null) item[key] = value;
    }
    return item;
  });
  if (explanations.length) out.explanations = explanations;
  return Object.keys(out).length ? out : null;
}

export function compactDecisionTrace(trace) {
  if (!trace || typeof trace !== 'object') return null;
  if (trace.__historyFormat === HISTORY_FORMAT) return trace;

  const out = { __historyFormat: HISTORY_FORMAT };
  if (typeof trace.selected === 'string') out.selected = trace.selected;
  if (typeof trace.reason === 'string') out.reason = trace.reason;

  const perception = primitiveRecord(trace.perception, 12);
  const forecast = primitiveRecord(trace.forecast, 8);
  const worldModel = primitiveRecord(trace.worldModel, 6);
  if (perception) out.perception = perception;
  if (forecast) out.forecast = forecast;
  if (worldModel) out.worldModel = worldModel;

  if (trace.cognition && typeof trace.cognition === 'object') {
    const cognition = {};
    const attention = primitiveRecord(trace.cognition.attention, 5);
    const uncertainty = primitiveRecord(trace.cognition.uncertainty, 6);
    if (attention) cognition.attention = attention;
    const planningHorizon = finite(trace.cognition.planningHorizon);
    if (planningHorizon !== null) cognition.planningHorizon = planningHorizon;
    if (uncertainty) cognition.uncertainty = uncertainty;
    if (Object.keys(cognition).length) out.cognition = cognition;
  }

  const hypotheses = compactHypotheses(trace.hypotheses, 3);
  if (hypotheses.length) out.hypotheses = hypotheses;
  const candidates = compactCandidates(trace.candidates || trace.counterfactuals, 3);
  if (candidates.length) out.candidates = candidates;

  const analogies = compactAnalogies(trace.memoryReasoning?.analogies, 2);
  if (analogies.length) out.memoryReasoning = { analogies };

  const causalReasoning = compactCausalReasoning(trace.causalReasoning);
  if (causalReasoning) out.causalReasoning = causalReasoning;

  return out;
}

export function compactWorldDecisionHistories(countries) {
  let agents = 0;
  let records = 0;
  let converted = 0;
  for (const country of countries || []) {
    const all = [
      ...(country.households || []),
      ...(country.firms || []),
      ...(country.banks || []),
      ...(country.governments || []),
      ...(country.centralBanks || [])
    ];
    for (const agent of all) {
      const decisions = agent.cognition?.decisions;
      if (!Array.isArray(decisions) || !decisions.length) continue;
      agents += 1;
      for (const decision of decisions) {
        records += 1;
        if (!decision?.trace || /^compact-v\d+$/.test(String(decision.trace.__historyFormat || ''))) continue;
        // Replace only the historical pointer. cognition.lastReasoning remains the
        // detailed current trace, so current-agent inspection loses no detail.
        decision.trace = compactDecisionTrace(decision.trace);
        decision.historyFormat = HISTORY_FORMAT;
        converted += 1;
      }
    }
  }
  return { agents, records, converted };
}
