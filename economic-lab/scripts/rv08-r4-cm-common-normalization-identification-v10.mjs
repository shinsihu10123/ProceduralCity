import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seed=(process.env.DIAG_SEED||'ECON-RV02-A').trim();
const months=Math.max(1,Math.round(Number(process.env.DIAG_MONTHS||24)));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-9;
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const q=(a,p)=>{if(!a.length)return 0;const x=[...a].sort((m,n)=>m-n);const i=(x.length-1)*p;const lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?x[lo]:x[lo]+(x[hi]-x[lo])*(i-lo)};
const stats=a=>({n:a.length,p25:q(a,.25),median:q(a,.5),p75:q(a,.75),p90:q(a,.9)});
function digest(world){const h=createHash('sha256');h.update(JSON.stringify({month:world.month,rng:world.rng}));for(const c of world.countries)h.update(JSON.stringify(c));h.update(JSON.stringify(world.ledger.entries));return h.digest('hex');}
function payroll(entries,accountId){let x=0;for(const e of entries){if(!/wage|payroll/i.test(String(e.kind||'')))continue;for(const p of e.postings||[])if(String(p.accountId)===String(accountId)&&finite(p.delta)<0)x+=-finite(p.delta);}return x;}
function run(){
 const world=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
 const firmRows=[],countryRows=[];
 for(let i=0;i<months;i++){
  world.stepMonth();
  const monthEntries=world.ledger.entriesFor({month:world.month});
  for(const c of world.countries){
   const entries=monthEntries.filter(e=>String(e.countryId)===String(c.id));
   let consumerCapacityValue=0,consumerOutputValue=0;
   for(const f of c.firms||[]){
    if(f.active===false)continue;
    const price=Math.max(EPS,finite(f.price));
    const cap=Math.max(0,finite(f.capacity));
    const out=Math.max(0,finite(f.output));
    if(f.consumerFacing===true){consumerCapacityValue+=cap*price;consumerOutputValue+=out*price;}
    const pay=payroll(entries,f.accountId);
    if(pay>EPS&&cap*price>EPS)firmRows.push({month:world.month,countryId:String(c.id),industryId:String(f.industryId),firmId:String(f.id),payroll:pay,capacityValue:cap*price,outputValue:out*price,requiredFactor:pay/(cap*price),outputRequiredFactor:out*price>EPS?pay/(out*price):null});
   }
   const desired=Math.max(0,finite(c.lastMarkets?.goods?.desiredBudget));
   if(desired>EPS&&consumerCapacityValue>EPS)countryRows.push({month:world.month,countryId:String(c.id),desiredBudget:desired,consumerCapacityValue,consumerOutputValue,demandRequiredFactor:desired/consumerCapacityValue,outputDemandRequiredFactor:consumerOutputValue>EPS?desired/consumerOutputValue:null});
  }
 }
 const health=world.forceHealthCheck();
 const accounting=world.countries.every(c=>world.ledger.verifyCountry(c.id)?.ok===true&&world.accounting.verifyCountry(c,world.ledger,world.month)?.ok!==false);
 return {world,firmRows,countryRows,digest:digest(world),healthy:health.ok===true&&accounting};
}
function group(rows,key,field){const m=new Map();for(const r of rows){const k=String(r[key]);if(!m.has(k))m.set(k,[]);const v=r[field];if(Number.isFinite(v)&&v>0)m.get(k).push(v);}return Object.fromEntries([...m].map(([k,v])=>[k,stats(v)]));}
const a=run(),b=run();
const firmFactors=a.firmRows.map(r=>r.requiredFactor).filter(v=>Number.isFinite(v)&&v>0);
const demandFactors=a.countryRows.map(r=>r.demandRequiredFactor).filter(v=>Number.isFinite(v)&&v>0);
const fs=stats(firmFactors),ds=stats(demandFactors);
const iqrOverlap=Math.max(0,Math.min(fs.p75,ds.p75)-Math.max(fs.p25,ds.p25));
const iqrUnion=Math.max(fs.p75,ds.p75)-Math.min(fs.p25,ds.p25);
const overlapShare=iqrUnion>EPS?iqrOverlap/iqrUnion:1;
const candidates=[fs.median,ds.median,Math.sqrt(Math.max(EPS,fs.median*ds.median))].filter((v,i,x)=>Number.isFinite(v)&&v>0&&x.findIndex(z=>Math.abs(Math.log(z/v))<1e-9)===i);
const candidateResults=candidates.map(k=>({factor:k,payrollResidualShare:a.firmRows.filter(r=>r.capacityValue*k+EPS<r.payroll).length/Math.max(1,a.firmRows.length),medianDemandResidual:q(a.countryRows.map(r=>r.desiredBudget/Math.max(EPS,r.consumerCapacityValue*k)),.5)}));
const summary={firmRequired:fs,demandRequired:ds,medianRatioDemandToFirm:ds.median/Math.max(EPS,fs.median),iqrOverlapShare:overlapShare,candidates:candidateResults,scalarPlausible:overlapShare>=0.25&&ds.median/fs.median>=0.25&&ds.median/fs.median<=4};
const gates={noMutationByAudit:true,exactDiagnosticReplay:JSON.stringify(a.firmRows)===JSON.stringify(b.firmRows)&&JSON.stringify(a.countryRows)===JSON.stringify(b.countryRows),exactCanonicalReplay:a.digest===b.digest,hardAccountingHealthy:a.healthy&&b.healthy,finitePositiveFactors:firmFactors.length>0&&demandFactors.length>0&&firmFactors.every(v=>Number.isFinite(v)&&v>0)&&demandFactors.every(v=>Number.isFinite(v)&&v>0),observationsPresent:a.firmRows.length>0&&a.countryRows.length>0,allCountriesObserved:new Set(a.countryRows.map(r=>r.countryId)).size===4,allIndustriesObserved:new Set(a.firmRows.map(r=>r.industryId)).size===4};gates.ok=Object.values(gates).every(Boolean);
const result={workPackage:'WP-RV08-R4-CM',seed,months,gates,summary,cohorts:{firmCountry:group(a.firmRows,'countryId','requiredFactor'),industry:group(a.firmRows,'industryId','requiredFactor'),demandCountry:group(a.countryRows,'countryId','demandRequiredFactor')},worldDigest:a.digest};
console.log('WP_RV08_R4_CM_GATES',JSON.stringify(gates));console.log('WP_RV08_R4_CM_SUMMARY',JSON.stringify(summary));console.log('WP_RV08_R4_CM_COHORTS',JSON.stringify(result.cohorts));console.log('WP_RV08_R4_CM_WORLD_DIGEST',a.digest);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(result,null,2));console.log('WP_RV08_R4_CM_OUTPUT',outputJson);}assert.equal(gates.ok,true,`${seed}: R4-CM gate failed`);
