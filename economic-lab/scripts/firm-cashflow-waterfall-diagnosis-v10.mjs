import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v),clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,finite(x)));
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function fingerprint(w){return {month:w.month,rng:clone(w.rng),countries:clone(w.countries),ledgerEntries:clone(w.ledger.entries),accounting:w.countries.map(c=>({id:c.id,report:w.accountingReport(c.id)}))};}
function postingDelta(entry,accountId){return sum((entry.postings||[]).filter(p=>p.accountId===accountId).map(p=>p.delta));}
function classify(kind,delta){
  const k=String(kind||'');
  if(k==='bank_loan_origination')return 'credit';
  if(k==='bank_loan_payment')return 'debt';
  if(k==='wage')return 'wage';
  if(k==='interfirm_purchase')return delta>=0?'b2bSales':'inputPurchase';
  if(k==='capital_investment')return delta>=0?'capitalSales':'capex';
  if(k==='goods_purchase')return delta>=0?'consumerSales':'other';
  if(k==='government_consumption'||k==='public_investment')return delta>=0?'governmentSales':'other';
  if(k.includes('tax'))return 'tax';
  return 'other';
}
function runWorld(scaleProfile,seed,horizon,collect=true){
  const world=createWorld(scaleProfile,seed),rows=[];
  for(let i=0;i<horizon;i++){
    const opening=new Map();
    for(const c of world.countries)for(const f of c.firms)opening.set(f.id,{countryId:c.id,industryId:f.industryId,accountId:f.accountId,openingCash:world.ledger.balance(f.accountId),safeCash:finite(f.safeCash),workers:finite(f.workers),active:f.active!==false});
    world.stepMonth();
    if(collect){
      for(const c of world.countries){
        const entries=world.ledger.entriesFor({month:world.month,countryId:c.id});
        const byAccount=new Map();
        for(const e of entries)for(const p of e.postings||[]){if(!byAccount.has(p.accountId))byAccount.set(p.accountId,[]);byAccount.get(p.accountId).push(e);}
        for(const [firmId,o] of opening){if(o.countryId!==c.id)continue;const f=c.firms.find(x=>x.id===firmId);if(!f)continue;const flows={credit:0,debt:0,wage:0,b2bSales:0,inputPurchase:0,capitalSales:0,capex:0,consumerSales:0,governmentSales:0,tax:0,other:0};let totalDelta=0;for(const e of byAccount.get(o.accountId)||[]){const d=postingDelta(e,o.accountId);if(Math.abs(d)<=EPS)continue;totalDelta+=d;const bucket=classify(e.kind,d);if(['debt','wage','inputPurchase','capex','tax'].includes(bucket))flows[bucket]+=Math.max(0,-d);else if(['credit','b2bSales','capitalSales','consumerSales','governmentSales'].includes(bucket))flows[bucket]+=Math.max(0,d);else flows.other+=d;}
          const closingCash=world.ledger.balance(o.accountId),salesCash=flows.b2bSales+flows.capitalSales+flows.consumerSales+flows.governmentSales,coreCashCost=flows.wage+flows.inputPurchase,coreNet=salesCash-coreCashCost,nonFinanceNet=totalDelta-flows.credit+flows.debt;
          rows.push({scaleProfile,seed,month:world.month,countryId:c.id,firmId,industryId:o.industryId,activeAtStart:o.active,activeAtEnd:f.active!==false,workersAtStart:o.workers,openingCash:o.openingCash,closingCash,safeCash:o.safeCash,startCashStress:clamp(1-o.openingCash/Math.max(1,o.safeCash),0,1.5),endCashStress:clamp(1-closingCash/Math.max(1,o.safeCash),0,1.5),...flows,salesCash,coreCashCost,coreNet,coreCoverage:ratio(salesCash,coreCashCost),nonFinanceNet,totalDelta,cashReconciliationError:closingCash-o.openingCash-totalDelta,revenue:finite(f.revenue),output:finite(f.output),price:finite(f.price),wageArrears:finite(f.wageArrears),loanBalance:finite(f.loanBalance),gdpResidual:gdpResidual(c.macro),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});
        }
      }
    }
  }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${scaleProfile}/${seed}: health failed`);return {world,rows,health,fingerprint:fingerprint(world)};
}
const nonInterference=[];for(const s of scales){const seed=`ECON-RV07-P29-NI-${s}`,h=Math.min(3,months);const a=runWorld(s,seed,h,false).fingerprint,b=runWorld(s,seed,h,true).fingerprint,exact=JSON.stringify(a)===JSON.stringify(b);assert.ok(exact,`${s}: observer interference`);nonInterference.push({scaleProfile:s,exact});}
const runs=[];for(const s of scales)for(const seed of seeds)runs.push(runWorld(s,seed,months,true));const rows=runs.flatMap(r=>r.rows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function aggregate(rs){const operatingNeg=rs.filter(r=>r.coreNet< -EPS),nonFinanceNeg=rs.filter(r=>r.nonFinanceNet< -EPS);return {firmMonths:rs.length,meanOpeningCash:mean(rs.map(r=>r.openingCash)),meanClosingCash:mean(rs.map(r=>r.closingCash)),meanSalesCash:mean(rs.map(r=>r.salesCash)),meanWageOut:mean(rs.map(r=>r.wage)),meanInputOut:mean(rs.map(r=>r.inputPurchase)),meanDebtService:mean(rs.map(r=>r.debt)),meanCreditIn:mean(rs.map(r=>r.credit)),meanCapexOut:mean(rs.map(r=>r.capex)),meanTaxOut:mean(rs.map(r=>r.tax)),meanCoreNet:mean(rs.map(r=>r.coreNet)),coreCoverage:ratio(sum(rs.map(r=>r.salesCash)),sum(rs.map(r=>r.coreCashCost))),negativeCoreShare:ratio(operatingNeg.length,rs.length),meanNonFinanceNet:mean(rs.map(r=>r.nonFinanceNet)),negativeNonFinanceShare:ratio(nonFinanceNeg.length,rs.length),meanStartCashStress:mean(rs.map(r=>r.startCashStress)),meanEndCashStress:mean(rs.map(r=>r.endCashStress)),meanLoanBalance:mean(rs.map(r=>r.loanBalance)),meanWageArrears:mean(rs.map(r=>r.wageArrears)),exitByEndShare:ratio(rs.filter(r=>!r.activeAtEnd).length,rs.length)};}
const summary=[];for(const s of scales)for(const w of windows)summary.push({scaleProfile:s,window:w.id,...aggregate(rows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to))});
const industrySummary=[];for(const s of scales)for(const w of windows)for(const industryId of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])industrySummary.push({scaleProfile:s,window:w.id,industryId,...aggregate(rows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to&&r.industryId===industryId))});
const maxCashReconciliationError=Math.max(0,...rows.map(r=>Math.abs(r.cashReconciliationError))),maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.gdpResidual)));
const gates={observerNonInterferenceExact:nonInterference.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),rowsPresent:rows.length>0,cashFlowReconciled:maxCashReconciliationError<TOL,ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.coreNet)&&Number.isFinite(r.closingCash))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P29 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.map(x=>({scale:x.scaleProfile,window:x.window,sales:+x.meanSalesCash.toFixed(1),wage:+x.meanWageOut.toFixed(1),inputs:+x.meanInputOut.toFixed(1),coverage:+x.coreCoverage.toFixed(3),negCore:+x.negativeCoreShare.toFixed(3),coreNet:+x.meanCoreNet.toFixed(1),debt:+x.meanDebtService.toFixed(1),credit:+x.meanCreditIn.toFixed(1),capex:+x.meanCapexOut.toFixed(1),cashStress:+x.meanEndCashStress.toFixed(3)})));
console.log('WP_RV07_P29_INDUSTRY',JSON.stringify(industrySummary));
console.log('WP_RV07_P29_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P29',title:'Exact firm cash-flow waterfall and operating coverage audit',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},nonInterference,gates,reconciliation:{maxCashReconciliationError,maxGdpResidual},summary,industrySummary,rows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P29_OUTPUT',outputJson);}
