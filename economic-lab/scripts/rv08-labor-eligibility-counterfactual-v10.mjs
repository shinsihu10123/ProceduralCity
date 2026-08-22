import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const shares=(process.env.DIAG_ELIGIBLE_SHARES||'1,0.8,0.7,0.6').split(',').map(Number).filter(x=>Number.isFinite(x)&&x>0&&x<=1);
const months=Math.max(12,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function hash32(text){let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function oneWorkerCapacity(c,f){const capitalEffect=.72+Math.log1p(Math.max(0,F(f.capitalStock)))*.105,humanEffect=.82+F(c.humanCapital)*.30,resourceEffect=f.industryId==='RESOURCE'?.62+F(c.resourceBase)*.62:1,planEffect=1+CL(f.currentPlan?.productionChange||0,-.12,.15);return Math.max(EPS,F(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__atNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__atNorm++;}
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

function assignEligibility(w,seed,share){
  for(const c of w.countries){
    Object.defineProperty(c,'__diagnosticLaborEligibility',{value:true,writable:true,configurable:true,enumerable:false});
    const ranked=c.households.map(h=>({h,rank:hash32(`${seed}:${c.id}:${h.id}:labor-eligibility`)})).sort((a,b)=>a.rank-b.rank||a.h.id.localeCompare(b.h.id));
    const eligibleN=Math.max(1,Math.round(ranked.length*share));
    const eligible=new Set(ranked.slice(0,eligibleN).map(x=>x.h.id));
    for(const h of c.households)Object.defineProperty(h,'__diagnosticLaborEligible',{value:eligible.has(h.id),writable:true,configurable:true,enumerable:false});
    for(const h of c.households){if(h.employed&&h.__diagnosticLaborEligible===false){h.employed=false;h.employerId=null;}}
    const counts=new Map(c.firms.map(f=>[f.id,0]));
    for(const h of c.households)if(h.employed&&h.employerId&&counts.has(h.employerId))counts.set(h.employerId,counts.get(h.employerId)+1);
    for(const f of c.firms)f.workers=counts.get(f.id)||0;
  }
}

function fingerprint(w){return JSON.stringify({month:w.month,countries:w.countries.map(c=>({id:c.id,macro:c.macro,firms:c.firms.map(f=>[f.id,f.active,f.workers,f.desiredWorkers,f.wage,f.cash,f.inventory,f.output,f.revenue,f.wageArrears]),households:c.households.map(h=>[h.id,h.employed,h.employerId,h.wage,h.wealth,h.income,h.wageArrears])}))});}

function verifyAllEligibleNoninterference(seed,base){
  const plain=buildWorld(seed,base),flagged=buildWorld(seed,base);assignEligibility(flagged,seed,1);
  for(let i=0;i<6;i++){plain.stepMonth();flagged.stepMonth();assert.equal(fingerprint(flagged),fingerprint(plain),`${seed}/${base}: all-eligible diagnostic changed economic state at month ${i+1}`);}
  return true;
}

function runRegime(seed,base,share){
  const w=buildWorld(seed,base);assignEligibility(w,seed,share);const rows=[];
  for(let i=0;i<months;i++){
    w.stepMonth();
    for(const c of w.countries){
      const eligible=c.households.filter(h=>h.__diagnosticLaborEligible!==false),employedEligible=eligible.filter(h=>h.employed).length,need=laborNeed(c),desired=Math.max(EPS,need.desired),actualWorkers=S(c.firms.filter(f=>f.active!==false).map(f=>f.workers));
      rows.push({month:w.month,countryId:c.id,totalHouseholds:c.households.length,eligible:eligible.length,employedEligible,correctedUnemployment:1-employedEligible/Math.max(1,eligible.length),macroNonemployment:F(c.macro?.unemployment),desired:need.desired,viableNeed:need.viable,physicalNeed:need.physical,desiredToEligible:need.desired/Math.max(1,eligible.length),viableToEligible:need.viable/Math.max(1,eligible.length),physicalToEligible:need.physical/Math.max(1,eligible.length),targetFill:actualWorkers/desired,unfilled:F(c.lastMarkets?.labor?.unfilled),gdp:F(c.macro?.gdp),output:F(c.macro?.realOutput),arrears:F(c.macro?.wageArrears),activeFirms:F(c.macro?.activeFirms),exits:F(c.macro?.firmExits),transfers:F(c.macro?.governmentTransfers),transferRecipients:F(c.lastFiscal?.transferRecipients)});
    }
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${seed}/${base}/${share}: health`);
  const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${seed}/${base}/${share}: accounting`);
  return {seed,base,share,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__atNorm,meanEligible:M(rows.map(r=>r.eligible)),meanCorrectedUnemployment:M(rows.map(r=>r.correctedUnemployment)),terminalCorrectedUnemployment:M(rows.filter(r=>r.month>months-6).map(r=>r.correctedUnemployment)),meanMacroNonemployment:M(rows.map(r=>r.macroNonemployment)),meanDesiredToEligible:M(rows.map(r=>r.desiredToEligible)),shareMonthsDesiredExceedsEligible:rows.filter(r=>r.desiredToEligible>1).length/Math.max(1,rows.length),meanViableToEligible:M(rows.map(r=>r.viableToEligible)),shareMonthsViableExceedsEligible:rows.filter(r=>r.viableToEligible>1).length/Math.max(1,rows.length),meanPhysicalToEligible:M(rows.map(r=>r.physicalToEligible)),shareMonthsPhysicalExceedsEligible:rows.filter(r=>r.physicalToEligible>1).length/Math.max(1,rows.length),meanTargetFill:M(rows.map(r=>r.targetFill)),meanUnfilled:M(rows.map(r=>r.unfilled)),meanGdp:M(rows.map(r=>r.gdp)),meanOutput:M(rows.map(r=>r.output)),meanArrears:M(rows.map(r=>r.arrears)),meanActiveFirms:M(rows.map(r=>r.activeFirms)),totalExits:S(rows.map(r=>r.exits)),meanTransfers:M(rows.map(r=>r.transfers)),meanTransferRecipients:M(rows.map(r=>r.transferRecipients))};
}

const noninterference=[];for(const base of bases)for(const seed of seeds)noninterference.push({seed,base,ok:verifyAllEligibleNoninterference(seed,base)});
const runs=[];for(const base of bases)for(const seed of seeds)for(const share of shares)runs.push(runRegime(seed,base,share));
const report={workPackage:'WP-RV08-R4-AT',title:'Labor-Eligibility Causal Counterfactual — Current Transfer Semantics Preserved',note:'Diagnostic-only. Eligibility shares are causal sensitivity probes, not age/participation calibration. Noneligible agents remain in the existing household transfer system; this intentionally exposes the consequence of adding labor nonparticipants without redesigning fiscal/social-status semantics.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,shares,months},gates:{allEligibleNoninterference:noninterference.every(x=>x.ok),allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length*shares.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerOk:runs.every(r=>r.ledgerOk),accountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),ok:true},compact:runs.map(r=>({seed:r.seed,base:r.base,share:r.share,meanEligible:r.meanEligible,meanCorrectedUnemployment:r.meanCorrectedUnemployment,terminalCorrectedUnemployment:r.terminalCorrectedUnemployment,meanMacroNonemployment:r.meanMacroNonemployment,meanDesiredToEligible:r.meanDesiredToEligible,shareMonthsDesiredExceedsEligible:r.shareMonthsDesiredExceedsEligible,meanViableToEligible:r.meanViableToEligible,shareMonthsViableExceedsEligible:r.shareMonthsViableExceedsEligible,meanPhysicalToEligible:r.meanPhysicalToEligible,shareMonthsPhysicalExceedsEligible:r.shareMonthsPhysicalExceedsEligible,meanTargetFill:r.meanTargetFill,meanUnfilled:r.meanUnfilled,meanGdp:r.meanGdp,meanOutput:r.meanOutput,meanArrears:r.meanArrears,meanActiveFirms:r.meanActiveFirms,totalExits:r.totalExits,meanTransfers:r.meanTransfers,meanTransferRecipients:r.meanTransferRecipients})),noninterference,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact:report.compact},null,2));