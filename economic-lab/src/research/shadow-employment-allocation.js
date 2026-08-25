const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function eligible(person) {
  return Boolean(
    person?.alive &&
    person?.workingAge &&
    person?.laborForceStatus === 'participating' &&
    finite(person.hoursAvailable) > EPS
  );
}

function byId(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

export class ShadowEmploymentAllocationRehearsal {
  constructor({ shadowPersonSystem, shadowLaborDemandSystem }) {
    if (!shadowPersonSystem) throw new Error('shadowPersonSystem is required');
    if (!shadowLaborDemandSystem) throw new Error('shadowLaborDemandSystem is required');
    this.shadowPersonSystem = shadowPersonSystem;
    this.shadowLaborDemandSystem = shadowLaborDemandSystem;
    this.standardMonthlyHours = Math.max(1, finite(shadowPersonSystem.profile?.standardMonthlyHours, 160));
    this.countryData = new Map();
  }

  allocate(countries, month = 0) {
    this.countryData.clear();
    for (const country of countries || []) this.allocateCountry(country, month);
    return this.report();
  }

  allocateCountry(country, month = 0) {
    const countryId = String(country.id);
    const demand = this.shadowLaborDemandSystem.countryReport(countryId);
    if (!demand) throw new Error(`shadow labor demand missing for ${countryId}`);

    const persons = this.shadowPersonSystem.persons(countryId).filter(eligible).slice().sort(byId);
    const personById = new Map(persons.map(p => [String(p.id), p]));
    const households = new Map((country.households || []).map(h => [String(h.id), h]));
    const firms = new Map((country.firms || []).filter(f => f.active !== false).map(f => [String(f.id), f]));
    const remainingHours = new Map(persons.map(p => [String(p.id), Math.max(0, finite(p.hoursAvailable))]));
    const allocations = [];
    const allocatedPersonIds = new Set();
    const firmRows = [];

    const demandRows = demand.rows.slice().sort((a, b) => String(a.firmId).localeCompare(String(b.firmId)));
    for (const row of demandRows) {
      const firm = firms.get(String(row.firmId));
      if (!firm) continue;
      const targetLaborUnits = Math.max(0, finite(row.shadowDesiredLaborUnits));
      let remainingLaborUnits = targetLaborUnits;
      let allocatedLaborUnits = 0;

      const candidates = persons.slice().sort((a, b) => {
        const ha = households.get(String(a.householdId));
        const hb = households.get(String(b.householdId));
        const aSame = ha?.employed && String(ha.employerId) === String(firm.id) ? 0 : 1;
        const bSame = hb?.employed && String(hb.employerId) === String(firm.id) ? 0 : 1;
        return aSame - bSame || byId(a, b);
      });

      for (const person of candidates) {
        if (remainingLaborUnits <= EPS) break;
        const personId = String(person.id);
        if (allocatedPersonIds.has(personId)) continue;
        const hoursAvailable = Math.max(0, finite(remainingHours.get(personId)));
        if (hoursAvailable <= EPS) continue;
        const skillFactor = Math.max(EPS, finite(person.effectiveSkillFactor, 1));
        const laborUnitsPerHour = skillFactor / this.standardMonthlyHours;
        const hoursNeeded = remainingLaborUnits / laborUnitsPerHour;
        const hoursWorked = Math.min(hoursAvailable, Math.max(0, hoursNeeded));
        const laborUnits = hoursWorked * laborUnitsPerHour;
        if (laborUnits <= EPS) continue;

        const household = households.get(String(person.householdId));
        const monthlyWage = Math.max(0, finite(firm.wage));
        const wageRatePerHour = monthlyWage / this.standardMonthlyHours;
        const grossWageDue = hoursWorked * wageRatePerHour;
        let transitionClass = 'PERSON_NEWLY_EMPLOYED_FROM_NONEMPLOYED_HOUSEHOLD';
        if (household?.employed && String(household.employerId) === String(firm.id)) transitionClass = 'LEGACY_MAPPED_SAME_FIRM';
        else if (household?.employed) transitionClass = 'LEGACY_MAPPED_DIFFERENT_PERSON';

        allocations.push({
          id: `r4-ce-c:${countryId}:${month}:${personId}:${firm.id}`,
          countryId,
          month,
          personId,
          householdId: String(person.householdId),
          firmId: String(firm.id),
          contractedHours: hoursWorked,
          hoursWorked,
          hoursAvailable,
          skillFactor,
          laborUnits,
          wageRatePerHour,
          grossWageDue,
          allocationSource: 'shadow-labor-demand-deterministic-rehearsal-v1',
          transitionClass
        });
        allocatedPersonIds.add(personId);
        remainingHours.set(personId, hoursAvailable - hoursWorked);
        remainingLaborUnits = Math.max(0, remainingLaborUnits - laborUnits);
        allocatedLaborUnits += laborUnits;
      }

      firmRows.push({
        firmId: String(firm.id),
        targetLaborUnits,
        allocatedLaborUnits,
        unfilledLaborUnits: Math.max(0, targetLaborUnits - allocatedLaborUnits)
      });
    }

    allocations.sort((a, b) => a.id.localeCompare(b.id));
    const allocationsByHousehold = new Map();
    for (const row of allocations) {
      if (!allocationsByHousehold.has(row.householdId)) allocationsByHousehold.set(row.householdId, []);
      allocationsByHousehold.get(row.householdId).push(row);
    }

    const householdRows = [];
    const transitionLedger = [];
    for (const household of country.households || []) {
      const householdId = String(household.id);
      const rows = allocationsByHousehold.get(householdId) || [];
      const projectedLaborIncome = rows.reduce((s, r) => s + r.grossWageDue, 0);
      householdRows.push({
        householdId,
        earners: rows.length,
        projectedLaborIncome,
        legacyLaborIncome: Math.max(0, finite(household.wage)),
        laborIncomeDelta: projectedLaborIncome - Math.max(0, finite(household.wage))
      });

      if (household.employed) {
        const eligibleMembers = persons.filter(p => String(p.householdId) === householdId);
        const sameFirm = rows.some(r => String(r.firmId) === String(household.employerId));
        let transitionClass;
        if (!eligibleMembers.length) transitionClass = 'LEGACY_EMPLOYED_NO_ELIGIBLE_PERSON';
        else if (sameFirm) transitionClass = 'LEGACY_MAPPED_SAME_FIRM';
        else if (rows.length) transitionClass = 'LEGACY_MAPPED_DIFFERENT_PERSON';
        else transitionClass = 'LEGACY_EMPLOYED_ELIGIBLE_UNALLOCATED';
        transitionLedger.push({ householdId, legacyEmployerId: household.employerId == null ? null : String(household.employerId), transitionClass });
      }
    }

    const unallocatedEligible = persons
      .filter(p => !allocatedPersonIds.has(String(p.id)))
      .map(p => ({ personId: String(p.id), householdId: String(p.householdId), transitionClass: 'ELIGIBLE_PERSON_UNALLOCATED' }));
    const unfilledFirmDemand = firmRows
      .filter(r => r.unfilledLaborUnits > EPS)
      .map(r => ({ firmId: r.firmId, unfilledLaborUnits: r.unfilledLaborUnits, transitionClass: 'FIRM_DEMAND_UNFILLED' }));

    const legacyGrossWageDue = (country.households || []).filter(h => h.employed && h.employerId).reduce((sum, h) => {
      const firm = firms.get(String(h.employerId));
      return sum + Math.max(0, finite(firm?.wage, finite(h.wage)));
    }, 0);
    const proposedGrossWageDue = allocations.reduce((sum, row) => sum + row.grossWageDue, 0);

    const summary = {
      countryId,
      month,
      laborForcePersons: this.shadowPersonSystem.laborForce(countryId).length,
      eligiblePersons: persons.length,
      allocatedPersons: allocations.length,
      unallocatedEligiblePersons: unallocatedEligible.length,
      totalAllocatedHours: allocations.reduce((sum, row) => sum + row.hoursWorked, 0),
      totalAllocatedLaborUnits: allocations.reduce((sum, row) => sum + row.laborUnits, 0),
      firmDemandLaborUnits: firmRows.reduce((sum, row) => sum + row.targetLaborUnits, 0),
      unfilledFirmDemandLaborUnits: firmRows.reduce((sum, row) => sum + row.unfilledLaborUnits, 0),
      legacyEmployedHouseholds: transitionLedger.length,
      legacyMappedHouseholds: transitionLedger.filter(row => row.transitionClass === 'LEGACY_MAPPED_SAME_FIRM' || row.transitionClass === 'LEGACY_MAPPED_DIFFERENT_PERSON').length,
      legacyNoEligiblePerson: transitionLedger.filter(row => row.transitionClass === 'LEGACY_EMPLOYED_NO_ELIGIBLE_PERSON').length,
      legacyEligibleUnallocated: transitionLedger.filter(row => row.transitionClass === 'LEGACY_EMPLOYED_ELIGIBLE_UNALLOCATED').length,
      householdsZeroEarners: householdRows.filter(row => row.earners === 0).length,
      householdsOneEarner: householdRows.filter(row => row.earners === 1).length,
      householdsMultipleEarners: householdRows.filter(row => row.earners > 1).length,
      legacyGrossWageDue,
      proposedGrossWageDue,
      grossWageDelta: proposedGrossWageDue - legacyGrossWageDue
    };

    const data = { countryId, month, allocations, firmRows, householdRows, transitionLedger, unallocatedEligible, unfilledFirmDemand, summary };
    this.countryData.set(countryId, data);
    return structuredClone(summary);
  }

  validate(countries = []) {
    const issues = [];
    const countryMap = new Map((countries || []).map(c => [String(c.id), c]));
    for (const [countryId, data] of this.countryData.entries()) {
      const country = countryMap.get(countryId);
      if (!country) { issues.push({ countryId, type: 'COUNTRY_MISSING' }); continue; }
      const persons = new Map(this.shadowPersonSystem.persons(countryId).map(p => [String(p.id), p]));
      const firms = new Map((country.firms || []).filter(f => f.active !== false).map(f => [String(f.id), f]));
      const seenPersons = new Set();
      for (const allocation of data.allocations) {
        if (seenPersons.has(allocation.personId)) issues.push({ countryId, type: 'MULTIPLE_PRIMARY_ALLOCATIONS', personId: allocation.personId });
        seenPersons.add(allocation.personId);
        const person = persons.get(allocation.personId);
        if (!person) issues.push({ countryId, type: 'PERSON_MISSING', personId: allocation.personId });
        if (!firms.has(allocation.firmId)) issues.push({ countryId, type: 'FIRM_MISSING', firmId: allocation.firmId });
        if (person && String(person.householdId) !== allocation.householdId) issues.push({ countryId, type: 'HOUSEHOLD_MEMBERSHIP_MISMATCH', personId: allocation.personId });
        if (allocation.hoursWorked > finite(person?.hoursAvailable) + 1e-7) issues.push({ countryId, type: 'HOURS_ABOVE_AVAILABLE', personId: allocation.personId });
        if (Math.abs(allocation.hoursWorked * allocation.wageRatePerHour - allocation.grossWageDue) > 1e-7) issues.push({ countryId, type: 'GROSS_WAGE_IDENTITY', personId: allocation.personId });
      }
      for (const row of data.firmRows) {
        if (row.allocatedLaborUnits > row.targetLaborUnits + 1e-7) issues.push({ countryId, type: 'FIRM_ALLOCATION_ABOVE_TARGET', firmId: row.firmId });
      }
      const employedCount = (country.households || []).filter(h => h.employed).length;
      if (data.transitionLedger.length !== employedCount) issues.push({ countryId, type: 'LEGACY_TRANSITION_LEDGER_INCOMPLETE', expected: employedCount, actual: data.transitionLedger.length });
      const pooled = data.householdRows.reduce((sum, row) => sum + row.projectedLaborIncome, 0);
      const wages = data.allocations.reduce((sum, row) => sum + row.grossWageDue, 0);
      if (Math.abs(pooled - wages) > 1e-7) issues.push({ countryId, type: 'HOUSEHOLD_INCOME_POOL_IDENTITY', pooled, wages });
    }
    return { ok: issues.length === 0, issues };
  }

  report() {
    const countries = Array.from(this.countryData.values()).map(data => ({ ...structuredClone(data.summary) }));
    return {
      version: 'r4-ce-c-shadow-allocation-v1',
      standardMonthlyHours: this.standardMonthlyHours,
      countries,
      totals: countries.reduce((acc, row) => {
        for (const key of [
          'laborForcePersons','eligiblePersons','allocatedPersons','unallocatedEligiblePersons','totalAllocatedHours',
          'totalAllocatedLaborUnits','firmDemandLaborUnits','unfilledFirmDemandLaborUnits','legacyEmployedHouseholds',
          'legacyMappedHouseholds','legacyNoEligiblePerson','legacyEligibleUnallocated','householdsZeroEarners',
          'householdsOneEarner','householdsMultipleEarners','legacyGrossWageDue','proposedGrossWageDue','grossWageDelta'
        ]) acc[key] = finite(acc[key]) + finite(row[key]);
        return acc;
      }, {})
    };
  }
}
