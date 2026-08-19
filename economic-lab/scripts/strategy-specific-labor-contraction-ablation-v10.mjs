import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const variants=[
  {id:'unit-basis-control',plans:[]},
  {id:'unit-basis-hold-defense-labor-contraction',plans:['방어']},
  {id:'unit-basis-hold-cash-preservation-labor-contraction',plans:['현금 보존']},
  {id:'unit-basis-hold-defense-and-cash-labor-contraction',plans:['방어','현금 보존']}
];
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v);
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function digest(world){const h=createHash('sha256'),put=v=>h.update(JSON.stringify(v));put({month:world.month,rng:world.rng});for(const c of world.countries){put(c);put(world.accountingReport(c.id));}for(const e of world.ledger.entries)put(e);return h.digest('hex');}
function installAblation(world,variant){
  world.__rv07P27=[];
  const originalCredit=world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit=(country,month,signals)=>{
    for(const f of country.firms.filter(x=>x.active!==false)){
      const selected=f.currentPlan?.name||f.lastTrace?.selected||null;
      const before=finite(f.desiredWorkers),workers=finite(f.workers),hiringChange=finite(f.currentPlan?.hiringChange);
      const targeted=variant.plans.includes(selected)&&before+TOL<workers;
      if(targeted){
        f.desiredWorkers=Math.max(before,workers);
        world.__rv07P27.push({month,countryId:country.id,firmId:f.id,industryId:f.industryId,selected,workersBeforeLabor:workers,desiredBefore:before,desiredAfter:finite(f.desiredWorkers),hiringChange});
      }
    }
    return originalCredit(country,month,signals);
  };
}
function runVariant(variant,scaleProfile,seed,horizon,collect=true){
  const world=createWorld(scaleProfile,seed);if(variant.plans.length)installAblation(world,variant);else world.__rv07P27=[];const rows=[];
  for(let i=0;i<horizon;i++){
    world.stepMonth();
    if(collect)for(const c of world.countries){const m=c.macro||{},g=c.lastMarkets?.goods||{},ind=c.lastIndustry||{};const active=c.firms.filter(f=>f.active!==false);rows.push({variant:variant.id,scaleProfile,seed,month:world.month,countryId:c.id,unemployment:finite(m.unemployment),exits:finite(m.firmExits),activeFirms:finite(m.activeFirms),wageArrears:finite(m.wageArrears),goodsFulfillment:ratio(finite(g.nominalConsumption??m.consumption),finite(g.desiredBudget)),inputShortage:finite(ind.inputShortageUnits),resourceOutput:finite(ind.sectorOutputs?.RESOURCE),materialsOutput:finite(ind.sectorOutputs?.MATERIALS),consumerOutput:finite(ind.sectorOutputs?.CONSUMER),negativeHiringShare:ratio(active.filter(f=>finite(f.currentPlan?.hiringChange)<-TOL).length,active.length),interventions:world.__rv07P27.filter(e=>e.month===world.month&&e.countryId===c.id).length,gdp:finite(m.gdp),gdpResidual:gdpResidual(m),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});}
  }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${variant.id}/${scaleProfile}/${seed}: health failed`);return {rows,events:world.__rv07P27,health,digest:digest(world)};
}
const determinism=[];for(const v of variants)for(const s of scales){const seed=`ECON-RV07-P27-DET-${v.plans.join('-')||'C'}-${s}`,h=Math.min(3,months),a=runVariant(v,s,seed,h,false).digest,b=runVariant(v,s,seed,h,false).digest,exact=a===b;assert.ok(exact,`${v.id}/${s}: nondeterministic`);determinism.push({variant:v.id,scaleProfile:s,exact});}
const runs=[];for(const v of variants)for(const s of scales)for(const seed of seeds)runs.push({variant:v.id,scaleProfile:s,seed,...runVariant(v,s,seed,months,true)});const rows=runs.flatMap(r=>r.rows),events=runs.flatMap(r=>r.events);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){return {countryMonths:rs.length,meanUnemployment:mean(rs.map(r=>r.unemployment)),totalExits:sum(rs.map(r=>r.exits)),meanActiveFirms:mean(rs.map(r=>r.activeFirms)),meanWageArrears:mean(rs.map(r=>r.wageArrears)),meanGoodsFulfillment:mean(rs.map(r=>r.goodsFulfillment)),meanInputShortage:mean(rs.map(r=>r.inputShortage)),meanResourceOutput:mean(rs.map(r=>r.resourceOutput)),meanMaterialsOutput:mean(rs.map(r=>r.materialsOutput)),meanConsumerOutput:mean(rs.map(r=>r.consumerOutput)),meanNegativeHiringShare:mean(rs.map(r=>r.negativeHiringShare)),interventions:sum(rs.map(r=>r.interventions)),meanGdp:mean(rs.map(r=>r.gdp))};}
const summary=[];for(const v of variants)for(const s of scales)for(const w of windows)summary.push({variant:v.id,scaleProfile:s,window:w.id,...agg(rows.filter(r=>r.variant===v.id&&r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to))});
const comparisons={};for(const s of scales){comparisons[s]={};for(const v of variants.slice(1)){comparisons[s][v.id]={};for(const w of windows){const c=summary.find(x=>x.variant===variants[0].id&&x.scaleProfile===s&&x.window===w.id),x=summary.find(x=>x.variant===v.id&&x.scaleProfile===s&&x.window===w.id);comparisons[s][v.id][w.id]={unemploymentDifference:x.meanUnemployment-c.meanUnemployment,exitDifference:x.totalExits-c.totalExits,wageArrearsDifference:x.meanWageArrears-c.meanWageArrears,goodsFulfillmentDifference:x.meanGoodsFulfillment-c.meanGoodsFulfillment,inputShortageDifference:x.meanInputShortage-c.meanInputShortage,resourceOutputRatio:ratio(x.meanResourceOutput,c.meanResourceOutput),materialsOutputRatio:ratio(x.meanMaterialsOutput,c.meanMaterialsOutput),consumerOutputRatio:ratio(x.meanConsumerOutput,c.meanConsumerOutput),gdpDifference:x.meanGdp-c.meanGdp,interventions:x.interventions};}}}
const candidateEvents=events.filter(e=>e.selected==='방어'||e.selected==='현금 보존'),maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.gdpResidual)));
const gates={deterministicReplayExact:determinism.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,interventionsActuallyApplied:candidateEvents.length>0,targetedPlanScopeValid:candidateEvents.every(e=>['방어','현금 보존'].includes(e.selected)),targetedDesiredWorkersHeld:candidateEvents.every(e=>e.desiredAfter+TOL>=e.workersBeforeLabor),ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.unemployment)&&Number.isFinite(r.consumerOutput))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P27 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.window==='FULL').map(x=>({variant:x.variant,scale:x.scaleProfile,u:+x.meanUnemployment.toFixed(4),exits:x.totalExits,arrears:+x.meanWageArrears.toFixed(1),fulfill:+x.meanGoodsFulfillment.toFixed(4),shortage:+x.meanInputShortage.toFixed(2),consumer:+x.meanConsumerOutput.toFixed(2),interventions:x.interventions})));
console.log('WP_RV07_P27_COMPARISON',JSON.stringify(comparisons));console.log('WP_RV07_P27_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P27',title:'Strategy-specific labor contraction causal matrix',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},variants,determinism,gates,reconciliation:{maxGdpResidual},summary,comparisons,rows,events};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P27_OUTPUT',outputJson);}
