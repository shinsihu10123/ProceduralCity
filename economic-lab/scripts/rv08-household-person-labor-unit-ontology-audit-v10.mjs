import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const slotCaps=(process.env.DIAG_WORKER_SLOTS_PER_HOUSEHOLD||'0.5,0.75,1,1.25,1.5,2').split(',').map(Number).filter(x=>Number.isFinite(x)&&x>0);
const months=Math.max(12,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function oneWorkerCapacity(c,f){const capitalEffect=.72+Math.log1p(Math.max(0,F(f.capitalStock)))*.105,humanEffect=.82+F(c.humanCapital)*.30,resourceEffect=f.industryId==='RESOURCE'?.62+F(c.resourceBase)*.62:1,planEffect=1+CL(f.currentPlan?.productionChange||0,-.12,.15);return Math.max(EPS,F(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__asNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__asNorm++;}
    }
    done.add(c.id);return out;
  };
}

function buildWorld(seed,base){const w=makeWorld(seed);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});installNormalization(w,base);return w;}

function laborNeed(c){
  let physical=0,viable=0,desired=0;
  for(const f of c.firms.filter(x=>x.active!==false)){
    desired+=Math.max(0,F(f.desiredWorkers));
    const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
    const required=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f)));physical+=required;
    const inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
    const ok=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=required*Math.max(EPS,F(f.wage));
    if(ok)viable+=required;
  }
  return {physical,viable,desired};
}

const demographicFields=['age','birthMonth','birthYear','deathMonth','alive','householdSize','members','children','dependents','student','retired','retirementAge','laborForceParticipant','laborEligible','workingAge','spouseId'];
const individualLaborFields=['employed','employerId','wage','reservationWage','skill'];
const householdEconomicFields=['wealth','accountId','consumption','desiredConsumptionBudget','savings','loanBalance'];

function schemaAudit(c){
  const sample=c.households[0]||{};
  const present=Object.fromEntries(demographicFields.map(k=>[k,Object.prototype.hasOwnProperty.call(sample,k)]));
  return {
    demographicFieldPresence:present,
    demographicFieldsPresent:Object.values(present).filter(Boolean).length,
    individualLaborFieldsPresent:individualLaborFields.filter(k=>Object.prototype.hasOwnProperty.call(sample,k)),
    householdEconomicFieldsPresent:householdEconomicFields.filter(k=>Object.prototype.hasOwnProperty.call(sample,k)),
    oneEmployerScalar:Object.prototype.hasOwnProperty.call(sample,'employerId')&&!Array.isArray(sample.employerId),
    oneEmploymentScalar:Object.prototype.hasOwnProperty.call(sample,'employed')&&typeof sample.employed==='boolean'
  };
}

function runOne(seed,base){
  const w=buildWorld(seed,base),rows=[];
  const initialIds=new Map(w.countries.map(c=>[c.id,c.households.map(h=>h.id).slice().sort()]));
  const initialCounts=new Map(w.countries.map(c=>[c.id,c.households.length]));
  const schema=w.countries.map(c=>({countryId:c.id,...schemaAudit(c)}));
  for(let i=0;i<months;i++){
    w.stepMonth();
    for(const c of w.countries){
      const households=c.households.length,employed=c.households.filter(h=>h.employed).length,need=laborNeed(c),slotSensitivity={};
      for(const cap of slotCaps){const supply=Math.max(EPS,households*cap);slotSensitivity[String(cap)]={viableNeedToSlotCapacity:need.viable/supply,physicalNeedToSlotCapacity:need.physical/supply,desiredToSlotCapacity:need.desired/supply};}
      rows.push({month:w.month,countryId:c.id,households,employed,...need,viableSlotsPerHousehold:need.viable/Math.max(1,households),physicalSlotsPerHousehold:need.physical/Math.max(1,households),desiredSlotsPerHousehold:need.desired/Math.max(1,households),slotSensitivity});
    }
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${seed}/${base}: health`);
  const stableCounts=w.countries.every(c=>c.households.length===initialCounts.get(c.id));
  const stableIds=w.countries.every(c=>JSON.stringify(c.households.map(h=>h.id).slice().sort())===JSON.stringify(initialIds.get(c.id)));
  const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
  assert.ok(stableCounts&&stableIds,`${seed}/${base}: household population changed`);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${seed}/${base}: accounting`);
  const slotSensitivity={};
  for(const cap of slotCaps){const k=String(cap);slotSensitivity[k]={meanViableNeedToSlotCapacity:M(rows.map(r=>r.slotSensitivity[k].viableNeedToSlotCapacity)),shareMonthsViableNeedExceedsSlotCapacity:rows.filter(r=>r.slotSensitivity[k].viableNeedToSlotCapacity>1).length/Math.max(1,rows.length),meanPhysicalNeedToSlotCapacity:M(rows.map(r=>r.slotSensitivity[k].physicalNeedToSlotCapacity)),shareMonthsPhysicalNeedExceedsSlotCapacity:rows.filter(r=>r.slotSensitivity[k].physicalNeedToSlotCapacity>1).length/Math.max(1,rows.length),meanDesiredToSlotCapacity:M(rows.map(r=>r.slotSensitivity[k].desiredToSlotCapacity)),shareMonthsDesiredExceedsSlotCapacity:rows.filter(r=>r.slotSensitivity[k].desiredToSlotCapacity>1).length/Math.max(1,rows.length)};}
  return {seed,base,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__asNorm,stableCounts,stableIds,schema,meanHouseholds:M(rows.map(r=>r.households)),meanEmployed:M(rows.map(r=>r.employed)),meanViableSlotsPerHousehold:M(rows.map(r=>r.viableSlotsPerHousehold)),meanPhysicalSlotsPerHousehold:M(rows.map(r=>r.physicalSlotsPerHousehold)),meanDesiredSlotsPerHousehold:M(rows.map(r=>r.desiredSlotsPerHousehold)),slotSensitivity};
}

const runs=[];for(const base of bases)for(const seed of seeds)runs.push(runOne(seed,base));
const schemaNoDemography=runs.every(r=>r.schema.every(s=>s.demographicFieldsPresent===0));
const hybridUnitObserved=runs.every(r=>r.schema.every(s=>s.oneEmployerScalar&&s.oneEmploymentScalar&&s.individualLaborFieldsPresent.length===individualLaborFields.length&&s.householdEconomicFieldsPresent.length>=5));
const report={workPackage:'WP-RV08-R4-AS',title:'Household / Person Labor-Unit Ontology Audit',note:'Diagnostic-only. Worker-slot capacities are semantic sensitivity assumptions, not demographic calibration and not a multi-worker household implementation. No economic rule is changed.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,months,workerSlotsPerHousehold:slotCaps},gates:{allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),stableHouseholdCounts:runs.every(r=>r.stableCounts),stableHouseholdIds:runs.every(r=>r.stableIds),ledgerOk:runs.every(r=>r.ledgerOk),accountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),schemaNoDemography,hybridUnitObserved,ok:true},compact:runs.map(r=>({seed:r.seed,base:r.base,months:r.months,meanHouseholds:r.meanHouseholds,meanEmployed:r.meanEmployed,meanViableSlotsPerHousehold:r.meanViableSlotsPerHousehold,meanPhysicalSlotsPerHousehold:r.meanPhysicalSlotsPerHousehold,meanDesiredSlotsPerHousehold:r.meanDesiredSlotsPerHousehold,slotSensitivity:r.slotSensitivity,schema:r.schema[0]})),runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact:report.compact},null,2));