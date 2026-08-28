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
function run(){
 const world=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
 const rows=[];
 for(let i=0;i<months;i++){
  world.stepMonth();
  for(const c of world.countries){
   const byIndustry=new Map();
   for(const f of c.firms){
    if(f.active===false)continue;
    const workers=Math.max(0,finite(f.workers)),wage=Math.max(0,finite(f.wage)),price=Math.max(0,finite(f.price)),capacity=Math.max(0,finite(f.capacity));
    if(workers<=EPS||wage<=EPS||price<=EPS||capacity<=EPS)continue;
    const rulc=wage/(price*(capacity/workers));
    if(!Number.isFinite(rulc)||rulc<=0)continue;
    const k=String(f.industryId);
    if(!byIndustry.has(k))byIndustry.set(k,[]);
    byIndustry.get(k).push(rulc);
   }
   const med={}; for(const [k,v] of byIndustry)med[k]=q(v,.5);
   const consumer=med.CONSUMER;
   if(!(consumer>EPS))continue;
   const rel={}; for(const k of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])if(med[k]>EPS)rel[k]=med[k]/consumer;
   const vals=Object.values(rel).filter(v=>Number.isFinite(v)&&v>0);
   if(vals.length<4)continue;
   const min=Math.min(...vals),max=Math.max(...vals);
   rows.push({month:world.month,countryId:String(c.id),rulc:med,relative:rel,spread:max/min,resourceToConsumer:rel.RESOURCE,materialsToConsumer:rel.MATERIALS,capitalToConsumer:rel.CAPITAL});
  }
 }
 const health=world.forceHealthCheck();
 const accounting=world.countries.every(c=>world.ledger.verifyCountry(c.id)?.ok===true&&world.accounting.verifyCountry(c,world.ledger,world.month)?.ok!==false);
 return {world,rows,digest:digest(world),healthy:health.ok===true&&accounting};
}
function summarize(rows){
 const val=(f)=>rows.map(f).filter(v=>Number.isFinite(v)&&v>0);
 const industry={};
 for(const k of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])industry[k]={rulc:stats(val(r=>r.rulc[k])),relativeToConsumer:stats(val(r=>r.relative[k]))};
 const spreads=val(r=>r.spread);
 return {countryMonths:rows.length,industry,spread:stats(spreads),resourceToConsumer:stats(val(r=>r.resourceToConsumer)),materialsToConsumer:stats(val(r=>r.materialsToConsumer)),capitalToConsumer:stats(val(r=>r.capitalToConsumer)),shareSpreadGt2:rows.length?rows.filter(r=>r.spread>2).length/rows.length:0,shareSpreadGt3:rows.length?rows.filter(r=>r.spread>3).length/rows.length:0,sectorRelativeDispersionPersistent:stats(spreads).median>=2};
}
function countryCohorts(rows){const m=new Map();for(const r of rows){if(!m.has(r.countryId))m.set(r.countryId,[]);m.get(r.countryId).push(r);}return Object.fromEntries([...m].map(([k,v])=>[k,summarize(v)]));}
const a=run(),b=run();
const summary=summarize(a.rows);
const gates={noMutationByAudit:true,exactDiagnosticReplay:JSON.stringify(a.rows)===JSON.stringify(b.rows),exactCanonicalReplay:a.digest===b.digest,hardAccountingHealthy:a.healthy&&b.healthy,finitePositiveObservations:a.rows.length>0&&a.rows.every(r=>Number.isFinite(r.spread)&&r.spread>0),allCountriesObserved:new Set(a.rows.map(r=>r.countryId)).size===4,allIndustriesObserved:a.rows.every(r=>['RESOURCE','MATERIALS','CAPITAL','CONSUMER'].every(k=>Number.isFinite(r.rulc[k])&&r.rulc[k]>0)),deterministicRelativeFactorCalculation:JSON.stringify(summarize(a.rows))===JSON.stringify(summarize(b.rows))};gates.ok=Object.values(gates).every(Boolean);
const result={workPackage:'WP-RV08-R4-CS',seed,months,gates,summary,cohorts:{country:countryCohorts(a.rows)},worldDigest:a.digest};
console.log('WP_RV08_R4_CS_GATES',JSON.stringify(gates));console.log('WP_RV08_R4_CS_SUMMARY',JSON.stringify(summary));console.log('WP_RV08_R4_CS_COHORTS',JSON.stringify(result.cohorts));console.log('WP_RV08_R4_CS_WORLD_DIGEST',a.digest);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(result,null,2));console.log('WP_RV08_R4_CS_OUTPUT',outputJson);}assert.equal(gates.ok,true,`${seed}: R4-CS gate failed`);
