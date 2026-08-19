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
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v);
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function fingerprint(w){return {month:w.month,rng:clone(w.rng),countries:clone(w.countries),ledgerEntries:clone(w.ledger.entries),accounting:w.countries.map(c=>({id:c.id,report:w.accountingReport(c.id)}))};}
function exactPayrollDue(country,f){return sum(country.households.filter(h=>h.employed&&h.employerId===f.id).map(h=>{const wage=Math.max(0,finite(f.wage)),prior=Math.max(0,finite(h.wageArrears));return wage+Math.min(prior,wage*0.5);}));}
function snapshotFirms(world,country,extra=()=>({})){return country.firms.filter(f=>f.active!==false).map(f=>({firmId:f.id,industryId:f.industryId,consumerFacing:f.consumerFacing===true,cash:world.ledger.balance(f.accountId),workers:finite(f.workers),desiredWorkers:finite(f.desiredWorkers),price:finite(f.price),wage:finite(f.wage),revenue:finite(f.revenue),inputSpend:finite(f.inputSpend),output:finite(f.output),sales:finite(f.sales),...extra(f)}));}

function installAudit(world){
  world.__rv07P17={preDebt:new Map(),postDebt:new Map(),postCredit:new Map(),prePayroll:new Map(),postGoods:new Map(),postFiscal:new Map()};
  const debt=world.banking.serviceDebt.bind(world.banking);
  world.banking.serviceDebt=(country,month)=>{world.__rv07P17.preDebt.set(`${month}|${country.id}`,snapshotFirms(world,country));const out=debt(country,month);world.__rv07P17.postDebt.set(`${month}|${country.id}`,snapshotFirms(world,country));return out;};
  const credit=world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit=(country,month,signals)=>{const out=credit(country,month,signals);world.__rv07P17.postCredit.set(`${month}|${country.id}`,snapshotFirms(world,country));return out;};
  const accrue=world.accounting.accrueMonthlyWages.bind(world.accounting);
  world.accounting.accrueMonthlyWages=(country,month)=>{world.__rv07P17.prePayroll.set(`${month}|${country.id}`,snapshotFirms(world,country,f=>({payrollDue:exactPayrollDue(country,f),prePayrollRevenue:finite(f.revenue),prePayrollInputSpend:finite(f.inputSpend)})));return accrue(country,month);};
  const ingest=world.accounting.ingestSettlementEntries.bind(world.accounting);
  world.accounting.ingestSettlementEntries=(entries,country,month)=>{const out=ingest(entries,country,month);world.__rv07P17.postGoods.set(`${month}|${country.id}`,snapshotFirms(world,country));return out;};
  const corp=world.fiscal.collectCorporateTaxes.bind(world.fiscal);
  world.fiscal.collectCorporateTaxes=(country,month)=>{const out=corp(country,month);world.__rv07P17.postFiscal.set(`${month}|${country.id}`,snapshotFirms(world,country));return out;};
}
function mapRows(rows){return new Map((rows||[]).map(x=>[x.firmId,x]));}
function runWorld(scaleProfile,seed,horizon,audited){
  const world=createWorld(scaleProfile,seed);if(audited)installAudit(world);const firmRows=[],countryRows=[];
  for(let i=0;i<horizon;i++){
    world.stepMonth();
    for(const c of world.countries){
      if(audited){const key=`${world.month}|${c.id}`,st=world.__rv07P17;const a=mapRows(st.preDebt.get(key)),b=mapRows(st.postDebt.get(key)),d=mapRows(st.postCredit.get(key)),p=mapRows(st.prePayroll.get(key)),g=mapRows(st.postGoods.get(key)),fisc=mapRows(st.postFiscal.get(key));assert.ok(p.size>0,`${key}: missing pre-payroll snapshots`);
        const monthEntries=world.ledger.entriesFor({month:world.month,countryId:c.id});
        for(const pre of p.values()){
          const x0=a.get(pre.firmId),x1=b.get(pre.firmId),x2=d.get(pre.firmId),xg=g.get(pre.firmId),xf=fisc.get(pre.firmId);assert.ok(x0&&x1&&x2&&xg&&xf,`${key}/${pre.firmId}: stage snapshot missing`);
          const firm=c.firms.find(x=>x.id===pre.firmId);assert.ok(firm,`${key}/${pre.firmId}: firm missing`);
          const finalRevenue=finite(firm.revenue),laterRevenue=Math.max(0,finalRevenue-finite(pre.prePayrollRevenue));
          const account=firm.accountId;let positiveAfterPayroll=0;const wageSeq=monthEntries.filter(e=>e.kind==='wage'&&e.meta?.firmId===firm.id).map(e=>Number(String(e.id).replace('TX-',''))).filter(Number.isFinite);const lastWageSeq=wageSeq.length?Math.max(...wageSeq):-Infinity;
          for(const e of monthEntries){const seq=Number(String(e.id).replace('TX-',''));if(!(seq>lastWageSeq))continue;for(const posting of e.postings||[])if(posting.accountId===account&&posting.delta>0)positiveAfterPayroll+=posting.delta;}
          const due=finite(pre.payrollDue),opCost=due+finite(pre.prePayrollInputSpend),cashPre=finite(pre.cash);
          firmRows.push({scaleProfile,seed,month:world.month,countryId:c.id,firmId:firm.id,industryId:pre.industryId,consumerFacing:pre.consumerFacing,workers:pre.workers,price:pre.price,wage:pre.wage,payrollDue:due,inputSpend:finite(pre.prePayrollInputSpend),cashPreDebt:finite(x0.cash),cashPostDebt:finite(x1.cash),cashPostCredit:finite(x2.cash),cashPrePayroll:cashPre,cashPostGoods:finite(xg.cash),cashPostFiscal:finite(xf.cash),prePayrollRevenue:finite(pre.prePayrollRevenue),finalRevenue,laterRevenue,positiveCashInflowsAfterPayroll:positiveAfterPayroll,output:finite(firm.output),sales:finite(firm.sales),debtServiceDrain:Math.max(0,finite(x0.cash)-finite(x1.cash)),creditCashGain:Math.max(0,finite(x2.cash)-finite(x1.cash)),preDebtAffordable:finite(x0.cash)+TOL>=due,postDebtAffordable:finite(x1.cash)+TOL>=due,postCreditAffordable:finite(x2.cash)+TOL>=due,prePayrollAffordable:cashPre+TOL>=due,debtCreatesShortfall:finite(x0.cash)+TOL>=due&&finite(x1.cash)+TOL<due,creditRepairsShortfall:finite(x1.cash)+TOL<due&&finite(x2.cash)+TOL>=due,laterRevenueCouldCoverShortfall:cashPre+TOL<due&&cashPre+laterRevenue+TOL>=due,laterGrossInflowsCouldCoverShortfall:cashPre+TOL<due&&cashPre+positiveAfterPayroll+TOL>=due,revenueToPayroll:ratio(finalRevenue,due),revenueToOperatingCashCost:ratio(finalRevenue,opCost),prePayrollRevenueShare:ratio(pre.prePayrollRevenue,finalRevenue),cashOperatingMargin:finalRevenue-opCost,exitedByEnd:firm.active===false});
        }
      }
      countryRows.push({scaleProfile,seed,month:world.month,countryId:c.id,unemployment:finite(c.macro?.unemployment),exits:finite(c.macro?.firmExits),wageArrears:finite(c.macro?.wageArrears),inputShortage:finite(c.lastIndustry?.inputShortageUnits),gdpResidual:gdpResidual(c.macro),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});
    }
  }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${scaleProfile}/${seed}: health failed`);return {world,firmRows,countryRows,health,fingerprint:fingerprint(world)};
}
const ni=[];for(const s of scales){const seed=`ECON-RV07-P17-NI-${s}`,h=Math.min(3,months);const a=runWorld(s,seed,h,false).fingerprint,b=runWorld(s,seed,h,true).fingerprint,exact=JSON.stringify(a)===JSON.stringify(b);assert.ok(exact,`${s}: observer interference`);ni.push({scaleProfile:s,exact});}
const runs=[];for(const s of scales)for(const seed of seeds)runs.push(runWorld(s,seed,months,true));const firmRows=runs.flatMap(r=>r.firmRows),countryRows=runs.flatMap(r=>r.countryRows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){const short=rs.filter(r=>!r.prePayrollAffordable);return {firmMonths:rs.length,prePayrollUnaffordableShare:ratio(short.length,rs.length),debtCreatesShortfallShare:ratio(rs.filter(r=>r.debtCreatesShortfall).length,rs.length),creditRepairsShortfallShare:ratio(rs.filter(r=>r.creditRepairsShortfall).length,rs.length),laterRevenueCouldCoverShareOfShortfalls:ratio(short.filter(r=>r.laterRevenueCouldCoverShortfall).length,short.length),laterGrossInflowsCouldCoverShareOfShortfalls:ratio(short.filter(r=>r.laterGrossInflowsCouldCoverShortfall).length,short.length),negativeCashOperatingMarginShare:ratio(rs.filter(r=>r.cashOperatingMargin<-TOL).length,rs.length),meanRevenueToPayroll:mean(rs.map(r=>r.revenueToPayroll)),meanRevenueToOperatingCashCost:mean(rs.map(r=>r.revenueToOperatingCashCost)),meanPrePayrollRevenueShare:mean(rs.filter(r=>r.finalRevenue>EPS).map(r=>r.prePayrollRevenueShare)),meanDebtServiceDrain:mean(rs.map(r=>r.debtServiceDrain)),meanCreditCashGain:mean(rs.map(r=>r.creditCashGain)),meanPayrollDue:mean(rs.map(r=>r.payrollDue)),meanInputSpend:mean(rs.map(r=>r.inputSpend)),meanFinalRevenue:mean(rs.map(r=>r.finalRevenue)),meanLaterRevenue:mean(rs.map(r=>r.laterRevenue))};}
const summary=[],industrySummary=[];for(const s of scales)for(const w of windows){const rs=firmRows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to);summary.push({scaleProfile:s,window:w.id,...agg(rs)});for(const industryId of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])industrySummary.push({scaleProfile:s,window:w.id,industryId,...agg(rs.filter(r=>r.industryId===industryId))});}
const maxGdpResidual=Math.max(0,...countryRows.map(r=>Math.abs(r.gdpResidual)));
const gates={observerNonInterferenceExact:ni.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCountryCoverage:countryRows.length===scales.length*seeds.length*months*4,firmRowsPresent:firmRows.length>0,allStageSnapshotsMatched:firmRows.every(r=>Number.isFinite(r.cashPreDebt)&&Number.isFinite(r.cashPostFiscal)),ledgerCountriesOk:countryRows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:firmRows.every(r=>Number.isFinite(r.revenueToOperatingCashCost)&&Number.isFinite(r.cashOperatingMargin))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P17 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.map(x=>({scale:x.scaleProfile,window:x.window,unaff:+x.prePayrollUnaffordableShare.toFixed(4),debtFlip:+x.debtCreatesShortfallShare.toFixed(4),creditRepair:+x.creditRepairsShortfallShare.toFixed(4),laterRevCover:+x.laterRevenueCouldCoverShareOfShortfalls.toFixed(4),laterGrossCover:+x.laterGrossInflowsCouldCoverShareOfShortfalls.toFixed(4),negMargin:+x.negativeCashOperatingMarginShare.toFixed(4),revPayroll:+x.meanRevenueToPayroll.toFixed(3),revOpCost:+x.meanRevenueToOperatingCashCost.toFixed(3),preRevShare:+x.meanPrePayrollRevenueShare.toFixed(3)})));
console.log('WP_RV07_P17_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P17',title:'Firm cash-cycle timing and operating margin diagnosis',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},nonInterference:ni,gates,reconciliation:{maxGdpResidual},summary,industrySummary,firmRows,countryRows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P17_OUTPUT',outputJson);}
