import { EconomicWorld as BaseWorld } from './world-v10.js';
import { COUNTRY_SEEDS } from '../config/countries.js';

const PRICE_UNIT_SCALE = 100;

export class EconomicWorld extends BaseWorld {
  constructor(seedText = 'ECON-4-001', options = {}) {
    const originalPrices = COUNTRY_SEEDS.map(seed => Number(seed.initialPrice));
    for (const seed of COUNTRY_SEEDS) seed.initialPrice = Number(seed.initialPrice) * PRICE_UNIT_SCALE;
    try {
      super(seedText, options);
      this.runtimeCalibration = {
        id: 'nominal-price-unit-v1',
        priceUnitScale: PRICE_UNIT_SCALE,
        reason: 'align product-price currency units with wage/cash currency units'
      };
    } finally {
      COUNTRY_SEEDS.forEach((seed, index) => { seed.initialPrice = originalPrices[index]; });
    }
  }
}
