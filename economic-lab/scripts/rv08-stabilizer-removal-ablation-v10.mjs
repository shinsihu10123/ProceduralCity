import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed=(process.env.DIAG_SEED||'ECON-RV02-A').trim();
const variant=(process.env.DIAG_VARIANT||'control').trim();
const months=Math.max(24,Number(process.env.DIAG_MONTHS||36));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

const allowed=new Set(['control','no-transfers','no-government-demand','no-new-credit','no-fiscal-stabilizers','no-stabilizers']);
assert.ok(allowed.has(variant),`unknown variant ${variant}`);

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function installNormalization(w){const target=new Set(['MATERIALS','CONSUMER']),done=new Set();w.__beNorm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),cap=F(f.capacity),required=margin>EPS&&cap>EPS?payroll/(margin*cap):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=cap*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__beNorm++;}}done.add(c.id);return out;};}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installRemoval(w){
  const removeTransfers=variant==='no-transfers'||variant==='no-fiscal-stabilizers'||variant==='no-stabilizers';
  const removeGovDemand=variant==='no-government-demand'||variant==='no-fiscal-stabilizers'||variant==='no-stabilizers';
  const removeCredit=variant==='no-new-credit'||variant==='no-stabilizers';
  if(removeTransfers){w.fiscal.payAutomaticTransfers=()=>0;}
  if(removeGovDemand){w.fiscal.executeGovernmentDemand=(country,month)=>{const g=country.governments?.[0];if(g)g.lastDemandMonth=month;return 0;};}
  if(removeCredit){w.banking.originateCredit=country=>{const m=w.banking.emptyMetrics();m.outstandingLoans=(country.loans||[]).reduce((s,l)=>s+(l.status==='active'?F(l.outstanding):0),0);return m;};}
  return{removeTransfers,removeGovDemand,removeCredit};
}

const w=makeWorld();
for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});
installNormalization(w);
const intervention=installRemoval(w);
const rows=[];
for(let i=0;i<months;i++){
  w.stepMonth();
  for(const c of w.countries){const m=c.macro||{};rows.push({month:w.month,countryId:c.id,u:F(m.unemployment),gdp:F(m.gdp),output:F(m.realOutput),arrears:F(m.wageArrears),active:F(m.activeFirms),exits:F(m.firmExits),entries:F(m.firmEntries),credit:F(m.newCredit),transfers:F(m.governmentTransfers),govDemand:F(m.governmentDemand),consumption:F(m.consumption),investment:F(m.grossInvestment)});}
}
const health=w.forceHealthCheck();
const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false);
const ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true);
const gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
const finiteOk=rows.every(r=>Object.values(r).every(v=>typeof v==='string'||Number.isFinite(v)));
assert.ok(accountingOk&&ledgerOk&&gdpOk&&finiteOk,`${seed}/${variant}: gate failure`);
const late=rows.filter(r=>r.month>=13),terminal=rows.filter(r=>r.month===months);
const compact={seed,variant,months,...intervention,healthOk:health.ok,accountingOk,ledgerOk,gdpOk,finiteOk,normalizationApps:w.__beNorm,meanUnemployment:M(rows.map(r=>r.u)),lateUnemployment:M(late.map(r=>r.u)),terminalUnemployment:M(terminal.map(r=>r.u)),terminalGdp:M(terminal.map(r=>r.gdp)),terminalOutput:M(terminal.map(r=>r.output)),terminalArrears:M(terminal.map(r=>r.arrears)),terminalActive:M(terminal.map(r=>r.active)),totalExits:S(rows.map(r=>r.exits)),totalEntries:S(rows.map(r=>r.entries)),totalCredit:S(rows.map(r=>r.credit)),totalTransfers:S(rows.map(r=>r.transfers)),totalGovDemand:S(rows.map(r=>r.govDemand)),totalConsumption:S(rows.map(r=>r.consumption)),totalInvestment:S(rows.map(r=>r.investment))};
assert.ok(w.__beNorm>0,`${seed}/${variant}: normalization inactive`);
const report={workPackage:'WP-RV08-R4-BE',title:'Existing Stabilizer Removal Causal Ablation',note:'Diagnostic removal ablation only. No stronger policy parameters or canonical repair.',generatedAt:new Date().toISOString(),configuration:{seed,variant,months,base:'materials-consumer'},gates:{healthOk:health.ok,accountingOk,ledgerOk,gdpIdentityArithmetic:gdpOk,finiteOk,normalizationActivated:w.__beNorm>0,completeMonths:rows.length===months*w.countries.length,ok:true},compact};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
