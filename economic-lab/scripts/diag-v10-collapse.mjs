import { EconomicWorld } from '../src/core/world-v10-stable.js';
const world = new EconomicWorld('ECON-4-001', { healthCheckInterval: 0 });
world.step(24);
const out = world.countries.map(c => ({
  id:c.id,
  gdp:c.macro.gdp,
  unemployment:c.macro.unemployment,
  realOutput:c.macro.realOutput,
  consumption:c.macro.consumption,
  activeFirms:c.firms.filter(f=>f.active!==false).length,
  employed:c.households.filter(h=>h.employed).length,
  inputShortage:c.macro.inputShortageUnits,
  b2b:c.macro.b2bTrade,
  sectors:{RESOURCE:c.macro.resourceOutput,MATERIALS:c.macro.materialsOutput,CAPITAL:c.macro.capitalGoodsOutput,CONSUMER:c.macro.consumerGoodsOutput},
  workers:Object.fromEntries(['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].map(s=>[s,c.firms.filter(f=>f.active!==false&&f.industryId===s).reduce((n,f)=>n+f.workers,0)])),
  active:Object.fromEntries(['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].map(s=>[s,c.firms.filter(f=>f.active!==false&&f.industryId===s).length])),
  inventory:Object.fromEntries(['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].map(s=>[s,c.firms.filter(f=>f.active!==false&&f.industryId===s).reduce((n,f)=>n+Number(f.inventory||0),0)]))
}));
console.log(JSON.stringify(out,null,2));
