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
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v),clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,finite(x)));
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function digest(world){const h=createHash('sha256'),put=v=>h.update(JSON.stringify(v));put({month:world.month,rng:world.rng});for(const c of world.countries){put(c);put(world.accountingReport(c.id));}for(const e of world.ledger.entries)put(e);return h.digest('hex');}
function unconstrainedPlan(f){const anchor=Math.max(2,finite(f.previousSales),finite(f.targetInventory)*0.42),expected=anchor*(1+clamp(f.beliefs?.demandGrowth||0,-0.18,0.22)),replenishment=Math.max(0,finite(f.targetInventory)-finite(f.inventory));return Math.max(0,expected*0.72+replenishment);}
function candidateMargin(trace,selected){const rows=(trace?.candidates||[]).filter(x=>Number.isFinite(Number(x.utility)));const selectedRow=rows.find(x=>x.name===selected);const others=rows.filter(x=>x.name!==selected).map(x=>finite(x.utility)).sort((a,b)=>b-a);return selectedRow?finite(selectedRow.utility)-(others[0]??finite(selectedRow.utility)):0;}
function installAudit(world){
  world.__rv07P24={decision:new Map(),plan:new Map(),produce:new Map()};
  const credit=world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit=(country,month,signals)=>{
    const rows=[];
    for(const f of country.firms.filter(x=>x.active!==false)){
      const trace=f.lastTrace||{},p=trace.perception||{},selected=f.currentPlan?.name||trace.selected||'UNKNOWN',hiringChange=finite(f.currentPlan?.hiringChange),workersBefore=finite(f.workers),expectedDesired=Math.max(0,Math.round(Math.max(1,workersBefore)*(1+clamp(hiringChange,-0.10,0.12))));
      rows.push({firmId:f.id,industryId:f.industryId,consumerFacing:f.consumerFacing===true,workersBefore,desiredWorkers:finite(f.desiredWorkers),expectedDesired,desiredError:finite(f.desiredWorkers)-expectedDesired,hiringChange,negativeHiring:hiringChange<-TOL,selected,utilityMargin:candidateMargin(trace,selected),cashStress:finite(p.cashStress),inventoryPressure:finite(p.inventoryPressure),supplyStress:finite(p.supplyStress),debtBurden:finite(p.debtBurden),expectedDemandGrowth:finite(p.expectedDemandGrowth),observedDemandGrowth:finite(p.observedDemandGrowth),expectedCostGrowth:finite(p.expectedCostGrowth),cashBeforeCredit:world.ledger.balance(f.accountId),priorSupplyShortage:finite(f.supplyShortage)});
    }
    world.__rv07P24.decision.set(`${month}|${country.id}`,rows);
    return credit(country,month,signals);
  };
  const plan=world.supply.planProduction.bind(world.supply);
  world.supply.planProduction=country=>{
    const out=plan(country),rows=[];
    for(const f of country.firms.filter(x=>x.active!==false)){const u=unconstrainedPlan(f);rows.push({firmId:f.id,workersAfterLabor:finite(f.workers),actualHeadcountChange:0,capacity:finite(f.capacity),unconstrainedPlan:u,desiredProduction:finite(f.desiredProduction),capacityBound:u>finite(f.capacity)*1.08+TOL});}
    world.__rv07P24.plan.set(`${world.month}|${country.id}`,rows);return out;
  };
  const produce=world.supply.produce.bind(world.supply);
  world.supply.produce=(country,month,metrics)=>{const out=produce(country,month,metrics);world.__rv07P24.produce.set(`${month}|${country.id}`,new Map(country.firms.filter(x=>x.active!==false).map(f=>[f.id,{output:finite(f.output),supplyShortage:finite(f.supplyShortage)}])));return out;};
}
function runWorld(scaleProfile,seed,horizon,audited){
  const world=createWorld(scaleProfile,seed);if(audited)installAudit(world);const firmRows=[],countryRows=[];
  for(let i=0;i<horizon;i++){
    world.stepMonth();
    for(const c of world.countries){
      if(audited){const key=`${world.month}|${c.id}`,d=world.__rv07P24.decision.get(key)||[],p=world.__rv07P24.plan.get(key)||[],q=world.__rv07P24.produce.get(key)||new Map(),pm=new Map(p.map(x=>[x.firmId,x]));assert.equal(d.length,p.length,`${key}: decision/plan mismatch`);for(const a of d){const b=pm.get(a.firmId),z=q.get(a.firmId);assert.ok(b&&z,`${key}/${a.firmId}: downstream snapshot missing`);firmRows.push({scaleProfile,seed,month:world.month,countryId:c.id,...a,...b,...z,actualHeadcountChange:b.workersAfterLabor-a.workersBefore,executedLayoff:b.workersAfterLabor+TOL<a.workersBefore,outputToDesired:ratio(z.output,b.desiredProduction)});}countryRows.push({scaleProfile,seed,month:world.month,countryId:c.id,unemployment:finite(c.macro?.unemployment),exits:finite(c.macro?.firmExits),wageArrears:finite(c.macro?.wageArrears),consumerOutput:finite(c.lastIndustry?.sectorOutputs?.CONSUMER),inputShortage:finite(c.lastIndustry?.inputShortageUnits),gdpResidual:gdpResidual(c.macro),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});}
    }
  }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${scaleProfile}/${seed}: health failed`);return {firmRows,countryRows,health,digest:digest(world)};
}
const ni=[];for(const s of scales){const seed=`ECON-RV07-P24-NI-${s}`,h=Math.min(3,months),a=runWorld(s,seed,h,false).digest,b=runWorld(s,seed,h,true).digest,exact=a===b;assert.ok(exact,`${s}: observer interference`);ni.push({scaleProfile:s,exact});}
const runs=[];for(const s of scales)for(const seed of seeds)runs.push(runWorld(s,seed,months,true));const firmRows=runs.flatMap(r=>r.firmRows),countryRows=runs.flatMap(r=>r.countryRows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){const neg=rs.filter(r=>r.negativeHiring),lay=rs.filter(r=>r.executedLayoff),non=rs.filter(r=>!r.negativeHiring);return {firmMonths:rs.length,negativeHiringShare:ratio(neg.length,rs.length),executedLayoffShare:ratio(lay.length,rs.length),negativeHiringCapacityBoundShare:ratio(neg.filter(r=>r.capacityBound).length,neg.length),negativeHiringExecutedLayoffShare:ratio(neg.filter(r=>r.executedLayoff).length,neg.length),defenseShareOfNegative:ratio(neg.filter(r=>r.selected==='방어').length,neg.length),cashPreservationShareOfNegative:ratio(neg.filter(r=>r.selected==='현금 보존').length,neg.length),expansionShareOfNegative:ratio(neg.filter(r=>r.selected==='확장').length,neg.length),meanNegativeHiringChange:mean(neg.map(r=>r.hiringChange)),meanNegativeCashStress:mean(neg.map(r=>r.cashStress)),meanNonnegativeCashStress:mean(non.map(r=>r.cashStress)),meanNegativeInventoryPressure:mean(neg.map(r=>r.inventoryPressure)),meanNonnegativeInventoryPressure:mean(non.map(r=>r.inventoryPressure)),meanNegativeSupplyStress:mean(neg.map(r=>r.supplyStress)),meanNonnegativeSupplyStress:mean(non.map(r=>r.supplyStress)),meanNegativeDebtBurden:mean(neg.map(r=>r.debtBurden)),meanNonnegativeDebtBurden:mean(non.map(r=>r.debtBurden)),meanNegativeExpectedDemandGrowth:mean(neg.map(r=>r.expectedDemandGrowth)),meanNonnegativeExpectedDemandGrowth:mean(non.map(r=>r.expectedDemandGrowth)),meanNegativeUtilityMargin:mean(neg.map(r=>r.utilityMargin)),meanNegativeOutputToDesired:mean(neg.map(r=>r.outputToDesired)),meanNonnegativeOutputToDesired:mean(non.map(r=>r.outputToDesired))};}
const summary=[];for(const s of scales)for(const w of windows)summary.push({scaleProfile:s,window:w.id,...agg(firmRows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to))});
const industrySummary=[];for(const s of scales)for(const w of windows)for(const industryId of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])industrySummary.push({scaleProfile:s,window:w.id,industryId,...agg(firmRows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to&&r.industryId===industryId))});
const planSummary=[];for(const s of scales)for(const w of windows){const rs=firmRows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to&&r.negativeHiring);for(const selected of [...new Set(rs.map(r=>r.selected))].sort()){const q=rs.filter(r=>r.selected===selected);planSummary.push({scaleProfile:s,window:w.id,selected,cases:q.length,shareOfNegative:ratio(q.length,rs.length),meanHiringChange:mean(q.map(r=>r.hiringChange)),meanCashStress:mean(q.map(r=>r.cashStress)),meanInventoryPressure:mean(q.map(r=>r.inventoryPressure)),meanSupplyStress:mean(q.map(r=>r.supplyStress)),meanDebtBurden:mean(q.map(r=>r.debtBurden)),meanExpectedDemandGrowth:mean(q.map(r=>r.expectedDemandGrowth)),executedLayoffShare:ratio(q.filter(r=>r.executedLayoff).length,q.length)});}}
const maxDesiredError=Math.max(0,...firmRows.map(r=>Math.abs(r.desiredError))),maxGdpResidual=Math.max(0,...countryRows.map(r=>Math.abs(r.gdpResidual)));
const gates={observerNonInterferenceExact:ni.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCountryCoverage:countryRows.length===scales.length*seeds.length*months*4,firmRowsPresent:firmRows.length>0,desiredWorkerEquationReconciled:maxDesiredError<TOL,decisionPlanProduceMatched:firmRows.every(r=>Number.isFinite(r.workersAfterLabor)&&Number.isFinite(r.output)),ledgerCountriesOk:countryRows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:firmRows.every(r=>Number.isFinite(r.hiringChange)&&Number.isFinite(r.cashStress))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P24 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.map(x=>({scale:x.scaleProfile,window:x.window,neg:+x.negativeHiringShare.toFixed(3),layoff:+x.executedLayoffShare.toFixed(3),capNeg:+x.negativeHiringCapacityBoundShare.toFixed(3),defense:+x.defenseShareOfNegative.toFixed(3),cashPlan:+x.cashPreservationShareOfNegative.toFixed(3),cashNeg:+x.meanNegativeCashStress.toFixed(3),cashOther:+x.meanNonnegativeCashStress.toFixed(3),invNeg:+x.meanNegativeInventoryPressure.toFixed(3),supplyNeg:+x.meanNegativeSupplyStress.toFixed(3),demandNeg:+x.meanNegativeExpectedDemandGrowth.toFixed(3)})));
console.log('WP_RV07_P24_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P24',title:'Firm hiring-change driver audit',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},nonInterference:ni,gates,reconciliation:{maxDesiredError,maxGdpResidual},summary,industrySummary,planSummary,countryRows,firmRows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P24_OUTPUT',outputJson);}
