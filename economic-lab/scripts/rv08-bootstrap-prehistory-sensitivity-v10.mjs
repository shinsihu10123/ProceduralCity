import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'unit,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const variants=(process.env.DIAG_VARIANTS||'control,input-buffer,grace6,input-buffer-grace6').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(18,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='materials-consumer'?new Set(['MATERIALS','CONSUMER']):new Set();}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installNormalization(w,base){const target=targetSectors(base),done=new Set();w.__axNorm=0;if(!target.size)return;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__axNorm++;}}done.add(c.id);return out;};}

function seedOpeningInputs(w){
  let firms=0,units=0,value=0;
  for(const c of w.countries){
    for(const f of c.firms.filter(x=>x.active!==false&&x.inputProduct)){
      const price=supplierMean(c,f.inputProduct);if(price<=EPS)continue;
      const qty=Math.max(0,unconstrainedPlan(f)*F(f.inputPerOutput));if(qty<=EPS)continue;
      const book=qty*price;
      f.inputInventory[f.inputProduct]=(F(f.inputInventory[f.inputProduct])+qty);
      f.inputBookValues[f.inputProduct]=(F(f.inputBookValues[f.inputProduct])+book);
      w.accounting.gl.post({month:0,entityId:f.id,kind:'diagnostic_inherited_input_buffer',lines:[{account:'input_inventory',debit:book},{account:'opening_equity',credit:book}],meta:{product:f.inputProduct,units:qty,diagnosticOnly:true}});
      firms++;units+=qty;value+=book;
    }
  }
  return{firms,units,value};
}
function installStartupGrace(w,graceMonths){
  if(graceMonths<=0)return;
  const original=w.supply.evaluateExits.bind(w.supply);
  w.supply.evaluateExits=c=>{
    if(w.month<=graceMonths){for(const f of c.firms.filter(x=>x.active!==false))f.distressMonths=0;return[];}
    return original(c);
  };
}
function buildWorld(seed,base,variant){
  const w=makeWorld(seed);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});installNormalization(w,base);
  const input=variant.includes('input-buffer')?seedOpeningInputs(w):{firms:0,units:0,value:0};
  const grace=variant.includes('grace6')?6:0;installStartupGrace(w,grace);
  return{w,input,grace};
}
function row(c,w){return{month:w.month,countryId:c.id,u:F(c.macro?.unemployment),gdp:F(c.macro?.gdp),output:F(c.macro?.realOutput),arrears:F(c.macro?.wageArrears),active:F(c.macro?.activeFirms),exits:F(c.macro?.firmExits),entries:F(c.macro?.firmEntries),credit:F(c.macro?.newCredit),defaults:F(c.macro?.loanDefaults),inputShortage:F(c.macro?.inputShortageUnits),unmet:F(c.macro?.unmetDemandRatio),unfilled:F(c.macro?.unfilledJobs),transfers:F(c.macro?.governmentTransfers)};}
function wmean(rows,a,b,k){return M(rows.filter(r=>r.month>=a&&r.month<=b).map(r=>r[k]));}
function wsum(rows,a,b,k){return S(rows.filter(r=>r.month>=a&&r.month<=b).map(r=>r[k]));}
function runOne(seed,base,variant){
  const {w,input,grace}=buildWorld(seed,base,variant),rows=[];
  for(let i=0;i<months;i++){w.stepMonth();for(const c of w.countries)rows.push(row(c,w));}
  const health=w.forceHealthCheck();const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${seed}/${base}/${variant}: accounting`);
  const terminal=rows.filter(r=>r.month===months),post=rows.filter(r=>r.month>=13);
  return{seed,base,variant,months,grace,input,healthOk:health.ok,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__axNorm,meanUnemployment:M(rows.map(r=>r.u)),terminalUnemployment:M(terminal.map(r=>r.u)),terminalActiveFirms:M(terminal.map(r=>r.active)),terminalGdp:M(terminal.map(r=>r.gdp)),terminalOutput:M(terminal.map(r=>r.output)),terminalArrears:M(terminal.map(r=>r.arrears)),totalExits:S(rows.map(r=>r.exits)),first6Exits:wsum(rows,1,6,'exits'),m7_12Exits:wsum(rows,7,12,'exits'),post12Exits:S(post.map(r=>r.exits)),first6Credit:wsum(rows,1,6,'credit'),first6Arrears:wmean(rows,1,6,'arrears'),first6InputShortage:wmean(rows,1,6,'inputShortage'),first6Unmet:wmean(rows,1,6,'unmet'),m7_12Unemployment:wmean(rows,7,12,'u'),m7_12Gdp:wmean(rows,7,12,'gdp'),m7_12Arrears:wmean(rows,7,12,'arrears'),m13_24Unemployment:wmean(rows,13,24,'u'),m13_24Gdp:wmean(rows,13,24,'gdp'),m13_24Output:wmean(rows,13,24,'output'),m13_24Arrears:wmean(rows,13,24,'arrears'),m13_24InputShortage:wmean(rows,13,24,'inputShortage'),m13_24Unmet:wmean(rows,13,24,'unmet')};
}

const runs=[];for(const base of bases)for(const seed of seeds)for(const variant of variants)runs.push(runOne(seed,base,variant));
const report={workPackage:'WP-RV08-R4-AX',title:'Bootstrap / Opening Stock-Flow / Startup Grace Sensitivity',note:'Diagnostic-only. Opening input buffers are inherited one-round intermediate stocks financed by opening equity; startup grace resets distress and suppresses exits only for months 1-6. Neither intervention is a proposed canonical repair or empirical calibration.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,variants,months},gates:{completeCoverage:runs.length===seeds.length*bases.length*variants.length,accountingOk:runs.every(r=>r.accountingOk),ledgerOk:runs.every(r=>r.ledgerOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),healthRecorded:runs.every(r=>typeof r.healthOk==='boolean'),normalizationActivated:runs.filter(r=>r.base==='materials-consumer').every(r=>r.normalizationApps>0),ok:true},compact:runs.map(r=>({seed:r.seed,base:r.base,variant:r.variant,inputFirms:r.input.firms,inputValue:r.input.value,terminalUnemployment:r.terminalUnemployment,terminalActiveFirms:r.terminalActiveFirms,terminalGdp:r.terminalGdp,terminalOutput:r.terminalOutput,terminalArrears:r.terminalArrears,totalExits:r.totalExits,first6Credit:r.first6Credit,first6Arrears:r.first6Arrears,first6InputShortage:r.first6InputShortage,first6Unmet:r.first6Unmet,m7_12Unemployment:r.m7_12Unemployment,m7_12Arrears:r.m7_12Arrears,m13_24Unemployment:r.m13_24Unemployment,m13_24Gdp:r.m13_24Gdp,m13_24Output:r.m13_24Output,m13_24Arrears:r.m13_24Arrears,m13_24InputShortage:r.m13_24InputShortage,m13_24Unmet:r.m13_24Unmet})),runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact:report.compact},null,2));
