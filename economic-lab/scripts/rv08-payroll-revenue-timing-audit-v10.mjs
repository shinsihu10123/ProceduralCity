import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const modes=(process.env.DIAG_MODES||'canonical,ramp-grace').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(8,Number(process.env.DIAG_MONTHS||18));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7,UP=0.12,GRACE_DISTRESS=24;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const Q=(a,p)=>{if(!a.length)return 0;const x=[...a].sort((u,v)=>u-v),i=Math.max(0,Math.min(x.length-1,Math.floor((x.length-1)*p)));return x[i];};
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function oneWorkerCapacity(c,f){const capitalEffect=.72+Math.log1p(Math.max(0,F(f.capitalStock)))*.105,humanEffect=.82+F(c.humanCapital)*.30,resourceEffect=f.industryId==='RESOURCE'?.62+F(c.resourceBase)*.62:1,planEffect=1+CL(f.currentPlan?.productionChange||0,-.12,.15);return Math.max(EPS,F(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installNormalization(w,base){const target=targetSectors(base),done=new Set();w.__ajNorm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__ajNorm++;}}done.add(c.id);return out;};}

function installRampGrace(w,mode){
  w.__ajInterventions=0;
  if(mode!=='ramp-grace')return;
  const credit=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    const result=credit(c,month,signals);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f)));
      const inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const viable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      const current=Math.max(0,F(f.workers)),canonical=Math.max(0,F(f.desiredWorkers));
      if(viable&&physical>current){const ramp=Math.max(current,Math.round(Math.max(1,current)*(1+UP))),applied=Math.max(canonical,Math.min(physical,ramp));if(Math.abs(applied-canonical)>TOL){f.desiredWorkers=applied;w.__ajInterventions++;}}
    }
    return result;
  };
  w.supply.evaluateExits=c=>{
    const exited=[];
    for(const f of c.firms.filter(x=>x.active!==false)){
      const cash=w.ledger.balance(f.accountId),severePayroll=F(f.wageArrears)>Math.max(100,F(f.wage)*Math.max(1,F(f.workers))*1.35),severeCredit=F(f.creditMisses)>=5,liquidity=cash<F(f.safeCash)*.025&&severePayroll;
      if(liquidity||severeCredit)f.distressMonths=F(f.distressMonths)+1;else f.distressMonths=Math.max(0,F(f.distressMonths)-1);
      if(f.distressMonths<GRACE_DISTRESS)continue;
      f.active=false;f.desiredWorkers=0;f.desiredProduction=0;for(const h of c.households)if(h.employerId===f.id){h.employed=false;h.employerId=null;}f.workers=0;exited.push(f.industryId);
    }
    return exited;
  };
}

function installAudit(w,base){
  w.__ajPlan=new Map();w.__ajOpen=new Map();w.__ajRows=[];
  const plan=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=plan(c);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const planViable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      w.__ajPlan.set(`${w.month}|${c.id}|${f.id}`,{rawPlan,physical,margin,planViable});
    }
    return out;
  };

  const accrue=w.accounting.accrueMonthlyWages.bind(w.accounting);
  w.accounting.accrueMonthlyWages=(c,month)=>{
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const planRow=w.__ajPlan.get(`${w.month}|${c.id}|${f.id}`);if(!planRow)continue;
      const staff=c.households.filter(h=>h.employed&&h.employerId===f.id);
      const priorArrears=S(staff.map(h=>Math.max(0,F(h.wageArrears)))),basePayroll=F(f.wage)*staff.length,arrearsService=S(staff.map(h=>Math.min(Math.max(0,F(h.wageArrears)),F(f.wage)*.5))),totalDue=basePayroll+arrearsService;
      w.__ajOpen.set(`${w.month}|${c.id}|${f.id}`,{month:w.month,countryId:c.id,firmId:f.id,base,planViable:planRow.planViable,rawPlan:planRow.rawPlan,physicalWorkers:planRow.physical,workers:staff.length,wage:F(f.wage),priorArrears,basePayroll,arrearsService,totalDue,cashBeforePayroll:w.ledger.balance(f.accountId),prePayrollRevenue:F(f.revenue),inputSpend:F(f.inputSpend),output:F(f.output)});
    }
    return accrue(c,month);
  };

  const incomeTax=w.fiscal.collectIncomeTaxes.bind(w.fiscal);
  w.fiscal.collectIncomeTaxes=(c,month)=>{
    const wages=w.ledger.entriesFor({month:w.month,countryId:c.id,kind:'wage'}),paidByFirm=new Map();
    for(const e of wages){const id=e.meta?.firmId;if(id)paidByFirm.set(id,(paidByFirm.get(id)||0)+F(e.amount));}
    for(const f of c.firms.filter(x=>x.industryId==='CONSUMER')){const row=w.__ajOpen.get(`${w.month}|${c.id}|${f.id}`);if(row){row.paidPayroll=paidByFirm.get(f.id)||0;row.cashAfterPayroll=w.ledger.balance(f.accountId);}}
    return incomeTax(c,month);
  };

  const consumptionTax=w.fiscal.collectConsumptionTaxes.bind(w.fiscal);
  w.fiscal.collectConsumptionTaxes=(c,month)=>{
    for(const f of c.firms.filter(x=>x.industryId==='CONSUMER')){const row=w.__ajOpen.get(`${w.month}|${c.id}|${f.id}`);if(row){row.consumerRevenue=F(f.consumerRevenue);row.revenueAfterGoods=F(f.revenue);row.cashAfterGoods=w.ledger.balance(f.accountId);}}
    return consumptionTax(c,month);
  };

  const exits=w.supply.evaluateExits.bind(w.supply);
  w.supply.evaluateExits=c=>{
    for(const f of c.firms.filter(x=>x.industryId==='CONSUMER')){
      const key=`${w.month}|${c.id}|${f.id}`,row=w.__ajOpen.get(key);if(!row)continue;
      row.endRevenue=F(f.revenue);row.postPayrollRevenue=Math.max(0,row.endRevenue-row.prePayrollRevenue);row.postPayrollConsumerRevenue=Math.max(0,F(row.consumerRevenue));row.cashBeforeExit=w.ledger.balance(f.accountId);
      row.cashGapBase=Math.max(0,row.basePayroll-row.cashBeforePayroll);row.cashGapTotal=Math.max(0,row.totalDue-row.cashBeforePayroll);row.paidBaseGap=Math.max(0,row.basePayroll-F(row.paidPayroll));row.paidTotalGap=Math.max(0,row.totalDue-F(row.paidPayroll));
      row.consumerRevenueCoverage=row.cashGapBase>EPS?row.postPayrollConsumerRevenue/row.cashGapBase:1;row.totalPostRevenueCoverage=row.cashGapBase>EPS?row.postPayrollRevenue/row.cashGapBase:1;
      row.baseAffordableWithConsumer=row.cashBeforePayroll+row.postPayrollConsumerRevenue+TOL>=row.basePayroll;row.baseAffordableWithTotalRevenue=row.cashBeforePayroll+row.postPayrollRevenue+TOL>=row.basePayroll;
      row.totalDueAffordableWithTotalRevenue=row.cashBeforePayroll+row.postPayrollRevenue+TOL>=row.totalDue;
      row.currentUnderpaid=F(row.paidPayroll)+TOL<row.basePayroll;row.timingCandidate=row.currentUnderpaid&&row.baseAffordableWithTotalRevenue;row.consumerTimingCandidate=row.currentUnderpaid&&row.baseAffordableWithConsumer;row.operatingGapAfterRevenue=row.currentUnderpaid&&!row.baseAffordableWithTotalRevenue;
      w.__ajRows.push(row);w.__ajOpen.delete(key);
    }
    return exits(c);
  };
}

function summarize(rows){
  const v=rows.filter(r=>r.planViable),g=v.filter(r=>r.cashGapBase>EPS),u=v.filter(r=>r.currentUnderpaid),den=Math.max(1,v.length),uden=Math.max(1,u.length),gap=S(g.map(r=>r.cashGapBase));
  return{rows:rows.length,planViableRows:v.length,sharePlanViable:rows.length?v.length/rows.length:0,meanWorkers:M(v.map(r=>r.workers)),meanPhysicalWorkers:M(v.map(r=>r.physicalWorkers)),meanCashBeforePayroll:M(v.map(r=>r.cashBeforePayroll)),meanBasePayroll:M(v.map(r=>r.basePayroll)),meanPaidPayroll:M(v.map(r=>F(r.paidPayroll))),meanPostPayrollConsumerRevenue:M(v.map(r=>r.postPayrollConsumerRevenue)),meanPostPayrollRevenue:M(v.map(r=>r.postPayrollRevenue)),shareCashGapBase:g.length/den,shareCurrentUnderpaid:u.length/den,shareTimingCandidate:v.filter(r=>r.timingCandidate).length/den,shareConsumerTimingCandidate:v.filter(r=>r.consumerTimingCandidate).length/den,shareOperatingGapAfterRevenue:v.filter(r=>r.operatingGapAfterRevenue).length/den,shareUnderpaidTimingCandidate:u.filter(r=>r.timingCandidate).length/uden,shareUnderpaidConsumerTimingCandidate:u.filter(r=>r.consumerTimingCandidate).length/uden,shareUnderpaidOperatingGap:u.filter(r=>r.operatingGapAfterRevenue).length/uden,aggregateBaseCashGap:gap,aggregatePostPayrollRevenue:S(g.map(r=>r.postPayrollRevenue)),aggregateConsumerRevenue:S(g.map(r=>r.postPayrollConsumerRevenue)),aggregateRevenueToGap:gap>EPS?S(g.map(r=>r.postPayrollRevenue))/gap:0,p50RevenueToGap:Q(g.map(r=>r.totalPostRevenueCoverage),.5),shareArrearsServiceOnly:v.filter(r=>r.cashBeforePayroll+TOL>=r.basePayroll&&r.cashBeforePayroll+TOL<r.totalDue).length/den};
}

function runOne(base,seed,mode){
  const w=makeWorld(seed);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});
  installNormalization(w,base);installRampGrace(w,mode);installAudit(w,base);
  const monthly=[];for(let i=0;i<months;i++){w.stepMonth();monthly.push({month:w.month,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),arrears:S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears))))),linked:S(w.countries.flatMap(c=>c.households.filter(h=>h.employed&&h.employerId).map(h=>Math.max(0,F(h.wageArrears))))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output))))});}
  const health=w.forceHealthCheck();assert.ok(health.ok,`${base}/${seed}/${mode}: health`);const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${base}/${seed}/${mode}: accounting`);
  const timing=summarize(w.__ajRows);assert.ok(timing.planViableRows>0,`${base}/${seed}/${mode}: no viable rows`);const tail=monthly.slice(-6);
  return{base,seed,mode,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__ajNorm,interventions:w.__ajInterventions,timing,summary:{unemployment:M(monthly.map(x=>x.unemployment)),terminalUnemployment:M(tail.map(x=>x.unemployment)),arrears:M(monthly.map(x=>x.arrears)),terminalArrears:M(tail.map(x=>x.arrears)),linked:M(monthly.map(x=>x.linked)),terminalLinked:M(tail.map(x=>x.linked)),gdp:M(monthly.map(x=>x.gdp)),output:M(monthly.map(x=>x.output))}};
}

const runs=[];for(const base of bases)for(const seed of seeds)for(const mode of modes)runs.push(runOne(base,seed,mode));
const finite=runs.every(r=>Object.values({...r.summary,...r.timing}).every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({base:r.base,seed:r.seed,mode:r.mode,u:r.summary.unemployment,u6:r.summary.terminalUnemployment,arrears:r.summary.arrears,linked:r.summary.linked,gdp:r.summary.gdp,output:r.summary.output,viable:r.timing.planViableRows,cashGap:r.timing.shareCashGapBase,underpaid:r.timing.shareCurrentUnderpaid,timing:r.timing.shareTimingCandidate,consumerTiming:r.timing.shareConsumerTimingCandidate,operating:r.timing.shareOperatingGapAfterRevenue,underpaidTiming:r.timing.shareUnderpaidTimingCandidate,underpaidOperating:r.timing.shareUnderpaidOperatingGap,revenueGap:r.timing.aggregateRevenueToGap,basePayroll:r.timing.meanBasePayroll,paidPayroll:r.timing.meanPaidPayroll,postRevenue:r.timing.meanPostPayrollRevenue}));
const report={workPackage:'WP-RV08-R4-AJ',title:'Payroll-Before-Revenue Working-Capital Timing Audit',note:'Observational timing audit. No settlement, credit, wage, price, tax or canonical exit repair is introduced. ramp-grace is a previously established diagnostic exposure regime.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,modes,months},gates:{allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===bases.length*seeds.length*modes.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),consumerPlanViableObserved:runs.every(r=>r.timing.planViableRows>0),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
