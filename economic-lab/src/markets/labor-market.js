export function clearLaborMarket(country, rng) {
  const employedByFirm = new Map(country.firms.map(f => [f.id, []]));
  for (const h of country.households) {
    if (h.employed && h.employerId && employedByFirm.has(h.employerId)) employedByFirm.get(h.employerId).push(h);
  }

  let layoffs = 0;
  for (const f of country.firms) {
    const staff = employedByFirm.get(f.id);
    const ranked = staff.map(h => ({ h, score: (h.skill || 0) + rng.normal(0, 0.04) }))
      .sort((a, b) => a.score - b.score || a.h.id.localeCompare(b.h.id));
    while (ranked.length > f.desiredWorkers) {
      const h = ranked.shift().h;
      h.employed = false;
      h.employerId = null;
      layoffs += 1;
    }
    f.workers = ranked.length;
  }

  const unemployed = country.households
    .filter(h => !h.employed)
    .map(h => ({ h, score: (h.skill || 0) + rng.normal(0, 0.03) }))
    .sort((a, b) => b.score - a.score || a.h.id.localeCompare(b.h.id))
    .map(x => x.h);
  const firms = [...country.firms].sort((a, b) => b.wage - a.wage || a.id.localeCompare(b.id));
  let hires = 0;

  for (const f of firms) {
    const vacancy = Math.max(0, f.desiredWorkers - f.workers);
    const monthlyHiringCapacity = Math.max(1, Math.ceil(vacancy * 0.35));
    let hiredHere = 0;
    let scans = 0;
    const maxScans = Math.min(unemployed.length, Math.max(10, monthlyHiringCapacity * 8));

    while (f.workers < f.desiredWorkers && unemployed.length && hiredHere < monthlyHiringCapacity && scans < maxScans) {
      const h = unemployed.shift();
      scans += 1;
      const reservation = h.reservationWage || h.wage * 0.72;
      const informationFriction = 0.95 + rng.next() * 0.12;
      const matchProbability = Math.min(0.96, 0.58 + (h.skill || 0) * 0.24 + country.financialAccess * 0.08);
      if (f.wage >= reservation * informationFriction && rng.next() < matchProbability) {
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
