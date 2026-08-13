import { COUNTRY_SEEDS } from './countries.js';

export const SCALE_PROFILES = Object.freeze({
  compact: Object.freeze({ id: 'compact', householdFactor: 0.25, firmFactor: 0.25, minHouseholds: 80, minFirms: 10 }),
  baseline: Object.freeze({ id: 'baseline', householdFactor: 1, firmFactor: 1, minHouseholds: 1, minFirms: 1 }),
  x2: Object.freeze({ id: 'x2', householdFactor: 2, firmFactor: 2, minHouseholds: 1, minFirms: 1 }),
  x5: Object.freeze({ id: 'x5', householdFactor: 5, firmFactor: 5, minHouseholds: 1, minFirms: 1 }),
  x10: Object.freeze({ id: 'x10', householdFactor: 10, firmFactor: 10, minHouseholds: 1, minFirms: 1 })
});

function positive(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveScaleProfile(input = 'baseline') {
  if (typeof input === 'string') {
    const profile = SCALE_PROFILES[input];
    if (!profile) throw new Error(`unknown scale profile: ${input}`);
    return { ...profile };
  }

  if (typeof input === 'number') {
    const factor = positive(input);
    return {
      id: `custom-${factor}x`,
      householdFactor: factor,
      firmFactor: factor,
      minHouseholds: 1,
      minFirms: 1
    };
  }

  if (input && typeof input === 'object') {
    const householdFactor = positive(input.householdFactor ?? input.factor, 1);
    const firmFactor = positive(input.firmFactor ?? input.factor, householdFactor);
    return {
      id: String(input.id || `custom-h${householdFactor}-f${firmFactor}`),
      householdFactor,
      firmFactor,
      minHouseholds: Math.max(1, Math.round(Number(input.minHouseholds || 1))),
      minFirms: Math.max(1, Math.round(Number(input.minFirms || 1)))
    };
  }

  throw new Error('invalid scale profile');
}

export function scaledCountrySeeds(profileInput = 'baseline') {
  const profile = resolveScaleProfile(profileInput);
  return COUNTRY_SEEDS.map(seed => ({
    ...seed,
    households: Math.max(profile.minHouseholds, Math.round(Number(seed.households) * profile.householdFactor)),
    firms: Math.max(profile.minFirms, Math.round(Number(seed.firms) * profile.firmFactor))
  }));
}

export function seedScaleSummary(profileInput = 'baseline') {
  const profile = resolveScaleProfile(profileInput);
  const seeds = scaledCountrySeeds(profile);
  const households = seeds.reduce((sum, seed) => sum + Number(seed.households || 0), 0);
  const firms = seeds.reduce((sum, seed) => sum + Number(seed.firms || 0), 0);
  return {
    profile,
    countries: seeds.length,
    households,
    firms,
    economicAgentsBeforeEntry: households + firms + seeds.length * 3
  };
}
