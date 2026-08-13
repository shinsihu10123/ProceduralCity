import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10.js';

function verifyAgent(agent) {
  const cognition = agent.cognition;
  assert.ok(cognition?.enabled);
  assert.ok(cognition.lastReasoning && typeof cognition.lastReasoning === 'object');
  assert.notEqual(cognition.lastReasoning.__historyFormat, 'compact-v1', `${agent.id} current reasoning must stay detailed`);
  assert.ok(Array.isArray(cognition.lastReasoning.candidates) || Array.isArray(cognition.lastReasoning.counterfactuals), `${agent.id} current reasoning candidates missing`);
  assert.ok(Array.isArray(cognition.decisions) && cognition.decisions.length > 0);
  for (const decision of cognition.decisions) {
    assert.equal(decision.historyFormat, 'compact-v1', `${agent.id} historical decision must be compact`);
    assert.equal(decision.trace?.__historyFormat, 'compact-v1');
    assert.ok(typeof decision.selected === 'string');
    assert.ok(!decision.trace?.cognition?.calibration, `${agent.id} historical trace must not retain calibration matrix`);
    assert.ok(!decision.trace?.cognition?.strategyStats, `${agent.id} historical trace must not retain strategy stats`);
    assert.ok((decision.trace?.candidates?.length || 0) <= 6);
  }
}

const world = new EconomicWorld('ECON-V10-HISTORY', {
  scaleProfile: 'compact',
  healthCheckInterval: 0
});
world.step(4);

assert.equal(world.decisionHistory.monthsCompacted, 4);
assert.ok(world.decisionHistory.recordsConverted > 0);
assert.equal(world.decisionHistory.last.month, 4);

for (const country of world.countries) {
  verifyAgent(country.households.find(agent => agent.cognition?.decisions?.length));
  verifyAgent(country.firms.find(agent => agent.active !== false && agent.cognition?.decisions?.length));
  verifyAgent(country.banks.find(agent => agent.cognition?.decisions?.length));
  verifyAgent(country.governments.find(agent => agent.cognition?.decisions?.length));
  verifyAgent(country.centralBanks.find(agent => agent.cognition?.decisions?.length));
}

const a = new EconomicWorld('ECON-V10-HISTORY-DETERMINISM', { scaleProfile: 'compact', healthCheckInterval: 0 });
const b = new EconomicWorld('ECON-V10-HISTORY-DETERMINISM', { scaleProfile: 'compact', healthCheckInterval: 0 });
a.step(4);
b.step(4);
for (let i = 0; i < a.countries.length; i++) {
  assert.deepEqual(a.countries[i].households[0].cognition.decisions, b.countries[i].households[0].cognition.decisions);
  assert.deepEqual(a.countries[i].firms[0].cognition.decisions, b.countries[i].firms[0].cognition.decisions);
}

assert.ok(a.forceHealthCheck().ok);
assert.ok(b.forceHealthCheck().ok);
console.log('Economic Lab v0.10 compact decision-history gate PASS');
