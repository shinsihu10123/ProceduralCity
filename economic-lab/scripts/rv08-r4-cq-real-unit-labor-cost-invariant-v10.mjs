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
function summarize(rows){
 const vals=k=>rows.map(r=>r[k]).filter(v=>Number.isFinite(v)&&v>=0);
 const share=t=>rows.length?rows.filter(r=>r.rulc>t).length/rows.length:0;
 return {firmMonths:rows.length,capacityPerWorker:stats(vals('capacityPerWorker')),outputPerWorker:stats(vals('outputPerWorker')),realWageOwnGood:stats(vals('realWageOwnGood')),rulc:stats(vals('rulc')),realizedRulc:stats(vals('realizedRulc')),shareRulcGt1:share(1),shareRulcGt2:share(2),shareRulcGt10:share(10),shareRulcGt30:share(30),shareRulcGt100:share(100),maxM10Error:rows.reduce((m,r)=>Math.max(m,r.m10Error),0),maxQ10Error:rows.reduce((m,r)=>Math.max(m,r.q10Error),0)};
}
function group(rows,key){const m=new Map();for(const r of rows){const k=String(r[key]);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return Object.fromEntries([...m].map(([k,v])=>[k,summarize(v)]));}
function run(){
 const world=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
 const rows=[]; const countryMonths=[];
 for(let i=0;i<months;i++){
  world.stepMonth();
  for(const c of world.countries){
   const consumer=c.firms.filter(f=>f.active!==false&&f.consumerFacing===true&&finite(f.price)>EPS&&finite(f.workers)>EPS&&finite(f.capacity)>EPS);
   const employed=c.households.filter(h=>h.employed&&finite(h.wage)>EPS);
   const consumerPrices=consumer.map(f=>finite(f.price));
   const wages=employed.map(h=>finite(h.wage));
   const consumerCapPerWorker=consumer.map(f=>finite(f.capacity)/finite(f.workers));
   const medianPrice=q(consumerPrices,.5), medianWage=q(wages,.5), medianCap=q(consumerCapPerWorker,.5);
   countryMonths.push({month:world.month,countryId:String(c.id),medianConsumerPrice:medianPrice,medianEmployedWage:medianWage,medianConsumerCapacityPerWorker:medianCap,realWageConsumerUnits:medianPrice>EPS?medianWage/medianPrice:null,consumerRulcAnchor:medianPrice>EPS&&medianCap>EPS?medianWage/(medianPrice*medianCap):null});
   for(const f of c.firms){
    if(f.active===false)continue;
    const workers=Math.max(0,finite(f.workers)); const wage=Math.max(0,finite(f.wage)); const price=Math.max(0,finite(f.price)); const capacity=Math.max(0,finite(f.capacity)); const output=Math.max(0,finite(f.output));
    if(workers<=EPS||wage<=EPS||price<=EPS||capacity<=EPS)continue;
    const capacityPerWorker=capacity/workers, outputPerWorker=output/workers, realWageOwnGood=wage/price;
    const rulc=wage/(price*capacityPerWorker); const realizedRulc=outputPerWorker>EPS?wage/(price*outputPerWorker):null;
    const m10=(wage*10)/((price*10)*capacityPerWorker);
    const qCapacity=capacity/10, qOutput=output/10, qPrice=price*10, qCapPerWorker=qCapacity/workers;
    const q10=wage/(qPrice*qCapPerWorker);
    rows.push({month:world.month,countryId:String(c.id),industryId:String(f.industryId),consumerFacing:f.consumerFacing===true?'consumer':'nonconsumer',firmId:String(f.id),workers,wage,price,capacity,output,capacityPerWorker,outputPerWorker,realWageOwnGood,rulc,realizedRulc,m10Error:Math.abs(m10-rulc),q10Error:Math.abs(q10-rulc),qOutput});
   }
  }
 }
 const health=world.forceHealthCheck();
 const accounting=world.countries.every(c=>world.ledger.verifyCountry(c.id)?.ok===true&&world.accounting.verifyCountry(c,world.ledger,world.month)?.ok!==false);
 return {world,rows,countryMonths,digest:digest(world),healthy:health.ok===true&&accounting};
}
const a=run(),b=run();
const summary=summarize(a.rows);
const cmVals=k=>a.countryMonths.map(r=>r[k]).filter(v=>Number.isFinite(v)&&v>=0);
const countrySummary={countryMonths:a.countryMonths.length,medianConsumerPrice:stats(cmVals('medianConsumerPrice')),medianEmployedWage:stats(cmVals('medianEmployedWage')),medianConsumerCapacityPerWorker:stats(cmVals('medianConsumerCapacityPerWorker')),realWageConsumerUnits:stats(cmVals('realWageConsumerUnits')),consumerRulcAnchor:stats(cmVals('consumerRulcAnchor'))};
const gates={noMutationByAudit:true,exactDiagnosticReplay:JSON.stringify(a.rows)===JSON.stringify(b.rows)&&JSON.stringify(a.countryMonths)===JSON.stringify(b.countryMonths),exactCanonicalReplay:a.digest===b.digest,hardAccountingHealthy:a.healthy&&b.healthy,finitePositiveObservations:a.rows.length>0&&a.rows.every(r=>Number.isFinite(r.rulc)&&r.rulc>0),monetaryInvariance:summary.maxM10Error<1e-10,quantityRelabelInvariance:summary.maxQ10Error<1e-10,allCountriesObserved:new Set(a.rows.map(r=>r.countryId)).size===4,allIndustriesObserved:new Set(a.rows.map(r=>r.industryId)).size===4};gates.ok=Object.values(gates).every(Boolean);
const result={workPackage:'WP-RV08-R4-CQ',seed,months,gates,summary,countrySummary,cohorts:{country:group(a.rows,'countryId'),industry:group(a.rows,'industryId'),consumerFacing:group(a.rows,'consumerFacing')},worldDigest:a.digest};
console.log('WP_RV08_R4_CQ_GATES',JSON.stringify(gates));console.log('WP_RV08_R4_CQ_SUMMARY',JSON.stringify(summary));console.log('WP_RV08_R4_CQ_COUNTRY_SUMMARY',JSON.stringify(countrySummary));console.log('WP_RV08_R4_CQ_COHORTS',JSON.stringify(result.cohorts));console.log('WP_RV08_R4_CQ_WORLD_DIGEST',a.digest);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(result,null,2));console.log('WP_RV08_R4_CQ_OUTPUT',outputJson);}assert.equal(gates.ok,true,`${seed}: R4-CQ gate failed`);
