import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const variants=[
  {id:'unit-basis-control',scope:'none'},
  {id:'unit-basis-consumer-payroll-bridge',scope:'consumer'},
  {id:'unit-basis-upstream-payroll-bridge',scope:'upstream'},
  {id:'unit-basis-all-firm-payroll-bridge',scope:'all'}
];
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v);
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function deterministicDigest(world){
  const hash=createHash('sha256');
  const put=value=>hash.update(JSON.stringify(value));
  put({month:world.month,rng:world.rng});
  for(const country of world.countries){
    put(country);
    put(world.accountingReport(country.id));
  }
  for(const entry of world.ledger.entries)put(entry);
  return hash.digest('hex');
}
function exactPayrollDue(country,firm){return sum(country.households.filter(h=>h.employed&&h.employerId===firm.id).map(h=>{const wage=Math.max(0,finite(firm.wage)),prior=Math.max(0,finite(h.wageArrears));return wage+Math.min(prior,wage*0.5);}));}
function eligible(variant,f){if(variant.scope==='all')return true;if(variant.scope==='consumer')return f.consumerFacing===true;if(variant.scope==='upstream')return f.consumerFacing!==true;return false;}
function tagged(country){return country.loans.filter(l=>l.__rv07P19===true);}
function installBridge(world,variant){
  world.__rv07P19=[];
  const accrue=world.accounting.accrueMonthlyWages.bind(world.accounting);
  const close=world.accounting.closeCountryMonth.bind(world.accounting);
  world.accounting.accrueMonthlyWages=(country,month)=>{
    const bank=country.banks[0];
    for(const firm of country.firms.filter(f=>f.active!==false&&eligible(variant,f)).sort((a,b)=>a.id.localeCompare(b.id))){
      const due=exactPayrollDue(country,firm),cashBefore=world.ledger.balance(firm.accountId),shortfall=Math.max(0,due-cashBefore);if(shortfall<=EPS)continue;
      const created=world.ledger.adjustMoney({month,countryId:country.id,accountId:firm.accountId,amount:shortfall,kind:'rv07_p19_payroll_bridge_origination',meta:{bankId:bank.id,borrowerId:firm.id,scope:variant.scope}});assert.ok(Math.abs(created-shortfall)<=TOL*Math.max(1,shortfall),`${variant.id}/${month}/${country.id}/${firm.id}: exact bridge mismatch`);
      const loan={id:`RV07P19-${variant.scope}-${country.id}-${String(month).padStart(3,'0')}-${firm.id}`,countryId:country.id,bankId:bank.id,borrowerId:firm.id,borrowerKind:'firm',originalPrincipal:created,outstanding:created,annualRate:0,monthlyRate:0,termMonths:1,originatedMonth:month,nextPaymentMonth:month+1,missedPayments:0,arrears:0,status:'active',estimatedDefaultProbabilityAtOrigination:null,__rv07P19:true,__rv07P19Scope:variant.scope};country.loans.push(loan);firm.loanBalance=finite(firm.loanBalance)+created;world.accounting.recordLoanOrigination({country,bank,borrower:firm,loan,month,amount:created});world.__rv07P19.push({type:'issued',variant:variant.id,scope:variant.scope,month,countryId:country.id,firmId:firm.id,consumerFacing:firm.consumerFacing===true,loanId:loan.id,due,cashBefore,shortfall,amount:created});
    }
    return accrue(country,month);
  };
  world.accounting.closeCountryMonth=(country,ledger,month)=>{
    const bank=country.banks[0],firmMap=new Map(country.firms.map(f=>[f.id,f]));
    for(const loan of tagged(country)){
      if(loan.status!=='active'||loan.originatedMonth!==month||loan.outstanding<=EPS)continue;const firm=firmMap.get(loan.borrowerId);if(!firm)continue;const cashBefore=world.ledger.balance(firm.accountId),requested=Math.min(loan.outstanding,Math.max(0,cashBefore));if(requested<=EPS)continue;
      const delta=world.ledger.adjustMoney({month,countryId:country.id,accountId:firm.accountId,amount:-requested,kind:'rv07_p19_payroll_bridge_repayment',meta:{loanId:loan.id,bankId:bank.id,borrowerId:firm.id,timing:'post_all_domestic_sales'}});const principalPaid=Math.max(0,-delta);if(principalPaid<=EPS)continue;world.accounting.recordLoanPayment({country,bank,borrower:firm,loan,month,principalPaid,interestPaid:0});loan.outstanding=Math.max(0,loan.outstanding-principalPaid);firm.loanBalance=Math.max(0,finite(firm.loanBalance)-principalPaid);if(loan.outstanding<=EPS){loan.outstanding=0;loan.status='repaid';loan.arrears=0;}world.__rv07P19.push({type:'repaid',variant:variant.id,scope:variant.scope,month,countryId:country.id,firmId:firm.id,loanId:loan.id,cashBefore,amount:principalPaid,outstandingAfter:loan.outstanding});
    }
    return close(country,ledger,month);
  };
}
function runVariant(variant,scaleProfile,seed,horizon,collect=true){
  const world=createWorld(scaleProfile,seed);if(variant.scope!=='none')installBridge(world,variant);else world.__rv07P19=[];const rows=[];
  for(let i=0;i<horizon;i++){world.stepMonth();if(collect)for(const c of world.countries){const ev=world.__rv07P19.filter(e=>e.month===world.month&&e.countryId===c.id),issued=ev.filter(e=>e.type==='issued'),repaid=ev.filter(e=>e.type==='repaid'),goods=c.lastMarkets?.goods||{},macro=c.macro||{};rows.push({variant:variant.id,scope:variant.scope,scaleProfile,seed,month:world.month,countryId:c.id,bridgeIssued:issued.length,bridgeIssuedAmount:sum(issued.map(e=>e.amount)),bridgeRepaidAmount:sum(repaid.map(e=>e.amount)),bridgeSameMonthRepaymentRate:ratio(sum(repaid.map(e=>e.amount)),sum(issued.map(e=>e.amount))),taggedOutstanding:sum(tagged(c).filter(l=>l.status==='active').map(l=>l.outstanding)),unemployment:finite(macro.unemployment),exits:finite(macro.firmExits),wageArrears:finite(macro.wageArrears),goodsFulfillment:ratio(finite(goods.nominalConsumption??macro.consumption),finite(goods.desiredBudget)),inputShortage:finite(c.lastIndustry?.inputShortageUnits),consumerOutput:finite(c.lastIndustry?.sectorOutputs?.CONSUMER),materialsOutput:finite(c.lastIndustry?.sectorOutputs?.MATERIALS),gdp:finite(macro.gdp),gdpResidual:gdpResidual(macro),creditApprovalRate:ratio(finite(c.lastCredit?.approved),finite(c.lastCredit?.applications)),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});}}
  const health=world.forceHealthCheck();assert.ok(health.ok,`${variant.id}/${scaleProfile}/${seed}: health failed`);return {variant:variant.id,scaleProfile,seed,rows,health,fingerprint:deterministicDigest(world),events:world.__rv07P19};
}
const determinism=[];for(const v of variants)for(const s of scales){const seed=`ECON-RV07-P19-DET-${v.scope}-${s}`,h=Math.min(3,months);const a=runVariant(v,s,seed,h,false).fingerprint,b=runVariant(v,s,seed,h,false).fingerprint,exact=a===b;assert.ok(exact,`${v.id}/${s}: nondeterministic`);determinism.push({variant:v.id,scaleProfile:s,exact});}
const runs=[];for(const v of variants)for(const s of scales)for(const seed of seeds)runs.push(runVariant(v,s,seed,months,true));const rows=runs.flatMap(r=>r.rows),events=runs.flatMap(r=>r.events);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){return {countryMonths:rs.length,meanUnemployment:mean(rs.map(r=>r.unemployment)),totalExits:sum(rs.map(r=>r.exits)),meanWageArrears:mean(rs.map(r=>r.wageArrears)),meanGoodsFulfillment:mean(rs.map(r=>r.goodsFulfillment)),meanInputShortage:mean(rs.map(r=>r.inputShortage)),meanConsumerOutput:mean(rs.map(r=>r.consumerOutput)),meanMaterialsOutput:mean(rs.map(r=>r.materialsOutput)),meanGdp:mean(rs.map(r=>r.gdp)),meanCreditApprovalRate:mean(rs.map(r=>r.creditApprovalRate)),bridgeIssued:sum(rs.map(r=>r.bridgeIssued)),bridgeIssuedAmount:sum(rs.map(r=>r.bridgeIssuedAmount)),bridgeRepaidAmount:sum(rs.map(r=>r.bridgeRepaidAmount)),sameMonthRepaymentRate:ratio(sum(rs.map(r=>r.bridgeRepaidAmount)),sum(rs.map(r=>r.bridgeIssuedAmount))),meanTaggedOutstanding:mean(rs.map(r=>r.taggedOutstanding))};}
const summary=[];for(const v of variants)for(const s of scales)for(const w of windows)summary.push({variant:v.id,scope:v.scope,scaleProfile:s,window:w.id,...agg(rows.filter(r=>r.variant===v.id&&r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to))});
const comparisons={};for(const s of scales){comparisons[s]={};const control=summary.find(x=>x.variant===variants[0].id&&x.scaleProfile===s&&x.window==='FULL');for(const v of variants.slice(1)){const a=summary.find(x=>x.variant===v.id&&x.scaleProfile===s&&x.window==='FULL');comparisons[s][v.scope]={unemploymentDifference:a.meanUnemployment-control.meanUnemployment,exitDifference:a.totalExits-control.totalExits,wageArrearsDifference:a.meanWageArrears-control.meanWageArrears,goodsFulfillmentDifference:a.meanGoodsFulfillment-control.meanGoodsFulfillment,inputShortageDifference:a.meanInputShortage-control.meanInputShortage,consumerOutputRatio:ratio(a.meanConsumerOutput,control.meanConsumerOutput),materialsOutputRatio:ratio(a.meanMaterialsOutput,control.meanMaterialsOutput),gdpDifference:a.meanGdp-control.meanGdp,creditApprovalDifference:a.meanCreditApprovalRate-control.meanCreditApprovalRate,bridgeIssuedAmount:a.bridgeIssuedAmount,sameMonthRepaymentRate:a.sameMonthRepaymentRate};}}
const issuedEvents=events.filter(e=>e.type==='issued'),maxIssueError=Math.max(0,...issuedEvents.map(e=>Math.abs(e.amount-e.shortfall))),maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.gdpResidual)));
const targetValid=issuedEvents.every(e=>(e.scope==='all')||(e.scope==='consumer'&&e.consumerFacing)||(e.scope==='upstream'&&!e.consumerFacing));
const gates={deterministicReplayExact:determinism.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,bridgeActuallyIssued:issuedEvents.length>0,exactShortfallBridge:maxIssueError<TOL,targetScopeValid:targetValid,ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.unemployment)&&Number.isFinite(r.bridgeIssuedAmount))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P19 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.window==='FULL').map(x=>({variant:x.variant,scale:x.scaleProfile,u:+x.meanUnemployment.toFixed(4),exits:x.totalExits,arrears:+x.meanWageArrears.toFixed(1),fulfill:+x.meanGoodsFulfillment.toFixed(4),shortage:+x.meanInputShortage.toFixed(2),consumer:+x.meanConsumerOutput.toFixed(2),issued:+x.bridgeIssuedAmount.toFixed(1),repay:+x.sameMonthRepaymentRate.toFixed(4)})));
console.log('WP_RV07_P19_COMPARISON',JSON.stringify(comparisons));console.log('WP_RV07_P19_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P19',title:'Exact payroll-liquidity bridge sector matrix',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},variants,determinism,gates,reconciliation:{maxIssueError,maxGdpResidual},summary,comparisons,rows,events};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P19_OUTPUT',outputJson);}
