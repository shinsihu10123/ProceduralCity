import { EconomicWorld as BaseWorld } from './world-v10.js';
import { COUNTRY_SEEDS } from '../config/countries.js';

const PRICE_UNIT_SCALE = 200;

export class EconomicWorld extends BaseWorld {
  constructor(seedText = 'ECON-4-001', options = {}) {
    const originalPrices = COUNTRY_SEEDS.map(seed => Number(seed.initialPrice));
    for (const seed of COUNTRY_SEEDS) seed.initialPrice = Number(seed.initialPrice) * PRICE_UNIT_SCALE;
    try {
      super(seedText, options);
      this.runtimeCalibration = { id: 'nominal-price-unit-v2', priceUnitScale: PRICE_UNIT_SCALE };
    } finally {
      COUNTRY_SEEDS.forEach((seed, index) => { seed.initialPrice = originalPrices[index]; });
    }
  }

  stepMonth() {
    super.stepMonth();
    if (this.month === 24 && globalThis.process?.env?.GITHUB_ACTIONS) {
      console.log('MONTH24', JSON.stringify(this.countries.map(c => ({
        id:c.id,
        u:c.macro.unemployment,
        c:c.macro.consumption,
        y:c.macro.realOutput,
        af:c.firms.filter(f=>f.active!==false).map(f=>f.industryId),
        w:c.firms.filter(f=>f.active!==false).map(f=>[f.industryId,f.workers])
      }))));
    }
  }
}
