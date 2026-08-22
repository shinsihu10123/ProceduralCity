import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const regimes=(process.env.DIAG_REGIMES||'control,max-ramp,grace,max-ramp-grace,full-need').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(8,Number(process.env.DIAG_MONTHS||18));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7,UP=0.12,CANONICAL_DISTRESS=4,GRACE_DISTRESS=24;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const Q=(a,p)=>{if(!a.length)return 0;const x=[...a].sort((u,v)=>u-v),i=Math.max(0,Math.min(x.length-1,Math.floor((x.length-1)*p)));return x[i];};
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function oneWorkerCapacity(c,f){const capitalEffect=.72+Math.log1p(Math.max(0,F(f.capitalStock)))*.105,humanEffect=.82+F(c.humanCapital)*.30,resourceEffect=f.industryId==='RESOURCE'?.62+F(c.resourceBase)*.62:1,planEffect=1+CL(f.currentPlan?.productionChange||0,-.12,.15);return Math.max(EPS,F(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installNormalization(w,base){const target=targetSectors(base),done=new Set();w.__ahNorm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__ahNorm++;}}done.add(c.id);return out;};}

function installStaffing(w,regime){
  w.__ahRows=[];w.__ahPre=new Map();w.__ahInterventions=0;
  const credit=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    const result=credit(c,month,signals); // preserve canonical credit view of staffing
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f)));
      const inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0;
      const margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const planViable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      const current=Math.max(0,F(f.workers)),canonical=Math.max(0,F(f.desiredWorkers));
      let applied=canonical;
      if(planViable&&physical>current){
        if(regime==='max-ramp'||regime==='max-ramp-grace'){
          const ramp=Math.max(current,Math.round(Math.max(1,current)*(1+UP)));
          applied=Math.max(canonical,Math.min(physical,ramp));
        }else if(regime==='full-need') applied=physical;
      }
      if(Math.abs(applied-canonical)>TOL){f.desiredWorkers=applied;w.__ahInterventions++;}
      w.__ahPre.set(`${w.month}|${c.id}|${f.id}`,{planViable,rawPlan,physical,current,canonical,applied});
    }
    return result;
  };
  const plan=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=plan(c);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const pre=w.__ahPre.get(`${w.month}|${c.id}|${f.id}`);if(!pre||!pre.planViable)continue;
      w.__ahRows.push({...pre,month:w.month,countryId:c.id,firmId:f.id,actual:Math.max(0,F(f.workers)),output:F(f.output),capacity:F(f.capacity)});
    }
    return out;
  };
}

function installDistressClock(w,regime){
  w.__ahExits=0;
  const grace=regime==='grace'||regime==='max-ramp-grace';
  if(!grace){const orig=w.supply.evaluateExits.bind(w.supply);w.supply.evaluateExits=c=>{const x=orig(c);w.__ahExits+=x.length;return x;};return;}
  w.supply.evaluateExits=c=>{
    const exited=[];
    for(const f of c.firms.filter(x=>x.active!==false)){
      const cash=w.ledger.balance(f.accountId),severePayroll=(F(f.wageArrears)>Math.max(100,F(f.wage)*Math.max(1,F(f.workers))*1.35)),severeCredit=F(f.creditMisses)>=5,liquidity=cash<F(f.safeCash)*.025&&severePayroll;
      if(liquidity||severeCredit)f.distressMonths=F(f.distressMonths)+1;else f.distressMonths=Math.max(0,F(f.distressMonths)-1);
      if(f.distressMonths<GRACE_DISTRESS)continue;
      f.active=false;f.desiredWorkers=0;f.desiredProduction=0;
      for(const h of c.households)if(h.employerId===f.id){h.employed=false;h.employerId=null;}
      f.workers=0;exited.push(f.industryId);w.__ahExits++;
    }
    return exited;
  };
}

function summarizeStaff(rows){const v=rows.filter(r=>r.planViable);return{rows:v.length,meanCanonicalToPhysical:M(v.map(r=>r.canonical/r.physical)),meanAppliedToPhysical:M(v.map(r=>r.applied/r.physical)),meanActualToPhysical:M(v.map(r=>r.actual/r.physical)),meanActualToApplied:M(v.map(r=>r.applied>EPS?r.actual/r.applied:1)),p50AppliedToPhysical:Q(v.map(r=>r.applied/r.physical),.5),shareAppliedBelow50Physical:v.length?v.filter(r=>r.applied/r.physical<.5).length/v.length:0};}

function runOne(base,seed,regime){
  const w=makeWorld(seed);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});
  installNormalization(w,base);installStaffing(w,regime);installDistressClock(w,regime);
  const monthly=[];
  for(let i=0;i<months;i++){
    w.stepMonth();
    monthly.push({month:w.month,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),arrears:S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears))))),linkedArrears:S(w.countries.flatMap(c=>c.households.filter(h=>h.employed&&h.employerId).map(h=>Math.max(0,F(h.wageArrears))))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output)))),activeFirms:S(w.countries.map(c=>c.firms.filter(f=>f.active!==false).length))});
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${base}/${seed}/${regime}: health`);
  const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
  assert.ok(accountingOk&&ledgerOk&&gdpOk,`${base}/${seed}/${regime}: accounting`);
  assert.ok(w.__ahRows.length>0,`${base}/${seed}/${regime}: no plan-viable consumer rows`);
  const staff=summarizeStaff(w.__ahRows),tail=monthly.slice(-6);
  return{base,seed,regime,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__ahNorm,interventions:w.__ahInterventions,exits:w.__ahExits,distressThreshold:regime==='grace'||regime==='max-ramp-grace'?GRACE_DISTRESS:CANONICAL_DISTRESS,staff,summary:{unemployment:M(monthly.map(x=>x.unemployment)),terminalUnemployment:M(tail.map(x=>x.unemployment)),arrears:M(monthly.map(x=>x.arrears)),terminalArrears:M(tail.map(x=>x.arrears)),linkedArrears:M(monthly.map(x=>x.linkedArrears)),terminalLinkedArrears:M(tail.map(x=>x.linkedArrears)),gdp:M(monthly.map(x=>x.gdp)),output:M(monthly.map(x=>x.output)),activeFirms:M(monthly.map(x=>x.activeFirms))},monthly};
}

const runs=[];
for(const base of bases)for(const seed of seeds)for(const regime of regimes)runs.push(runOne(base,seed,regime));
const finite=runs.every(r=>Object.values({...r.summary,...r.staff}).every(v=>typeof v!=='number'||Number.isFinite(v)));
assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({base:r.base,seed:r.seed,regime:r.regime,u:r.summary.unemployment,u6:r.summary.terminalUnemployment,arrears:r.summary.arrears,arrears6:r.summary.terminalArrears,linked:r.summary.linkedArrears,linked6:r.summary.terminalLinkedArrears,gdp:r.summary.gdp,output:r.summary.output,active:r.summary.activeFirms,exits:r.exits,interventions:r.interventions,distress:r.distressThreshold,canonicalPhysical:r.staff.meanCanonicalToPhysical,appliedPhysical:r.staff.meanAppliedToPhysical,actualPhysical:r.staff.meanActualToPhysical,actualApplied:r.staff.meanActualToApplied,below50:r.staff.shareAppliedBelow50Physical}));
const report={workPackage:'WP-RV08-R4-AH-AI',title:'Production-Informed Staffing Ramp / Distress-Clock Ablation',note:'Diagnostic-only. Separates weak production-blind hiring signal from transition/distress-clock incompatibility. Full-need is a known inadmissible reference, not a repair candidate.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,regimes,months,upwardRamp:UP,canonicalDistressMonths:CANONICAL_DISTRESS,graceDistressMonths:GRACE_DISTRESS},gates:{allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===bases.length*seeds.length*regimes.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),consumerPlanViableObserved:runs.every(r=>r.staff.rows>0),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
