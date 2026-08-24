const EPS = 1e-12;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function stableHash(text) {
  let hash = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitHash(text) {
  return stableHash(text) / 0xffffffff;
}

function normalizeShares(rows, valueKey = 'share') {
  const clean = (rows || [])
    .map(row => ({ ...row, [valueKey]: Math.max(0, finite(row?.[valueKey])) }))
    .filter(row => row[valueKey] > 0);
  const total = clean.reduce((sum, row) => sum + row[valueKey], 0);
  if (!(total > EPS)) return [];
  return clean.map(row => ({ ...row, [valueKey]: row[valueKey] / total }));
}

function pickByShare(rows, u, valueKey = 'share') {
  let acc = 0;
  for (const row of rows) {
    acc += row[valueKey];
    if (u <= acc + EPS) return row;
  }
  return rows[rows.length - 1] || null;
}

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('shadowDemographyProfile is required');
  if (!String(profile.id || '').trim()) throw new Error('shadowDemographyProfile.id is required');

  const householdSizeDistribution = normalizeShares(profile.householdSizeDistribution)
    .map(row => ({ ...row, size: Math.max(1, Math.round(finite(row.size, 1))) }));
  const ageDistribution = normalizeShares(profile.ageDistribution)
    .map(row => ({
      ...row,
      id: String(row.id || '').trim() || `age-${row.minMonths}-${row.maxMonths}`,
      minMonths: Math.max(0, Math.round(finite(row.minMonths))),
      maxMonths: Math.max(0, Math.round(finite(row.maxMonths)))
    }))
    .filter(row => row.maxMonths >= row.minMonths);

  if (!householdSizeDistribution.length) throw new Error('householdSizeDistribution must have positive shares');
  if (!ageDistribution.length) throw new Error('ageDistribution must have positive shares');

  const workingAgeMinMonths = Math.max(0, Math.round(finite(profile.workingAgeMinMonths)));
  const workingAgeMaxMonths = Math.max(workingAgeMinMonths, Math.round(finite(profile.workingAgeMaxMonths, workingAgeMinMonths)));
  const standardMonthlyHours = Math.max(1, finite(profile.standardMonthlyHours, 160));
  const participationByAgeBucket = { ...(profile.participationByAgeBucket || {}) };
  const skillFactorByBucket = { ...(profile.skillFactorByBucket || {}) };

  return Object.freeze({
    id: String(profile.id),
    householdSizeDistribution,
    ageDistribution,
    workingAgeMinMonths,
    workingAgeMaxMonths,
    standardMonthlyHours,
    participationByAgeBucket,
    skillFactorByBucket
  });
}

function ageForBucket(bucket, key) {
  const span = Math.max(1, bucket.maxMonths - bucket.minMonths + 1);
  return bucket.minMonths + Math.floor(unitHash(`${key}:age`) * span);
}

function participationProbability(profile, bucket) {
  return clamp(profile.participationByAgeBucket?.[bucket.id] ?? 0, 0, 1);
}

function skillFactor(profile, bucket) {
  return Math.max(EPS, finite(profile.skillFactorByBucket?.[bucket.id], 1));
}

function makePerson({ countryId, household, householdIndex, memberIndex, profile }) {
  const householdId = String(household.id);
  const key = `${profile.id}:${countryId}:${householdId}:${householdIndex}:${memberIndex}`;
  const ageBucket = pickByShare(profile.ageDistribution, unitHash(`${key}:bucket`));
  const ageMonths = ageForBucket(ageBucket, key);
  const workingAge = ageMonths >= profile.workingAgeMinMonths && ageMonths <= profile.workingAgeMaxMonths;
  const participating = workingAge && unitHash(`${key}:participation`) < participationProbability(profile, ageBucket);
  const availableHours = participating ? profile.standardMonthlyHours : 0;

  return {
    id: `shadow-person:${countryId}:${householdId}:${memberIndex}`,
    householdId,
    countryId: String(countryId),
    ageMonths,
    alive: true,
    workingAge,
    laborForceStatus: participating ? 'participating' : 'outside',
    employmentStatus: participating ? 'unemployed_shadow' : 'not_applicable',
    employerId: null,
    hoursAvailable: availableHours,
    hoursWorked: 0,
    wageRate: 0,
    laborIncome: 0,
    effectiveSkillFactor: skillFactor(profile, ageBucket),
    profileBucket: ageBucket.id,
    projectionSource: 'shadow-demography-profile',
    compatibilityHouseholdIndex: householdIndex
  };
}

function summarizeCountry(country, persons, householdViews, contradictions, profile) {
  const workingAge = persons.filter(p => p.workingAge && p.alive);
  const laborForce = persons.filter(p => p.laborForceStatus === 'participating' && p.alive);
  const employed = laborForce.filter(p => p.employmentStatus === 'employed_shadow');
  const unemployed = laborForce.filter(p => p.employmentStatus === 'unemployed_shadow');
  const availableHours = laborForce.reduce((sum, p) => sum + finite(p.hoursAvailable), 0);
  const workedHours = employed.reduce((sum, p) => sum + finite(p.hoursWorked), 0);
  const availableLaborUnits = laborForce.reduce(
    (sum, p) => sum + finite(p.hoursAvailable) / profile.standardMonthlyHours * finite(p.effectiveSkillFactor, 1),
    0
  );
  const workedLaborUnits = employed.reduce(
    (sum, p) => sum + finite(p.hoursWorked) / profile.standardMonthlyHours * finite(p.effectiveSkillFactor, 1),
    0
  );

  return {
    countryId: String(country.id),
    profileId: profile.id,
    persons: persons.length,
    households: householdViews.length,
    personsPerHousehold: householdViews.length ? persons.length / householdViews.length : 0,
    workingAgePersons: workingAge.length,
    workingAgeShare: persons.length ? workingAge.length / persons.length : 0,
    laborForcePersons: laborForce.length,
    laborForceParticipationRate: workingAge.length ? laborForce.length / workingAge.length : 0,
    shadowEmployedPersons: employed.length,
    shadowUnemployedPersons: unemployed.length,
    shadowUnemploymentRate: laborForce.length ? unemployed.length / laborForce.length : 0,
    availableLaborHours: availableHours,
    workedLaborHours: workedHours,
    availableLaborUnits,
    workedLaborUnits,
    canonicalEmployedHouseholds: (country.households || []).filter(h => h.employed).length,
    compatibilityContradictions: contradictions.length
  };
}

export class ShadowPersonHouseholdSystem {
  constructor({ profile }) {
    this.profile = validateProfile(profile);
    this.countryData = new Map();
  }

  initialize(countries) {
    this.countryData.clear();
    for (const country of countries || []) this.initializeCountry(country);
    return this.report();
  }

  initializeCountry(country) {
    const persons = [];
    const householdViews = [];
    const contradictions = [];
    const householdMembers = new Map();

    for (let householdIndex = 0; householdIndex < (country.households || []).length; householdIndex += 1) {
      const household = country.households[householdIndex];
      const sizeRow = pickByShare(
        this.profile.householdSizeDistribution,
        unitHash(`${this.profile.id}:${country.id}:${household.id}:household-size`)
      );
      const memberCount = Math.max(1, Math.round(finite(sizeRow?.size, 1)));
      const members = [];
      for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
        const person = makePerson({ countryId: country.id, household, householdIndex, memberIndex, profile: this.profile });
        persons.push(person);
        members.push(person);
      }
      householdMembers.set(String(household.id), members);
    }

    const data = { country, persons, householdViews, contradictions, householdMembers, summary: null };
    this.countryData.set(String(country.id), data);
    this.refreshCountry(country);
    return data;
  }

  refresh(countries) {
    for (const country of countries || []) {
      if (!this.countryData.has(String(country.id))) this.initializeCountry(country);
      else this.refreshCountry(country);
    }
    return this.report();
  }

  refreshCountry(country) {
    const data = this.countryData.get(String(country.id));
    if (!data) return this.initializeCountry(country);
    data.contradictions.length = 0;
    data.householdViews.length = 0;

    const householdById = new Map((country.households || []).map(h => [String(h.id), h]));

    for (const person of data.persons) {
      person.employmentStatus = person.laborForceStatus === 'participating' ? 'unemployed_shadow' : 'not_applicable';
      person.employerId = null;
      person.hoursWorked = 0;
      person.wageRate = 0;
      person.laborIncome = 0;
    }

    for (const [householdId, members] of data.householdMembers.entries()) {
      const household = householdById.get(householdId);
      if (!household) {
        data.contradictions.push({ type: 'HOUSEHOLD_MISSING', householdId });
        continue;
      }

      const participants = members.filter(p => p.laborForceStatus === 'participating' && p.alive);
      if (household.employed) {
        const worker = participants[0];
        if (!worker) {
          data.contradictions.push({
            type: 'CANONICAL_EMPLOYED_WITHOUT_ELIGIBLE_PARTICIPANT',
            householdId,
            employerId: household.employerId ?? null
          });
        } else {
          worker.employmentStatus = 'employed_shadow';
          worker.employerId = household.employerId ?? null;
          worker.hoursWorked = Math.min(worker.hoursAvailable, this.profile.standardMonthlyHours);
          worker.wageRate = worker.hoursWorked > EPS ? finite(household.wage) / this.profile.standardMonthlyHours : 0;
          worker.laborIncome = finite(household.income);
        }
      }

      const workingAgeCount = members.filter(p => p.workingAge && p.alive).length;
      const laborForceCount = participants.length;
      const employedShadowCount = members.filter(p => p.employmentStatus === 'employed_shadow').length;
      const unemployedShadowCount = members.filter(p => p.employmentStatus === 'unemployed_shadow').length;
      const availableLaborHours = members.reduce((sum, p) => sum + finite(p.hoursAvailable), 0);
      const workedLaborHours = members.reduce((sum, p) => sum + finite(p.hoursWorked), 0);
      const dependents = Math.max(0, members.length - workingAgeCount);

      data.householdViews.push({
        householdId,
        memberIds: members.map(p => p.id),
        memberCount: members.length,
        workingAgeCount,
        laborForceCount,
        employedShadowCount,
        unemployedShadowCount,
        availableLaborHours,
        workedLaborHours,
        dependencyRatio: workingAgeCount > 0 ? dependents / workingAgeCount : dependents > 0 ? dependents : 0
      });
    }

    data.summary = summarizeCountry(country, data.persons, data.householdViews, data.contradictions, this.profile);
    return data.summary;
  }

  persons(countryId) {
    return this.countryData.get(String(countryId))?.persons || [];
  }

  householdView(householdId) {
    for (const data of this.countryData.values()) {
      const view = data.householdViews.find(row => row.householdId === String(householdId));
      if (view) return view;
    }
    return null;
  }

  countrySummary(countryId) {
    const summary = this.countryData.get(String(countryId))?.summary;
    return summary ? structuredClone(summary) : null;
  }

  laborForce(countryId) {
    return this.persons(countryId).filter(p => p.laborForceStatus === 'participating' && p.alive);
  }

  availableLaborUnits(countryId) {
    return finite(this.countrySummary(countryId)?.availableLaborUnits);
  }

  compatibilityReport(countryId) {
    const contradictions = this.countryData.get(String(countryId))?.contradictions || [];
    return structuredClone(contradictions);
  }

  validate() {
    const issues = [];
    const personIds = new Set();

    for (const [countryId, data] of this.countryData.entries()) {
      const memberToHousehold = new Map();
      for (const view of data.householdViews) {
        for (const personId of view.memberIds) {
          if (memberToHousehold.has(personId)) issues.push({ countryId, type: 'PERSON_IN_MULTIPLE_HOUSEHOLDS', personId });
          memberToHousehold.set(personId, view.householdId);
        }
      }

      for (const person of data.persons) {
        if (personIds.has(person.id)) issues.push({ countryId, type: 'DUPLICATE_PERSON_ID', personId: person.id });
        personIds.add(person.id);
        if (memberToHousehold.get(person.id) !== person.householdId) issues.push({ countryId, type: 'MEMBERSHIP_MISMATCH', personId: person.id });
        if (!Number.isFinite(person.ageMonths) || person.ageMonths < 0) issues.push({ countryId, type: 'INVALID_AGE', personId: person.id });
        if (person.employmentStatus === 'employed_shadow' && person.laborForceStatus !== 'participating') issues.push({ countryId, type: 'EMPLOYED_OUTSIDE_LABOR_FORCE', personId: person.id });
        if (person.hoursWorked < -EPS || person.hoursAvailable < -EPS || person.hoursWorked > person.hoursAvailable + EPS) issues.push({ countryId, type: 'INVALID_HOURS', personId: person.id });
        const units = person.hoursAvailable / this.profile.standardMonthlyHours * finite(person.effectiveSkillFactor, 1);
        if (!Number.isFinite(units) || units < -EPS) issues.push({ countryId, type: 'INVALID_LABOR_UNITS', personId: person.id });
      }

      const memberTotal = data.householdViews.reduce((sum, row) => sum + row.memberCount, 0);
      if (memberTotal !== data.persons.length) issues.push({ countryId, type: 'COUNTRY_MEMBER_TOTAL_MISMATCH', memberTotal, persons: data.persons.length });
    }

    return { ok: issues.length === 0, issues };
  }

  report() {
    const countries = [...this.countryData.values()].map(data => structuredClone(data.summary));
    const validation = this.validate();
    return {
      profileId: this.profile.id,
      countries,
      totals: {
        persons: countries.reduce((sum, row) => sum + finite(row?.persons), 0),
        households: countries.reduce((sum, row) => sum + finite(row?.households), 0),
        workingAgePersons: countries.reduce((sum, row) => sum + finite(row?.workingAgePersons), 0),
        laborForcePersons: countries.reduce((sum, row) => sum + finite(row?.laborForcePersons), 0),
        shadowEmployedPersons: countries.reduce((sum, row) => sum + finite(row?.shadowEmployedPersons), 0),
        shadowUnemployedPersons: countries.reduce((sum, row) => sum + finite(row?.shadowUnemployedPersons), 0),
        compatibilityContradictions: countries.reduce((sum, row) => sum + finite(row?.compatibilityContradictions), 0)
      },
      validation
    };
  }
}
