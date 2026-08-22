import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed=(process.env.DIAG_SEED||'ECON-RV02-A').trim();
const variant=(process.env.DIAG_VARIANT||'control').trim();
const months=Math.max(18,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));
const allowed=new Set(['control','legacy-firms','legacy-households','legacy-both']);
assert.ok(allowed.has(variant),`unknown variant ${variant}`);

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function installNormalization(w){const target=new Set(['MATERIALS','CONSUMER']),done=new Set();w.__bc2Norm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),cap=F(f.capacity),required=margin>EPS&&cap>EPS?payroll/(margin*cap):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=cap*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__bc2Norm++;}}done.add(c.id);return out;};}
function latestDecision(a){const d=a?.cognition?.decisions||[];return d.length?d[d.length-1]?.selected||null:null;}
function firmAction(f){return f.currentPlan?.selected||f.currentPlan?.name||latestDecision(f);}
function householdAction(h){return h.lastTrace?.selected||latestDecision(h);}
function actionStats(values){const a=values.filter(Boolean),counts=new Map();for(const v of a)counts.set(v,(counts.get(v)||0)+1);if(!a.length)return{n:0,topShare:0,entropy:0,unique:0};const cs=[...counts.values()],top=Math.max(...cs)/a.length,entropy=-S(cs.map(k=>{const p=k/a.length;return p*Math.log(p);})),den=Math.log(Math.max(2,counts.size));return{n:a.length,topShare:top,entropy:den>0?entropy/den:0,unique:counts.size};}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function applyVariant(w){const legacyF=variant==='legacy-firms'||variant==='legacy-both',legacyH=variant==='legacy-households'||variant==='legacy-both';for(const c of w.countries){for(const f of c.firms)if(legacyF&&f.cognition)f.cognition.enabled=false;for(const h of c.households)if(legacyH&&h.cognition)h.cognition.enabled=false;}if(legacyF){const original=w.createEntrant.bind(w);w.createEntrant=(country,industryId)=>{const f=original(country,industryId);if(f.cognition)f.cognition.enabled=false;return f;};}return{legacyF,legacyH};}

const w=makeWorld();
for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});
installNormalization(w);
const mode=applyVariant(w),rows=[];
for(let i=0;i<months;i++){
  w.stepMonth();
  for(const c of w.countries){const active=c.firms.filter(f=>f.active!==false),consumer=active.filter(f=>f.industryId==='CONSUMER'),fs=actionStats(active.map(firmAction)),cs=actionStats(consumer.map(firmAction)),hs=actionStats(c.households.map(householdAction)),m=c.macro||{};rows.push({month:w.month,countryId:c.id,activeCount:active.length,consumerCount:consumer.length,firmObserved:fs.n,consumerObserved:cs.n,firmTop:fs.topShare,firmEntropy:fs.entropy,consumerTop:cs.topShare,consumerEntropy:cs.entropy,houseTop:hs.topShare,houseEntropy:hs.entropy,u:F(m.unemployment),gdp:F(m.gdp),output:F(m.realOutput),arrears:F(m.wageArrears),active:F(m.activeFirms),consumption:F(m.consumption)});}
}
const health=w.forceHealthCheck(),accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5),observationOk=rows.every(r=>r.activeCount===0||r.firmObserved>0)&&rows.every(r=>r.consumerCount===0||r.consumerObserved>0);
assert.ok(accountingOk&&ledgerOk&&gdpOk&&observationOk&&w.__bc2Norm>0,`${seed}/${variant}: gate failure`);
const late=rows.filter(r=>r.month>=13),terminal=rows.filter(r=>r.month===months);
const compact={seed,variant,months,...mode,healthOk:health.ok,accountingOk,ledgerOk,gdpOk,observationOk,normalizationApps:w.__bc2Norm,meanFirmTop:M(rows.map(r=>r.firmTop)),meanFirmEntropy:M(rows.map(r=>r.firmEntropy)),meanConsumerTop:M(rows.map(r=>r.consumerTop)),meanConsumerEntropy:M(rows.map(r=>r.consumerEntropy)),meanHouseTop:M(rows.map(r=>r.houseTop)),meanHouseEntropy:M(rows.map(r=>r.houseEntropy)),meanUnemployment:M(rows.map(r=>r.u)),lateUnemployment:M(late.map(r=>r.u)),terminalUnemployment:M(terminal.map(r=>r.u)),terminalGdp:M(terminal.map(r=>r.gdp)),terminalOutput:M(terminal.map(r=>r.output)),terminalArrears:M(terminal.map(r=>r.arrears)),terminalActive:M(terminal.map(r=>r.active)),lateConsumption:M(late.map(r=>r.consumption))};
const report={workPackage:'WP-RV08-R4-BC2',title:'Corrected Cognitive Synchronization Attribution',note:'Observer correction: legacy firm plan name is now counted. No canonical repair.',generatedAt:new Date().toISOString(),configuration:{seed,variant,months,base:'materials-consumer'},gates:{healthOk:health.ok,accountingOk,ledgerOk,gdpIdentityArithmetic:gdpOk,observationCoverage:observationOk,normalizationActivated:w.__bc2Norm>0,ok:true},compact};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
