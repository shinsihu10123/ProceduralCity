let laborMarketDiagnosticObserver = null;

export function setLaborMarketDiagnosticObserver(observer = null) {
  if (observer !== null && typeof observer !== 'function') throw new TypeError('labor diagnostic observer must be a function or null');
  laborMarketDiagnosticObserver = observer;
}

function exactDiagnosticRuntimeEnabled(country) {
  return country?.__diagnosticExactLaborRuntime === true;
}

function laborEligibilityDiagnosticEnabled(country) {
  return country?.__diagnosticLaborEligibility === true;
}

function laborEligible(country, household) {
  return !laborEligibilityDiagnosticEnabled(country) || household?.__diagnosticLaborEligible !== false;
}

function clearLaborMarketCore(country, rng) {
  const diagnostics = laborMarketDiagnosticObserver ? {
    initialVacancies: 0,
    firmsWithVacancies: 0,
    hiringCapacitySlots: 0,
    scanAttempts: 0,
    reservationWageRejections: 0,
    stochasticMatchRejections: 0,
    hiringCapacityBoundVacancies: 0,
    scanLimitBoundVacancies: 0,
    noApplicantVacancies: 0
  } : null;

  const employedByFirm = new Map(country.firms.map(f => [f.id, []]));
  for (const h of country.households) {
    if (h.employed && h.employerId && employedByFirm.has(h.employerId) && laborEligible(country, h)) employedByFirm.get(h.employerId).push(h);
    else if (h.employed && !laborEligible(country, h)) {
      h.employed = false;
      h.employerId = null;
    }
  }

  let layoffs = 0;
  for (const f of country.firms) {
    const staff = employedByFirm.get(f.id) || [];
    const target = f.active === false ? 0 : Math.max(0, f.desiredWorkers);
    const ranked = staff.map(h => ({ h, score: (h.skill || 0) + rng.normal(0, 0.04) }))
      .sort((a, b) => a.score - b.score || a.h.id.localeCompare(b.h.id));
    while (ranked.length > target) {
      const h = ranked.shift().h;
      h.employed = false;
      h.employerId = null;
      layoffs += 1;
    }
    f.workers = ranked.length;
  }

  const unemployed = country.households
    .filter(h => !h.employed && laborEligible(country, h))
    .map(h => ({ h, score: (h.skill || 0) + rng.normal(0, 0.03) }))
    .sort((a, b) => b.score - a.score || a.h.id.localeCompare(b.h.id))
    .map(x => x.h);
  const useExactFastQueue = exactDiagnosticRuntimeEnabled(country);
  let unemployedHead = 0;
  const unemployedCount = () => useExactFastQueue ? unemployed.length - unemployedHead : unemployed.length;
  const takeUnemployed = () => useExactFastQueue ? unemployed[unemployedHead++] : unemployed.shift();

  const firms = country.firms
    .filter(f => f.active !== false)
    .sort((a, b) => b.wage - a.wage || a.id.localeCompare(b.id));
  let hires = 0;

  for (const f of firms) {
    const vacancy = Math.max(0, f.desiredWorkers - f.workers);
    const monthlyHiringCapacity = Math.max(1, Math.ceil(vacancy * 0.35));
    if (diagnostics && vacancy > 0) {
      diagnostics.initialVacancies += vacancy;
      diagnostics.firmsWithVacancies += 1;
      diagnostics.hiringCapacitySlots += monthlyHiringCapacity;
    }
    let hiredHere = 0;
    let scans = 0;
    const maxScans = Math.min(unemployedCount(), Math.max(10, monthlyHiringCapacity * 8));

    while (f.workers < f.desiredWorkers && unemployedCount() && hiredHere < monthlyHiringCapacity && scans < maxScans) {
      const h = takeUnemployed();
      scans += 1;
      if (diagnostics) diagnostics.scanAttempts += 1;
      const reservation = h.reservationWage || h.wage * 0.72;
      const informationFriction = 0.95 + rng.next() * 0.12;
      const matchProbability = Math.min(0.96, 0.58 + (h.skill || 0) * 0.24 + country.financialAccess * 0.08);
      const wageEligible = f.wage >= reservation * informationFriction;
      let stochasticMatch = false;
      if (wageEligible) {
        stochasticMatch = rng.next() < matchProbability;
        if (diagnostics && !stochasticMatch) diagnostics.stochasticMatchRejections += 1;
      } else if (diagnostics) {
        diagnostics.reservationWageRejections += 1;
      }

      if (wageEligible && stochasticMatch) {
        h.employed = true;
        h.employerId = f.id;
        h.wage = f.wage;
        f.workers += 1;
        hires += 1;
        hiredHere += 1;
      } else {
        unemployed.push(h);
      }
    }

    const gap = Math.max(0, f.desiredWorkers - f.workers);
    if (diagnostics && gap > 0) {
      if (hiredHere >= monthlyHiringCapacity) diagnostics.hiringCapacityBoundVacancies += gap;
      else if (scans >= maxScans) diagnostics.scanLimitBoundVacancies += gap;
      else if (!unemployedCount()) diagnostics.noApplicantVacancies += gap;
    }
    if (gap > 0) f.wage *= 1 + Math.min(0.025, gap / Math.max(1, f.desiredWorkers) * 0.03);
  }

  const unfilled = firms.reduce((s, f) => s + Math.max(0, f.desiredWorkers - f.workers), 0);
  const result = { hires, layoffs, unfilled };
  if (laborMarketDiagnosticObserver) {
    laborMarketDiagnosticObserver({
      countryId: country.id,
      result: { ...result },
      diagnostics: { ...diagnostics }
    });
  }
  return result;
}

export function clearLaborMarket(country, rng) {
  const profiler = country?.__runtimeProfiler;
  return profiler
    ? profiler.measure('market.labor', () => clearLaborMarketCore(country, rng))
    : clearLaborMarketCore(country, rng);
}

function settlePayrollCore(country, ledger, month) {
  const firmMap = new Map(country.firms.map(f => [f.id, f]));
  let payroll = 0;
  let unpaid = 0;
  let payments = 0;

  for (const h of country.households) {
    h.income = 0;
    if (!h.employed || !h.employerId || !firmMap.has(h.employerId)) continue;
    const f = firmMap.get(h.employerId);
    if (f.active === false) {
      h.employed = false;
      h.employerId = null;
      continue;
    }
    const priorArrears = Math.max(0, h.wageArrears || 0);
    const due = f.wage + Math.min(priorArrears, f.wage * 0.5);
    const paid = ledger.transfer({
      month,
      countryId: country.id,
      from: f.accountId,
      to: h.accountId,
      amount: due,
      kind: 'wage',
      meta: { firmId: f.id, householdId: h.id }
    });
    h.income = paid;
    h.wage = f.wage;
    h.wageArrears = Math.max(0, priorArrears + f.wage - paid);
    payroll += paid;
    unpaid += Math.max(0, due - paid);
    if (paid > 0) payments += 1;
  }

  if (exactDiagnosticRuntimeEnabled(country)) {
    const arrearsByFirm = new Map();
    for (const h of country.households) {
      if (!h.employerId) continue;
      arrearsByFirm.set(h.employerId, (arrearsByFirm.get(h.employerId) || 0) + Math.max(0, h.wageArrears || 0));
    }
    for (const f of country.firms) f.wageArrears = arrearsByFirm.get(f.id) || 0;
  } else {
    for (const f of country.firms) {
      f.wageArrears = country.households
        .filter(h => h.employerId === f.id)
        .reduce((s, h) => s + Math.max(0, h.wageArrears || 0), 0);
    }
  }

  return { payroll, unpaid, payments };
}

export function settlePayroll(country, ledger, month) {
  const profiler = country?.__runtimeProfiler;
  return profiler
    ? profiler.measure('market.payroll', () => settlePayrollCore(country, ledger, month))
    : settlePayrollCore(country, ledger, month);
}
