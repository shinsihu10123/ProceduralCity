import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v09.js';

const world = new EconomicWorld('ECON-4-001');

let agentsWithPeers = 0;
for (const country of world.countries) {
  const agents = world.cognitive.agents(country);
  for (const agent of agents) {
    const social = agent.cognition?.social;
    assert.ok(social, `${agent.id} social learning state missing`);
    assert.ok(Number.isFinite(social.conformity));
    assert.ok(Number.isFinite(social.sourceTrust));
    assert.ok(Number.isFinite(social.independence));
    if (social.peerIds.length > 0) agentsWithPeers += 1;
    assert.ok(new Set(social.peerIds).size === social.peerIds.length, `${agent.id} peer list contains duplicates`);
    assert.ok(!social.peerIds.includes(agent.id), `${agent.id} cannot be its own peer`);
  }
}
assert.ok(agentsWithPeers > 100, 'peer networks must exist at scale');

world.step(12);

let influencedAgents = 0;
let agentsWithBeliefShift = 0;
let agentsWithHerding = 0;
let regimeUsingPosterior = 0;
let cumulativeInfluence = 0;

for (const country of world.countries) {
  const info = world.information.summary(country);
  assert.ok(info.agents > 0);
  assert.ok(Number.isFinite(info.meanInfluence));
  assert.ok(Number.isFinite(info.meanDispersion));
  assert.ok(Number.isFinite(info.meanHerdingIndex));
  assert.ok(info.meanInfluence > 0, `${country.id} social influence must be active`);
  assert.ok(info.meanHerdingIndex > 0, `${country.id} herding metric must be active`);
  assert.equal(country.macro.cognitiveSocialInfluence, info.meanInfluence);
  assert.equal(country.macro.cognitiveBeliefDispersion, info.meanDispersion);
  assert.equal(country.macro.cognitiveHerdingIndex, info.meanHerdingIndex);

  for (const agent of world.information.agents(country)) {
    const cognition = agent.cognition;
    const social = cognition.social;
    assert.ok(social.lastInfluence, `${agent.id} must receive a monthly information update`);
    assert.equal(social.lastInfluence.month, 12);
    assert.ok(Array.isArray(social.lastInfluence.updates));
    assert.ok(Number.isFinite(social.lastInfluence.meanInfluence));
    assert.ok(Number.isFinite(social.lastInfluence.meanDispersion));
    assert.ok(Number.isFinite(social.lastInfluence.herdingIndex));
    assert.ok(social.history.length > 0 && social.history.length <= 36);
    assert.ok(social.cumulativeInfluence >= 0);
    cumulativeInfluence += social.cumulativeInfluence;
    if (social.lastInfluence.updates.length > 0) influencedAgents += 1;
    if (social.lastInfluence.updates.some(x => Math.abs(Number(x.shift || 0)) > 1e-12)) agentsWithBeliefShift += 1;
    if (social.lastInfluence.herdingIndex > 0) agentsWithHerding += 1;

    const regime = cognition.regime;
    assert.ok(regime?.lastPerceivedSignals, `${agent.id} regime must retain perceived signals`);
    for (const key of ['inflation', 'unemployment', 'demandGrowth', 'externalStress', 'creditStress']) {
      const posterior = cognition.beliefs?.[key]?.mean;
      const perceived = regime.lastPerceivedSignals?.[key];
      if (Number.isFinite(Number(posterior)) && Number.isFinite(Number(perceived))) {
        assert.ok(Math.abs(Number(posterior) - Number(perceived)) < 1e-12, `${agent.id} regime must use posterior ${key}`);
        regimeUsingPosterior += 1;
      }
    }
  }
}

assert.ok(influencedAgents > 100, 'social signals must be processed at scale');
assert.ok(agentsWithBeliefShift > 20, 'peer information must change some beliefs');
assert.ok(agentsWithHerding > 100, 'herding metric must be present across agents');
assert.ok(cumulativeInfluence > 0, 'cumulative social influence must be non-zero');
assert.ok(regimeUsingPosterior > 100, 'regime inference must consume socially updated posterior beliefs');

// Social learning must never directly violate the real economy / accounting layer.
for (const country of world.countries) {
  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement identity failed under social learning`);
  assert.ok(report.general.ok, `${country.id} private/bank SFC failed under social learning`);
  assert.ok(report.fiscal.accountingOk, `${country.id} fiscal accounting failed under social learning`);
  assert.ok(report.monetary.accountingOk, `${country.id} monetary accounting failed under social learning`);
  assert.ok(report.assetMarket.accountingOk, `${country.id} asset accounting failed under social learning`);
  assert.ok(report.international.accountingOk, `${country.id} international accounting failed under social learning`);
}
assert.ok(world.globalInternationalReport().ok, 'global international accounting failed under social learning');

// Determinism gate includes graph construction, peer weights and belief propagation.
const a = new EconomicWorld('ECON-V09-SOCIAL-DETERMINISM');
const b = new EconomicWorld('ECON-V09-SOCIAL-DETERMINISM');
a.step(5);
b.step(5);
for (let i = 0; i < a.countries.length; i++) {
  const ac = a.countries[i];
  const bc = b.countries[i];
  assert.equal(ac.macro.gdp, bc.macro.gdp);
  assert.equal(ac.macro.priceIndex, bc.macro.priceIndex);
  assert.deepEqual(ac.households[0].cognition.social, bc.households[0].cognition.social);
  assert.deepEqual(ac.firms[0].cognition.social, bc.firms[0].cognition.social);
  assert.deepEqual(ac.firms[0].cognition.regime, bc.firms[0].cognition.regime);
  assert.deepEqual(ac.firms[0].cognition.beliefs, bc.firms[0].cognition.beliefs);
}

console.log('Economic Lab v0.9 social learning / herding smoke test PASS');
