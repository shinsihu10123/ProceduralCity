import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const R=(a,b)=>Math.abs(F(b))>EPS?F(a)/F(b):0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

const bases=['consumer','materials-consumer'];
const modes=[
  'control',
  'realized-cover',
  'capacity-cover',
  'recent-demand-cover',
  'cash-stock-cover',
  'multi-potential',
  'multi-potential-max2',
  'no-exit-upper'
];
const variants=bases.flatMap(base=>modes.map(mode=>({id:`${base}-${mode}`,base,mode})));

function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(scale,seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:scale,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__r4fNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__r4fNorm++;}
    }
    done.add(c.id);return out;
  };
}

function installPriorCapture(w){
  w.__r4fPrior=new Map();
  const begin=w.supply.beginMonth.bind(w.supply);
  w.supply.beginMonth=c=>{
    for(const f of c.firms)w.__r4fPrior.set(`${c.id}|${f.id}`,{sales:F(f.sales),revenue:F(f.revenue),inputSpend:F(f.inputSpend),output:F(f.output),cash:w.ledger.balance(f.accountId),arrears:F(f.wageArrears)});
    return begin(c);
  };
}

function deactive(c,f){
  f.active=false;f.desiredWorkers=0;f.desiredProduction=0;
  for(const h of c.households)if(h.employerId===f.id){h.employed=false;h.employerId=null;}
  f.workers=0;
}

function candidateSignals(w,c,f){
  const prior=w.__r4fPrior.get(`${c.id}|${f.id}`)||{};
  const cash=w.ledger.balance(f.accountId),workers=Math.max(0,F(f.workers)),wage=Math.max(EPS,F(f.wage)),payroll=wage*workers;
  const severePayrollStress=F(f.wageArrears)>Math.max(100,wage*Math.max(1,workers)*1.35),severeCreditStress=F(f.creditMisses)>=5,liquidityFailure=cash<F(f.safeCash)*.025&&severePayrollStress;
  const nextDistress=(liquidityFailure||severeCreditStress)?F(f.distressMonths)+1:Math.max(0,F(f.distressMonths)-1);
  const inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,inputCost=F(f.inputPerOutput)*inputPrice,margin=F(f.price)-inputCost,positiveMargin=Math.max(0,margin);
  const realizedContribution=Math.max(0,F(f.revenue)-F(f.inputSpend)),capacityContribution=positiveMargin*Math.max(0,F(f.capacity)),desiredContribution=positiveMargin*Math.max(0,F(f.desiredProduction)),recentContribution=positiveMargin*Math.max(0,F(prior.sales));
  const inventoryGrossValue=Math.max(0,F(f.inventory))*Math.max(0,F(f.price)),cashStock=Math.max(0,cash)+inventoryGrossValue;
  const realizedCover=payroll>EPS&&realizedContribution+TOL>=payroll,capacityCover=payroll>EPS&&capacityContribution+TOL>=payroll,recentDemandCover=payroll>EPS&&recentContribution+TOL>=payroll,cashStockCover=payroll>EPS&&cashStock+TOL>=payroll;
  return {cash,workers,wage,payroll,safeCash:F(f.safeCash),arrears:F(f.wageArrears),creditMisses:F(f.creditMisses),loanBalance:F(f.loanBalance),distressBefore:F(f.distressMonths),nextDistress,severePayrollStress,severeCreditStress,liquidityFailure,inputPrice,inputCost,margin,realizedContribution,capacityContribution,desiredContribution,recentContribution,inventoryUnits:Math.max(0,F(f.inventory)),inventoryGrossValue,cashStock,realizedCoverage:R(realizedContribution,payroll),capacityCoverage:R(capacityContribution,payroll),desiredCoverage:R(desiredContribution,payroll),recentCoverage:R(recentContribution,payroll),cashStockCoverage:R(cashStock,payroll),realizedCover,capacityCover,recentDemandCover,cashStockCover,output:F(f.output),sales:F(f.sales),revenue:F(f.revenue),inputSpend:F(f.inputSpend),priorSales:F(prior.sales),priorRevenue:F(prior.revenue),supplyShortage:F(f.supplyShortage),desiredProduction:F(f.desiredProduction),capacity:F(f.capacity),productivity:F(f.productivity),selected:String(f.currentPlan?.selected||f.currentPlan?.trace?.selected||'UNKNOWN'),cashStress:F(f.currentPlan?.trace?.perception?.cashStress)};
}

function guardEligible(mode,s,guardCount){
  if(mode==='no-exit-upper')return true;
  if(s.severeCreditStress)return false;
  if(mode==='realized-cover')return s.realizedCover;
  if(mode==='capacity-cover')return s.capacityCover;
  if(mode==='recent-demand-cover')return s.recentDemandCover;
  if(mode==='cash-stock-cover')return s.cashStockCover;
  if(mode==='multi-potential')return s.realizedCover||s.capacityCover||s.recentDemandCover||s.cashStockCover;
  if(mode==='multi-potential-max2')return guardCount<2&&(s.realizedCover||s.capacityCover||s.recentDemandCover||s.cashStockCover);
  return false;
}

function installExitMatrix(w,v){
  w.__r4fCandidates=[];w.__r4fGuardCount=new Map();w.__r4fGuards=0;w.__r4fGuardWorkers=0;w.__r4fCandidateWorkers=0;
  const original=w.supply.evaluateExits.bind(w.supply);
  if(v.mode==='control'){
    w.supply.evaluateExits=c=>{
      const before=[];
      for(const f of c.firms.filter(x=>x.active!==false)){
        const s=candidateSignals(w,c,f);if(s.nextDistress>=4)before.push({firm:f,s});
      }
      const out=original(c);
      for(const {firm,s} of before){w.__r4fCandidateWorkers+=s.workers;w.__r4fCandidates.push({variant:v.id,base:v.base,mode:v.mode,month:w.month,countryId:c.id,firmId:firm.id,industryId:firm.industryId,guarded:false,exited:firm.active===false,...s});}
      return out;
    };
    return;
  }
  w.supply.evaluateExits=c=>{
    const exited=[];
    for(const f of c.firms.filter(x=>x.active!==false)){
      const s=candidateSignals(w,c,f);f.distressMonths=s.nextDistress;
      if(f.distressMonths<4)continue;
      w.__r4fCandidateWorkers+=s.workers;
      const priorCount=F(w.__r4fGuardCount.get(f.id));
      const guarded=guardEligible(v.mode,s,priorCount);
      if(guarded){f.distressMonths=3;w.__r4fGuardCount.set(f.id,priorCount+1);w.__r4fGuards++;w.__r4fGuardWorkers+=s.workers;}
      else{deactive(c,f);exited.push(f.industryId);}
      w.__r4fCandidates.push({variant:v.id,base:v.base,mode:v.mode,month:w.month,countryId:c.id,firmId:f.id,industryId:f.industryId,guarded,exited:!guarded,priorGuardCount:priorCount,...s});
    }
    return exited;
  };
}

function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function digest(w){const h=createHash('sha256'),put=v=>h.update(JSON.stringify(v));put({month:w.month,rng:w.rng});for(const c of w.countries){put(c);put(w.accountingReport(c.id));}for(const e of w.ledger.entries)put(e);return h.digest('hex');}

function macroRow(w,v,scale,seed,c){const m=c.macro||{},ind=c.lastIndustry||{},sec=ind.sectorOutputs||{};return{variant:v.id,base:v.base,mode:v.mode,scaleProfile:scale,seed,month:w.month,countryId:c.id,unemployment:F(m.unemployment),exits:F(m.firmExits),entries:F(m.firmEntries),activeFirms:F(m.activeFirms),layoffs:F(m.layoffs),hires:F(m.hires),arrears:F(m.wageArrears),fulfillment:1-F(m.unmetDemandRatio),shortage:F(m.inputShortageUnits),resource:F(sec.RESOURCE,m.resourceOutput),materials:F(sec.MATERIALS,m.materialsOutput),consumer:F(sec.CONSUMER,m.consumerGoodsOutput),cash:F(m.firmCash),sales:F(m.nominalSales),gdp:F(m.gdp),gdpResidual:gdpResidual(m),ledgerOk:w.ledger.verifyCountry(c.id)?.ok===true};}

function run(v,scale,seed,h,instrument=true,capture=false){
  const w=makeWorld(scale,seed);installNormalization(w,v.base);installPriorCapture(w);if(instrument)installExitMatrix(w,v);
  const rows=[];for(let i=0;i<h;i++){w.stepMonth();for(const c of w.countries)rows.push(macroRow(w,v,scale,seed,c));}
  const health=w.forceHealthCheck();assert.ok(health.ok,`${v.id}/${scale}/${seed}: health`);
  const generalOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false);
  return{variant:v.id,scaleProfile:scale,seed,rows,candidates:instrument?w.__r4fCandidates:[],normalizationApps:w.__r4fNorm||0,guards:w.__r4fGuards||0,guardWorkers:w.__r4fGuardWorkers||0,candidateWorkers:w.__r4fCandidateWorkers||0,health,generalOk,fingerprint:capture?digest(w):null};
}

const niScale=scales[0],niSeed='ECON-RV08-R4F-NI',niH=Math.min(4,months),control=variants.find(v=>v.base==='consumer'&&v.mode==='control');
const niRaw=run(control,niScale,niSeed,niH,false,true).fingerprint,niObserved=run(control,niScale,niSeed,niH,true,true).fingerprint,controlObserverNonInterferenceExact=niRaw===niObserved;assert.ok(controlObserverNonInterferenceExact,'control observer non-interference');

const deterministic=[];for(const v of variants)for(const scale of scales){const seed=`ECON-RV08-R4F-DET-${v.id}-${scale}`,h=Math.min(3,months),a=run(v,scale,seed,h,true,true).fingerprint,b=run(v,scale,seed,h,true,true).fingerprint;assert.equal(a,b,`${v.id}/${scale}: deterministic`);deterministic.push({variant:v.id,scaleProfile:scale,exact:true});}
const runs=[];for(const v of variants)for(const scale of scales)for(const seed of seeds)runs.push(run(v,scale,seed,months,true,false));
const rows=runs.flatMap(r=>r.rows),candidates=runs.flatMap(r=>r.candidates.map(x=>({...x,scaleProfile:r.scaleProfile,seed:r.seed})));
const windows=[['M1-3',1,Math.min(3,months)],['M4-6',4,Math.min(6,months)],['M7-9',7,Math.min(9,months)],['M10-12',10,Math.min(12,months)],['M13-18',13,Math.min(18,months)],['M19-24',19,months],['FULL',1,months]].filter(x=>x[1]<=x[2]);
function agg(rs){return{countryMonths:rs.length,unemployment:M(rs.map(x=>x.unemployment)),exits:S(rs.map(x=>x.exits)),entries:S(rs.map(x=>x.entries)),activeFirms:M(rs.map(x=>x.activeFirms)),layoffs:S(rs.map(x=>x.layoffs)),hires:S(rs.map(x=>x.hires)),arrears:M(rs.map(x=>x.arrears)),fulfillment:M(rs.map(x=>x.fulfillment)),shortage:M(rs.map(x=>x.shortage)),resource:M(rs.map(x=>x.resource)),materials:M(rs.map(x=>x.materials)),consumer:M(rs.map(x=>x.consumer)),cash:M(rs.map(x=>x.cash)),sales:M(rs.map(x=>x.sales))};}
const summary=[];for(const v of variants)for(const scale of scales)for(const[window,a,b]of windows)summary.push({variant:v.id,base:v.base,mode:v.mode,scaleProfile:scale,window,...agg(rows.filter(x=>x.variant===v.id&&x.scaleProfile===scale&&x.month>=a&&x.month<=b))});
function candidateAgg(rs){const n=rs.length;return{candidates:n,workers:S(rs.map(x=>x.workers)),guarded:n?rs.filter(x=>x.guarded).length:0,guardedShare:n?rs.filter(x=>x.guarded).length/n:0,realizedCoverShare:n?rs.filter(x=>x.realizedCover).length/n:0,capacityCoverShare:n?rs.filter(x=>x.capacityCover).length/n:0,recentDemandCoverShare:n?rs.filter(x=>x.recentDemandCover).length/n:0,cashStockCoverShare:n?rs.filter(x=>x.cashStockCover).length/n:0,severeCreditShare:n?rs.filter(x=>x.severeCreditStress).length/n:0,liquidityFailureShare:n?rs.filter(x=>x.liquidityFailure).length/n:0,meanRealizedCoverage:M(rs.map(x=>x.realizedCoverage)),meanCapacityCoverage:M(rs.map(x=>x.capacityCoverage)),meanRecentCoverage:M(rs.map(x=>x.recentCoverage)),meanCashStockCoverage:M(rs.map(x=>x.cashStockCoverage)),meanSupplyShortage:M(rs.map(x=>x.supplyShortage)),meanInventoryGrossValue:M(rs.map(x=>x.inventoryGrossValue))};}
const candidateSummary=[];for(const v of variants)for(const scale of scales)for(const[window,a,b]of windows)candidateSummary.push({variant:v.id,base:v.base,mode:v.mode,scaleProfile:scale,window,...candidateAgg(candidates.filter(x=>x.variant===v.id&&x.scaleProfile===scale&&x.month>=a&&x.month<=b))});
const comparisons={};for(const scale of scales){comparisons[scale]={};for(const base of bases){comparisons[scale][base]={};for(const[window]of windows){const q=mode=>summary.find(x=>x.scaleProfile===scale&&x.base===base&&x.mode===mode&&x.window===window),a=q('control');comparisons[scale][base][window]={};for(const mode of modes.slice(1)){const b=q(mode);comparisons[scale][base][window][mode]={du:b.unemployment-a.unemployment,dexits:b.exits-a.exits,darrears:b.arrears-a.arrears,dfulfill:b.fulfillment-a.fulfillment,dshortage:b.shortage-a.shortage,consumerRatio:R(b.consumer,a.consumer),dcash:b.cash-a.cash};}}}}
const maxGdp=Math.max(0,...rows.map(x=>Math.abs(x.gdpResidual))),guardRuns=runs.filter(r=>!r.variant.endsWith('-control')&&!r.variant.endsWith('-no-exit-upper')),upperRuns=runs.filter(r=>r.variant.endsWith('-no-exit-upper'));
const gates={controlObserverNonInterferenceExact,deterministicReplayExact:deterministic.every(x=>x.exact),allHealthy:runs.every(r=>r.health.ok),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,normalizationActivated:S(runs.map(r=>r.normalizationApps))>0,candidatesObserved:candidates.length>0,selectiveGuardActivated:S(guardRuns.map(r=>r.guards))>0,noExitUpperActivated:S(upperRuns.map(r=>r.guards))>0,noExitUpperReportsZeroExits:rows.filter(x=>x.mode==='no-exit-upper').every(x=>Math.abs(x.exits)<TOL),ledgerCountriesOk:rows.every(x=>x.ledgerOk),generalAccountingOk:runs.every(r=>r.generalOk),gdpIdentityReconciled:maxGdp<TOL,finiteRows:rows.every(x=>Number.isFinite(x.unemployment)&&Number.isFinite(x.arrears)),finiteCandidates:candidates.every(x=>Number.isFinite(x.capacityCoverage)&&Number.isFinite(x.cashStockCoverage))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`R4F gates ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.scaleProfile==='baseline'&&x.window==='FULL').map(x=>({variant:x.variant,u:+x.unemployment.toFixed(4),exits:x.exits,arrears:+x.arrears.toFixed(0),fulfill:+x.fulfillment.toFixed(3),short:+x.shortage.toFixed(1),layoffs:x.layoffs,consumer:+x.consumer.toFixed(1),cash:+x.cash.toFixed(0)})));
console.table(candidateSummary.filter(x=>x.scaleProfile==='baseline'&&x.window==='FULL').map(x=>({variant:x.variant,candidates:x.candidates,guardShare:+x.guardedShare.toFixed(3),realized:+x.realizedCoverShare.toFixed(3),capacity:+x.capacityCoverShare.toFixed(3),recent:+x.recentDemandCoverShare.toFixed(3),cashStock:+x.cashStockCoverShare.toFixed(3),credit:+x.severeCreditShare.toFixed(3),liq:+x.liquidityFailureShare.toFixed(3)})));
console.log('WP_RV08_R4F_GATES',JSON.stringify(gates));console.log('WP_RV08_R4F_COMPARISONS',JSON.stringify(comparisons));
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify({workPackage:'WP-RV08-R4F',title:'Exit-candidate counterfactual viability matrix',generatedAt:new Date().toISOString(),configuration:{variants,scales,seeds,months},gates,summary,candidateSummary,comparisons,candidates,rows},null,2));console.log('WP_RV08_R4F_OUTPUT',outputJson);}
