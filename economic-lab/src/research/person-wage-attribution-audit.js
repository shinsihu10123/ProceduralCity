const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapById(rows = []) {
  return new Map(rows.map(row => [String(row.id), row]));
}

function signedBalanceRows(accounting, entities, account) {
  return (entities || []).map(entity => ({
    id: String(entity.id),
    balance: finite(accounting.gl.naturalBalance(entity.id, account))
  }));
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
      contradictions.filter(row => row.householdId).map(row => String(row.householdId))
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

    const firmClaimRows = signedBalanceRows(this.accounting, country.firms || [], 'wages_payable');
    const householdClaimRows = signedBalanceRows(this.accounting, country.households || [], 'wage_receivable');

    const signedFirmWagesPayable = firmClaimRows.reduce((sum, row) => sum + row.balance, 0);
    const signedHouseholdWageReceivable = householdClaimRows.reduce((sum, row) => sum + row.balance, 0);
    const positiveFirmWagesPayable = firmClaimRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
    const positiveHouseholdWageReceivable = householdClaimRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
    const negativeFirmWagesPayable = firmClaimRows.filter(row => row.balance < -EPS);
    const negativeHouseholdWageReceivable = householdClaimRows.filter(row => row.balance < -EPS);

    const grossDueProjectionError = canonicalGrossDue - projectedGrossDue - unresolvedGrossDue;
    const signedReceivablePayableError = signedHouseholdWageReceivable - signedFirmWagesPayable;
    const positiveReceivablePayableError = positiveHouseholdWageReceivable - positiveFirmWagesPayable;
    const operationalVsPositiveGlReceivableGap = canonicalOperationalArrears - positiveHouseholdWageReceivable;

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
      signedHouseholdWageReceivable,
      signedFirmWagesPayable,
      signedReceivablePayableError,
      positiveHouseholdWageReceivable,
      positiveFirmWagesPayable,
      positiveReceivablePayableError,
      negativeHouseholdWageReceivableCount: negativeHouseholdWageReceivable.length,
      negativeFirmWagesPayableCount: negativeFirmWagesPayable.length,
      negativeHouseholdWageReceivableTotal: negativeHouseholdWageReceivable.reduce((sum, row) => sum + row.balance, 0),
      negativeFirmWagesPayableTotal: negativeFirmWagesPayable.reduce((sum, row) => sum + row.balance, 0),
      negativeHouseholdWageReceivableSample: negativeHouseholdWageReceivable.slice(0, 5),
      negativeFirmWagesPayableSample: negativeFirmWagesPayable.slice(0, 5),
      operationalVsPositiveGlReceivableGap,
      identities: {
        grossDueProjection: Math.abs(grossDueProjectionError) < 1e-7,
        signedGlWageReceivableEqualsPayable: Math.abs(signedReceivablePayableError) < 1e-6
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
        'orphanOperationalArrears', 'signedHouseholdWageReceivable', 'signedFirmWagesPayable',
        'signedReceivablePayableError', 'positiveHouseholdWageReceivable', 'positiveFirmWagesPayable',
        'positiveReceivablePayableError', 'negativeHouseholdWageReceivableCount',
        'negativeFirmWagesPayableCount', 'negativeHouseholdWageReceivableTotal',
        'negativeFirmWagesPayableTotal', 'operationalVsPositiveGlReceivableGap'
      ]) acc[key] += finite(row[key]);
      return acc;
    }, Object.fromEntries([
      'canonicalEmployedHouseholds', 'projectedContracts', 'unresolvedEmploymentContradictions',
      'canonicalGrossDue', 'projectedGrossDue', 'unresolvedGrossDue', 'grossDueProjectionError',
      'canonicalCashPaid', 'projectedCashPaid', 'unresolvedCashPaid', 'nonContractCashPaid',
      'canonicalOperationalArrears', 'projectedOperationalArrears', 'unresolvedOperationalArrears',
      'orphanOperationalArrears', 'signedHouseholdWageReceivable', 'signedFirmWagesPayable',
      'signedReceivablePayableError', 'positiveHouseholdWageReceivable', 'positiveFirmWagesPayable',
      'positiveReceivablePayableError', 'negativeHouseholdWageReceivableCount',
      'negativeFirmWagesPayableCount', 'negativeHouseholdWageReceivableTotal',
      'negativeFirmWagesPayableTotal', 'operationalVsPositiveGlReceivableGap'
    ].map(key => [key, 0])));

    const gates = {
      grossDueProjectionIdentity: countryReports.every(row => row.identities.grossDueProjection),
      signedGlWageReceivableEqualsPayable: countryReports.every(row => row.identities.signedGlWageReceivableEqualsPayable),
      personAttributionObserved: totals.projectedContracts > 0
    };
    gates.ok = Object.values(gates).every(Boolean);

    return {
      version: 'r4-ce-b-attribution-audit-v2',
      month,
      gates,
      diagnostics: {
        negativeClaimBalancesObserved: totals.negativeHouseholdWageReceivableCount > 0 || totals.negativeFirmWagesPayableCount > 0,
        positiveOnlyClaimMismatch: Math.abs(totals.positiveReceivablePayableError) >= 1e-6
      },
      totals,
      countries: countryReports
    };
  }
}
