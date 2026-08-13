import { EconomicWorld as InternationalEconomicWorld } from './world-v08.js';
import { CognitiveArchitecture } from '../ai/cognitive-core.js';

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
        cognition.memory.episodes.push({
          month: this.month,
          attention: { level: 2, salience: 0.5, trigger: 'firm-entry', lastLevelChangeMonth: this.month },
          observation: {
            month: this.month,
            event: 'firm-entry',
            industryId: firm.industryId,
            cash: Number(firm.cash || 0),
            debt: Number(firm.loanBalance || 0),
            price: Number(firm.price || 0),
            wage: Number(firm.wage || 0)
          },
          topHypothesis: {
            name: '신규 진입 불확실성',
            confidence: 0.72,
            evidence: { noOperatingHistory: true },
            causalClaim: '운영실적이 없으므로 초기 수요·비용모형의 불확실성이 큼'
          }
        });
        cognition.attention = { level: 2, salience: 0.5, trigger: 'firm-entry', lastLevelChangeMonth: this.month };
      }
    }
    return firm;
  }

  stepMonth() {
    const nextMonth = this.month + 1;
    this.cognitive.beginWorldMonth(this.countries, nextMonth);
    super.stepMonth();
    this.cognitive.endWorldMonth(this.countries, this.month);
    for (const country of this.countries) {
      this.refreshV09Macro(country);
      country.history[country.history.length - 1] = { month: this.month, ...country.macro };
    }
  }

  refreshV09Macro(country) {
    const cognitive = this.cognitive.summary(country);
    country.lastCognitive = cognitive;
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
      cognitiveCalibrationMAE: cognitive.meanCalibrationMAE
    };
  }

  snapshot() {
    const base = super.snapshot();
    for (const snapCountry of base.countries) {
      const country = this.countries.find(c => c.id === snapCountry.id);
      snapCountry.cognitive = this.cognitive.summary(country);
      snapCountry.sampleHouseholdCognition = structuredClone(country.households[0]?.cognition || null);
      const sampleFirm = country.firms.find(f => f.active !== false && f.lastTrace?.cognition) || country.firms.find(f => f.active !== false) || country.firms[0];
      snapCountry.sampleFirmCognition = structuredClone(sampleFirm?.cognition || null);
      snapCountry.sampleBankCognition = structuredClone(country.banks[0]?.cognition || null);
      snapCountry.sampleGovernmentCognition = structuredClone(country.governments[0]?.cognition || null);
      snapCountry.sampleCentralBankCognition = structuredClone(country.centralBanks[0]?.cognition || null);
    }
    return base;
  }
}
