export const INDUSTRIES = {
  RESOURCE: {
    id: 'RESOURCE',
    name: 'Resource Extraction',
    product: 'raw_material',
    share: 0.20,
    consumerFacing: false,
    inputProduct: null,
    inputPerOutput: 0,
    priceMultiplier: 0.58
  },
  MATERIALS: {
    id: 'MATERIALS',
    name: 'Materials & Processing',
    product: 'processed_material',
    share: 0.25,
    consumerFacing: false,
    inputProduct: 'raw_material',
    inputPerOutput: 0.62,
    priceMultiplier: 0.82
  },
  CAPITAL: {
    id: 'CAPITAL',
    name: 'Capital Goods',
    product: 'capital_good',
    share: 0.15,
    consumerFacing: false,
    inputProduct: 'processed_material',
    inputPerOutput: 0.74,
    priceMultiplier: 1.85
  },
  CONSUMER: {
    id: 'CONSUMER',
    name: 'Consumer Goods',
    product: 'consumer_good',
    share: 0.40,
    consumerFacing: true,
    inputProduct: 'processed_material',
    inputPerOutput: 0.52,
    priceMultiplier: 1.00
  }
};

export const INDUSTRY_ORDER = [
  INDUSTRIES.RESOURCE,
  INDUSTRIES.MATERIALS,
  INDUSTRIES.CAPITAL,
  INDUSTRIES.CONSUMER
];

export function industryForIndex(index, total) {
  const t = Math.max(1, total);
  const x = (index + 0.5) / t;
  let cumulative = 0;
  for (const industry of INDUSTRY_ORDER) {
    cumulative += industry.share;
    if (x <= cumulative + 1e-9) return industry;
  }
  return INDUSTRIES.CONSUMER;
}

export function industryById(id) {
  return INDUSTRY_ORDER.find(x => x.id === id) || INDUSTRIES.CONSUMER;
}
