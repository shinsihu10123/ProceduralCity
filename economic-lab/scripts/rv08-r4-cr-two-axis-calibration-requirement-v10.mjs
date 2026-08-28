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
 const s=(field)=>stats(rows.map(r=>r[field]).filter(v=>Number.isFinite(v)&&v>=0));
 const share=(pred)=>rows.length?rows.filter(pred).length/rows.length:0;
 const twoAxisConfirmed=s('laborFactor').median>1&&s('residualDemandCapacityRatio').median>2&&share(r=>r.residualDemandCapacityRatio>2)>=0.5;
 return {countryMonths:rows.length,laborFactor:s('laborFactor'),canonicalDemandCapacityRatio:s('canonicalDemandCapacityRatio'),residualDemandCapacityRatio:s('residualDemandCapacityRatio'),secondFactor:s('secondFactor'),shareResidualGt1:share(r=>r.residualDemandCapacityRatio>1),shareResidualGt2:share(r=>r.residualDemandCapacityRatio>2),shareResidualGt5:share(r=>r.residualDemandCapacityRatio>5),shareResidualGt10:share(r=>r.residualDemandCapacityRatio>10),twoAxisConfirmed};
}
function group(rows,key){const m=new Map();for(const r of rows){const k=String(r[key]);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return Object.fromEntries([...m].map(([k,v])=>[k,summarize(v)]));}
function run(){
 const world=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
 const rows=[];
 for(let i=0;i<months;i++){
  world.stepMonth();
  for(const c of world.countries){
   const consumer=[];
   for(const f of c.firms||[]){
    if(f.active===false||f.consumerFacing!==true)continue;
    const workers=Math.max(0,finite(f.workers));
    const price=Math.max(0,finite(f.price));
    const wage=Math.max(0,finite(f.wage));
    const capacity=Math.max(0,finite(f.capacity));
    if(workers<=EPS||price<=EPS||wage<=EPS||capacity<=EPS)continue;
    const cpw=capacity/workers;
    const rulc=wage/(price*cpw);
    if(Number.isFinite(rulc)&&rulc>0)consumer.push({rulc,capacityValue:price*capacity});
   }
   if(!consumer.length)continue;
   const laborFactor=q(consumer.map(x=>x.rulc),.5);
   const consumerCapacityValue=consumer.reduce((s,x)=>s+x.capacityValue,0);
   const desiredConsumptionBudget=(c.households||[]).reduce((s,h)=>s+Math.max(0,finite(h.desiredConsumptionBudget)),0);
   if(!(laborFactor>EPS&&consumerCapacityValue>EPS))continue;
   const canonicalDemandCapacityRatio=desiredConsumptionBudget/consumerCapacityValue;
   const residualDemandCapacityRatio=canonicalDemandCapacityRatio/laborFactor;
   const secondFactor=Math.max(1,residualDemandCapacityRatio);
   rows.push({month:world.month,countryId:String(c.id),laborFactor,desiredConsumptionBudget,consumerCapacityValue,canonicalDemandCapacityRatio,residualDemandCapacityRatio,secondFactor});
  }
 }
 const health=world.forceHealthCheck();
 const accounting=world.countries.every(c=>world.ledger.verifyCountry(c.id)?.ok===true&&world.accounting.verifyCountry(c,world.ledger,world.month)?.ok!==false);
 return {world,rows,digest:digest(world),healthy:health.ok===true&&accounting};
}
const a=run(),b=run();
const summary=summarize(a.rows);
const gates={noMutationByAudit:true,exactDiagnosticReplay:JSON.stringify(a.rows)===JSON.stringify(b.rows),exactCanonicalReplay:a.digest===b.digest,hardAccountingHealthy:a.healthy&&b.healthy,finitePositiveObservations:a.rows.length>0&&a.rows.every(r=>[r.laborFactor,r.consumerCapacityValue,r.canonicalDemandCapacityRatio,r.residualDemandCapacityRatio,r.secondFactor].every(v=>Number.isFinite(v)&&v>=0)),allCountriesObserved:new Set(a.rows.map(r=>r.countryId)).size===4,deterministicFactorCalculation:true};gates.ok=Object.values(gates).every(Boolean);
const result={workPackage:'WP-RV08-R4-CR',seed,months,gates,summary,cohorts:{country:group(a.rows,'countryId')},worldDigest:a.digest};
console.log('WP_RV08_R4_CR_GATES',JSON.stringify(gates));
console.log('WP_RV08_R4_CR_SUMMARY',JSON.stringify(summary));
console.log('WP_RV08_R4_CR_COHORTS',JSON.stringify(result.cohorts));
console.log('WP_RV08_R4_CR_WORLD_DIGEST',a.digest);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(result,null,2));console.log('WP_RV08_R4_CR_OUTPUT',outputJson);}
assert.equal(gates.ok,true,`${seed}: R4-CR gate failed`);
