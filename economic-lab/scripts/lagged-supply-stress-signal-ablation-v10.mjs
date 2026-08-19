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
const variants=[{id:'unit-basis-control',lagged:false},{id:'unit-basis-lagged-supply-stress-signal',lagged:true}];
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v),clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,finite(x)));
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function digest(world){const h=createHash('sha256'),put=v=>h.update(JSON.stringify(v));put({month:world.month,rng:world.rng});for(const c of world.countries){put(c);put(world.accountingReport(c.id));}for(const e of world.ledger.entries)put(e);return h.digest('hex');}
function installLaggedSignal(world){
  world.__rv07P26={saved:new Map(),decisionRows:[]};
  const begin=world.supply.beginMonth.bind(world.supply);
  world.supply.beginMonth=country=>{
    const saved=country.firms.filter(f=>f.active!==false).map(f=>({firmId:f.id,priorShortage:Math.max(0,finite(f.supplyShortage)),priorDesiredProduction:Math.max(0,finite(f.desiredProduction)),priorCapacity:Math.max(0,finite(f.capacity))}));
    const out=begin(country),byId=new Map(saved.map(x=>[x.firmId,x]));
    for(const f of country.firms.filter(x=>x.active!==false)){const s=byId.get(f.id);f.supplyShortage=s?.priorShortage||0;}
    world.__rv07P26.saved.set(`${world.month}|${country.id}`,saved);return out;
  };
  const credit=world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit=(country,month,signals)=>{
    const key=`${month}|${country.id}`,saved=world.__rv07P26.saved.get(key)||[],byId=new Map(saved.map(x=>[x.firmId,x]));
    for(const f of country.firms.filter(x=>x.active!==false)){
      const s=byId.get(f.id);assert.ok(s,`${key}/${f.id}: lag snapshot missing`);const expected=clamp(s.priorShortage/Math.max(1,s.priorDesiredProduction||s.priorCapacity||1),0,1),observed=finite(f.lastTrace?.perception?.supplyStress);
      world.__rv07P26.decisionRows.push({month,countryId:country.id,firmId:f.id,industryId:f.industryId,priorShortage:s.priorShortage,expectedSupplyStress:expected,observedSupplyStress:observed,signalError:observed-expected,selected:f.currentPlan?.name||f.lastTrace?.selected||null,hiringChange:finite(f.currentPlan?.hiringChange),negativeHiring:finite(f.currentPlan?.hiringChange)<-TOL,cashStress:finite(f.lastTrace?.perception?.cashStress),inventoryPressure:finite(f.lastTrace?.perception?.inventoryPressure)});
      f.supplyShortage=0;
    }
    return credit(country,month,signals);
  };
}
function runVariant(variant,scaleProfile,seed,horizon,collect=true){
  const world=createWorld(scaleProfile,seed);if(variant.lagged)installLaggedSignal(world);else world.__rv07P26={decisionRows:[]};const rows=[];
  for(let i=0;i<horizon;i++){
    world.stepMonth();
    if(collect)for(const c of world.countries){const m=c.macro||{},g=c.lastMarkets?.goods||{},ind=c.lastIndustry||{};const decisions=variant.lagged?world.__rv07P26.decisionRows.filter(r=>r.month===world.month&&r.countryId===c.id):c.firms.filter(f=>f.active!==false).map(f=>({negativeHiring:finite(f.currentPlan?.hiringChange)<-TOL,observedSupplyStress:finite(f.lastTrace?.perception?.supplyStress)}));rows.push({variant:variant.id,scaleProfile,seed,month:world.month,countryId:c.id,unemployment:finite(m.unemployment),exits:finite(m.firmExits),wageArrears:finite(m.wageArrears),goodsFulfillment:ratio(finite(g.nominalConsumption??m.consumption),finite(g.desiredBudget)),inputShortage:finite(ind.inputShortageUnits),resourceOutput:finite(ind.sectorOutputs?.RESOURCE),materialsOutput:finite(ind.sectorOutputs?.MATERIALS),consumerOutput:finite(ind.sectorOutputs?.CONSUMER),negativeHiringShare:ratio(decisions.filter(r=>r.negativeHiring).length,decisions.length),meanDecisionSupplyStress:mean(decisions.map(r=>r.observedSupplyStress)),gdp:finite(m.gdp),gdpResidual:gdpResidual(m),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});}
  }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${variant.id}/${scaleProfile}/${seed}: health failed`);return {rows,decisionRows:world.__rv07P26.decisionRows,health,digest:digest(world)};
}
const determinism=[];for(const v of variants)for(const s of scales){const seed=`ECON-RV07-P26-DET-${v.lagged?'L':'C'}-${s}`,h=Math.min(3,months),a=runVariant(v,s,seed,h,false).digest,b=runVariant(v,s,seed,h,false).digest,exact=a===b;assert.ok(exact,`${v.id}/${s}: nondeterministic`);determinism.push({variant:v.id,scaleProfile:s,exact});}
const runs=[];for(const v of variants)for(const s of scales)for(const seed of seeds)runs.push({variant:v.id,scaleProfile:s,seed,...runVariant(v,s,seed,months,true)});const rows=runs.flatMap(r=>r.rows),candidateDecisions=runs.filter(r=>r.variant===variants[1].id).flatMap(r=>r.decisionRows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){return {countryMonths:rs.length,meanUnemployment:mean(rs.map(r=>r.unemployment)),totalExits:sum(rs.map(r=>r.exits)),meanWageArrears:mean(rs.map(r=>r.wageArrears)),meanGoodsFulfillment:mean(rs.map(r=>r.goodsFulfillment)),meanInputShortage:mean(rs.map(r=>r.inputShortage)),meanResourceOutput:mean(rs.map(r=>r.resourceOutput)),meanMaterialsOutput:mean(rs.map(r=>r.materialsOutput)),meanConsumerOutput:mean(rs.map(r=>r.consumerOutput)),meanNegativeHiringShare:mean(rs.map(r=>r.negativeHiringShare)),meanDecisionSupplyStress:mean(rs.map(r=>r.meanDecisionSupplyStress)),meanGdp:mean(rs.map(r=>r.gdp))};}
const summary=[];for(const v of variants)for(const s of scales)for(const w of windows)summary.push({variant:v.id,scaleProfile:s,window:w.id,...agg(rows.filter(r=>r.variant===v.id&&r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to))});
const comparisons={};for(const s of scales){comparisons[s]={};for(const w of windows){const c=summary.find(x=>x.variant===variants[0].id&&x.scaleProfile===s&&x.window===w.id),x=summary.find(x=>x.variant===variants[1].id&&x.scaleProfile===s&&x.window===w.id);comparisons[s][w.id]={unemploymentDifference:x.meanUnemployment-c.meanUnemployment,exitDifference:x.totalExits-c.totalExits,wageArrearsDifference:x.meanWageArrears-c.meanWageArrears,goodsFulfillmentDifference:x.meanGoodsFulfillment-c.meanGoodsFulfillment,inputShortageDifference:x.meanInputShortage-c.meanInputShortage,resourceOutputRatio:ratio(x.meanResourceOutput,c.meanResourceOutput),materialsOutputRatio:ratio(x.meanMaterialsOutput,c.meanMaterialsOutput),consumerOutputRatio:ratio(x.meanConsumerOutput,c.meanConsumerOutput),negativeHiringDifference:x.meanNegativeHiringShare-c.meanNegativeHiringShare,gdpDifference:x.meanGdp-c.meanGdp};}}
const maxSignalError=Math.max(0,...candidateDecisions.map(r=>Math.abs(r.signalError))),maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.gdpResidual)));
const gates={deterministicReplayExact:determinism.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,candidateDecisionRowsPresent:candidateDecisions.length>0,laggedSignalReconciled:maxSignalError<TOL,positiveLaggedSignalActuallyPresented:candidateDecisions.some(r=>r.observedSupplyStress>0.01),ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.unemployment)&&Number.isFinite(r.consumerOutput))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P26 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.window==='FULL').map(x=>({variant:x.variant,scale:x.scaleProfile,u:+x.meanUnemployment.toFixed(4),exits:x.totalExits,arrears:+x.meanWageArrears.toFixed(1),fulfill:+x.meanGoodsFulfillment.toFixed(4),shortage:+x.meanInputShortage.toFixed(2),consumer:+x.meanConsumerOutput.toFixed(2),negHire:+x.meanNegativeHiringShare.toFixed(3),supplySignal:+x.meanDecisionSupplyStress.toFixed(3)})));
console.log('WP_RV07_P26_COMPARISON',JSON.stringify(comparisons));console.log('WP_RV07_P26_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P26',title:'Lagged supply-stress decision signal timing causal ablation',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},variants,determinism,gates,reconciliation:{maxSignalError,maxGdpResidual},summary,comparisons,rows,candidateDecisionRows:candidateDecisions};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P26_OUTPUT',outputJson);}
