const EPS = 1e-9;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ratio(numerator, denominator) {
  const d = finite(denominator);
  return Math.abs(d) > EPS ? finite(numerator) / d : 0;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + finite(value), 0) / values.length;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = values.map(value => finite(value)).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

function finiteDeep(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteDeep);
  if (value && typeof value === 'object') return Object.values(value).every(finiteDeep);
  return true;
}

function householdState(country) {
  return new Map(country.households.map(h => [h.id, {
    employed: Boolean(h.employed),
    employerId: h.employerId || null
  }]));
}

function firmState(country) {
  return new Map(country.firms.map(f => [f.id, {
    active: f.active !== false,
    industryId: f.industryId,
    distressMonths: finite(f.distressMonths),
    cash: finite(f.cash),
    creditMisses: finite(f.creditMisses),
    wageArrears: finite(f.wageArrears)
  }]));
}

function loanState(country) {
  return new Map((country.loans || []).map(loan => [loan.id, {
    status: loan.status,
    borrowerId: loan.borrowerId,
    borrowerKind: loan.borrowerKind,
    outstanding: finite(loan.outstanding),
    arrears: finite(loan.arrears),
    missedPayments: finite(loan.missedPayments)
  }]));
}

function sum(values) {
  return values.reduce((total, value) => total + finite(value), 0);
}

export class RealityDiagnosticRecorder {
  constructor(world) {
    this.seed = String(world?.seedText || 'unknown');
    this.scaleProfile = String(world?.scaleProfile?.id || 'unknown');
    this.records = [];
    this.exitEvents = [];
    this.loanTransitions = [];
    this.pendingLabor = new Map();
    this.previousHouseholds = new Map();
    this.previousFirms = new Map();
    this.previousLoans = new Map();
    this.unemploymentDuration = new Map();
    this.maxLaborFlowError = 0;
    this.maxGdpIdentityResidual = 0;
    this.maxFirmExitReconciliationError = 0;

    for (const country of world?.countries || []) {
      this.previousHouseholds.set(country.id, householdState(country));
      this.previousFirms.set(country.id, firmState(country));
      this.previousLoans.set(country.id, loanState(country));
      for (const h of country.households || []) {
        this.unemploymentDuration.set(h.id, h.employed ? 0 : 1);
      }
    }
  }

  recordLaborMarket(event) {
    if (!event?.countryId) return;
    this.pendingLabor.set(event.countryId, structuredClone(event));
  }

  captureMonth(world) {
    for (const country of world.countries || []) this.captureCountry(world, country);
  }

  captureCountry(world, country) {
    const previousHouseholds = this.previousHouseholds.get(country.id) || new Map();
    const previousFirms = this.previousFirms.get(country.id) || new Map();
    const previousLoans = this.previousLoans.get(country.id) || new Map();
    const currentFirmMap = new Map(country.firms.map(f => [f.id, f]));

    let priorEmployed = 0;
    let priorUnemployed = 0;
    let currentEmployed = 0;
    let currentUnemployed = 0;
    let jobFindings = 0;
    let separations = 0;
    let exitSeparations = 0;
    const unemploymentDurations = [];

    for (const h of country.households || []) {
      const previous = previousHouseholds.get(h.id) || { employed: false, employerId: null };
      if (previous.employed) priorEmployed += 1;
      else priorUnemployed += 1;
      if (h.employed) currentEmployed += 1;
      else currentUnemployed += 1;

      if (!previous.employed && h.employed) jobFindings += 1;
      if (previous.employed && !h.employed) {
        separations += 1;
        if (previous.employerId && currentFirmMap.get(previous.employerId)?.active === false) exitSeparations += 1;
      }

      const priorDuration = finite(this.unemploymentDuration.get(h.id));
      const duration = h.employed ? 0 : priorDuration + 1;
      this.unemploymentDuration.set(h.id, duration);
      if (!h.employed) unemploymentDurations.push(duration);
    }

    const laborFlowError = currentEmployed - (priorEmployed - separations + jobFindings);
    this.maxLaborFlowError = Math.max(this.maxLaborFlowError, Math.abs(laborFlowError));

    const laborEvent = this.pendingLabor.get(country.id) || null;
    this.pendingLabor.delete(country.id);
    const marketLabor = country.lastMarkets?.labor || {};
    const detailedLabor = laborEvent?.diagnostics || {};
    const vacancies = finite(detailedLabor.initialVacancies, finite(marketLabor.hires) + finite(marketLabor.unfilled));

    const newExits = [];
    for (const f of country.firms || []) {
      const previous = previousFirms.get(f.id);
      if (!previous || !previous.active || f.active !== false) continue;
      const cash = finite(world.ledger?.balance?.(f.accountId), finite(f.cash));
      const severePayrollStress = finite(f.wageArrears) > Math.max(100, finite(f.wage) * Math.max(1, finite(f.workers)) * 1.35);
      const severeCreditStress = finite(f.creditMisses) >= 5;
      const liquidityFailure = cash < finite(f.safeCash) * 0.025 && severePayrollStress;
      const event = {
        month: world.month,
        countryId: country.id,
        firmId: f.id,
        industryId: f.industryId,
        distressMonths: finite(f.distressMonths),
        cash,
        safeCash: finite(f.safeCash),
        wageArrears: finite(f.wageArrears),
        creditMisses: finite(f.creditMisses),
        revenue: finite(f.revenue),
        sales: finite(f.sales),
        inventory: finite(f.inventory),
        inputShortage: finite(f.supplyShortage),
        loanBalance: finite(f.loanBalance),
        currentLiquidityFailure: liquidityFailure,
        currentSevereCreditStress: severeCreditStress,
        priorDistressMonths: finite(previous.distressMonths),
        priorCash: finite(previous.cash),
        priorCreditMisses: finite(previous.creditMisses),
        priorWageArrears: finite(previous.wageArrears)
      };
      this.exitEvents.push(event);
      newExits.push(event);
    }

    const macroFirmExits = finite(country.macro?.firmExits);
    const exitReconciliationError = newExits.length - macroFirmExits;
    this.maxFirmExitReconciliationError = Math.max(this.maxFirmExitReconciliationError, Math.abs(exitReconciliationError));

    const currentLoans = loanState(country);
    for (const [loanId, state] of currentLoans) {
      const previous = previousLoans.get(loanId);
      if (!previous) {
        this.loanTransitions.push({
          month: world.month,
          countryId: country.id,
          loanId,
          borrowerId: state.borrowerId,
          borrowerKind: state.borrowerKind,
          from: 'none',
          to: state.status,
          outstanding: state.outstanding,
          arrears: state.arrears,
          missedPayments: state.missedPayments
        });
      } else if (previous.status !== state.status) {
        this.loanTransitions.push({
          month: world.month,
          countryId: country.id,
          loanId,
          borrowerId: state.borrowerId,
          borrowerKind: state.borrowerKind,
          from: previous.status,
          to: state.status,
          outstanding: state.outstanding,
          arrears: state.arrears,
          missedPayments: state.missedPayments
        });
      }
    }

    const households = country.households || [];
    const employedHouseholds = households.filter(h => h.employed);
    const unemployedHouseholds = households.filter(h => !h.employed);
    const activeFirms = (country.firms || []).filter(f => f.active !== false);
    const distressedFirms = activeFirms.filter(f => finite(f.distressMonths) > 0);
    const credit = country.lastCredit || {};
    const monetary = country.lastMonetary || {};
    const bank = country.banks?.[0] || null;
    const bankStatement = bank && world.accounting?.entityStatement
      ? world.accounting.entityStatement(bank.id, world.month)?.balanceSheet || {}
      : {};
    const bankAssets = finite(bankStatement.assets);
    const bankEquity = finite(bankStatement.equity);
    const bankDeposits = finite(country.macro?.bankDeposits);
    const bankReserves = finite(country.macro?.bankReserves);

    const consumption = finite(country.macro?.consumption);
    const grossInvestment = finite(country.macro?.grossInvestment);
    const publicInvestment = finite(country.macro?.publicInvestment);
    const governmentConsumption = finite(country.macro?.governmentConsumption);
    const inventoryInvestment = finite(country.macro?.inventoryInvestment);
    const netExports = finite(country.macro?.netExports);
    const gdp = finite(country.macro?.gdp);
    const reconstructedGdp = consumption + grossInvestment + publicInvestment + governmentConsumption + inventoryInvestment + netExports;
    const gdpIdentityResidual = gdp - reconstructedGdp;
    this.maxGdpIdentityResidual = Math.max(this.maxGdpIdentityResidual, Math.abs(gdpIdentityResidual));

    const record = {
      month: world.month,
      countryId: country.id,
      labor: {
        priorEmployed,
        priorUnemployed,
        currentEmployed,
        currentUnemployed,
        jobFindings,
        separations,
        exitSeparations,
        otherSeparations: Math.max(0, separations - exitSeparations),
        jobFindingRate: ratio(jobFindings, priorUnemployed),
        separationRate: ratio(separations, priorEmployed),
        vacancies,
        vacancyRate: ratio(vacancies, currentEmployed + vacancies),
        vacancyFillRate: ratio(finite(marketLabor.hires), vacancies),
        hires: finite(marketLabor.hires),
        layoffs: finite(marketLabor.layoffs),
        unfilledVacancies: finite(marketLabor.unfilled),
        scanAttempts: finite(detailedLabor.scanAttempts),
        reservationWageRejections: finite(detailedLabor.reservationWageRejections),
        stochasticMatchRejections: finite(detailedLabor.stochasticMatchRejections),
        hiringCapacityBoundVacancies: finite(detailedLabor.hiringCapacityBoundVacancies),
        scanLimitBoundVacancies: finite(detailedLabor.scanLimitBoundVacancies),
        noApplicantVacancies: finite(detailedLabor.noApplicantVacancies),
        firmsWithVacancies: finite(detailedLabor.firmsWithVacancies),
        hiringCapacitySlots: finite(detailedLabor.hiringCapacitySlots),
        meanUnemploymentDuration: mean(unemploymentDurations),
        medianUnemploymentDuration: quantile(unemploymentDurations, 0.5),
        p90UnemploymentDuration: quantile(unemploymentDurations, 0.9),
        maxUnemploymentDuration: unemploymentDurations.length ? Math.max(...unemploymentDurations) : 0,
        stockFlowError: laborFlowError
      },
      households: {
        income: sum(households.map(h => h.income)),
        disposableIncome: sum(households.map(h => h.disposableIncome)),
        consumption: sum(households.map(h => h.consumption)),
        saving: sum(households.map(h => h.savings)),
        consumptionShareOfDisposableIncome: ratio(
          sum(households.map(h => h.consumption)),
          sum(households.map(h => h.disposableIncome))
        ),
        meanEmployedIncome: mean(employedHouseholds.map(h => h.income)),
        meanUnemployedIncome: mean(unemployedHouseholds.map(h => h.income)),
        unemploymentIncomeGap: mean(employedHouseholds.map(h => h.income)) - mean(unemployedHouseholds.map(h => h.income)),
        debt: sum(households.map(h => h.loanBalance)),
        wageArrears: sum(households.map(h => h.wageArrears))
      },
      firms: {
        active: activeFirms.length,
        total: country.firms?.length || 0,
        newExits: newExits.length,
        revenue: sum(activeFirms.map(f => f.revenue)),
        salesUnits: sum(activeFirms.map(f => f.sales)),
        outputUnits: sum(activeFirms.map(f => f.output)),
        cash: sum(activeFirms.map(f => world.ledger?.balance?.(f.accountId))),
        debt: sum(activeFirms.map(f => f.loanBalance)),
        inventoryUnits: sum(activeFirms.map(f => f.inventory)),
        inputShortageUnits: sum(activeFirms.map(f => f.supplyShortage)),
        wageArrears: sum(activeFirms.map(f => f.wageArrears)),
        distressedFirms: distressedFirms.length,
        meanDistressMonths: mean(distressedFirms.map(f => f.distressMonths))
      },
      banking: {
        applications: finite(credit.applications),
        approved: finite(credit.approved),
        rejected: finite(credit.rejected),
        approvalRate: ratio(finite(credit.approved), finite(credit.applications)),
        newCredit: finite(credit.newCredit),
        principalRepaid: finite(credit.principalRepaid),
        interestPaid: finite(credit.interestPaid),
        missedPayments: finite(credit.missedPayments),
        defaults: finite(credit.defaults),
        chargeOffs: finite(credit.chargeOffs),
        outstandingLoans: finite(credit.outstandingLoans),
        creditStress: finite(monetary.creditStress),
        bankStress: finite(monetary.bankStress),
        bankCapitalRatio: ratio(bankEquity, bankAssets),
        bankReserveRatio: ratio(bankReserves, bankDeposits),
        bankAssets,
        bankEquity,
        bankProfit: finite(country.macro?.bankProfit)
      },
      macro: {
        nominalGdp: gdp,
        reconstructedGdp,
        gdpIdentityResidual,
        realOutput: finite(country.macro?.realOutput),
        consumption,
        grossInvestment,
        publicInvestment,
        governmentConsumption,
        inventoryInvestment,
        exports: finite(country.macro?.exports),
        imports: finite(country.macro?.imports),
        netExports,
        priceIndex: finite(country.macro?.priceIndex),
        unemployment: finite(country.macro?.unemployment),
        avgWage: finite(country.macro?.avgWage)
      },
      fiscal: {
        taxRevenue: finite(country.macro?.taxRevenue),
        transfers: finite(country.macro?.governmentTransfers),
        governmentDemand: finite(country.macro?.governmentDemand),
        primaryBalance: finite(country.macro?.fiscalPrimaryBalance),
        overallBalance: finite(country.macro?.fiscalOverallBalance),
        publicDebt: finite(country.macro?.publicDebt),
        publicDebtRatio: finite(country.macro?.publicDebtRatio)
      },
      international: {
        exports: finite(country.macro?.exports),
        imports: finite(country.macro?.imports),
        tradeBalance: finite(country.macro?.tradeBalance),
        exchangeRate: finite(country.macro?.exchangeRate),
        exchangeRateChange: finite(country.macro?.exchangeRateChange),
        currentAccount: finite(country.macro?.currentAccount),
        currentAccountWXU: finite(country.macro?.currentAccountWXU),
        netForeignAssets: finite(country.macro?.netForeignAssets),
        foreignDebt: finite(country.macro?.foreignDebt),
        externalStress: finite(country.macro?.externalStress)
      }
    };

    this.records.push(record);
    this.previousHouseholds.set(country.id, householdState(country));
    this.previousFirms.set(country.id, firmState(country));
    this.previousLoans.set(country.id, currentLoans);
  }

  report() {
    const report = {
      schemaVersion: 1,
      kind: 'economic-lab-reality-diagnostics',
      seed: this.seed,
      scaleProfile: this.scaleProfile,
      monthsObserved: this.records.length ? Math.max(...this.records.map(row => row.month)) : 0,
      records: structuredClone(this.records),
      exitEvents: structuredClone(this.exitEvents),
      loanTransitions: structuredClone(this.loanTransitions),
      gates: {
        finite: finiteDeep(this.records) && finiteDeep(this.exitEvents) && finiteDeep(this.loanTransitions),
        laborStockFlowReconciled: this.maxLaborFlowError <= 1e-9,
        gdpIdentityReconciled: this.maxGdpIdentityResidual <= 1e-6,
        firmExitCountsReconciled: this.maxFirmExitReconciliationError <= 1e-9,
        maxLaborFlowError: this.maxLaborFlowError,
        maxGdpIdentityResidual: this.maxGdpIdentityResidual,
        maxFirmExitReconciliationError: this.maxFirmExitReconciliationError
      }
    };
    report.gates.ok = report.gates.finite &&
      report.gates.laborStockFlowReconciled &&
      report.gates.gdpIdentityReconciled &&
      report.gates.firmExitCountsReconciled;
    return report;
  }
}
