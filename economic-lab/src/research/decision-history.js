function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function primitiveRecord(source, limit = 24) {
  if (!source || typeof source !== 'object') return null;
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(source)) {
    if (count >= limit) break;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        out[key] = value;
        count += 1;
      }
    } else if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
      out[key] = value;
      count += 1;
    }
  }
  return out;
}

function compactHypotheses(rows, limit = 4) {
  return (rows || []).slice(0, limit).map(row => ({
    name: row?.name || null,
    confidence: finite(row?.confidence, 0),
    learnedReliability: finite(row?.learnedReliability, null)
  }));
}

function compactCandidates(rows, limit = 6) {
  return (rows || []).slice(0, limit).map(row => {
    const out = {
      name: row?.name || null,
      utility: finite(row?.utility, null),
      expectedUtility: finite(row?.expectedUtility, null),
      downside: finite(row?.downside, null),
      variance: finite(row?.variance, null)
    };
    for (const key of [
      'consumeShare',
      'productionChange',
      'priceChange',
      'hiringChange',
      'approved',
      'rateChange',
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

function compactAnalogies(rows, limit = 3) {
  return (rows || []).slice(0, limit).map(row => ({
    month: finite(row?.month, null),
    similarity: finite(row?.similarity, null),
    reward: finite(row?.reward, null),
    decision: typeof row?.decision === 'string' ? row.decision : null,
    topHypothesis: row?.topHypothesis?.name || row?.topHypothesis || null
  }));
}

function compactCausalReasoning(causal) {
  if (!causal || typeof causal !== 'object') return null;
  return {
    target: causal.target || null,
    forecast: primitiveRecord(causal.forecast, 8),
    explanations: (causal.explanations || []).slice(0, 4).map(row => ({
      cause: row?.cause || row?.source || row?.name || null,
      target: row?.target || null,
      contribution: finite(row?.contribution, null),
      coefficient: finite(row?.coefficient, null),
      confidence: finite(row?.confidence, null),
      observations: finite(row?.observations, null)
    }))
  };
}

export function compactDecisionTrace(trace) {
  if (!trace || typeof trace !== 'object') return null;
  if (trace.__historyFormat === 'compact-v1') return trace;
  return {
    __historyFormat: 'compact-v1',
    selected: trace.selected || null,
    reason: typeof trace.reason === 'string' ? trace.reason : null,
    perception: primitiveRecord(trace.perception, 24),
    forecast: primitiveRecord(trace.forecast, 16),
    worldModel: primitiveRecord(trace.worldModel, 16),
    cognition: trace.cognition ? {
      attention: primitiveRecord(trace.cognition.attention, 8),
      planningHorizon: finite(trace.cognition.planningHorizon, null),
      uncertainty: primitiveRecord(trace.cognition.uncertainty, 8)
    } : null,
    hypotheses: compactHypotheses(trace.hypotheses, 4),
    candidates: compactCandidates(trace.candidates || trace.counterfactuals, 6),
    memoryReasoning: trace.memoryReasoning ? {
      analogies: compactAnalogies(trace.memoryReasoning.analogies, 3),
      demandForecast: primitiveRecord(trace.memoryReasoning.demandForecast, 6),
      incomeForecast: primitiveRecord(trace.memoryReasoning.incomeForecast, 6),
      unemploymentForecast: primitiveRecord(trace.memoryReasoning.unemploymentForecast, 6),
      inflationForecast: primitiveRecord(trace.memoryReasoning.inflationForecast, 6)
    } : null,
    causalReasoning: compactCausalReasoning(trace.causalReasoning)
  };
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
        if (!decision?.trace || decision.trace.__historyFormat === 'compact-v1') continue;
        // Replace only the historical pointer. If cognition.lastReasoning references
        // the original detailed object, it remains intact for current inspection.
        decision.trace = compactDecisionTrace(decision.trace);
        decision.historyFormat = 'compact-v1';
        converted += 1;
      }
    }
  }
  return { agents, records, converted };
}
