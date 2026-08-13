import { EconomicWorld } from '../src/core/world-v09.js';

const world = new EconomicWorld('ECON-4-001');
for (let month = 1; month <= 24; month++) {
  world.step(1);
  for (const country of world.countries) {
    const report = world.accountingReport(country.id);
    if (report.general.ok) continue;
    const diffs = [];
    for (const entity of [...country.households, ...country.firms]) {
      const glCash = world.accounting.gl.naturalBalance(entity.id, 'cash');
      const settlement = world.ledger.balance(entity.accountId);
      const diff = glCash - settlement;
      if (Math.abs(diff) > 1e-7) diffs.push({ id: entity.id, kind: entity.kind, glCash, settlement, diff });
    }
    console.log('SFC_FAILURE', JSON.stringify({
      month,
      countryId: country.id,
      general: report.general,
      settlement: report.settlement,
      fiscal: report.fiscal,
      monetary: report.monetary,
      international: report.international,
      diffs: diffs.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,20)
    }, null, 2));
    process.exit(0);
  }
}
console.log('NO_SFC_FAILURE');
