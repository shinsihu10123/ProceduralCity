import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer').split(',').map(x=>x.trim()).filter(Boolean);
const profiles=(process.env.DIAG_PROFILES||'baseline').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(12,Number(process.env.DIAG_MONTHS||24));
const checkMonths=Math.max(2,Number(process.env.DIAG_CHECK_MONTHS||3));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

const PROFILE_MAP={
  baseline:{id:'baseline-h1-f1',householdFactor:1,firmFactor:1,minHouseholds:1,minFirms:1},
  balanced2:{id:'balanced-h2-f2',householdFactor:2,firmFactor:2,minHouseholds:1,minFirms:1},
  households2:{id:'households-h2-f1',householdFactor:2,firmFactor:1,minHouseholds:1,minFirms:1},
  firms2:{id:'firms-h1-f2',householdFactor:1,firmFactor:2,minHouseholds:1,minFirms:1}
};

function profileFor(id){const p=PROFILE_MAP[id];if(!p)throw new Error(`unknown population profile ${id}`);return{...p};}
function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed,profile){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:profile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function oneWorkerCapacity(c,f){const capitalEffect=.72+Math.log1p(Math.max(0,F(f.capitalStock)))*.105,humanEffect=.82+F(c.humanCapital)*.30,resourceEffect=f.industryId==='RESOURCE'?.62+F(c.resourceBase)*.62:1,planEffect=1+CL(f.currentPlan?.productionChange||0,-.12,.15);return Math.max(EPS,F(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function enableExactDiagnosticLaborRuntime(w){for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__apNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__apNorm++;}
    }
    done.add(c.id);return out;
  };
}

function installObserver(w){
  w.__apRows=[];
  const plan=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=plan(c);
    let physical=0,viablePhysical=0,desired=0,workers=0,viableDesired=0,viableWorkers=0,plannedFirms=0,viableFirms=0;
    const bySector={};
    for(const f of c.firms.filter(x=>x.active!==false)){
      desired+=Math.max(0,F(f.desiredWorkers));workers+=Math.max(0,F(f.workers));
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      plannedFirms++;
      const need=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice,viable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=need*Math.max(EPS,F(f.wage));
      physical+=need;
      if(!bySector[f.industryId])bySector[f.industryId]={physical:0,viablePhysical:0,desired:0,workers:0,firms:0,viableFirms:0};
      const s=bySector[f.industryId];s.physical+=need;s.desired+=Math.max(0,F(f.desiredWorkers));s.workers+=Math.max(0,F(f.workers));s.firms++;
      if(viable){viablePhysical+=need;viableDesired+=Math.max(0,F(f.desiredWorkers));viableWorkers+=Math.max(0,F(f.workers));viableFirms++;s.viablePhysical+=need;s.viableFirms++;}
    }
    w.__apRows.push({month:w.month,countryId:c.id,households:c.households.length,activeFirms:c.firms.filter(x=>x.active!==false).length,plannedFirms,viableFirms,physical,viablePhysical,desired,workers,viableDesired,viableWorkers,bySector});
    return out;
  };
}

function initialCensus(w){
  const households=S(w.countries.map(c=>c.households.length)),firms=S(w.countries.map(c=>c.firms.filter(f=>f.active!==false).length)),desired=S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.desiredWorkers)))),workers=S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.workers)))),employed=S(w.countries.map(c=>c.households.filter(h=>h.employed).length));
  return{households,firms,householdsPerFirm:households/Math.max(1,firms),desiredJobs:desired,desiredJobsPerHousehold:desired/Math.max(1,households),workers,workersPerHousehold:workers/Math.max(1,households),employed,initialUnemployment:1-employed/Math.max(1,households)};
}

function fingerprint(w){return JSON.stringify({month:w.month,countries:w.countries.map(c=>({id:c.id,macro:c.macro,firms:c.firms.map(f=>[f.id,f.active!==false,F(f.workers),F(f.desiredWorkers),F(f.productivity),F(f.price),F(f.wage),F(f.output),F(f.sales),F(f.revenue),F(f.inventory),F(f.inputSpend),F(f.wageArrears),F(f.loanBalance),F(f.distressMonths),w.ledger.balance(f.accountId)]),households:c.households.map(h=>[h.id,!!h.employed,h.employerId,F(h.income),F(h.wageArrears),w.ledger.balance(h.accountId)]),settlement:w.ledger.totalBalance(c.id)}))});}
function buildWorld(seed,base,profile,observed=false){const w=makeWorld(seed,profile);enableExactDiagnosticLaborRuntime(w);installNormalization(w,base);if(observed)installObserver(w);return w;}
function verifyObserverNoninterference(seed,base,profile){const a=buildWorld(seed,base,profile,false),b=buildWorld(seed,base,profile,true);for(let i=0;i<checkMonths;i++){a.stepMonth();b.stepMonth();}return fingerprint(a)===fingerprint(b);}

function runOne(seed,base,profileId){
  const profile=profileFor(profileId),observerNoninterference=verifyObserverNoninterference(seed,base,profile);assert.ok(observerNoninterference,`${profileId}/${base}/${seed}: observer changed state`);
  const w=buildWorld(seed,base,profile,true),initial=initialCensus(w),monthly=[];
  for(let i=0;i<months;i++){
    w.stepMonth();
    const rows=w.__apRows.filter(r=>r.month===w.month),households=S(rows.map(r=>r.households)),physical=S(rows.map(r=>r.physical)),viablePhysical=S(rows.map(r=>r.viablePhysical)),desired=S(rows.map(r=>r.desired)),workers=S(rows.map(r=>r.workers)),activeFirms=S(rows.map(r=>r.activeFirms));
    const gdp=S(w.countries.map(c=>F(c.macro?.gdp))),output=S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output)))),arrears=S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears))))),employed=S(w.countries.map(c=>c.households.filter(h=>h.employed).length)),unfilled=S(w.countries.map(c=>F(c.macro?.unfilledJobs)));
    monthly.push({month:w.month,households,physical,viablePhysical,desired,workers,activeFirms,gdp,output,arrears,employed,unfilled,unemployment:1-employed/Math.max(1,households)});
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${profileId}/${base}/${seed}: health`);const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${profileId}/${base}/${seed}: accounting`);
  assert.ok(monthly.length===months&&monthly.every(x=>x.households>0&&x.physical>0),`${profileId}/${base}/${seed}: population rows missing`);
  const summary={
    meanHouseholds:M(monthly.map(x=>x.households)),meanActiveFirms:M(monthly.map(x=>x.activeFirms)),meanHouseholdsPerActiveFirm:M(monthly.map(x=>x.households/Math.max(1,x.activeFirms))),
    meanPhysicalNeedPerHousehold:M(monthly.map(x=>x.physical/x.households)),meanViablePhysicalNeedPerHousehold:M(monthly.map(x=>x.viablePhysical/x.households)),shareMonthsPhysicalNeedExceedsPopulation:monthly.filter(x=>x.physical>x.households).length/monthly.length,shareMonthsViablePhysicalNeedExceedsPopulation:monthly.filter(x=>x.viablePhysical>x.households).length/monthly.length,
    meanDesiredJobsPerHousehold:M(monthly.map(x=>x.desired/x.households)),meanActualWorkersPerHousehold:M(monthly.map(x=>x.workers/x.households)),meanDesiredToPhysical:M(monthly.map(x=>x.desired/Math.max(1,x.physical))),meanTargetFill:M(monthly.map(x=>x.workers/Math.max(1,x.desired))),meanUnemployment:M(monthly.map(x=>x.unemployment)),meanUnfilledJobsPerHousehold:M(monthly.map(x=>x.unfilled/x.households)),
    meanGdpPerHousehold:M(monthly.map(x=>x.gdp/x.households)),meanOutputPerHousehold:M(monthly.map(x=>x.output/x.households)),meanArrearsPerHousehold:M(monthly.map(x=>x.arrears/x.households)),terminalUnemployment:M(monthly.slice(-6).map(x=>x.unemployment)),terminalArrearsPerHousehold:M(monthly.slice(-6).map(x=>x.arrears/x.households))
  };
  return{seed,base,profileId,profile,months,observerNoninterference,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__apNorm,initial,summary};
}

const runs=[];for(const profileId of profiles)for(const base of bases)for(const seed of seeds)runs.push(runOne(seed,base,profileId));
const finite=runs.every(r=>[...Object.values(r.initial),...Object.values(r.summary)].every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({seed:r.seed,base:r.base,profile:r.profileId,hFactor:r.profile.householdFactor,fFactor:r.profile.firmFactor,initialHouseholds:r.initial.households,initialFirms:r.initial.firms,initialHouseholdsPerFirm:r.initial.householdsPerFirm,initialDesiredJobsPerHousehold:r.initial.desiredJobsPerHousehold,initialWorkersPerHousehold:r.initial.workersPerHousehold,initialUnemployment:r.initial.initialUnemployment,physicalNeedPerHousehold:r.summary.meanPhysicalNeedPerHousehold,viablePhysicalNeedPerHousehold:r.summary.meanViablePhysicalNeedPerHousehold,monthsPhysicalOverPopulation:r.summary.shareMonthsPhysicalNeedExceedsPopulation,monthsViablePhysicalOverPopulation:r.summary.shareMonthsViablePhysicalNeedExceedsPopulation,desiredJobsPerHousehold:r.summary.meanDesiredJobsPerHousehold,actualWorkersPerHousehold:r.summary.meanActualWorkersPerHousehold,desiredToPhysical:r.summary.meanDesiredToPhysical,targetFill:r.summary.meanTargetFill,unemployment:r.summary.meanUnemployment,terminalUnemployment:r.summary.terminalUnemployment,unfilledPerHousehold:r.summary.meanUnfilledJobsPerHousehold,gdpPerHousehold:r.summary.meanGdpPerHousehold,outputPerHousehold:r.summary.meanOutputPerHousehold,arrearsPerHousehold:r.summary.meanArrearsPerHousehold,terminalArrearsPerHousehold:r.summary.terminalArrearsPerHousehold}));
const report={workPackage:'WP-RV08-R4-AP',title:'Population Sufficiency / Labor Feasibility / Scale Sensitivity Audit',note:'Diagnostic-only. Population and firm-count profile changes are causal probes, not production repairs. Balanced scaling tests finite-size sensitivity; household-only and firm-only scaling deliberately alter household/firm density and therefore cannot by themselves identify pure labor-supply effects.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,profiles,months,checkMonths},gates:{observerNoninterference:runs.every(r=>r.observerNoninterference),allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length*profiles.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),populationRowsObserved:runs.every(r=>r.summary.meanHouseholds>0),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
