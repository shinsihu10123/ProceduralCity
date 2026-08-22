import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const states=(process.env.DIAG_STATES||'canonical,ramp-grace').split(',').map(x=>x.trim()).filter(Boolean);
const bridges=(process.env.DIAG_BRIDGES||'control,gap-bridge,sales-backed,inventory-backed').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(8,Number(process.env.DIAG_MONTHS||18));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7,UP=0.12,GRACE_DISTRESS=24;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function oneWorkerCapacity(c,f){const capitalEffect=.72+Math.log1p(Math.max(0,F(f.capitalStock)))*.105,humanEffect=.82+F(c.humanCapital)*.30,resourceEffect=f.industryId==='RESOURCE'?.62+F(c.resourceBase)*.62:1,planEffect=1+CL(f.currentPlan?.productionChange||0,-.12,.15);return Math.max(EPS,F(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}

function installNormalization(w,base){const target=targetSectors(base),done=new Set();w.__akNorm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__akNorm++;}}done.add(c.id);return out;};}

function installRampGrace(w,state){w.__akStaffInterventions=0;if(state!=='ramp-grace')return;const credit=w.banking.originateCredit.bind(w.banking);w.banking.originateCredit=(c,month,signals)=>{const result=credit(c,month,signals);for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice,viable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage)),current=Math.max(0,F(f.workers)),canonical=Math.max(0,F(f.desiredWorkers));if(viable&&physical>current){const ramp=Math.max(current,Math.round(Math.max(1,current)*(1+UP))),applied=Math.max(canonical,Math.min(physical,ramp));if(Math.abs(applied-canonical)>TOL){f.desiredWorkers=applied;w.__akStaffInterventions++;}}}return result;};w.supply.evaluateExits=c=>{const exited=[];for(const f of c.firms.filter(x=>x.active!==false)){const cash=w.ledger.balance(f.accountId),severePayroll=F(f.wageArrears)>Math.max(100,F(f.wage)*Math.max(1,F(f.workers))*1.35),severeCredit=F(f.creditMisses)>=5,liquidity=cash<F(f.safeCash)*.025&&severePayroll;if(liquidity||severeCredit)f.distressMonths=F(f.distressMonths)+1;else f.distressMonths=Math.max(0,F(f.distressMonths)-1);if(f.distressMonths<GRACE_DISTRESS)continue;f.active=false;f.desiredWorkers=0;f.desiredProduction=0;for(const h of c.households)if(h.employerId===f.id){h.employed=false;h.employerId=null;}f.workers=0;exited.push(f.industryId);}return exited;};}

function installBridge(w,bridge){
  w.__akPlan=new Map();w.__akBridgeEvents=[];w.__akBridgeLoans=[];
  const plan=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{const out=plan(c);for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice,viable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));w.__akPlan.set(`${w.month}|${c.id}|${f.id}`,{viable,rawPlan,physical});}return out;};

  function createBridge(c,f,amount,meta){
    if(!(amount>EPS))return 0;
    const bank=c.banks[0];
    const created=w.ledger.adjustMoney({month:w.month,countryId:c.id,accountId:f.accountId,amount,kind:'diagnostic_payroll_bridge_origination',meta:{bankId:bank.id,borrowerId:f.id,bridgeRegime:bridge}});
    if(!(created>EPS))return 0;
    const loan={id:`BRG-${String(w.banking.loanSequence++).padStart(8,'0')}`,countryId:c.id,bankId:bank.id,borrowerId:f.id,borrowerKind:'firm',originalPrincipal:created,outstanding:created,annualRate:0,monthlyRate:0,termMonths:1,originatedMonth:w.month,nextPaymentMonth:w.month+1,missedPayments:0,arrears:0,status:'active',estimatedDefaultProbabilityAtOrigination:0,diagnosticPayrollBridge:true,bridgeRegime:bridge};
    c.loans.push(loan);f.loanBalance=F(f.loanBalance)+created;w.accounting.recordLoanOrigination({country:c,bank,borrower:f,loan,month:w.month,amount:created});
    const event={loanId:loan.id,countryId:c.id,firmId:f.id,month:w.month,bridge,created,sameMonthRepaid:0,basePayroll:meta.basePayroll,cashBefore:meta.cashBefore,gap:meta.gap,priorSalesValue:meta.priorSalesValue,inventoryValue:meta.inventoryValue};
    w.__akBridgeLoans.push(loan);w.__akBridgeEvents.push(event);return created;
  }

  const accrue=w.accounting.accrueMonthlyWages.bind(w.accounting);
  w.accounting.accrueMonthlyWages=(c,month)=>{
    if(bridge!=='control'){
      for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
        const p=w.__akPlan.get(`${w.month}|${c.id}|${f.id}`);if(!p?.viable)continue;
        const workers=c.households.filter(h=>h.employed&&h.employerId===f.id).length,basePayroll=Math.max(0,F(f.wage)*workers),cashBefore=w.ledger.balance(f.accountId),gap=Math.max(0,basePayroll-cashBefore);if(gap<=EPS)continue;
        const priorSalesValue=Math.max(0,F(f.previousSales)*F(f.price)),inventoryValue=Math.max(0,F(f.inventory)*F(f.price));
        let amount=0;if(bridge==='gap-bridge')amount=gap;else if(bridge==='sales-backed')amount=Math.min(gap,priorSalesValue);else if(bridge==='inventory-backed')amount=Math.min(gap,inventoryValue);
        createBridge(c,f,amount,{basePayroll,cashBefore,gap,priorSalesValue,inventoryValue});
      }
    }
    return accrue(c,month);
  };

  const corporateTax=w.fiscal.collectCorporateTaxes.bind(w.fiscal);
  w.fiscal.collectCorporateTaxes=(c,month)=>{
    const result=corporateTax(c,month);
    const bank=c.banks[0],firmMap=new Map(c.firms.map(f=>[f.id,f]));
    for(const event of w.__akBridgeEvents.filter(e=>e.countryId===c.id&&e.month===w.month)){
      const loan=c.loans.find(l=>l.id===event.loanId);if(!loan||loan.status!=='active'||loan.outstanding<=EPS)continue;const f=firmMap.get(loan.borrowerId);if(!f)continue;
      const cash=Math.max(0,w.ledger.balance(f.accountId)),revenueCap=Math.max(0,F(f.consumerRevenue)),requested=Math.min(loan.outstanding,cash,revenueCap);
      if(requested<=EPS)continue;
      const delta=w.ledger.adjustMoney({month:w.month,countryId:c.id,accountId:f.accountId,amount:-requested,kind:'diagnostic_payroll_bridge_payment',meta:{loanId:loan.id,bankId:bank.id,borrowerId:f.id,bridgeRegime:bridge}}),paid=Math.max(0,-delta);
      if(paid<=EPS)continue;
      w.accounting.recordLoanPayment({country:c,bank,borrower:f,loan,month:w.month,principalPaid:paid,interestPaid:0});loan.outstanding=Math.max(0,loan.outstanding-paid);f.loanBalance=Math.max(0,F(f.loanBalance)-paid);event.sameMonthRepaid+=paid;
      if(loan.outstanding<=EPS){loan.outstanding=0;loan.status='repaid';loan.arrears=0;}
    }
    return result;
  };

  const combine=w.banking.combineMetrics.bind(w.banking);
  w.banking.combineMetrics=(debt,origin,c)=>{const out=combine(debt,origin,c);out.outstandingLoans=c.loans.reduce((s,l)=>s+(l.status==='active'?Math.max(0,F(l.outstanding)):0),0);return out;};
}

function bridgeSummary(w){const events=w.__akBridgeEvents||[],loans=w.__akBridgeLoans||[],created=S(events.map(e=>e.created)),same=S(events.map(e=>e.sameMonthRepaid)),outstanding=S(loans.filter(l=>l.status==='active').map(l=>l.outstanding));return{draws:events.length,totalCreated:created,sameMonthRepaid:same,sameMonthRepaymentRatio:created>EPS?same/created:1,fullyRepaidSameMonth:events.length?events.filter(e=>e.sameMonthRepaid+TOL>=e.created).length/events.length:1,meanDraw:events.length?created/events.length:0,horizonOutstanding:outstanding,horizonOutstandingRatio:created>EPS?outstanding/created:0,repaidLoans:loans.filter(l=>l.status==='repaid').length,activeLoans:loans.filter(l=>l.status==='active').length,defaultedLoans:loans.filter(l=>l.status==='defaulted').length};}

function runOne(base,seed,state,bridge){const w=makeWorld(seed);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});installNormalization(w,base);installRampGrace(w,state);installBridge(w,bridge);const monthly=[];for(let i=0;i<months;i++){w.stepMonth();monthly.push({month:w.month,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),arrears:S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears))))),linked:S(w.countries.flatMap(c=>c.households.filter(h=>h.employed&&h.employerId).map(h=>Math.max(0,F(h.wageArrears))))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output)))),active:S(w.countries.map(c=>c.firms.filter(f=>f.active!==false).length))});}const health=w.forceHealthCheck();assert.ok(health.ok,`${base}/${seed}/${state}/${bridge}: health`);const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${base}/${seed}/${state}/${bridge}: accounting`);const bs=bridgeSummary(w);if(bridge!=='control')assert.ok(bs.draws>0,`${base}/${seed}/${state}/${bridge}: no bridge draws`);const tail=monthly.slice(-6);return{base,seed,state,bridge,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__akNorm,staffInterventions:w.__akStaffInterventions,bridgeSummary:bs,summary:{unemployment:M(monthly.map(x=>x.unemployment)),terminalUnemployment:M(tail.map(x=>x.unemployment)),arrears:M(monthly.map(x=>x.arrears)),terminalArrears:M(tail.map(x=>x.arrears)),linked:M(monthly.map(x=>x.linked)),terminalLinked:M(tail.map(x=>x.linked)),gdp:M(monthly.map(x=>x.gdp)),output:M(monthly.map(x=>x.output)),active:M(monthly.map(x=>x.active))},monthly};}

const runs=[];for(const base of bases)for(const seed of seeds)for(const state of states)for(const bridge of bridges)runs.push(runOne(base,seed,state,bridge));
const finite=runs.every(r=>Object.values({...r.summary,...r.bridgeSummary}).every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({base:r.base,seed:r.seed,state:r.state,bridge:r.bridge,u:r.summary.unemployment,u6:r.summary.terminalUnemployment,arrears:r.summary.arrears,arrears6:r.summary.terminalArrears,linked:r.summary.linked,linked6:r.summary.terminalLinked,gdp:r.summary.gdp,output:r.summary.output,active:r.summary.active,draws:r.bridgeSummary.draws,created:r.bridgeSummary.totalCreated,sameMonthRepaid:r.bridgeSummary.sameMonthRepaid,sameMonthRatio:r.bridgeSummary.sameMonthRepaymentRatio,fullySameMonth:r.bridgeSummary.fullyRepaidSameMonth,meanDraw:r.bridgeSummary.meanDraw,outstanding:r.bridgeSummary.horizonOutstanding,outstandingRatio:r.bridgeSummary.horizonOutstandingRatio,repaidLoans:r.bridgeSummary.repaidLoans,activeLoans:r.bridgeSummary.activeLoans,defaultedLoans:r.bridgeSummary.defaultedLoans}));
const report={workPackage:'WP-RV08-R4-AK',title:'Accounting-Preserving Payroll Working-Capital Bridge Ablation',note:'Diagnostic only. Bridge draws are booked loans. Backed variants use only pre-payroll information; same-month repayment is capped by actual consumer revenue and cash after corporate tax.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,states,bridges,months,upwardRamp:UP,graceDistressMonths:GRACE_DISTRESS},gates:{allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===bases.length*seeds.length*states.length*bridges.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),bridgeDrawsObserved:runs.filter(r=>r.bridge!=='control').every(r=>r.bridgeSummary.draws>0),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
