import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v09.js';

const world = new EconomicWorld('ECON-4-001');
assert.equal(world.countries.length, 4);
assert.deepEqual(world.countries.map(c => c.id), ['AST', 'BRN', 'CYR', 'DRN']);

const openingModels = new Map();
for (const country of world.countries) {
  const agents = [
    ...country.households,
    ...country.firms,
    ...country.banks,
    ...country.governments,
    ...country.centralBanks
  ];
  assert.ok(agents.length > 0);
  for (const agent of agents) {
    assert.equal(agent.cognition?.version, '0.9', `${agent.id} missing v0.9 cognition`);
    assert.ok(agent.cognition.profile.planningHorizon >= 1);
    assert.ok(agent.cognition.worldModel);
    assert.equal(agent.cognition.memory.episodes.length, 0);
  }
  const sampleFirm = country.firms.find(f => f.active !== false);
  openingModels.set(sampleFirm.id, structuredClone(sampleFirm.cognition.worldModel));
}

world.step(24);
assert.equal(world.month, 24);

let agentsWithResolvedForecasts = 0;
let agentsWithDecisions = 0;
let agentsWithHypotheses = 0;
let agentsWithDeepAttention = 0;
let agentsWithResolvedEpisodes = 0;
let agentsWithCausalEvidence = 0;
let totalCausalUpdates = 0;
let firmsUsingMemory = 0;
let householdsUsingMemory = 0;
let modelUpdates = 0;

for (const country of world.countries) {
  const report = world.accountingReport(country.id);
  assert.ok(report.settlement.ok, `${country.id} settlement identity failed`);
  assert.ok(report.general.ok, `${country.id} private/bank SFC failed`);
  assert.ok(report.fiscal.accountingOk, `${country.id} fiscal accounting failed`);
  assert.ok(report.monetary.accountingOk, `${country.id} monetary accounting failed`);
  assert.ok(report.assetMarket.accountingOk, `${country.id} asset accounting failed`);
  assert.ok(report.international.accountingOk, `${country.id} international accounting failed`);

  const summary = world.cognitive.summary(country);
  const depth = world.cognitiveDepthSummary(country);
  assert.equal(summary.agents, country.households.length + country.firms.length + country.banks.length + country.governments.length + country.centralBanks.length);
  assert.equal(summary.attentionLevels.reduce((a, b) => a + b, 0), summary.agents);
  assert.ok(summary.resolvedForecasts > 0, `${country.id} must resolve cognitive forecasts`);
  assert.ok(depth.resolvedEpisodes > 0, `${country.id} must close episodic memories with realized outcomes`);
  assert.ok(depth.causalUpdates > 0, `${country.id} must learn causal links from experience`);
  assert.ok(depth.causalLinksWithEvidence > 0, `${country.id} causal links must have observations`);
  assert.ok(depth.analogyReadyAgents > 0, `${country.id} must have agents ready for analogical retrieval`);
  assert.equal(country.macro.cognitiveCausalUpdates, depth.causalUpdates);
  assert.equal(country.macro.cognitiveResolvedEpisodes, depth.resolvedEpisodes);

  for (const value of Object.values(country.macro)) {
    assert.ok(Number.isFinite(value), `${country.id} macro value must be finite`);
  }

  const expectedGDP = country.macro.consumption
    + country.macro.grossInvestment
    + country.macro.publicInvestment
    + country.macro.governmentConsumption
    + country.macro.inventoryInvestment
    + country.macro.exports
    - country.macro.imports;
  assert.ok(Math.abs(country.macro.gdp - expectedGDP) < 1e-5, `${country.id} open-economy GDP identity failed`);

  const agents = [
    ...country.households,
    ...country.firms,
    ...country.banks,
    ...country.governments,
    ...country.centralBanks
  ];
  for (const agent of agents) {
    const c = agent.cognition;
    assert.equal(c.version, '0.9');
    assert.ok(c.memory.episodes.length > 0 && c.memory.episodes.length <= 48);
    assert.ok(c.attention.level >= 0 && c.attention.level <= 4);
    if (c.attention.level >= 2) agentsWithDeepAttention += 1;
    if (c.forecastHistory.length > 0) agentsWithResolvedForecasts += 1;
    if (c.decisions.length > 0) agentsWithDecisions += 1;
    if (c.hypotheses.length > 0) agentsWithHypotheses += 1;
    const resolvedEpisodes = c.memory.episodes.filter(ep => ep.outcome);
    if (resolvedEpisodes.length > 0) agentsWithResolvedEpisodes += 1;
    assert.ok(c.causalModel, `${agent.id} causal model missing`);
    assert.ok(Array.isArray(c.causalModel.links) && c.causalModel.links.length >= 8, `${agent.id} causal model too shallow`);
    assert.ok(c.causalModel.updates >= 0);
    totalCausalUpdates += c.causalModel.updates;
    const causalWithEvidence = c.causalModel.links.filter(link => link.observations > 0);
    if (causalWithEvidence.length > 0) agentsWithCausalEvidence += 1;
    for (const link of c.causalModel.links) {
      assert.ok(Number.isFinite(link.coefficient), `${agent.id} causal coefficient invalid`);
      assert.ok(Number.isFinite(link.confidence), `${agent.id} causal confidence invalid`);
      assert.ok(link.confidence >= 0 && link.confidence <= 1);
      assert.ok(link.observations >= 0);
    }
    for (const stat of Object.values(c.calibration)) {
      assert.ok(stat.count >= 0);
      assert.ok(Number.isFinite(stat.mae));
      assert.ok(Number.isFinite(stat.bias));
    }
    for (const value of Object.values(c.worldModel)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${agent.id} world-model value invalid`);
    }
  }

  const household = country.households.find(h =>
    h.lastTrace?.cognition &&
    Array.isArray(h.lastTrace?.candidates) &&
    Array.isArray(h.lastTrace?.memoryReasoning?.analogies)
  );
  assert.ok(household, `${country.id} household memory reasoning trace missing`);
  assert.ok(household.lastTrace.candidates.length >= 3);
  assert.ok(household.lastTrace.hypotheses.length >= 1);
  assert.ok(household.lastTrace.memoryReasoning.analogies.length > 0, `${country.id} household must retrieve prior analogies`);
  assert.ok(Array.isArray(household.lastTrace.causalReasoning?.explanations), `${country.id} household causal explanations missing`);
  assert.ok(household.lastTrace.causalReasoning.explanations.length > 0, `${country.id} household must use causal explanations`);
  householdsUsingMemory += 1;

  const firm = country.firms.find(f =>
    f.active !== false &&
    f.lastTrace?.cognition &&
    Array.isArray(f.lastTrace?.candidates) &&
    Array.isArray(f.lastTrace?.memoryReasoning?.analogies)
  );
  assert.ok(firm, `${country.id} firm memory reasoning trace missing`);
  assert.ok(firm.lastTrace.candidates.length >= 4);
  assert.ok(firm.lastTrace.worldModel?.demandPersistence !== undefined);
  assert.ok(firm.lastTrace.memoryReasoning.analogies.length > 0, `${country.id} firm must retrieve prior analogies`);
  assert.ok(Array.isArray(firm.lastTrace.causalReasoning?.explanations), `${country.id} firm causal explanations missing`);
  assert.ok(firm.lastTrace.causalReasoning.explanations.length > 0, `${country.id} firm must use causal explanations`);
  firmsUsingMemory += 1;

  const bank = country.banks[0];
  assert.ok(bank.lastTrace?.cognition, `${country.id} bank cognition trace missing`);
  assert.ok(Array.isArray(bank.lastTrace.counterfactuals), `${country.id} bank counterfactual trace missing`);

  const government = country.governments[0];
  assert.ok(government.lastTrace?.cognition, `${country.id} government cognition trace missing`);
  assert.ok(government.lastTrace.candidates.length >= 5);

  const centralBank = country.centralBanks[0];
  assert.ok(centralBank.lastTrace?.cognition, `${country.id} central-bank cognition trace missing`);
  assert.ok(centralBank.lastTrace.candidates.length >= 5);

  const sameFirm = country.firms.find(f => openingModels.has(f.id));
  const opening = sameFirm ? openingModels.get(sameFirm.id) : null;
  if (opening && sameFirm) {
    const changed = ['demandPersistence', 'inflationPersistence', 'wagePersistence'].some(key =>
      Math.abs(Number(sameFirm.cognition.worldModel[key]) - Number(opening[key])) > 1e-10
    );
    if (changed) modelUpdates += 1;
  }
}

const global = world.globalInternationalReport();
assert.ok(global.ok, 'global international accounting must balance');
assert.ok(Math.abs(global.tradeErrorWXU) < 1e-6);
assert.ok(Math.abs(global.currentAccountErrorWXU) < 1e-6);
assert.ok(Math.abs(global.nfaErrorWXU) < 1e-6);
assert.ok(Math.abs(global.fundingErrorWXU) < 1e-6);

assert.ok(agentsWithResolvedForecasts > 10, 'cognitive forecasts must resolve across agents');
assert.ok(agentsWithDecisions > 20, 'agents must accumulate decisions');
assert.ok(agentsWithHypotheses > 20, 'agents must maintain causal hypotheses');
assert.ok(agentsWithDeepAttention > 0, 'some agents must escalate beyond routine attention');
assert.ok(agentsWithResolvedEpisodes > 20, 'realized outcomes must be written back into episodic memory');
assert.ok(agentsWithCausalEvidence > 20, 'causal models must accumulate empirical evidence');
assert.ok(totalCausalUpdates > 100, 'causal-model learning must be active at scale');
assert.equal(firmsUsingMemory, 4);
assert.equal(householdsUsingMemory, 4);
assert.ok(modelUpdates > 0, 'at least one persistent firm world model must learn from forecast error');

const snap = world.snapshot();
assert.equal(snap.month, 24);
assert.ok(snap.globalInternational.ok);
for (const c of snap.countries) {
  assert.ok(c.cognitive.agents > 0);
  assert.ok(c.cognitive.causalUpdates > 0);
  assert.ok(c.cognitive.resolvedEpisodes > 0);
  assert.equal(c.sampleHouseholdCognition.version, '0.9');
  assert.equal(c.sampleBankCognition.version, '0.9');
  assert.equal(c.sampleGovernmentCognition.version, '0.9');
  assert.equal(c.sampleCentralBankCognition.version, '0.9');
  assert.ok(c.sampleHouseholdMemory.resolvedEpisodes > 0);
  assert.ok(c.sampleBankMemory.causalUpdates > 0);
}

// Determinism gate: same seed must produce identical economy, memory retrieval,
// causal learning and counterfactual choices.
const a = new EconomicWorld('ECON-V09-DETERMINISM');
const b = new EconomicWorld('ECON-V09-DETERMINISM');
a.step(6);
b.step(6);
for (let i = 0; i < a.countries.length; i++) {
  assert.equal(a.countries[i].macro.gdp, b.countries[i].macro.gdp);
  assert.equal(a.countries[i].macro.priceIndex, b.countries[i].macro.priceIndex);
  assert.equal(a.countries[i].firms[0].cognition.worldModel.demandPersistence, b.countries[i].firms[0].cognition.worldModel.demandPersistence);
  assert.deepEqual(a.countries[i].firms[0].cognition.hypotheses, b.countries[i].firms[0].cognition.hypotheses);
  assert.deepEqual(a.countries[i].firms[0].cognition.causalModel, b.countries[i].firms[0].cognition.causalModel);
  assert.deepEqual(a.countries[i].firms[0].lastTrace?.memoryReasoning, b.countries[i].firms[0].lastTrace?.memoryReasoning);
}

console.log('Economic Lab v0.9 deep cognitive economy smoke test PASS');
