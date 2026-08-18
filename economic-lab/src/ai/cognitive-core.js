export * from './cognitive-core-base-v09.js';

import { compactDecisionTrace } from '../research/decision-history.js';

function isCompactHistoryMode(mode) {
  return typeof mode === 'string' && /^compact-v\d+$/.test(mode);
}

export function recordDecision(agent, decision, month, realizedReward = null) {
  const c = agent?.cognition;
  if (!c?.enabled) return;

  const selected = decision?.selected || decision?.name || 'unknown';
  const detailedTrace = decision?.trace || null;
  const compactMode = isCompactHistoryMode(c.decisionHistoryMode);
  const historyTrace = detailedTrace
    ? compactMode
      ? compactDecisionTrace(detailedTrace)
      : structuredClone(detailedTrace)
    : null;
  const historyFormat = compactMode
    ? historyTrace?.__historyFormat || c.decisionHistoryMode
    : null;

  c.decisions.push({
    month,
    selected,
    trace: historyTrace,
    realizedReward,
    ...(historyFormat ? { historyFormat } : {})
  });
  if (c.decisions.length > 48) c.decisions.shift();

  if (!c.strategyStats[selected]) c.strategyStats[selected] = { count: 0, meanReward: 0, lastReward: 0 };
  c.strategyStats[selected].count += 1;

  // v0.10 stores the compact historical record separately while retaining the
  // full current reasoning object for inspection. v0.9 keeps its original
  // cloned-history semantics because it has no compact history policy.
  c.lastReasoning = compactMode ? detailedTrace : historyTrace;
}
