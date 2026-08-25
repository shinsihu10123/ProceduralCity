import { ShadowLaborDemandSystem } from './shadow-labor-demand.js';
import {
  buildFirmWorkingCapitalApplicationSnapshot,
  evaluateUnderwritingSnapshot
} from './snapshot-underwriting-evaluator.js';

const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableFinite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function signalsFor(country) {
  const prev = country.previousMacro || country.macro || {};
  const history = country.history || [];
  const prev2 = history.length > 1 ? history[history.length - 2] : prev;
  const inflation = prev2?.priceIndex ? finite(prev.priceIndex) / Math.max(EPS, finite(prev2.priceIndex, 1)) - 1 : 0;
  const wageGrowth = prev2?.avgWage ? finite(prev.avgWage) / Math.max(EPS, finite(prev2.avgWage, 1)) - 1 : 0;
  const demandGrowth = prev2?.nominalSales ? finite(prev.nominalSales) / Math.max(EPS, finite(prev2.nominalSales, 1)) - 1 : 0;
  return {
    inflation: Number.isFinite(inflation) ? inflation : 0,
    wageGrowth: Number.isFinite(wageGrowth) ? wageGrowth : 0,
    demandGrowth: Number.isFinite(demandGrowth) ? demandGrowth : 0,
    unemployment: finite(prev?.unemployment)
  };
}

function scheduledDebtService(country, firmId, month) {
  let total = 0;
  for (const loan of country.loans || []) {
    if (loan.status !== 'active' || String(loan.borrowerId) !== String(firmId) || month < finite(loan.nextPaymentMonth)) continue;
    const outstanding = Math.max(0, finite(loan.outstanding));
    const scheduledPrincipal = Math.min(outstanding, Math.max(0, finite(loan.originalPrincipal)) / Math.max(1, finite(loan.termMonths, 1)));
    const interestDue = outstanding * Math.max(0, finite(loan.monthlyRate));
    const requestedCatchUp = Math.min(Math.max(0, finite(loan.arrears)), scheduledPrincipal * 0.5);
    total += Math.min(outstanding + interestDue, scheduledPrincipal + interestDue + requestedCatchUp);
  }
  return total;
}

function classifyBinding({ physical, capacity, input, finance, underwriting }) {
  const candidates = [
    ['PHYSICAL_NEED', physical],
    ['PRODUCTION_CAPACITY', capacity],
    ['INPUT_AVAILABILITY', input],
    ['FINANCE', finance]
  ].filter(([, value]) => Number.isFinite(value));
  if (!candidates.length) return { primary: 'UNRESOLVED_MODEL_GAP', secondary: [] };
  const min = Math.min(...candidates.map(([, value]) => value));
  const tied = candidates.filter(([, value]) => Math.abs(value - min) <= 1e-7).map(([name]) => name);
  let primary = tied[0];
  if (primary === 'FINANCE') {
    if (underwriting?.applicationEligible && !underwriting.approved && underwriting.requestedAmount > EPS) primary = 'NEW_CREDIT_UNDERWRITING';
    else primary = 'CASH_WORKING_CAPITAL';
  }
  const secondary = tied.slice(1).map(name => name === 'FINANCE' ? 'CASH_WORKING_CAPITAL' : name);
  return { primary, secondary };
}

function aggregate(rows) {
  const sum = key => rows.reduce((s, row) => s + finite(row[key]), 0);
  const count = key => rows.filter(row => row.primaryBindingConstraint === key).length;
  return {
    establishments: rows.length,
    physicalLaborNeed: sum('physicalLaborNeed'),
    cashOnlyFinanceableLabor: sum('cashOnlyFinanceableLabor'),
    admissibleCreditFinanceableLabor: sum('admissibleCreditFinanceableLabor'),
    fullFinanceableLabor: sum('fullFinanceableLabor'),
    canonicalDesiredWorkers: sum('canonicalDesiredWorkers'),
    currentWorkers: sum('workerCount'),
    creditRequested: sum('workingCapitalCreditRequested'),
    creditAdmissible: sum('workingCapitalCreditAdmissible'),
    approvedApplications: rows.filter(row => row.underwritingApproved).length,
    eligibleApplications: rows.filter(row => row.underwritingApplicationEligible).length,
    bindingCounts: Object.fromEntries([
      'PHYSICAL_NEED','PRODUCTION_CAPACITY','INPUT_AVAILABILITY','CASH_WORKING_CAPITAL','EXISTING_CREDIT_LIMIT','NEW_CREDIT_UNDERWRITING','PAYROLL_COST','NO_BINDING_CONSTRAINT','UNRESOLVED_MODEL_GAP'
    ].map(key => [key, count(key)]))
  };
}

export class WorkingCapitalLaborEnvelope {
  constructor({ ledger, accounting, rng }) {
    if (!ledger || !accounting || !rng) throw new Error('ledger, accounting and rng are required');
    this.ledger = ledger;
    this.accounting = accounting;
    this.rng = rng;
    this.shadowLabor = new ShadowLaborDemandSystem({ ledger });
    this.countryData = new Map();
  }

  refresh(countries, month = 0) {
    this.countryData.clear();
    this.shadowLabor.refresh(countries, month);

    for (const country of countries || []) {
      const bank = country.banks?.[0];
      const bankStatement = bank ? this.accounting.entityStatement(bank.id, month).balanceSheet : null;
      const signals = signalsFor(country);
      const base = this.shadowLabor.countryReport(country.id);
      const rows = [];

      for (const row of base?.rows || []) {
        const firm = (country.firms || []).find(f => String(f.id) === String(row.firmId));
        if (!firm || firm.active === false) continue;
        const depositCash = Math.max(0, finite(this.ledger.balance(firm.accountId)));
        const debtService = scheduledDebtService(country, firm.id, month);
        const liquidBeforeNewCredit = Math.max(0, depositCash - debtService);
        const existingUndrawnCommittedCredit = 0;
        const application = buildFirmWorkingCapitalApplicationSnapshot({ firm, cash: depositCash });
        let underwriting = {
          applicationEligible: Boolean(application?.applicationEligible),
          approved: false,
          requestedAmount: Math.max(0, finite(application?.amount)),
          admissibleAmount: 0,
          annualRate: null,
          rejectionReason: application?.applicationEligible ? 'BANK_OR_STATEMENT_UNAVAILABLE' : 'NO_APPLICATION_THRESHOLD',
          source: { committedUndrawnCredit: 0, committedUndrawnCreditSource: 'NOT_MODELED_IN_CANONICAL_BANK_SYSTEM' }
        };
        if (bank && bankStatement && application?.applicationEligible) {
          underwriting = evaluateUnderwritingSnapshot({
            bank,
            application,
            bankStatement,
            signals,
            rngState: this.rng.state
          });
        }

        const wage = Math.max(EPS, finite(row.payrollPerLaborUnit, EPS));
        const inputCostPerLaborUnit = nullableFinite(row.inputCostPerLaborUnit);
        const unitOperatingCost = inputCostPerLaborUnit === null ? wage : wage + Math.max(0, inputCostPerLaborUnit);
        const physical = nullableFinite(row.physicalLaborNeed);
        const capacity = nullableFinite(row.capacityLaborLimit);
        const inputRatio = nullableFinite(row.inputConstraintRatio);
        const inputCeiling = physical === null
          ? null
          : inputRatio === null ? null : Math.max(0, physical * Math.min(1, Math.max(0, inputRatio)));
        const cashOnlyFinanceableLabor = liquidBeforeNewCredit / Math.max(EPS, unitOperatingCost);
        const existingFacilityFinanceableLabor = (liquidBeforeNewCredit + existingUndrawnCommittedCredit) / Math.max(EPS, unitOperatingCost);
        const admissibleCreditFinanceableLabor = (liquidBeforeNewCredit + existingUndrawnCommittedCredit + Math.max(0, finite(underwriting.admissibleAmount))) / Math.max(EPS, unitOperatingCost);
        const hardBounds = [physical, capacity, inputCeiling, admissibleCreditFinanceableLabor].filter(Number.isFinite);
        const fullFinanceableLabor = hardBounds.length ? Math.max(0, Math.min(...hardBounds)) : null;
        const binding = classifyBinding({ physical, capacity, input: inputCeiling, finance: admissibleCreditFinanceableLabor, underwriting });

        rows.push({
          countryId: String(country.id),
          firmId: String(firm.id),
          sectorId: row.sectorId,
          sizeBin: row.sizeBin,
          workerCount: row.workerCount,
          canonicalDesiredWorkers: row.canonicalDesiredWorkers,
          plannedOutput: row.plannedOutput,
          effectiveOutputPerLaborUnit: row.effectiveOutputPerLaborUnit,
          physicalLaborNeed: physical,
          capacityLaborLimit: capacity,
          requiredInputUnits: row.requiredInputUnits,
          availableInputUnits: row.availableInputUnits,
          inputCostPerOutput: row.inputCostPerOutput,
          inputCostForPhysicalPlan: physical === null || inputCostPerLaborUnit === null ? null : physical * inputCostPerLaborUnit,
          inputConstrainedLaborCeiling: inputCeiling,
          depositCash,
          existingLoanPrincipal: Math.max(0, finite(firm.loanBalance)),
          scheduledDebtServiceCurrentMonth: debtService,
          existingUndrawnCommittedCredit,
          existingUndrawnCommittedCreditSource: 'NOT_MODELED_IN_CANONICAL_BANK_SYSTEM',
          liquidWorkingCapitalBeforeNewCredit: liquidBeforeNewCredit,
          payrollPerLaborUnit: wage,
          inputCostPerLaborUnit,
          unitOperatingCost,
          workingCapitalCreditRequested: Math.max(0, finite(underwriting.requestedAmount)),
          workingCapitalCreditAdmissible: Math.max(0, finite(underwriting.admissibleAmount)),
          underwritingApplicationEligible: Boolean(underwriting.applicationEligible),
          underwritingApproved: Boolean(underwriting.approved),
          underwritingRejectReason: underwriting.rejectionReason || null,
          underwritingRate: Number.isFinite(underwriting.annualRate) ? underwriting.annualRate : null,
          underwritingMaturity: application?.termMonths ?? null,
          underwritingCollateralOrCapacityProxy: Number.isFinite(underwriting.capitalCapacity) ? underwriting.capitalCapacity : null,
          underwritingTraceSource: underwriting.source?.evaluator || 'NO_EVALUATION',
          cashOnlyFinanceableLabor,
          existingFacilityFinanceableLabor,
          admissibleCreditFinanceableLabor,
          fullFinanceableLabor,
          primaryBindingConstraint: binding.primary,
          secondaryBindingConstraints: binding.secondary
        });
      }

      const bySector = {};
      const bySize = {};
      for (const row of rows) {
        (bySector[row.sectorId] ||= []).push(row);
        (bySize[row.sizeBin] ||= []).push(row);
      }
      this.countryData.set(String(country.id), {
        countryId: String(country.id),
        month,
        rows,
        aggregate: aggregate(rows),
        bySector: Object.fromEntries(Object.entries(bySector).map(([k, v]) => [k, aggregate(v)])),
        bySize: Object.fromEntries(Object.entries(bySize).map(([k, v]) => [k, aggregate(v)]))
      });
    }
    return this.report();
  }

  validate() {
    const issues = [];
    for (const [countryId, data] of this.countryData.entries()) {
      for (const row of data.rows) {
        const requiredFinite = [
          'depositCash','existingLoanPrincipal','scheduledDebtServiceCurrentMonth','existingUndrawnCommittedCredit',
          'liquidWorkingCapitalBeforeNewCredit','payrollPerLaborUnit','unitOperatingCost','workingCapitalCreditRequested',
          'workingCapitalCreditAdmissible','cashOnlyFinanceableLabor','existingFacilityFinanceableLabor','admissibleCreditFinanceableLabor'
        ];
        for (const field of requiredFinite) if (!Number.isFinite(row[field])) issues.push({ countryId, firmId: row.firmId, type: 'NONFINITE_REQUIRED', field });
        if (row.cashOnlyFinanceableLabor > row.existingFacilityFinanceableLabor + 1e-7) issues.push({ countryId, firmId: row.firmId, type: 'NONMONOTONIC_EXISTING_FACILITY' });
        if (row.existingFacilityFinanceableLabor > row.admissibleCreditFinanceableLabor + 1e-7) issues.push({ countryId, firmId: row.firmId, type: 'NONMONOTONIC_ADMISSIBLE_CREDIT' });
        if (row.fullFinanceableLabor !== null) {
          for (const [field, bound] of [
            ['physicalLaborNeed', row.physicalLaborNeed],
            ['capacityLaborLimit', row.capacityLaborLimit],
            ['inputConstrainedLaborCeiling', row.inputConstrainedLaborCeiling],
            ['admissibleCreditFinanceableLabor', row.admissibleCreditFinanceableLabor]
          ]) {
            if (Number.isFinite(bound) && row.fullFinanceableLabor > bound + 1e-7) issues.push({ countryId, firmId: row.firmId, type: 'FULL_ENVELOPE_EXCEEDS_BOUND', field });
          }
        }
        if (!row.primaryBindingConstraint) issues.push({ countryId, firmId: row.firmId, type: 'MISSING_BINDING_CLASS' });
      }
    }
    return { ok: issues.length === 0, issues };
  }

  countryReport(countryId) {
    const row = this.countryData.get(String(countryId));
    return row ? structuredClone(row) : null;
  }

  report() {
    const countries = [...this.countryData.values()].map(structuredClone);
    return {
      version: 'r4-ce-d3-working-capital-envelope-v1',
      countries,
      totals: aggregate(countries.flatMap(c => c.rows)),
      validation: this.validate()
    };
  }
}
