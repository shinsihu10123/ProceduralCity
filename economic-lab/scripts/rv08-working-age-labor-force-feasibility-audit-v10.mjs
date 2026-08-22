import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const shares=(process.env.DIAG_LF_SHARES||'0.4,0.5,0.6,0.7,0.8,0.9,1').split(',').map(Number).filter(x=>Number.isFinite(x)&&x>0&&x<=1);
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
  const target=targetSectors(base),done=new Set();w.__arNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__arNorm++;}
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

function runOne(seed,base){
  const w=buildWorld(seed,base),rows=[];
  for(let i=0;i<months;i++){
    w.stepMonth();
    for(const c of w.countries){
      const population=c.households.length,employed=c.households.filter(h=>h.employed).length,need=laborNeed(c),byShare={};
      for(const p of shares){const lf=Math.max(1,population*p);byShare[String(p)]={laborForce:lf,viableNeedToLaborForce:need.viable/lf,physicalNeedToLaborForce:need.physical/lf,desiredToLaborForce:need.desired/lf,employmentToLaborForce:employed/lf};}
      rows.push({month:w.month,countryId:c.id,population,employed,...need,byShare});
    }
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${seed}/${base}: health`);
  const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
  assert.ok(accountingOk&&ledgerOk&&gdpOk,`${seed}/${base}: accounting`);
  const sensitivity={};
  for(const p of shares){const k=String(p);sensitivity[k]={meanViableNeedToLaborForce:M(rows.map(r=>r.byShare[k].viableNeedToLaborForce)),shareMonthsViableNeedExceedsLaborForce:rows.filter(r=>r.byShare[k].viableNeedToLaborForce>1).length/Math.max(1,rows.length),meanPhysicalNeedToLaborForce:M(rows.map(r=>r.byShare[k].physicalNeedToLaborForce)),shareMonthsPhysicalNeedExceedsLaborForce:rows.filter(r=>r.byShare[k].physicalNeedToLaborForce>1).length/Math.max(1,rows.length),meanDesiredToLaborForce:M(rows.map(r=>r.byShare[k].desiredToLaborForce)),shareMonthsDesiredExceedsLaborForce:rows.filter(r=>r.byShare[k].desiredToLaborForce>1).length/Math.max(1,rows.length)};}
  return{seed,base,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__arNorm,meanPopulation:M(rows.map(r=>r.population)),meanEmployed:M(rows.map(r=>r.employed)),meanViableNeed:M(rows.map(r=>r.viable)),meanPhysicalNeed:M(rows.map(r=>r.physical)),meanDesired:M(rows.map(r=>r.desired)),sensitivity};
}

const runs=[];for(const base of bases)for(const seed of seeds)runs.push(runOne(seed,base));
const report={workPackage:'WP-RV08-R4-AR',title:'Working-Age / Labor-Force Feasibility Sensitivity Audit',note:'Diagnostic-only. Labor-force shares are sensitivity assumptions, not demographic calibration. Economic state is unchanged by the share calculations. The transformed unit basis and prior productive-normalization diagnostic bases are retained for comparability with R4-AP.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,months,laborForceShares:shares},gates:{allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerOk:runs.every(r=>r.ledgerOk),accountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),ok:true},compact:runs.map(r=>({seed:r.seed,base:r.base,months:r.months,meanPopulation:r.meanPopulation,meanEmployed:r.meanEmployed,meanViableNeed:r.meanViableNeed,meanPhysicalNeed:r.meanPhysicalNeed,meanDesired:r.meanDesired,sensitivity:r.sensitivity})),runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact:report.compact},null,2));
