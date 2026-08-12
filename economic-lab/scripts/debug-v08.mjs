import { EconomicWorld } from '../src/core/world-v08.js';

const world = new EconomicWorld('ECON-4-001');
const gl = world.accounting.gl;
const seen = new Set();

for (let month = 1; month <= 36; month++) {
  world.step(1);
  for (const country of world.countries) {
    for (const entity of [...country.households, ...country.firms]) {
      const glCash = gl.naturalBalance(entity.id, 'cash');
      const settlement = world.ledger.balance(entity.accountId);
      const diff = glCash - settlement;
      const key = entity.id;
      if (Math.abs(diff) <= 1e-7 || seen.has(key)) continue;
      seen.add(key);
      const settlementEntries = world.ledger.entriesFor({ month, countryId: country.id })
        .filter(e => e.postings.some(p => p.accountId === entity.accountId));
      const journals = (gl.entities.get(entity.id)?.journals || []).filter(j => j.month === month);
      console.log('FIRST_DIVERGENCE', JSON.stringify({
        month,
        countryId: country.id,
        entityId: entity.id,
        glCash,
        settlement,
        diff,
        settlementEntries,
        journals
      }, null, 2));
    }
  }
}
