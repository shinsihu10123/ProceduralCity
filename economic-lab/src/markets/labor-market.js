export function clearLaborMarket(country, rng) {
  const employedByFirm = new Map(country.firms.map(f => [f.id, []]));
  for (const h of country.households) {
    if (h.employed && h.employerId && employedByFirm.has(h.employerId)) employedByFirm.get(h.employerId).push(h);
  }

  let layoffs = 0;
  for (const f of country.firms) {
    const staff = employedByFirm.get(f.id);
    staff.sort((a, b) => (a.skill || 0) - (b.skill || 0) + rng.normal(0, 0.04));
    while (staff.length > f.desiredWorkers) {
      const h = staff.shift();
      h.employed = false;
      h.employerId = null;
      layoffs += 1;
    }
    f.workers = staff.length;
  }

  const unemployed = country.households.filter(h => !h.employed);
  unemployed.sort((a, b) => (b.skill || 0) - (a.skill || 0) + rng.normal(0, 0.03));
  const firms = [...country.firms].sort((a, b) => b.wage - a.wage);
  let hires = 0;
  let cursor = 0;

  for (const f of firms) {
    while (f.workers < f.desiredWorkers && cursor < unemployed.length) {
      let accepted = null;
      let scan = cursor;
      while (scan < unemployed.length) {
        const h = unemployed[scan];
        const reservation = h.reservationWage || h.wage * 0.72;
        if (f.wage >= reservation * (0.96 + rng.next() * 0.08)) {
          accepted = h;
          unemployed[scan] = unemployed[cursor];
          unemployed[cursor] = accepted;
          break;
        }
        scan += 1;
      }
      if (!accepted) break;
      cursor += 1;
      accepted.employed = true;
      accepted.employerId = f.id;
      accepted.wage = f.wage;
      f.workers += 1;
      hires += 1;
    }

    const gap = Math.max(0, f.desiredWorkers - f.workers);
    if (gap > 0) f.wage *= 1 + Math.min(0.025, gap / Math.max(1, f.desiredWorkers) * 0.03);
  }

  const unfilled = country.firms.reduce((s, f) => s + Math.max(0, f.desiredWorkers - f.workers), 0);
  return { hires, layoffs, unfilled };
}

export function settlePayroll(country, ledger, month) {
  const firmMap = new Map(country.firms.map(f => [f.id, f]));
  let payroll = 0;
  let unpaid = 0;
  let payments = 0;

  for (const h of country.households) {
    h.income = 0;
    if (!h.employed || !h.employerId || !firmMap.has(h.employerId)) continue;
    const f = firmMap.get(h.employerId);
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

  for (const f of country.firms) {
    f.wageArrears = country.households
      .filter(h => h.employerId === f.id)
      .reduce((s, h) => s + Math.max(0, h.wageArrears || 0), 0);
  }

  return { payroll, unpaid, payments };
}
