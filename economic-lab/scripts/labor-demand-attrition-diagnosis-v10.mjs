import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8, TOL=1e-7;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0);
const mean=a=>a.length?sum(a)/a.length:0;
const ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,finite(x)));
const clone=v=>structuredClone(v);
const near=(a,b)=>Math.abs(finite(a)-finite(b))<=TOL*Math.max(1,Math.abs(finite(a)),Math.abs(finite(b)));

function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function fingerprint(world){return {month:world.month,rng:clone(world.rng),countries:clone(world.countries),ledgerEntries:clone(world.ledger.entries),accounting:world.countries.map(c=>({id:c.id,report:world.accountingReport(c.id)}))};}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}

function installAudit(world){
  world.__rv07P11Start=new Map();
  world.__rv07P11Rows=new Map();
  const originalBegin=world.supply.beginMonth.bind(world.supply);
  const originalPlan=world.supply.planProduction.bind(world.supply);
  world.supply.beginMonth=country=>{
    const out=originalBegin(country);
    const start=new Map();
    for(const f of country.firms) start.set(f.id,{workers:finite(f.workers),desiredWorkers:finite(f.desiredWorkers),active:f.active!==false});
    world.__rv07P11Start.set(`${world.month}|${country.id}`,start);
    return out;
  };
  world.supply.planProduction=country=>{
    const start=world.__rv07P11Start.get(`${world.month}|${country.id}`)||new Map();
    const out=originalPlan(country);
    const rows=[];
    for(const f of country.firms){
      if(f.active===false) continue;
      const s=start.get(f.id)||{workers:finite(f.workers),desiredWorkers:finite(f.desiredWorkers),active:true};
      const hc=clamp(f.currentPlan?.hiringChange||0,-0.10,0.12);
      const derivedDesired=Math.max(0,Math.round(Math.max(1,s.workers)*(1+hc)));
      const targetAnchor=Math.max(0,finite(f.targetInventory)*0.42);
      const demandAnchor=Math.max(2,finite(f.previousSales),targetAnchor);
      const anchor=near(demandAnchor,finite(f.previousSales))?'PREVIOUS_SALES':near(demandAnchor,targetAnchor)?'TARGET_INVENTORY':near(demandAnchor,2)?'FLOOR':'UNCLASSIFIED';
      const capBind=near(finite(f.desiredProduction),Math.max(0,finite(f.capacity)*1.08));
      rows.push({firmId:f.id,industryId:f.industryId,startWorkers:s.workers,postLaborWorkers:finite(f.workers),desiredWorkers:finite(f.desiredWorkers),derivedDesiredWorkers:derivedDesired,desiredWorkerError:finite(f.desiredWorkers)-derivedDesired,hiringChange:hc,planSelected:String(f.currentPlan?.selected||f.currentPlan?.name||''),workerTargetDirection:derivedDesired<s.workers?'CONTRACT':derivedDesired>s.workers?'EXPAND':'HOLD',plannedLayoffSlots:Math.max(0,s.workers-derivedDesired),plannedVacancySlots:Math.max(0,derivedDesired-s.workers),actualWorkerLoss:Math.max(0,s.workers-finite(f.workers)),actualWorkerGain:Math.max(0,finite(f.workers)-s.workers),previousSales:finite(f.previousSales),targetAnchor,demandAnchor,anchorBranch:anchor,replenishment:Math.max(0,finite(f.targetInventory)-finite(f.inventory)),capacity:finite(f.capacity),desiredProduction:finite(f.desiredProduction),capacityBound:capBind});
    }
    world.__rv07P11Rows.set(`${world.month}|${country.id}`,rows);
    return out;
  };
}

function run(scaleProfile,seed,horizon,audited){
  const world=createWorld(scaleProfile,seed); if(audited) installAudit(world);
  const firmRows=[], countryRows=[];
  for(let i=0;i<horizon;i++){
    world.stepMonth();
    for(const country of world.countries){
      if(audited){
        const rs=world.__rv07P11Rows.get(`${world.month}|${country.id}`)||[];
        assert.ok(rs.length>0,`${scaleProfile}/${seed}/${world.month}/${country.id}: missing labor-demand rows`);
        for(const r of rs) firmRows.push({scaleProfile,seed,month:world.month,countryId:country.id,...r});
      }
      countryRows.push({scaleProfile,seed,month:world.month,countryId:country.id,unemployment:finite(country.macro?.unemployment),exits:finite(country.macro?.firmExits),wageArrears:finite(country.macro?.wageArrears),gdpResidual:gdpResidual(country.macro),ledgerOk:world.ledger.verifyCountry(country.id)?.ok===true});
    }
  }
  const health=world.forceHealthCheck(); assert.ok(health.ok,`${scaleProfile}/${seed}: health failed`);
  return {world,firmRows,countryRows,health,fingerprint:fingerprint(world)};
}

const ni=[];
for(const scaleProfile of scales){const seed=`ECON-RV07-P11-NI-${scaleProfile}`,h=Math.min(3,months);const a=run(scaleProfile,seed,h,false).fingerprint,b=run(scaleProfile,seed,h,true).fingerprint;const exact=JSON.stringify(a)===JSON.stringify(b);assert.ok(exact,`${scaleProfile}: audit perturbed world`);ni.push({scaleProfile,exact});}
const runs=[];for(const scaleProfile of scales)for(const seed of seeds)runs.push(run(scaleProfile,seed,months,true));
const firmRows=runs.flatMap(r=>r.firmRows), countryRows=runs.flatMap(r=>r.countryRows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){const n=rs.length;const contract=rs.filter(r=>r.workerTargetDirection==='CONTRACT'),expand=rs.filter(r=>r.workerTargetDirection==='EXPAND'),targetAnchored=rs.filter(r=>r.anchorBranch==='TARGET_INVENTORY'),cap=rs.filter(r=>r.capacityBound),consumer=rs.filter(r=>r.industryId==='CONSUMER');return {firmMonths:n,meanStartWorkers:mean(rs.map(r=>r.startWorkers)),meanPostLaborWorkers:mean(rs.map(r=>r.postLaborWorkers)),meanHiringChange:mean(rs.map(r=>r.hiringChange)),contractShare:ratio(contract.length,n),holdShare:ratio(rs.filter(r=>r.workerTargetDirection==='HOLD').length,n),expandShare:ratio(expand.length,n),plannedLayoffSlots:sum(rs.map(r=>r.plannedLayoffSlots)),plannedVacancySlots:sum(rs.map(r=>r.plannedVacancySlots)),actualWorkerLoss:sum(rs.map(r=>r.actualWorkerLoss)),actualWorkerGain:sum(rs.map(r=>r.actualWorkerGain)),targetInventoryAnchorShare:ratio(targetAnchored.length,n),capacityBoundShare:ratio(cap.length,n),targetAnchoredContractShare:ratio(targetAnchored.filter(r=>r.workerTargetDirection==='CONTRACT').length,targetAnchored.length),capacityBoundContractShare:ratio(cap.filter(r=>r.workerTargetDirection==='CONTRACT').length,cap.length),consumer:{firmMonths:consumer.length,meanStartWorkers:mean(consumer.map(r=>r.startWorkers)),contractShare:ratio(consumer.filter(r=>r.workerTargetDirection==='CONTRACT').length,consumer.length),capacityBoundShare:ratio(consumer.filter(r=>r.capacityBound).length,consumer.length),targetAnchoredShare:ratio(consumer.filter(r=>r.anchorBranch==='TARGET_INVENTORY').length,consumer.length)}};}
const summary=[];for(const s of scales)for(const w of windows){const rs=firmRows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to);summary.push({scaleProfile:s,window:w.id,...agg(rs)});}
const industrySummary=[];for(const s of scales)for(const w of windows)for(const industryId of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER']){const rs=firmRows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to&&r.industryId===industryId);industrySummary.push({scaleProfile:s,window:w.id,industryId,...agg(rs)});}
const maxDesiredWorkerError=Math.max(0,...firmRows.map(r=>Math.abs(r.desiredWorkerError)));const maxGdpResidual=Math.max(0,...countryRows.map(r=>Math.abs(r.gdpResidual)));
const gates={observerNonInterferenceExact:ni.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCountryCoverage:countryRows.length===scales.length*seeds.length*months*4,firmRowsPresent:firmRows.length>0,desiredWorkerEquationReconciled:maxDesiredWorkerError<TOL,allDirectionsClassified:firmRows.every(r=>['CONTRACT','HOLD','EXPAND'].includes(r.workerTargetDirection)),ledgerCountriesOk:countryRows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:firmRows.every(r=>Number.isFinite(r.startWorkers)&&Number.isFinite(r.desiredWorkers)&&Number.isFinite(r.capacity))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P11 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.scaleProfile==='baseline').map(x=>({window:x.window,workers:+x.meanStartWorkers.toFixed(2),contract:+x.contractShare.toFixed(4),expand:+x.expandShare.toFixed(4),layoffSlots:x.plannedLayoffSlots,vacancySlots:x.plannedVacancySlots,targetAnchor:+x.targetInventoryAnchorShare.toFixed(4),capacityBound:+x.capacityBoundShare.toFixed(4),targetContract:+x.targetAnchoredContractShare.toFixed(4),consumerWorkers:+x.consumer.meanStartWorkers.toFixed(2),consumerContract:+x.consumer.contractShare.toFixed(4)})));
console.log('WP_RV07_P11_GATES',JSON.stringify(gates));console.log('WP_RV07_P11_RECONCILIATION',JSON.stringify({maxDesiredWorkerError,maxGdpResidual}));
const payload={workPackage:'WP-RV07-P11',title:'Labor-demand recursive attrition diagnosis',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},nonInterference:ni,gates,reconciliation:{maxDesiredWorkerError,maxGdpResidual},summary,industrySummary,countryRows,firmRows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P11_OUTPUT',outputJson);}
