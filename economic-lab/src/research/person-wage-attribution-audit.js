const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapById(rows = []) {
  return new Map(rows.map(row => [String(row.id), row]));
}

export class PersonWageAttributionAudit {
  constructor({ accounting }) {
    if (!accounting) throw new Error('accounting is required');
    this.accounting = accounting;
  }

  countryReport(country, registry, month) {
    const households = mapById(country.households || []);
    const firms = mapById(country.firms || []);
    const contracts = registry.contracts(country.id);
    const contradictions = registry.contradictions(country.id);
    const contractHouseholds = new Set(contracts.map(c => String(c.householdId)));
    const unresolvedHouseholdIds = new Set(
      contradictions
        .filter(row => row.householdId)
        .map(row => String(row.householdId))
    );

    const canonicalEmployed = (country.households || []).filter(h => {
      if (!h.employed || !h.employerId) return false;
      const firm = firms.get(String(h.employerId));
      return firm && firm.active !== false;
    });

    const canonicalGrossDue = canonicalEmployed.reduce((sum, h) => {
      const firm = firms.get(String(h.employerId));
      return sum + Math.max(0, finite(firm?.wage));
    }, 0);
    const projectedGrossDue = contracts.reduce((sum, c) => sum + Math.max(0, finite(c.grossWageDue)), 0);
    const unresolvedGrossDue = canonicalEmployed
      .filter(h => !contractHouseholds.has(String(h.id)))
      .reduce((sum, h) => sum + Math.max(0, finite(firms.get(String(h.employerId))?.wage)), 0);

    const canonicalCashPaid = (country.households || []).reduce((sum, h) => sum + Math.max(0, finite(h.income)), 0);
    const projectedCashPaid = contracts.reduce((sum, c) => sum + Math.max(0, finite(c.wagePaid)), 0);
    const unresolvedCashPaid = (country.households || [])
      .filter(h => unresolvedHouseholdIds.has(String(h.id)))
      .reduce((sum, h) => sum + Math.max(0, finite(h.income)), 0);
    const nonContractCashPaid = Math.max(0, canonicalCashPaid - projectedCashPaid - unresolvedCashPaid);

    const canonicalOperationalArrears = (country.households || []).reduce((sum, h) => sum + Math.max(0, finite(h.wageArrears)), 0);
    const projectedOperationalArrears = contracts.reduce((sum, c) => sum + Math.max(0, finite(c.wageArrears)), 0);
    const unresolvedOperationalArrears = (country.households || [])
      .filter(h => unresolvedHouseholdIds.has(String(h.id)))
      .reduce((sum, h) => sum + Math.max(0, finite(h.wageArrears)), 0);
    const orphanOperationalArrears = (country.households || [])
      .filter(h => !contractHouseholds.has(String(h.id)) && !unresolvedHouseholdIds.has(String(h.id)) && finite(h.wageArrears) > EPS)
      .reduce((sum, h) => sum + Math.max(0, finite(h.wageArrears)), 0);

    const firmWagesPayable = (country.firms || []).reduce(
      (sum, firm) => sum + Math.max(0, finite(this.accounting.gl.naturalBalance(firm.id, 'wages_payable'))),
      0
    );
    const householdWageReceivable = (country.households || []).reduce(
      (sum, household) => sum + Math.max(0, finite(this.accounting.gl.naturalBalance(household.id, 'wage_receivable'))),
      0
    );

    const grossDueProjectionError = canonicalGrossDue - projectedGrossDue - unresolvedGrossDue;
    const receivablePayableError = householdWageReceivable - firmWagesPayable;
    const operationalVsGlReceivableGap = canonicalOperationalArrears - householdWageReceivable;

    return {
      countryId: String(country.id),
      month,
      canonicalEmployedHouseholds: canonicalEmployed.length,
      projectedContracts: contracts.length,
      unresolvedEmploymentContradictions: contradictions.length,
      canonicalGrossDue,
      projectedGrossDue,
      unresolvedGrossDue,
      grossDueProjectionError,
      canonicalCashPaid,
      projectedCashPaid,
      unresolvedCashPaid,
      nonContractCashPaid,
      canonicalOperationalArrears,
      projectedOperationalArrears,
      unresolvedOperationalArrears,
      orphanOperationalArrears,
      householdWageReceivable,
      firmWagesPayable,
      receivablePayableError,
      operationalVsGlReceivableGap,
      identities: {
        grossDueProjection: Math.abs(grossDueProjectionError) < 1e-7,
        glWageReceivableEqualsPayable: Math.abs(receivablePayableError) < 1e-6
      }
    };
  }

  report(countries, registry, month = 0) {
    const countryReports = (countries || []).map(country => this.countryReport(country, registry, month));
    const totals = countryReports.reduce((acc, row) => {
      for (const key of [
        'canonicalEmployedHouseholds', 'projectedContracts', 'unresolvedEmploymentContradictions',
        'canonicalGrossDue', 'projectedGrossDue', 'unresolvedGrossDue', 'grossDueProjectionError',
        'canonicalCashPaid', 'projectedCashPaid', 'unresolvedCashPaid', 'nonContractCashPaid',
        'canonicalOperationalArrears', 'projectedOperationalArrears', 'unresolvedOperationalArrears',
        'orphanOperationalArrears', 'householdWageReceivable', 'firmWagesPayable',
        'receivablePayableError', 'operationalVsGlReceivableGap'
      ]) acc[key] += finite(row[key]);
      return acc;
    }, {
      canonicalEmployedHouseholds: 0,
      projectedContracts: 0,
      unresolvedEmploymentContradictions: 0,
      canonicalGrossDue: 0,
      projectedGrossDue: 0,
      unresolvedGrossDue: 0,
      grossDueProjectionError: 0,
      canonicalCashPaid: 0,
      projectedCashPaid: 0,
      unresolvedCashPaid: 0,
      nonContractCashPaid: 0,
      canonicalOperationalArrears: 0,
      projectedOperationalArrears: 0,
      unresolvedOperationalArrears: 0,
      orphanOperationalArrears: 0,
      householdWageReceivable: 0,
      firmWagesPayable: 0,
      receivablePayableError: 0,
      operationalVsGlReceivableGap: 0
    });

    const gates = {
      grossDueProjectionIdentity: countryReports.every(row => row.identities.grossDueProjection),
      glWageReceivableEqualsPayable: countryReports.every(row => row.identities.glWageReceivableEqualsPayable),
      personAttributionObserved: totals.projectedContracts > 0
    };
    gates.ok = Object.values(gates).every(Boolean);

    return { version: 'r4-ce-b-attribution-audit-v1', month, gates, totals, countries: countryReports };
  }
}
