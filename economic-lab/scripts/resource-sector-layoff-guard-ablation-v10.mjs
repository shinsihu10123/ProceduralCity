import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const variants=[{id:'unit-basis-control',guard:false},{id:'unit-basis-resource-capacity-layoff-guard',guard:true}];
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,finite(x))),clone=v=>structuredClone(v);
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function fingerprint(w){return {month:w.month,rng:clone(w.rng),countries:clone(w.countries),ledgerEntries:clone(w.ledger.entries),accounting:w.countries.map(c=>({id:c.id,report:w.accountingReport(c.id)}))};}
function planningTerms(country,f){
  const capitalEffect=0.72+Math.log1p(Math.max(0,finite(f.capitalStock)))*0.105;
  const humanEffect=0.82+finite(country.humanCapital)*0.30;
  const resourceEffect=f.industryId==='RESOURCE'?0.62+finite(country.resourceBase)*0.62:1;
  const planEffect=1+clamp(f.currentPlan?.productionChange||0,-0.12,0.15);
  const perWorker=Math.max(0,finite(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);
  const demandAnchor=Math.max(2,finite(f.previousSales),Math.max(0,finite(f.targetInventory)*0.42));
  const expectedDemand=demandAnchor*(1+clamp(f.beliefs?.demandGrowth||0,-0.18,0.22));
  const replenishment=Math.max(0,finite(f.targetInventory)-finite(f.inventory));
  const unconstrainedPlan=Math.max(0,expectedDemand*0.72+replenishment);
  const currentCapacityCap=Math.max(0,finite(f.workers)*perWorker*1.08);
  return {perWorker,unconstrainedPlan,currentCapacityCap,capacityBoundAtCurrent:unconstrainedPlan>currentCapacityCap+TOL};
}
function installGuard(world){
  world.__rv07P15=new Map();
  const original=world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit=(country,month,signals)=>{
    const result=original(country,month,signals);const mods=[];
    for(const f of country.firms){
      if(f.active===false)continue;
      const canonicalDesired=Math.max(0,finite(f.desiredWorkers));const currentWorkers=Math.max(0,finite(f.workers));const p=planningTerms(country,f);
      const eligibleResource=f.industryId==='RESOURCE';
      const guardApplied=eligibleResource&&canonicalDesired+TOL<currentWorkers&&p.capacityBoundAtCurrent;
      const guardedDesired=guardApplied?currentWorkers:canonicalDesired;
      f.desiredWorkers=guardedDesired;
      mods.push({firmId:f.id,industryId:f.industryId,eligibleResource,canonicalDesiredWorkers:canonicalDesired,currentWorkers,guardedDesiredWorkers:guardedDesired,guardApplied,preservedSlots:Math.max(0,guardedDesired-canonicalDesired),...p});
    }
    world.__rv07P15.set(`${month}|${country.id}`,mods);return result;
  };
}
function runVariant(variant,scaleProfile,seed,horizon,collect=true){
  const world=createWorld(scaleProfile,seed);if(variant.guard)installGuard(world);else world.__rv07P15=new Map();const rows=[];
  for(let i=0;i<horizon;i++){
    world.stepMonth();
    if(collect)for(const c of world.countries){const goods=c.lastMarkets?.goods||{},ind=c.lastIndustry||{},mods=world.__rv07P15.get(`${world.month}|${c.id}`)||[];rows.push({variant:variant.id,scaleProfile,seed,month:world.month,countryId:c.id,economy:{unemployment:finite(c.macro?.unemployment),exits:finite(c.macro?.firmExits),wageArrears:finite(c.macro?.wageArrears),goodsFulfillment:ratio(finite(goods.nominalConsumption??c.macro?.consumption),finite(goods.desiredBudget)),inputShortage:finite(ind.inputShortageUnits),resourceOutput:finite(ind.sectorOutputs?.RESOURCE),materialsOutput:finite(ind.sectorOutputs?.MATERIALS),capitalOutput:finite(ind.sectorOutputs?.CAPITAL),consumerOutput:finite(ind.sectorOutputs?.CONSUMER),gdp:finite(c.macro?.gdp),gdpResidual:gdpResidual(c.macro)},labor:{workers:sum(c.firms.filter(f=>f.active!==false).map(f=>f.workers)),resourceWorkers:sum(c.firms.filter(f=>f.active!==false&&f.industryId==='RESOURCE').map(f=>f.workers)),desiredWorkers:sum(c.firms.filter(f=>f.active!==false).map(f=>f.desiredWorkers)),hires:finite(c.lastMarkets?.labor?.hires),layoffs:finite(c.lastMarkets?.labor?.layoffs),unfilled:finite(c.lastMarkets?.labor?.unfilled)},mods,ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});}
  }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${variant.id}/${scaleProfile}/${seed}: health failed`);return {variant:variant.id,scaleProfile,seed,rows,health,fingerprint:fingerprint(world)};
}
const determinism=[];for(const v of variants)for(const s of scales){const seed=`ECON-RV07-P15-DET-${v.id}-${s}`,h=Math.min(3,months);const a=runVariant(v,s,seed,h,false).fingerprint,b=runVariant(v,s,seed,h,false).fingerprint;const exact=JSON.stringify(a)===JSON.stringify(b);assert.ok(exact,`${v.id}/${s}: nondeterministic`);determinism.push({variant:v.id,scaleProfile:s,exact});}
const runs=[];for(const v of variants)for(const s of scales)for(const seed of seeds)runs.push(runVariant(v,s,seed,months,true));const rows=runs.flatMap(x=>x.rows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){const mods=rs.flatMap(r=>r.mods);return {countryMonths:rs.length,meanUnemployment:mean(rs.map(r=>r.economy.unemployment)),totalExits:sum(rs.map(r=>r.economy.exits)),meanWageArrears:mean(rs.map(r=>r.economy.wageArrears)),meanGoodsFulfillment:mean(rs.map(r=>r.economy.goodsFulfillment)),meanInputShortage:mean(rs.map(r=>r.economy.inputShortage)),meanResourceOutput:mean(rs.map(r=>r.economy.resourceOutput)),meanMaterialsOutput:mean(rs.map(r=>r.economy.materialsOutput)),meanCapitalOutput:mean(rs.map(r=>r.economy.capitalOutput)),meanConsumerOutput:mean(rs.map(r=>r.economy.consumerOutput)),meanGdp:mean(rs.map(r=>r.economy.gdp)),meanWorkers:mean(rs.map(r=>r.labor.workers)),meanResourceWorkers:mean(rs.map(r=>r.labor.resourceWorkers)),totalLayoffs:sum(rs.map(r=>r.labor.layoffs)),meanUnfilled:mean(rs.map(r=>r.labor.unfilled)),guardApplied:mods.filter(m=>m.guardApplied).length,preservedSlots:sum(mods.map(m=>m.preservedSlots))};}
const summary=[];for(const v of variants)for(const s of scales)for(const w of windows){const rs=rows.filter(r=>r.variant===v.id&&r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to);summary.push({variant:v.id,scaleProfile:s,window:w.id,...agg(rs)});}
const comparisons={};for(const s of scales){comparisons[s]={};for(const w of windows){const c=summary.find(x=>x.variant===variants[0].id&&x.scaleProfile===s&&x.window===w.id),a=summary.find(x=>x.variant===variants[1].id&&x.scaleProfile===s&&x.window===w.id);comparisons[s][w.id]={unemploymentDifference:a.meanUnemployment-c.meanUnemployment,exitDifference:a.totalExits-c.totalExits,wageArrearsDifference:a.meanWageArrears-c.meanWageArrears,goodsFulfillmentDifference:a.meanGoodsFulfillment-c.meanGoodsFulfillment,inputShortageDifference:a.meanInputShortage-c.meanInputShortage,resourceOutputRatio:ratio(a.meanResourceOutput,c.meanResourceOutput),materialsOutputRatio:ratio(a.meanMaterialsOutput,c.meanMaterialsOutput),capitalOutputRatio:ratio(a.meanCapitalOutput,c.meanCapitalOutput),consumerOutputRatio:ratio(a.meanConsumerOutput,c.meanConsumerOutput),gdpDifference:a.meanGdp-c.meanGdp,workerDifference:a.meanWorkers-c.meanWorkers,resourceWorkerDifference:a.meanResourceWorkers-c.meanResourceWorkers,layoffDifference:a.totalLayoffs-c.totalLayoffs,guardApplied:a.guardApplied,preservedSlots:a.preservedSlots};}}
const candidateMods=rows.filter(r=>r.variant===variants[1].id).flatMap(r=>r.mods);const ruleValid=candidateMods.every(m=>(!m.guardApplied||m.industryId==='RESOURCE')&&(!m.guardApplied||m.capacityBoundAtCurrent)&&(!m.guardApplied||Math.abs(m.guardedDesiredWorkers-m.currentWorkers)<TOL)&&m.guardedDesiredWorkers<=Math.max(m.canonicalDesiredWorkers,m.currentWorkers)+TOL);const maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.economy.gdpResidual)));
const gates={deterministicReplayExact:determinism.every(x=>x.exact),allHealthy:runs.every(x=>x.health?.ok===true),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,interventionRowsPresent:candidateMods.length>0,resourceOnlyGuardRuleValid:ruleValid,guardOnlyTouchesResource:candidateMods.filter(m=>m.guardApplied).every(m=>m.industryId==='RESOURCE'),ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.economy.unemployment)&&Number.isFinite(r.labor.workers))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P15 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.window==='FULL').map(x=>({variant:x.variant,scale:x.scaleProfile,u:+x.meanUnemployment.toFixed(4),exits:x.totalExits,arrears:+x.meanWageArrears.toFixed(1),fulfill:+x.meanGoodsFulfillment.toFixed(4),shortage:+x.meanInputShortage.toFixed(3),resource:+x.meanResourceOutput.toFixed(3),materials:+x.meanMaterialsOutput.toFixed(3),consumer:+x.meanConsumerOutput.toFixed(3),rWorkers:+x.meanResourceWorkers.toFixed(1),guard:x.guardApplied,preserved:+x.preservedSlots.toFixed(0)})));
console.log('WP_RV07_P15_COMPARISON',JSON.stringify(comparisons));console.log('WP_RV07_P15_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P15',title:'Resource-sector capacity-bound layoff guard ablation',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},variants,determinism,gates,reconciliation:{maxGdpResidual},summary,comparisons,rows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P15_OUTPUT',outputJson);}
