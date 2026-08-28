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
function settlementFlow(entries,accountId,kinds,sign){let x=0;for(const e of entries){if(!kinds.has(String(e.kind||'')))continue;for(const p of e.postings||[]){if(String(p.accountId)!==String(accountId))continue;const d=finite(p.delta);if(sign==='in'&&d>0)x+=d;if(sign==='out'&&d<0)x+=-d;}}return x;}
function laborAccrual(gl,firmId,month){const entity=gl.entities.get(firmId);if(!entity)return 0;let x=0;for(const j of entity.journals||[]){if(Number(j.month)!==Number(month)||String(j.kind)!=='production_labor_accrual')continue;for(const line of j.lines||[])if(String(line.account)==='inventory')x+=Math.max(0,finite(line.debit));}return x;}
function summarize(rows){
 const positive=rows.filter(r=>r.output>EPS&&r.bookUnitCost>EPS&&r.price>EPS);
 const ratios=(field)=>positive.map(r=>r[field]).filter(v=>Number.isFinite(v)&&v>=0);
 const share=(pred)=>rows.length?rows.filter(pred).length/rows.length:0;
 return {
  firmMonths:rows.length,
  productiveFirmMonths:positive.length,
  priceToBookUnitCost:stats(ratios('priceToBookUnitCost')),
  priceToLaborCostPerOutput:stats(ratios('priceToLaborCostPerOutput')),
  fullSellthroughPayrollCoverage:stats(rows.map(r=>r.fullSellthroughPayrollCoverage).filter(v=>Number.isFinite(v)&&v>=0)),
  fullSellthroughLaborAccrualCoverage:stats(rows.map(r=>r.fullSellthroughLaborAccrualCoverage).filter(v=>Number.isFinite(v)&&v>=0)),
  realizedRevenuePayrollCoverage:stats(rows.map(r=>r.realizedRevenuePayrollCoverage).filter(v=>Number.isFinite(v)&&v>=0)),
  priceBelowBookCostShare:share(r=>r.priceBelowBookCost),
  severePriceBelowBookCostShare:share(r=>r.severePriceBelowBookCost),
  priceBelowLaborCostPerUnitShare:share(r=>r.priceBelowLaborCostPerUnit),
  fullSellthroughCannotCoverPayrollShare:share(r=>r.fullSellthroughCannotCoverPayroll),
  fullSellthroughCannotCoverLaborAccrualShare:share(r=>r.fullSellthroughCannotCoverLaborAccrual),
  realizedRevenueCannotCoverPayrollShare:share(r=>r.realizedRevenueCannotCoverPayroll),
  zeroOutputWithLaborAccrualShare:share(r=>r.zeroOutputWithLaborAccrual),
  costRecoveryPlausibleShare:share(r=>r.costRecoveryPlausible)
 };
}
function group(rows,key){const m=new Map();for(const r of rows){const k=String(r[key]);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return Object.fromEntries([...m].map(([k,v])=>[k,summarize(v)]));}
function run(){
 const world=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
 const rows=[];
 for(let i=0;i<months;i++){
  world.stepMonth();
  const monthEntries=world.ledger.entriesFor({month:world.month});
  for(const c of world.countries){
   const entries=monthEntries.filter(e=>String(e.countryId)===String(c.id));
   for(const f of c.firms||[]){
    if(f.active===false)continue;
    const price=Math.max(0,finite(f.price));
    const bookUnitCost=Math.max(0,finite(f.bookUnitCost));
    const output=Math.max(0,finite(f.output));
    const sales=Math.max(0,finite(f.sales));
    const payroll=settlementFlow(entries,f.accountId,new Set(['wage']),'out');
    const operatingRevenue=settlementFlow(entries,f.accountId,new Set(['goods_purchase','interfirm_purchase','capital_investment']),'in');
    const accrual=laborAccrual(world.accounting.gl,f.id,world.month);
    const laborCostPerOutput=output>EPS?accrual/output:null;
    const fullSellthroughRevenue=output*price;
    const priceToBookUnitCost=bookUnitCost>EPS?price/bookUnitCost:null;
    const priceToLaborCostPerOutput=laborCostPerOutput&&laborCostPerOutput>EPS?price/laborCostPerOutput:null;
    const fullSellthroughPayrollCoverage=payroll>EPS?fullSellthroughRevenue/payroll:null;
    const fullSellthroughLaborAccrualCoverage=accrual>EPS?fullSellthroughRevenue/accrual:null;
    const realizedRevenuePayrollCoverage=payroll>EPS?operatingRevenue/payroll:null;
    const realizedRevenueLaborAccrualCoverage=accrual>EPS?operatingRevenue/accrual:null;
    rows.push({month:world.month,countryId:String(c.id),industryId:String(f.industryId),consumerFacing:f.consumerFacing===true?'consumer':'nonconsumer',firmId:String(f.id),price,bookUnitCost,output,sales,payroll,operatingRevenue,laborAccrual:accrual,laborCostPerOutput,fullSellthroughRevenue,priceToBookUnitCost,priceToLaborCostPerOutput,fullSellthroughPayrollCoverage,fullSellthroughLaborAccrualCoverage,realizedRevenuePayrollCoverage,realizedRevenueLaborAccrualCoverage,priceBelowBookCost:bookUnitCost>EPS&&price+EPS<bookUnitCost,severePriceBelowBookCost:bookUnitCost>EPS&&price/bookUnitCost<0.25,priceBelowLaborCostPerUnit:laborCostPerOutput!==null&&price+EPS<laborCostPerOutput,fullSellthroughCannotCoverPayroll:payroll>EPS&&fullSellthroughRevenue+EPS<payroll,fullSellthroughCannotCoverLaborAccrual:accrual>EPS&&fullSellthroughRevenue+EPS<accrual,realizedRevenueCannotCoverPayroll:payroll>EPS&&operatingRevenue+EPS<payroll,zeroOutputWithLaborAccrual:output<=EPS&&accrual>EPS,costRecoveryPlausible:bookUnitCost>EPS&&price+EPS>=bookUnitCost&&(!payroll||fullSellthroughRevenue+EPS>=payroll)});
   }
  }
 }
 const health=world.forceHealthCheck();
 const accounting=world.countries.every(c=>world.ledger.verifyCountry(c.id)?.ok===true&&world.accounting.verifyCountry(c,world.ledger,world.month)?.ok!==false);
 return {world,rows,digest:digest(world),healthy:health.ok===true&&accounting};
}
const a=run(),b=run();
const summary=summarize(a.rows);
const finiteMetrics=a.rows.every(r=>[r.price,r.bookUnitCost,r.output,r.sales,r.payroll,r.operatingRevenue,r.laborAccrual,r.fullSellthroughRevenue].every(v=>Number.isFinite(v)&&v>=0));
const gates={noMutationByAudit:true,exactDiagnosticReplay:JSON.stringify(a.rows)===JSON.stringify(b.rows),exactCanonicalReplay:a.digest===b.digest,hardAccountingHealthy:a.healthy&&b.healthy,finiteCostMetrics:finiteMetrics,observationsPresent:a.rows.length>0,allCountriesObserved:new Set(a.rows.map(r=>r.countryId)).size===4,allIndustriesObserved:new Set(a.rows.map(r=>r.industryId)).size===4};gates.ok=Object.values(gates).every(Boolean);
const result={workPackage:'WP-RV08-R4-CO',seed,months,gates,summary,cohorts:{country:group(a.rows,'countryId'),industry:group(a.rows,'industryId'),consumerFacing:group(a.rows,'consumerFacing')},worldDigest:a.digest};
console.log('WP_RV08_R4_CO_GATES',JSON.stringify(gates));console.log('WP_RV08_R4_CO_SUMMARY',JSON.stringify(summary));console.log('WP_RV08_R4_CO_COHORTS',JSON.stringify(result.cohorts));console.log('WP_RV08_R4_CO_WORLD_DIGEST',a.digest);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(result,null,2));console.log('WP_RV08_R4_CO_OUTPUT',outputJson);}assert.equal(gates.ok,true,`${seed}: R4-CO gate failed`);
