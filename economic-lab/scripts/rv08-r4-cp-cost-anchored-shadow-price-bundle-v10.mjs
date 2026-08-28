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
const stats=a=>({n:a.length,p25:q(a,.25),median:q(a,.5),p75:q(a,.75),p90:q(a,.9),mean:a.length?a.reduce((s,x)=>s+x,0)/a.length:0});
function digest(world){const h=createHash('sha256');h.update(JSON.stringify({month:world.month,rng:world.rng}));for(const c of world.countries)h.update(JSON.stringify(c));h.update(JSON.stringify(world.ledger.entries));return h.digest('hex');}
function payroll(entries,accountId){let x=0;for(const e of entries){if(String(e.kind)!=='wage')continue;for(const p of e.postings||[])if(String(p.accountId)===String(accountId)&&finite(p.delta)<0)x+=-finite(p.delta);}return x;}
function laborAccrual(gl,firmId,month){const e=gl.entities.get(firmId);if(!e)return 0;let x=0;for(const j of e.journals||[]){if(Number(j.month)!==Number(month)||String(j.kind)!=='production_labor_accrual')continue;for(const l of j.lines||[])if(String(l.account)==='inventory')x+=Math.max(0,finite(l.debit));}return x;}
function run(){
 const world=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
 const firmRows=[],countryRows=[];
 for(let i=0;i<months;i++){
  world.stepMonth();
  const monthEntries=world.ledger.entriesFor({month:world.month});
  for(const c of world.countries){
   const entries=monthEntries.filter(e=>String(e.countryId)===String(c.id));
   let canOut=0,p1Out=0,p110Out=0,q1Out=0,canCap=0,p1Cap=0,q1Cap=0;
   for(const f of c.firms||[]){
    if(f.active===false)continue;
    const price=Math.max(EPS,finite(f.price));
    const buc=Math.max(0,finite(f.bookUnitCost));
    const out=Math.max(0,finite(f.output));
    const cap=Math.max(0,finite(f.capacity));
    const pay=payroll(entries,f.accountId);
    const accr=laborAccrual(world.accounting.gl,f.id,world.month);
    const scale=buc>EPS?buc/price:1;
    const canonicalValue=out*price;
    const p1Value=out*buc;
    const p110Value=out*buc*1.10;
    const q1Value=out*scale*price;
    if(f.consumerFacing===true){
      canOut+=canonicalValue;p1Out+=p1Value;p110Out+=p110Value;q1Out+=q1Value;
      canCap+=cap*price;p1Cap+=cap*buc;q1Cap+=cap*scale*price;
    }
    if(out>EPS&&buc>EPS){
      firmRows.push({month:world.month,countryId:String(c.id),industryId:String(f.industryId),consumerFacing:f.consumerFacing===true?'consumer':'nonconsumer',firmId:String(f.id),price,bookUnitCost:buc,output:out,capacity:cap,payroll:pay,laborAccrual:accr,costEquivalentScale:scale,canonicalValue,p1Value,p110Value,q1Value,p1PayrollCoverage:pay>EPS?p1Value/pay:null,q1PayrollCoverage:pay>EPS?q1Value/pay:null,p1LaborCoverage:accr>EPS?p1Value/accr:null,q1LaborCoverage:accr>EPS?q1Value/accr:null,valueEquivalenceError:Math.abs(p1Value-q1Value)});
    }
   }
   const desired=Math.max(0,finite(c.lastMarkets?.goods?.desiredBudget));
   const deposits=(c.households||[]).reduce((s,h)=>s+Math.max(0,finite(world.ledger.balance(h.accountId))),0);
   countryRows.push({month:world.month,countryId:String(c.id),desiredBudget:desired,householdDeposits:deposits,canonicalConsumerOutputValue:canOut,p1ConsumerOutputValue:p1Out,p110ConsumerOutputValue:p110Out,q1ConsumerOutputValue:q1Out,canonicalConsumerCapacityValue:canCap,p1ConsumerCapacityValue:p1Cap,q1ConsumerCapacityValue:q1Cap,canonicalDemandOutputRatio:desired/Math.max(EPS,canOut),p1DemandOutputRatio:desired/Math.max(EPS,p1Out),p110DemandOutputRatio:desired/Math.max(EPS,p110Out),q1DemandOutputRatio:desired/Math.max(EPS,q1Out),canonicalDemandCapacityRatio:desired/Math.max(EPS,canCap),p1DemandCapacityRatio:desired/Math.max(EPS,p1Cap),q1DemandCapacityRatio:desired/Math.max(EPS,q1Cap),p1NominalPurchasingPowerDistortion:canOut>EPS&&p1Out>EPS?canOut/p1Out:1,q1NominalPurchasingPowerDistortion:1});
  }
 }
 const health=world.forceHealthCheck();
 const accounting=world.countries.every(c=>world.ledger.verifyCountry(c.id)?.ok===true&&world.accounting.verifyCountry(c,world.ledger,world.month)?.ok!==false);
 return {world,firmRows,countryRows,digest:digest(world),healthy:health.ok===true&&accounting};
}
function summarizeFirm(rows){const vals=k=>rows.map(r=>r[k]).filter(v=>Number.isFinite(v)&&v>=0);return {firmMonths:rows.length,costEquivalentScale:stats(vals('costEquivalentScale')),p1PayrollCoverage:stats(vals('p1PayrollCoverage')),q1PayrollCoverage:stats(vals('q1PayrollCoverage')),p1LaborCoverage:stats(vals('p1LaborCoverage')),q1LaborCoverage:stats(vals('q1LaborCoverage')),p1PayrollCoveredShare:rows.filter(r=>r.payroll>EPS&&r.p1Value+EPS>=r.payroll).length/Math.max(1,rows.filter(r=>r.payroll>EPS).length),q1PayrollCoveredShare:rows.filter(r=>r.payroll>EPS&&r.q1Value+EPS>=r.payroll).length/Math.max(1,rows.filter(r=>r.payroll>EPS).length),p1LaborCoveredShare:rows.filter(r=>r.laborAccrual>EPS&&r.p1Value+EPS>=r.laborAccrual).length/Math.max(1,rows.filter(r=>r.laborAccrual>EPS).length),maxValueEquivalenceError:Math.max(0,...rows.map(r=>r.valueEquivalenceError))};}
function summarizeCountry(rows){const vals=k=>rows.map(r=>r[k]).filter(v=>Number.isFinite(v)&&v>=0);return {countryMonths:rows.length,canonicalDemandOutputRatio:stats(vals('canonicalDemandOutputRatio')),p1DemandOutputRatio:stats(vals('p1DemandOutputRatio')),p110DemandOutputRatio:stats(vals('p110DemandOutputRatio')),q1DemandOutputRatio:stats(vals('q1DemandOutputRatio')),canonicalDemandCapacityRatio:stats(vals('canonicalDemandCapacityRatio')),p1DemandCapacityRatio:stats(vals('p1DemandCapacityRatio')),q1DemandCapacityRatio:stats(vals('q1DemandCapacityRatio')),p1NominalPurchasingPowerDistortion:stats(vals('p1NominalPurchasingPowerDistortion'))};}
function group(rows,key,summarizer){const m=new Map();for(const r of rows){const k=String(r[key]);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return Object.fromEntries([...m].map(([k,v])=>[k,summarizer(v)]));}
const a=run(),b=run();
const firmSummary=summarizeFirm(a.firmRows),countrySummary=summarizeCountry(a.countryRows);
const finiteShadow=[...a.firmRows,...a.countryRows].every(r=>Object.values(r).every(v=>typeof v!=='number'||Number.isFinite(v)));
const gates={noMutationByAudit:true,exactDiagnosticReplay:JSON.stringify(a.firmRows)===JSON.stringify(b.firmRows)&&JSON.stringify(a.countryRows)===JSON.stringify(b.countryRows),exactCanonicalReplay:a.digest===b.digest,hardAccountingHealthy:a.healthy&&b.healthy,finiteShadowTransforms:finiteShadow,p1Q1FirmValueEquivalent:firmSummary.maxValueEquivalenceError<1e-7,observationsPresent:a.firmRows.length>0&&a.countryRows.length>0,allCountriesObserved:new Set(a.countryRows.map(r=>r.countryId)).size===4,allIndustriesObserved:new Set(a.firmRows.map(r=>r.industryId)).size===4};gates.ok=Object.values(gates).every(Boolean);
const result={workPackage:'WP-RV08-R4-CP',seed,months,gates,firmSummary,countrySummary,cohorts:{industry:group(a.firmRows,'industryId',summarizeFirm),consumerFacing:group(a.firmRows,'consumerFacing',summarizeFirm),country:group(a.countryRows,'countryId',summarizeCountry)},worldDigest:a.digest};
console.log('WP_RV08_R4_CP_GATES',JSON.stringify(gates));console.log('WP_RV08_R4_CP_FIRM_SUMMARY',JSON.stringify(firmSummary));console.log('WP_RV08_R4_CP_COUNTRY_SUMMARY',JSON.stringify(countrySummary));console.log('WP_RV08_R4_CP_COHORTS',JSON.stringify(result.cohorts));console.log('WP_RV08_R4_CP_WORLD_DIGEST',a.digest);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(result,null,2));console.log('WP_RV08_R4_CP_OUTPUT',outputJson);}assert.equal(gates.ok,true,`${seed}: R4-CP gate failed`);
