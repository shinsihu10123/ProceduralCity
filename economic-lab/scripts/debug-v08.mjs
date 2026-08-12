import { EconomicWorld } from '../src/core/world-v08.js';
const world = new EconomicWorld('ECON-4-001');
world.step(36);
for (const country of world.countries) {
  const report = world.accountingReport(country.id);
  console.log(country.id, JSON.stringify({ general: report.general, international: report.international, settlement: report.settlement, global: report.globalInternational }, null, 2));
}
