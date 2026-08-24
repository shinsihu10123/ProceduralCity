const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableFinite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function activeFirms(country) {
  return (country.firms || []).filter(firm => firm.active !== false);
}

function sizeBin(workers) {
  const n = Math.max(0, finite(workers));
  if (n < 1) return 'zero';
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  if (n <= 10) return '6-10';
  if (n <= 20) return '11-20';
  return '21+';
}

function supplierMeanPrice(country, product) {
  if (!product) return null;
  const prices = activeFirms(country)
    .filter(firm => firm.product === product && finite(firm.price) > EPS)
    .map(firm => finite(firm.price));
  if (!prices.length) return null;
  return prices.reduce((sum, value) => sum + value, 0) / prices.length;
}

function plannedOutput(firm) {
  const desired = nullableFinite(firm.desiredProduction);
  if (desired !== null && desired >= 0) return { value: desired, source: 'canonical.desiredProduction' };
  const selected = nullableFinite(firm.currentPlan?.plannedOutput);
  if (selected !== null && selected >= 0) return { value: selected, source: 'canonical.currentPlan.plannedOutput' };
  return { value: null, source: 'unavailable' };
}

function productionFactors(country, firm) {
  const capitalEffect = 0.72 + Math.log1p(Math.max(0, finite(firm.capitalStock))) * 0.105;
  const humanEffect = 0.82 + finite(country.humanCapital) * 0.30;
  const resourceEffect = firm.industryId === 'RESOURCE' ? 0.62 + finite(country.resourceBase) * 0.62 : 1;
  const planEffect = 1 + clamp(firm.currentPlan?.productionChange || 0, -0.12, 0.15);
  const effectiveOutputPerLaborUnit = Math.max(
    EPS,
    finite(firm.productivity) * capitalEffect * humanEffect * resourceEffect * planEffect
  );
  return { capitalEffect, humanEffect, resourceEffect, planEffect, effectiveOutputPerLaborUnit };
}

function inputFeasibility(country, firm, planned) {
  if (!firm.inputProduct) {
    return {
      inputProduct: null,
      requiredInputUnits: 0,
      availableInputUnits: 0,
      inputConstraintRatio: 1,
      supplierMeanPrice: null,
      inputCostPerOutput: 0,
      inputCostPerLaborUnit: 0
    };
  }

  const inputPerOutput = Math.max(0, finite(firm.inputPerOutput));
  const requiredInputUnits = planned === null ? null : Math.max(0, planned * inputPerOutput);
  const availableInputUnits = Math.max(0, finite(firm.inputInventory?.[firm.inputProduct]));
  const meanPrice = supplierMeanPrice(country, firm.inputProduct);
  const inputConstraintRatio = requiredInputUnits === null
    ? null
    : requiredInputUnits <= EPS
      ? 1
      : Math.min(1, availableInputUnits / requiredInputUnits);

  return {
    inputProduct: firm.inputProduct,
    requiredInputUnits,
    availableInputUnits,
    inputConstraintRatio,
    supplierMeanPrice: meanPrice,
    inputCostPerOutput: meanPrice === null ? null : inputPerOutput * meanPrice,
    inputCostPerLaborUnit: null
  };
}

function safeRatio(numerator, denominator) {
  const n = nullableFinite(numerator);
  const d = nullableFinite(denominator);
  if (n === null || d === null) return null;
  if (Math.abs(d) <= EPS) return n > EPS ? null : 0;
  return n / d;
}

function compactNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function classifyCoverage(ratio) {
  if (ratio === null || !Number.isFinite(ratio)) return 'unavailable';
  if (ratio < 0.5) return 'severe_undercoverage';
  if (ratio < 1) return 'undercoverage';
  if (ratio < 1.5) return 'narrow_coverage';
  return 'stronger_coverage';
}

function recordForFirm({ country, firm, ledger }) {
  const plan = plannedOutput(firm);
  const factors = productionFactors(country, firm);
  const input = inputFeasibility(country, firm, plan.value);
  const workerCount = Math.max(0, finite(firm.workers));
  const canonicalDesiredWorkers = Math.max(0, finite(firm.desiredWorkers));
  const currentWage = Math.max(EPS, finite(firm.wage, EPS));
  const capacity = Math.max(0, finite(firm.capacity));
  const physicalLaborNeed = plan.value === null ? null : Math.max(0, plan.value / factors.effectiveOutputPerLaborUnit);
  const capacityLaborLimit = capacity / factors.effectiveOutputPerLaborUnit;
  const payrollRequiredForPhysicalNeed = physicalLaborNeed === null ? null : physicalLaborNeed * currentWage;
  const availableCash = Math.max(0, finite(ledger.balance(firm.accountId)));

  input.inputCostPerLaborUnit = input.inputCostPerOutput === null
    ? null
    : input.inputCostPerOutput * factors.effectiveOutputPerLaborUnit;

  const cashPayrollFinanceableLaborUnits = availableCash / currentWage;
  const fullUnitCashCost = input.inputCostPerLaborUnit === null
    ? null
    : currentWage + Math.max(0, input.inputCostPerLaborUnit);
  const fullWorkingCapitalFinanceableLaborUnits = fullUnitCashCost === null
    ? null
    : availableCash / Math.max(EPS, fullUnitCashCost);
  const financeableLaborUnits = fullWorkingCapitalFinanceableLaborUnits ?? cashPayrollFinanceableLaborUnits;

  const bounds = [physicalLaborNeed, financeableLaborUnits, capacityLaborLimit].filter(Number.isFinite);
  const shadowDesiredLaborUnits = bounds.length ? Math.max(0, Math.min(...bounds)) : null;
  const shadowUnfilledLaborUnits = shadowDesiredLaborUnits === null
    ? null
    : Math.max(0, shadowDesiredLaborUnits - workerCount);

  const currentPayroll = Math.max(0, currentWage * workerCount);
  const revenue = Math.max(0, finite(firm.revenue));
  const revenuePayrollCoverage = currentPayroll > EPS ? revenue / currentPayroll : revenue > EPS ? null : 0;
  const variableInputNeed = plan.value === null || input.inputCostPerOutput === null
    ? null
    : Math.max(0, plan.value * input.inputCostPerOutput);
  const nearTermOperatingCashNeed = payrollRequiredForPhysicalNeed === null || variableInputNeed === null
    ? payrollRequiredForPhysicalNeed
    : payrollRequiredForPhysicalNeed + variableInputNeed;
  const workingCapitalGap = nearTermOperatingCashNeed === null
    ? null
    : Math.max(0, nearTermOperatingCashNeed - availableCash);
  const workingCapitalCoverage = nearTermOperatingCashNeed === null
    ? null
    : nearTermOperatingCashNeed <= EPS ? 1 : availableCash / nearTermOperatingCashNeed;
  const laborConstraintRatio = physicalLaborNeed === null
    ? null
    : physicalLaborNeed <= EPS ? 1 : Math.min(1, workerCount / physicalLaborNeed);

  const flags = [];
  if (plan.value === null) flags.push('PLAN_UNAVAILABLE');
  if (physicalLaborNeed === null) flags.push('PHYSICAL_NEED_UNAVAILABLE');
  else if (physicalLaborNeed <= EPS) flags.push('PHYSICAL_NEED_ZERO');
  else if (physicalLaborNeed > workerCount + 1e-7) flags.push('PHYSICAL_NEED_ABOVE_CURRENT_LABOR');
  if (input.inputConstraintRatio !== null && input.inputConstraintRatio < 1 - 1e-7) flags.push('INPUT_CONSTRAINED');
  if (revenue + 1e-7 < currentPayroll) flags.push('REVENUE_BELOW_CURRENT_PAYROLL');
  if (finite(firm.wageArrears) > EPS) flags.push('WAGE_ARREARS_POSITIVE');
  if (workingCapitalGap !== null && workingCapitalGap > EPS) flags.push('WORKING_CAPITAL_GAP');
  if (shadowDesiredLaborUnits !== null && shadowDesiredLaborUnits + 1e-7 < canonicalDesiredWorkers) flags.push('CANONICAL_TARGET_ABOVE_SHADOW_FINANCEABLE_DEMAND');
  if (physicalLaborNeed !== null && physicalLaborNeed > canonicalDesiredWorkers + 1e-7) flags.push('PHYSICAL_NEED_ABOVE_CANONICAL_TARGET');

  return {
    firmId: String(firm.id),
    countryId: String(country.id),
    sectorId: String(firm.industryId || 'UNKNOWN'),
    active: firm.active !== false,
    sizeBin: sizeBin(workerCount),
    workerCount,
    canonicalDesiredWorkers,
    plannedOutput: compactNumber(plan.value),
    plannedOutputSource: plan.source,
    estimatorVersion: 'canonical-supply-chain-capacity-inversion-v1',
    effectiveOutputPerLaborUnit: factors.effectiveOutputPerLaborUnit,
    physicalLaborNeed: compactNumber(physicalLaborNeed),
    capacityLaborLimit: compactNumber(capacityLaborLimit),
    payrollPerLaborUnit: currentWage,
    payrollRequiredForPhysicalNeed: compactNumber(payrollRequiredForPhysicalNeed),
    availableCash,
    existingUndrawnCredit: null,
    admissibleNewCreditCapacity: null,
    availableWorkingCapital: availableCash,
    workingCapitalEstimator: 'cash-only-lower-bound-v1',
    cashPayrollFinanceableLaborUnits,
    fullWorkingCapitalFinanceableLaborUnits: compactNumber(fullWorkingCapitalFinanceableLaborUnits),
    financeableLaborUnits: compactNumber(financeableLaborUnits),
    shadowDesiredLaborUnits: compactNumber(shadowDesiredLaborUnits),
    shadowUnfilledLaborUnits: compactNumber(shadowUnfilledLaborUnits),
    revenuePayrollCoverage: compactNumber(revenuePayrollCoverage),
    revenuePayrollCoverageClass: classifyCoverage(revenuePayrollCoverage),
    operatingPayrollCoverage: null,
    workingCapitalCoverage: compactNumber(workingCapitalCoverage),
    workingCapitalGap: compactNumber(workingCapitalGap),
    inputProduct: input.inputProduct,
    requiredInputUnits: compactNumber(input.requiredInputUnits),
    availableInputUnits: input.availableInputUnits,
    inputConstraintRatio: compactNumber(input.inputConstraintRatio),
    supplierMeanInputPrice: compactNumber(input.supplierMeanPrice),
    inputCostPerOutput: compactNumber(input.inputCostPerOutput),
    inputCostPerLaborUnit: compactNumber(input.inputCostPerLaborUnit),
    laborConstraintRatio: compactNumber(laborConstraintRatio),
    canonicalTargetGap: canonicalDesiredWorkers - workerCount,
    shadowVsCanonicalDemandGap: shadowDesiredLaborUnits === null ? null : shadowDesiredLaborUnits - canonicalDesiredWorkers,
    revenue,
    currentPayroll,
    wageArrears: Math.max(0, finite(firm.wageArrears)),
    output: Math.max(0, finite(firm.output)),
    inventory: Math.max(0, finite(firm.inventory)),
    inputInventoryUnits: Object.values(firm.inputInventory || {}).reduce((sum, value) => sum + Math.max(0, finite(value)), 0),
    loanBalance: Math.max(0, finite(firm.loanBalance)),
    distressMonths: Math.max(0, finite(firm.distressMonths)),
    feasibilityFlags: flags
  };
}

function mean(rows, getter) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + finite(getter(row)), 0) / rows.length;
}

function nullableMean(rows, getter) {
  const values = rows.map(getter).filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateRows(rows) {
  const physicalAvailable = rows.filter(row => Number.isFinite(row.physicalLaborNeed));
  const shadowAvailable = rows.filter(row => Number.isFinite(row.shadowDesiredLaborUnits));
  const coverageAvailable = rows.filter(row => Number.isFinite(row.revenuePayrollCoverage));
  return {
    establishments: rows.length,
    workers: rows.reduce((sum, row) => sum + row.workerCount, 0),
    canonicalDesiredWorkers: rows.reduce((sum, row) => sum + row.canonicalDesiredWorkers, 0),
    physicalLaborNeed: physicalAvailable.reduce((sum, row) => sum + row.physicalLaborNeed, 0),
    shadowDesiredLaborUnits: shadowAvailable.reduce((sum, row) => sum + row.shadowDesiredLaborUnits, 0),
    meanWorkers: mean(rows, row => row.workerCount),
    meanPhysicalLaborNeed: nullableMean(rows, row => row.physicalLaborNeed),
    meanShadowDesiredLaborUnits: nullableMean(rows, row => row.shadowDesiredLaborUnits),
    meanShadowVsCanonicalGap: nullableMean(rows, row => row.shadowVsCanonicalDemandGap),
    meanRevenuePayrollCoverage: nullableMean(coverageAvailable, row => row.revenuePayrollCoverage),
    revenueBelowPayrollShare: rows.length ? rows.filter(row => row.revenue + 1e-7 < row.currentPayroll).length / rows.length : 0,
    arrearsPositiveShare: rows.length ? rows.filter(row => row.wageArrears > EPS).length / rows.length : 0,
    inputConstrainedShare: rows.length ? rows.filter(row => row.feasibilityFlags.includes('INPUT_CONSTRAINED')).length / rows.length : 0,
    workingCapitalGapShare: rows.length ? rows.filter(row => row.feasibilityFlags.includes('WORKING_CAPITAL_GAP')).length / rows.length : 0,
    physicalAboveCanonicalShare: rows.length ? rows.filter(row => row.feasibilityFlags.includes('PHYSICAL_NEED_ABOVE_CANONICAL_TARGET')).length / rows.length : 0,
    canonicalAboveShadowFinanceableShare: rows.length ? rows.filter(row => row.feasibilityFlags.includes('CANONICAL_TARGET_ABOVE_SHADOW_FINANCEABLE_DEMAND')).length / rows.length : 0
  };
}

export class ShadowLaborDemandSystem {
  constructor({ ledger, shadowPersonSystem = null }) {
    this.ledger = ledger;
    this.shadowPersonSystem = shadowPersonSystem;
    this.countryData = new Map();
  }

  refresh(countries, month = 0) {
    this.countryData.clear();
    for (const country of countries || []) {
      const rows = activeFirms(country).map(firm => recordForFirm({ country, firm, ledger: this.ledger }));
      const bySector = {};
      const bySize = {};
      const bySectorSize = {};

      for (const row of rows) {
        (bySector[row.sectorId] ||= []).push(row);
        (bySize[row.sizeBin] ||= []).push(row);
        const key = `${row.sectorId}::${row.sizeBin}`;
        (bySectorSize[key] ||= []).push(row);
      }

      const availableLaborUnits = this.shadowPersonSystem
        ? this.shadowPersonSystem.availableLaborUnits(country.id)
        : null;
      const aggregate = aggregateRows(rows);
      const physicalLaborCoverage = availableLaborUnits === null || aggregate.physicalLaborNeed <= EPS
        ? null
        : availableLaborUnits / aggregate.physicalLaborNeed;
      const laborDemandCoverage = availableLaborUnits === null || aggregate.shadowDesiredLaborUnits <= EPS
        ? null
        : availableLaborUnits / aggregate.shadowDesiredLaborUnits;

      this.countryData.set(String(country.id), {
        month,
        countryId: String(country.id),
        rows,
        aggregate: {
          ...aggregate,
          availableLaborUnits,
          physicalLaborCoverage,
          laborDemandCoverage
        },
        bySector: Object.fromEntries(Object.entries(bySector).map(([key, value]) => [key, aggregateRows(value)])),
        bySize: Object.fromEntries(Object.entries(bySize).map(([key, value]) => [key, aggregateRows(value)])),
        bySectorSize: Object.fromEntries(Object.entries(bySectorSize).map(([key, value]) => [key, aggregateRows(value)]))
      });
    }
    return this.report();
  }

  countryReport(countryId) {
    const data = this.countryData.get(String(countryId));
    return data ? structuredClone(data) : null;
  }

  validate() {
    const issues = [];
    for (const [countryId, data] of this.countryData.entries()) {
      for (const row of data.rows) {
        const numericFields = [
          'workerCount', 'canonicalDesiredWorkers', 'effectiveOutputPerLaborUnit', 'capacityLaborLimit',
          'payrollPerLaborUnit', 'availableCash', 'availableWorkingCapital', 'cashPayrollFinanceableLaborUnits',
          'canonicalTargetGap', 'revenue', 'currentPayroll', 'wageArrears', 'output', 'inventory',
          'inputInventoryUnits', 'loanBalance', 'distressMonths'
        ];
        for (const field of numericFields) {
          if (!Number.isFinite(row[field])) issues.push({ countryId, firmId: row.firmId, type: 'NONFINITE_REQUIRED_FIELD', field });
        }
        const nullableNumericFields = [
          'plannedOutput', 'physicalLaborNeed', 'payrollRequiredForPhysicalNeed', 'fullWorkingCapitalFinanceableLaborUnits',
          'financeableLaborUnits', 'shadowDesiredLaborUnits', 'shadowUnfilledLaborUnits', 'revenuePayrollCoverage',
          'workingCapitalCoverage', 'workingCapitalGap', 'requiredInputUnits', 'inputConstraintRatio',
          'supplierMeanInputPrice', 'inputCostPerOutput', 'inputCostPerLaborUnit', 'laborConstraintRatio',
          'shadowVsCanonicalDemandGap'
        ];
        for (const field of nullableNumericFields) {
          if (row[field] !== null && !Number.isFinite(row[field])) issues.push({ countryId, firmId: row.firmId, type: 'NONFINITE_OPTIONAL_FIELD', field });
        }
        if (row.physicalLaborNeed !== null && row.physicalLaborNeed < -EPS) issues.push({ countryId, firmId: row.firmId, type: 'NEGATIVE_PHYSICAL_NEED' });
        if (row.financeableLaborUnits !== null && row.financeableLaborUnits < -EPS) issues.push({ countryId, firmId: row.firmId, type: 'NEGATIVE_FINANCEABLE_LABOR' });
        if (row.shadowDesiredLaborUnits !== null && row.shadowDesiredLaborUnits < -EPS) issues.push({ countryId, firmId: row.firmId, type: 'NEGATIVE_SHADOW_DESIRED' });
        if (row.shadowDesiredLaborUnits !== null) {
          for (const [field, bound] of [
            ['physicalLaborNeed', row.physicalLaborNeed],
            ['financeableLaborUnits', row.financeableLaborUnits],
            ['capacityLaborLimit', row.capacityLaborLimit]
          ]) {
            if (Number.isFinite(bound) && row.shadowDesiredLaborUnits > bound + 1e-7) issues.push({ countryId, firmId: row.firmId, type: 'SHADOW_DEMAND_EXCEEDS_BOUND', field });
          }
        }
      }
    }
    return { ok: issues.length === 0, issues };
  }

  report() {
    const countries = [...this.countryData.values()].map(data => ({
      month: data.month,
      countryId: data.countryId,
      aggregate: structuredClone(data.aggregate),
      bySector: structuredClone(data.bySector),
      bySize: structuredClone(data.bySize),
      bySectorSize: structuredClone(data.bySectorSize),
      rows: structuredClone(data.rows)
    }));
    return { countries, validation: this.validate() };
  }
}
