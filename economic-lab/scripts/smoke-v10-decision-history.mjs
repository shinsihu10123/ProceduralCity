import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';

const HISTORY_MODE = 'compact-v2';

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value) || '', 'utf8');
}

function verifyAgent(agent, { requireSmallerHistory = false } = {}) {
  const cognition = agent.cognition;
  assert.ok(cognition?.enabled);
  assert.equal(cognition.decisionHistoryMode, HISTORY_MODE, `${agent.id} must use direct ${HISTORY_MODE} history`);
  assert.ok(cognition.lastReasoning && typeof cognition.lastReasoning === 'object');
  assert.ok(!/^compact-v\d+$/.test(String(cognition.lastReasoning.__historyFormat || '')), `${agent.id} current reasoning must stay detailed`);
  assert.ok(Array.isArray(cognition.lastReasoning.candidates) || Array.isArray(cognition.lastReasoning.counterfactuals), `${agent.id} current reasoning candidates missing`);
  assert.ok(Array.isArray(cognition.decisions) && cognition.decisions.length > 0);

  for (const decision of cognition.decisions) {
    assert.equal(decision.historyFormat, HISTORY_MODE, `${agent.id} historical decision must be compact from creation`);
    assert.equal(decision.trace?.__historyFormat, HISTORY_MODE);
    assert.ok(typeof decision.selected === 'string');
    assert.ok(!decision.trace?.cognition?.calibration, `${agent.id} historical trace must not retain calibration matrix`);
    assert.ok(!decision.trace?.cognition?.strategyStats, `${agent.id} historical trace must not retain strategy stats`);
    assert.ok((decision.trace?.candidates?.length || 0) <= 3, `${agent.id} compact-v2 must cap historical candidates at three`);
    assert.ok((decision.trace?.hypotheses?.length || 0) <= 3, `${agent.id} compact-v2 must cap historical hypotheses at three`);
    assert.ok((decision.trace?.memoryReasoning?.analogies?.length || 0) <= 2, `${agent.id} compact-v2 must cap historical analogies at two`);
    for (const candidate of decision.trace?.candidates || []) {
      assert.ok(!candidate.counterfactual, `${agent.id} historical candidate must not retain nested counterfactual state`);
      assert.ok(!candidate.scenarios, `${agent.id} historical candidate must not retain scenario arrays`);
      assert.ok(typeof candidate.name === 'string');
      assert.ok(Number.isFinite(Number(candidate.utility)), `${agent.id} historical candidate must retain its evaluated utility`);
    }
  }

  if (requireSmallerHistory) {
    const latest = cognition.decisions[cognition.decisions.length - 1];
    assert.ok(
      jsonBytes(latest.trace) < jsonBytes(cognition.lastReasoning),
      `${agent.id} compact-v2 historical trace must be smaller than the corresponding detailed current trace`
    );
  }
}

const world = new EconomicWorld('ECON-V10-HISTORY', {
  scaleProfile: 'compact',
  healthCheckInterval: 0
});
assert.deepEqual(world.decisionHistory, {
  mode: HISTORY_MODE,
  currentDetail: 'full',
  historyDetail: 'compact'
});
for (const country of world.countries) {
  for (const agent of world.cognitive.agents(country)) {
    assert.equal(agent.cognition.decisionHistoryMode, HISTORY_MODE, `${agent.id} initial v0.10 agent policy missing`);
  }
}

// Direct entrant lifecycle: a new firm must inherit the same storage policy before
// it ever records a decision.
const entrantCountry = world.countries[0];
const entrantIndustry = entrantCountry.firms.find(f => f.active !== false)?.industryId;
const entrant = world.createEntrant(entrantCountry, entrantIndustry);
assert.equal(entrant.cognition.decisionHistoryMode, HISTORY_MODE);
assert.equal(entrant.cognition.decisions.length, 0);

world.step(4);
for (const country of world.countries) {
  verifyAgent(country.households.find(agent => agent.cognition?.decisions?.length), { requireSmallerHistory: true });
  verifyAgent(country.firms.find(agent => agent.active !== false && agent.cognition?.decisions?.length), { requireSmallerHistory: true });
  verifyAgent(country.banks.find(agent => agent.cognition?.decisions?.length));
  verifyAgent(country.governments.find(agent => agent.cognition?.decisions?.length));
  verifyAgent(country.centralBanks.find(agent => agent.cognition?.decisions?.length));
}
assert.equal(entrant.cognition.decisionHistoryMode, HISTORY_MODE);
if (entrant.cognition.decisions.length) verifyAgent(entrant);

const a = new EconomicWorld('ECON-V10-HISTORY-DETERMINISM', { scaleProfile: 'compact', healthCheckInterval: 0 });
const b = new EconomicWorld('ECON-V10-HISTORY-DETERMINISM', { scaleProfile: 'compact', healthCheckInterval: 0 });
a.step(4);
b.step(4);
for (let i = 0; i < a.countries.length; i++) {
  assert.deepEqual(a.countries[i].households[0].cognition.decisions, b.countries[i].households[0].cognition.decisions);
  assert.deepEqual(a.countries[i].firms[0].cognition.decisions, b.countries[i].firms[0].cognition.decisions);
  assert.equal(a.countries[i].households[0].cognition.decisionHistoryMode, HISTORY_MODE);
  assert.equal(b.countries[i].households[0].cognition.decisionHistoryMode, HISTORY_MODE);
}

assert.ok(a.forceHealthCheck().ok);
assert.ok(b.forceHealthCheck().ok);
console.log('Economic Lab v0.10 direct compact-v2 decision-history gate PASS');
