const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function activeFirmMap(country) {
  return new Map((country.firms || []).filter(f => f.active !== false).map(f => [String(f.id), f]));
}

function deterministicParticipant(members = []) {
  return members
    .filter(p => p?.alive && p?.workingAge && p?.laborForceStatus === 'participating' && finite(p.hoursAvailable) > EPS)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] || null;
}

function contractId(countryId, householdId, personId, firmId, projectionMonth) {
  return `m3-projection:${countryId}:${householdId}:${personId}:${firmId}:${projectionMonth}`;
}

export class PersonEmploymentContractRegistry {
  constructor({ shadowPersonSystem, standardMonthlyHours = null }) {
    if (!shadowPersonSystem) throw new Error('shadowPersonSystem is required');
    this.shadowPersonSystem = shadowPersonSystem;
    this.standardMonthlyHours = Math.max(
      1,
      finite(standardMonthlyHours, finite(shadowPersonSystem.profile?.standardMonthlyHours, 160))
    );
    this.countryData = new Map();
  }

  project(countries, month = 0) {
    this.countryData.clear();
    for (const country of countries || []) this.projectCountry(country, month);
    return this.report();
  }

  projectCountry(country, month = 0) {
    const countryId = String(country.id);
    const projectionMonth = Math.max(0, Math.round(finite(month)));
    const persons = this.shadowPersonSystem.persons(countryId);
    const personsByHousehold = new Map();
    for (const person of persons) {
      const key = String(person.householdId);
      if (!personsByHousehold.has(key)) personsByHousehold.set(key, []);
      personsByHousehold.get(key).push(person);
    }

    const firms = activeFirmMap(country);
    const contracts = [];
    const contradictions = [];
    const projectedPersonIds = new Set();

    for (const household of country.households || []) {
      if (!household.employed) continue;
      const householdId = String(household.id);
      const firmId = household.employerId == null ? null : String(household.employerId);
      if (!firmId || !firms.has(firmId)) {
        contradictions.push({
          type: 'CANONICAL_EMPLOYED_WITH_INVALID_EMPLOYER',
          countryId,
          householdId,
          employerId: firmId
        });
        continue;
      }

      const member = deterministicParticipant(personsByHousehold.get(householdId) || []);
      if (!member) {
        contradictions.push({
          type: 'CANONICAL_EMPLOYED_WITHOUT_ELIGIBLE_PARTICIPANT',
          countryId,
          householdId,
          employerId: firmId
        });
        continue;
      }
      if (projectedPersonIds.has(String(member.id))) {
        contradictions.push({
          type: 'PERSON_PROJECTED_TO_MULTIPLE_CONTRACTS',
          countryId,
          householdId,
          personId: String(member.id),
          employerId: firmId
        });
        continue;
      }

      const firm = firms.get(firmId);
      const contractedHours = Math.min(this.standardMonthlyHours, Math.max(0, finite(member.hoursAvailable)));
      const hoursWorked = contractedHours;
      const monthlyWage = Math.max(0, finite(firm.wage, finite(household.wage)));
      const wageRatePerHour = contractedHours > EPS ? monthlyWage / contractedHours : 0;
      const grossWageDue = hoursWorked * wageRatePerHour;
      const wageArrears = Math.max(0, finite(household.wageArrears));
      const effectiveSkillFactor = Math.max(EPS, finite(member.effectiveSkillFactor, 1));
      const laborUnits = hoursWorked / this.standardMonthlyHours * effectiveSkillFactor;

      const contract = {
        id: contractId(countryId, householdId, String(member.id), firmId, projectionMonth),
        countryId,
        personId: String(member.id),
        householdId,
        firmId,
        startMonth: projectionMonth,
        endMonth: null,
        status: 'active',
        standardMonthlyHours: this.standardMonthlyHours,
        contractedHours,
        hoursWorked,
        wageRatePerHour,
        grossWageDue,
        wagePaid: Math.max(0, finite(household.income)),
        wageArrears,
        skillFactor: effectiveSkillFactor,
        laborUnits,
        source: 'legacy-household-employment-projection'
      };
      contracts.push(contract);
      projectedPersonIds.add(contract.personId);
    }

    contracts.sort((a, b) => a.id.localeCompare(b.id));
    contradictions.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    const employedHouseholds = (country.households || []).filter(h => h.employed).length;
    const byFirm = {};
    for (const contract of contracts) {
      const row = byFirm[contract.firmId] ||= {
        firmId: contract.firmId,
        personContracts: 0,
        laborUnits: 0,
        grossWageDue: 0,
        wagePaid: 0,
        wageArrears: 0
      };
      row.personContracts += 1;
      row.laborUnits += contract.laborUnits;
      row.grossWageDue += contract.grossWageDue;
      row.wagePaid += contract.wagePaid;
      row.wageArrears += contract.wageArrears;
    }

    const summary = {
      countryId,
      projectionMonth,
      canonicalEmployedHouseholds: employedHouseholds,
      projectedContracts: contracts.length,
      unresolvedEmployedHouseholds: Math.max(0, employedHouseholds - contracts.length),
      projectionCoverage: employedHouseholds ? contracts.length / employedHouseholds : 1,
      projectedLaborUnits: contracts.reduce((s, c) => s + c.laborUnits, 0),
      projectedGrossWageDue: contracts.reduce((s, c) => s + c.grossWageDue, 0),
      projectedWagePaid: contracts.reduce((s, c) => s + c.wagePaid, 0),
      projectedWageArrears: contracts.reduce((s, c) => s + c.wageArrears, 0),
      contradictions: contradictions.length
    };

    const data = { countryId, projectionMonth, contracts, contradictions, byFirm, summary };
    this.countryData.set(countryId, data);
    return structuredClone(summary);
  }

  contracts(countryId) {
    return structuredClone(this.countryData.get(String(countryId))?.contracts || []);
  }

  contradictions(countryId) {
    return structuredClone(this.countryData.get(String(countryId))?.contradictions || []);
  }

  firmSummary(countryId, firmId) {
    const row = this.countryData.get(String(countryId))?.byFirm?.[String(firmId)];
    return row ? structuredClone(row) : null;
  }

  validate(countries = []) {
    const issues = [];
    const countryMap = new Map((countries || []).map(c => [String(c.id), c]));
    const globalContractIds = new Set();

    for (const [countryId, data] of this.countryData.entries()) {
      const country = countryMap.get(countryId);
      if (!country) {
        issues.push({ type: 'COUNTRY_MISSING', countryId });
        continue;
      }
      const households = new Map((country.households || []).map(h => [String(h.id), h]));
      const firms = activeFirmMap(country);
      const persons = new Map(this.shadowPersonSystem.persons(countryId).map(p => [String(p.id), p]));
      const activeByPerson = new Map();

      for (const contract of data.contracts) {
        if (globalContractIds.has(contract.id)) issues.push({ type: 'DUPLICATE_CONTRACT_ID', countryId, contractId: contract.id });
        globalContractIds.add(contract.id);
        const person = persons.get(contract.personId);
        const household = households.get(contract.householdId);
        const firm = firms.get(contract.firmId);
        if (!person) issues.push({ type: 'CONTRACT_PERSON_MISSING', countryId, contractId: contract.id });
        if (!household) issues.push({ type: 'CONTRACT_HOUSEHOLD_MISSING', countryId, contractId: contract.id });
        if (!firm) issues.push({ type: 'CONTRACT_FIRM_MISSING_OR_INACTIVE', countryId, contractId: contract.id });
        if (person && String(person.householdId) !== contract.householdId) issues.push({ type: 'PERSON_HOUSEHOLD_MISMATCH', countryId, contractId: contract.id });
        if (contract.status === 'active') {
          activeByPerson.set(contract.personId, (activeByPerson.get(contract.personId) || 0) + 1);
          if (contract.hoursWorked > contract.contractedHours + EPS) issues.push({ type: 'HOURS_WORKED_ABOVE_CONTRACT', countryId, contractId: contract.id });
          if (person && contract.contractedHours > finite(person.hoursAvailable) + EPS) issues.push({ type: 'CONTRACT_HOURS_ABOVE_AVAILABLE', countryId, contractId: contract.id });
        }
        const expectedDue = contract.hoursWorked * contract.wageRatePerHour;
        if (Math.abs(expectedDue - contract.grossWageDue) > 1e-7) issues.push({ type: 'GROSS_WAGE_IDENTITY', countryId, contractId: contract.id });
      }

      for (const [personId, count] of activeByPerson.entries()) {
        if (count > 1) issues.push({ type: 'MULTIPLE_ACTIVE_PRIMARY_CONTRACTS', countryId, personId, count });
      }

      if (data.summary.projectedContracts + data.summary.unresolvedEmployedHouseholds !== data.summary.canonicalEmployedHouseholds) {
        issues.push({ type: 'PROJECTION_COUNT_RECONCILIATION', countryId });
      }
    }

    return { ok: issues.length === 0, issues };
  }

  report() {
    const countries = Array.from(this.countryData.values()).map(data => ({
      ...structuredClone(data.summary),
      byFirm: structuredClone(Object.values(data.byFirm)),
      contradictions: structuredClone(data.contradictions)
    }));
    const totals = countries.reduce((acc, row) => {
      acc.canonicalEmployedHouseholds += row.canonicalEmployedHouseholds;
      acc.projectedContracts += row.projectedContracts;
      acc.unresolvedEmployedHouseholds += row.unresolvedEmployedHouseholds;
      acc.projectedLaborUnits += row.projectedLaborUnits;
      acc.projectedGrossWageDue += row.projectedGrossWageDue;
      acc.projectedWagePaid += row.projectedWagePaid;
      acc.projectedWageArrears += row.projectedWageArrears;
      acc.contradictions += row.contradictions.length;
      return acc;
    }, {
      canonicalEmployedHouseholds: 0,
      projectedContracts: 0,
      unresolvedEmployedHouseholds: 0,
      projectedLaborUnits: 0,
      projectedGrossWageDue: 0,
      projectedWagePaid: 0,
      projectedWageArrears: 0,
      contradictions: 0
    });
    totals.projectionCoverage = totals.canonicalEmployedHouseholds
      ? totals.projectedContracts / totals.canonicalEmployedHouseholds
      : 1;
    return { version: 'r4-ce-a-v1', standardMonthlyHours: this.standardMonthlyHours, countries, totals };
  }
}
