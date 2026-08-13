import { EconomicWorld as InternationalEconomicWorld } from './world-v08.js';
import { CognitiveArchitecture } from '../ai/cognitive-core.js';
import {
  attachEpisodeOutcome,
  learnCausalModel,
  summarizeMemory
} from '../ai/episodic-reasoning.js';
import { inferRegime, regimeRisk } from '../ai/regime-reasoning.js';

const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function growth(current, previous, fallback = 0) {
  const p = finite(previous);
  if (Math.abs(p) <= EPS) return fallback;
  return finite(current) / p - 1;
}

function currentSignals(country) {
  const macro = country.macro || {};
  const history = country.history || [];
  const previous = history.length > 1 ? history[history.length - 2] : country.previousMacro || macro;
  return {
    inflation: growth(macro.priceIndex, previous?.priceIndex, 0),
    unemployment: finite(macro.unemployment),
    demandGrowth: growth(macro.nominalSales, previous?.nominalSales, 0),
    wageGrowth: growth(macro.avgWage, previous?.avgWage, 0),
    externalStress: finite(macro.externalStress),
    creditStress: finite(country.lastMonetary?.creditStress, finite(macro.creditStress)),
    policyRate: finite(macro.policyRate),
    debtRatio: finite(macro.publicDebtRatio),
    exchangeRateChange: finite(macro.exchangeRateChange),
    currentAccountWXU: finite(macro.currentAccountWXU)
  };
}

function lastReward(agent) {
  const decisions = agent?.cognition?.decisions || [];
  if (!decisions.length) return null;
  const reward = Number(decisions[decisions.length - 1]?.realizedReward);
  return Number.isFinite(reward) ? reward : null;
}

export class EconomicWorld extends InternationalEconomicWorld {
  constructor(seedText = 'ECON-4-001') {
    super(seedText);
    this.cognitive = new CognitiveArchitecture({ rng: this.rng });
    this.cognitive.initializeWorld(this.countries);
    for (const country of this.countries) this.refreshV09Macro(country);
  }

  createEntrant(country, industryId) {
    const firm = super.createEntrant(country, industryId);
    if (this.cognitive) {
      const cognition = this.cognitive.initializeAgent(firm);
      if (cognition.memory.episodes.length === 0) {
        const inceptionObservation = {
          month: this.month,
          event: 'firm-entry',
          industryId: firm.industryId,
          cash: Number(firm.cash || 0),
          debt: Number(firm.loanBalance || 0),
          price: Number(firm.price || 0),
          wage: Number(firm.wage || 0),
          demandGrowth: 0,
          inflation: Number(country.macro?.priceIndex || 0) > 0 && Number(country.previousMacro?.priceIndex || 0) > 0
            ? Number(country.macro.priceIndex) / Number(country.previousMacro.priceIndex) - 1
            : 0,
          unemployment: Number(country.macro?.unemployment || 0),
          wageGrowth: 0,
          externalStress: Number(country.macro?.externalStress || 0),
          creditStress: Number(country.lastMonetary?.creditStress || 0),
          policyRate: Number(country.macro?.policyRate || 0),
          exchangeRateChange: Number(country.macro?.exchangeRateChange || 0),
          currentAccountWXU: Number(country.macro?.currentAccountWXU || 0)
        };
        cognition.memory.episodes.push({
          month: this.month,
          attention: { level: 2, salience: 0.5, trigger: 'firm-entry', lastLevelChangeMonth: this.month },
          observation: inceptionObservation,
          topHypothesis: {
            name: '신규 진입 불확실성',
            confidence: 0.72,
            evidence: { noOperatingHistory: true },
            causalClaim: '운영실적이 없으므로 초기 수요·비용모형의 불확실성이 큼'
          }
        });
        cognition.lastObservation = inceptionObservation;
        cognition.attention = { level: 2, salience: 0.5, trigger: 'firm-entry', lastLevelChangeMonth: this.month };
        inferRegime(cognition, inceptionObservation, this.month);
      }
    }
    return firm;
  }

  stepMonth() {
    const nextMonth = this.month + 1;
    this.cognitive.beginWorldMonth(this.countries, nextMonth);
    this.inferAgentRegimes(nextMonth);
    super.stepMonth();
    this.cognitive.endWorldMonth(this.countries, this.month);
    for (const country of this.countries) {
      this.closeCognitiveLearningLoop(country);
      this.refreshV09Macro(country);
      country.history[country.history.length - 1] = { month: this.month, ...country.macro };
    }
  }

  inferAgentRegimes(month) {
    for (const country of this.countries) {
      for (const agent of this.cognitive.agents(country)) {
        const cognition = agent.cognition;
        if (!cognition?.enabled || !cognition.lastObservation) continue;
        const regime = inferRegime(cognition, cognition.lastObservation, month);
        const risk = regimeRisk(cognition);
        const currentLevel = Number(cognition.attention?.level || 0);
        let targetLevel = currentLevel;
        if (regime.changed || risk > 0.58 || regime.changeMagnitude > 0.24) targetLevel = Math.max(targetLevel, 3);
        if ((regime.changed && regime.confidence > 0.34) || risk > 0.76 || regime.changeMagnitude > 0.38) targetLevel = Math.max(targetLevel, 4);
        if (targetLevel > currentLevel) {
          cognition.attention = {
            ...cognition.attention,
            level: targetLevel,
            salience: Math.max(Number(cognition.attention?.salience || 0), Math.min(1.5, risk + regime.changeMagnitude)),
            trigger: regime.changed ? `regime-shift:${regime.previous}->${regime.current}` : `regime-risk:${regime.current}`,
            lastLevelChangeMonth: month
          };
          const episode = cognition.memory.episodes[cognition.memory.episodes.length - 1];
          if (episode && Number(episode.month) === Number(month)) episode.attention = { ...cognition.attention };
        }
      }
    }
  }

  closeCognitiveLearningLoop(country) {
    const macroOutcome = currentSignals(country);

    for (const h of country.households || []) {
      const observation = h.cognition?.lastObservation || {};
      const outcome = {
        ...macroOutcome,
        incomeGrowth: growth(h.income, observation.income, 0),
        cashStress: Math.max(0, Math.min(1.5, 1 - finite(h.wealth) / Math.max(1, finite(h.wage) * 2.2))),
        employed: h.employed ? 1 : 0
      };
      attachEpisodeOutcome(h, this.month, outcome, lastReward(h));
      learnCausalModel(h, observation, outcome);
    }

    for (const f of country.firms || []) {
      const observation = f.cognition?.lastObservation || {};
      const firmDemandGrowth = growth(f.sales, observation.sales, macroOutcome.demandGrowth);
      const outcome = {
        ...macroOutcome,
        demandGrowth: Math.max(-1, Math.min(2.5, firmDemandGrowth)),
        cashStress: Math.max(0, Math.min(1.5, 1 - finite(f.cash) / Math.max(1, finite(f.safeCash, 1)))),
        inventoryPressure: (finite(f.inventory) - finite(f.targetInventory)) / Math.max(1, finite(f.targetInventory, 1)),
        supplyShortage: finite(f.supplyShortage),
        revenueGrowth: growth(f.revenue, observation.revenue, 0)
      };
      attachEpisodeOutcome(f, this.month, outcome, lastReward(f));
      learnCausalModel(f, observation, outcome);
    }

    const bank = country.banks?.[0];
    if (bank) {
      const observation = bank.cognition?.lastObservation || {};
      const applications = Math.max(1, finite(country.lastCredit?.applications));
      const outcome = {
        ...macroOutcome,
        creditDefaultRate: finite(country.lastCredit?.defaults) / applications,
        bankStress: finite(country.lastMonetary?.bankStress),
        capitalStress: finite(country.lastMonetary?.bankStress)
      };
      attachEpisodeOutcome(bank, this.month, outcome, lastReward(bank));
      learnCausalModel(bank, observation, outcome);
    }

    const government = country.governments?.[0];
    if (government) {
      const observation = government.cognition?.lastObservation || {};
      const outcome = {
        ...macroOutcome,
        debtRatio: finite(country.macro?.publicDebtRatio),
        fiscalBalanceRatio: finite(country.macro?.fiscalOverallBalance) / Math.max(1, Math.abs(finite(country.macro?.gdp)))
      };
      attachEpisodeOutcome(government, this.month, outcome, lastReward(government));
      learnCausalModel(government, observation, outcome);
    }

    const centralBank = country.centralBanks?.[0];
    if (centralBank) {
      const observation = centralBank.cognition?.lastObservation || {};
      const outcome = {
        ...macroOutcome,
        bankStress: finite(country.lastMonetary?.bankStress),
        assetMomentum: finite(country.lastAssetMarket?.indexReturn),
        reserveRatio: finite(country.lastMonetary?.bankReserveRatio)
      };
      attachEpisodeOutcome(centralBank, this.month, outcome, lastReward(centralBank));
      learnCausalModel(centralBank, observation, outcome);
    }
  }

  cognitiveDepthSummary(country) {
    const agents = this.cognitive.agents(country).filter(a => a.cognition?.enabled);
    let resolvedEpisodes = 0;
    let causalUpdates = 0;
    let causalLinksWithEvidence = 0;
    let analogyReadyAgents = 0;
    let regimeShifts = 0;
    let regimeUncertainty = 0;
    const regimes = {
      normal: 0,
      recession: 0,
      inflation: 0,
      overheating: 0,
      credit_crisis: 0,
      external_crisis: 0
    };
    for (const agent of agents) {
      const memory = summarizeMemory(agent);
      resolvedEpisodes += memory.resolvedEpisodes;
      causalUpdates += memory.causalUpdates;
      causalLinksWithEvidence += (agent.cognition?.causalModel?.links || []).filter(x => Number(x.observations || 0) > 0).length;
      if (memory.resolvedEpisodes >= 2) analogyReadyAgents += 1;
      const regime = agent.cognition?.regime;
      if (regime?.current && regime.current in regimes) regimes[regime.current] += 1;
      if (regime?.changed) regimeShifts += 1;
      regimeUncertainty += Number(regime?.uncertainty || 0);
    }
    return {
      resolvedEpisodes,
      causalUpdates,
      causalLinksWithEvidence,
      analogyReadyAgents,
      regimeShifts,
      meanRegimeUncertainty: agents.length ? regimeUncertainty / agents.length : 0,
      regimes
    };
  }

  refreshV09Macro(country) {
    const cognitive = this.cognitive.summary(country);
    const depth = this.cognitiveDepthSummary(country);
    country.lastCognitive = { ...cognitive, ...depth };
    country.macro = {
      ...country.macro,
      cognitiveAgents: cognitive.agents,
      cognitiveL0: cognitive.attentionLevels[0],
      cognitiveL1: cognitive.attentionLevels[1],
      cognitiveL2: cognitive.attentionLevels[2],
      cognitiveL3: cognitive.attentionLevels[3],
      cognitiveL4: cognitive.attentionLevels[4],
      cognitivePendingForecasts: cognitive.pendingForecasts,
      cognitiveResolvedForecasts: cognitive.resolvedForecasts,
      cognitiveCalibrationMAE: cognitive.meanCalibrationMAE,
      cognitiveResolvedEpisodes: depth.resolvedEpisodes,
      cognitiveCausalUpdates: depth.causalUpdates,
      cognitiveCausalLinksWithEvidence: depth.causalLinksWithEvidence,
      cognitiveAnalogyReadyAgents: depth.analogyReadyAgents,
      cognitiveRegimeShifts: depth.regimeShifts,
      cognitiveRegimeUncertainty: depth.meanRegimeUncertainty,
      regimeNormalAgents: depth.regimes.normal,
      regimeRecessionAgents: depth.regimes.recession,
      regimeInflationAgents: depth.regimes.inflation,
      regimeOverheatingAgents: depth.regimes.overheating,
      regimeCreditCrisisAgents: depth.regimes.credit_crisis,
      regimeExternalCrisisAgents: depth.regimes.external_crisis
    };
  }

  snapshot() {
    const base = super.snapshot();
    for (const snapCountry of base.countries) {
      const country = this.countries.find(c => c.id === snapCountry.id);
      const depth = this.cognitiveDepthSummary(country);
      snapCountry.cognitive = { ...this.cognitive.summary(country), ...depth };
      snapCountry.sampleHouseholdCognition = structuredClone(country.households[0]?.cognition || null);
      const sampleFirm = country.firms.find(f => f.active !== false && f.lastTrace?.cognition) || country.firms.find(f => f.active !== false) || country.firms[0];
      snapCountry.sampleFirmCognition = structuredClone(sampleFirm?.cognition || null);
      snapCountry.sampleBankCognition = structuredClone(country.banks[0]?.cognition || null);
      snapCountry.sampleGovernmentCognition = structuredClone(country.governments[0]?.cognition || null);
      snapCountry.sampleCentralBankCognition = structuredClone(country.centralBanks[0]?.cognition || null);
      snapCountry.sampleHouseholdMemory = summarizeMemory(country.households[0]);
      snapCountry.sampleFirmMemory = summarizeMemory(sampleFirm);
      snapCountry.sampleBankMemory = summarizeMemory(country.banks[0]);
      snapCountry.sampleGovernmentMemory = summarizeMemory(country.governments[0]);
      snapCountry.sampleCentralBankMemory = summarizeMemory(country.centralBanks[0]);
    }
    return base;
  }
}
