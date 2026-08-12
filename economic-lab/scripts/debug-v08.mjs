import { EconomicWorld } from '../src/core/world-v08.js';
const world = new EconomicWorld('ECON-4-001');
world.step(36);
for (const country of world.countries) {
  const report = world.accountingReport(country.id);
  const diffs = [];
  for (const entity of [...country.households, ...country.firms]) {
    const glCash = world.accounting.gl.naturalBalance(entity.id, 'cash');
    const settlement = world.ledger.balance(entity.accountId);
    const diff = glCash - settlement;
    if (Math.abs(diff) > 1e-7) diffs.push({ id: entity.id, kind: entity.kind, glCash, settlement, diff });
  }
  console.log(country.id, JSON.stringify({ general: report.general, international: report.international, diffs: diffs.slice(0, 20) }, null, 2));
}
