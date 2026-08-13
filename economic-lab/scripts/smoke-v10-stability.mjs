import assert from 'node:assert/strict';
import { EconomicWorld } from '../src/core/world-v10-stable.js';

const world = new EconomicWorld('ECON-4-001', { healthCheckInterval: 0 });

for (const country of world.countries) {
  const active = country.firms.filter(firm => firm.active !== false);
  const meanPrice = active.reduce((sum, firm) => sum + Number(firm.price || 0), 0) / Math.max(1, active.length);
  const meanWage = active.reduce((sum, firm) => sum + Number(firm.wage || 0), 0) / Math.max(1, active.length);
  const ratio = meanPrice / Math.max(1e-9, meanWage);
  assert.ok(ratio > 0.35 && ratio < 2.5, `${country.id} opening price/wage unit ratio is structurally inconsistent: ${ratio}`);
}

world.step(24);

const rows = world.countries.map(country => ({
  id: country.id,
  gdp: Number(country.macro.gdp),
  unemployment: Number(country.macro.unemployment),
  realOutput: Number(country.macro.realOutput),
  consumption: Number(country.macro.consumption),
  activeFirms: country.firms.filter(firm => firm.active !== false).length,
  totalFirms: country.firms.length,
  moneySupply: Number(country.macro.moneySupply),
  priceIndex: Number(country.macro.priceIndex)
}));

for (const row of rows) {
  assert.ok(Number.isFinite(row.gdp), `${row.id} GDP must stay finite`);
  assert.ok(row.realOutput > 0, `${row.id} real output mechanically collapsed to zero`);
  assert.ok(row.consumption > 0, `${row.id} consumption mechanically collapsed to zero`);
  assert.ok(row.activeFirms > 0, `${row.id} lost every active firm`);
  assert.ok(row.unemployment < 0.80, `${row.id} baseline unemployment mechanically collapsed above 80%`);
  assert.ok(row.priceIndex > 0, `${row.id} price index must remain positive`);
}

console.log('Economic Lab calibrated baseline 24-month stability gate PASS');
console.log(JSON.stringify(rows, null, 2));
