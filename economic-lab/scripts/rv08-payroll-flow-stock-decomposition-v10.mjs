import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const regimes=(process.env.DIAG_REGIMES||'control,mean3-immediate,mean3-ramp,floor3-ramp,hysteresis-ramp').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(24,Number(process.env.DIAG_MONTHS||36));
const checkMonths=Math.max(3,Number(process.env.DIAG_CHECK_MONTHS||6));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-6,UP=0.12,DOWN=0.10,GRACE_DISTRESS=24;
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
function enableExactDiagnosticLaborRuntime(w){for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__aoNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__aoNorm++;}
    }
    done.add(c.id);return out;
  };
}

function moveToward(current,target){
  current=Math.max(0,Math.round(F(current)));target=Math.max(0,Math.round(F(target)));
  if(target>current){const up=Math.max(current,Math.round(Math.max(1,current)*(1+UP)));return Math.min(target,up);}
  if(target<current){const down=Math.max(0,Math.round(Math.max(1,current)*(1-DOWN)));return Math.max(target,down);}
  return current;
}

function installEnvelopeState(w,regime){
  w.__aoHistory=new Map();w.__aoDecisionRows=[];w.__aoInterventions=0;w.__aoExits=0;
  const credit=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    const result=credit(c,month,signals);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const planViable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      const current=Math.max(0,Math.round(F(f.workers))),canonical=Math.max(0,Math.round(F(f.desiredWorkers))),key=`${c.id}|${f.id}`,hist=(w.__aoHistory.get(key)||[]).slice(-3),wage=Math.max(EPS,F(f.wage));
      const ready=hist.length===3,meanSupport=ready?Math.max(0,Math.floor(M(hist)/wage)):null,floorSupport=ready?Math.max(0,Math.floor(Math.min(...hist)/wage)):null;
      let target=canonical;
      if(planViable){
        if(regime==='control'||!ready){if(physical>current)target=Math.max(canonical,Math.min(physical,moveToward(current,physical)));}
        else if(regime==='mean3-immediate')target=Math.min(physical,meanSupport);
        else if(regime==='mean3-ramp')target=moveToward(current,Math.min(physical,meanSupport));
        else if(regime==='floor3-ramp')target=moveToward(current,Math.min(physical,floorSupport));
        else if(regime==='hysteresis-ramp'){
          let raw=current;
          if(meanSupport>current)raw=Math.min(physical,meanSupport);
          else if(floorSupport<current)raw=Math.min(physical,floorSupport);
          target=moveToward(current,raw);
        } else throw new Error(`unknown regime ${regime}`);
      }
      target=Math.max(0,Math.round(F(target)));
      if(Math.abs(target-canonical)>TOL){f.desiredWorkers=target;w.__aoInterventions++;}
      w.__aoDecisionRows.push({month:w.month,countryId:c.id,firmId:f.id,regime,planViable,ready,current,canonical,physical,meanSupport,floorSupport,target});
    }
    return result;
  };

  w.supply.evaluateExits=c=>{
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const key=`${c.id}|${f.id}`,hist=w.__aoHistory.get(key)||[],contribution=Math.max(0,F(f.revenue)-F(f.inputSpend));hist.push(contribution);while(hist.length>3)hist.shift();w.__aoHistory.set(key,hist);
    }
    const exited=[];
    for(const f of c.firms.filter(x=>x.active!==false)){
      const cash=w.ledger.balance(f.accountId),severePayroll=F(f.wageArrears)>Math.max(100,F(f.wage)*Math.max(1,F(f.workers))*1.35),severeCredit=F(f.creditMisses)>=5,liquidity=cash<F(f.safeCash)*.025&&severePayroll;
      if(liquidity||severeCredit)f.distressMonths=F(f.distressMonths)+1;else f.distressMonths=Math.max(0,F(f.distressMonths)-1);
      if(f.distressMonths<GRACE_DISTRESS)continue;
      f.active=false;f.desiredWorkers=0;f.desiredProduction=0;
      for(const h of c.households)if(h.employerId===f.id){h.employed=false;h.employerId=null;}
      f.workers=0;exited.push(f.industryId);w.__aoExits++;
    }
    return exited;
  };
}

function installPayrollFlowObserver(w){
  w.__aoWageRows=[];
  w.__aoClaims=new Map();
  const claimsFor=householdId=>{
    if(!w.__aoClaims.has(householdId))w.__aoClaims.set(householdId,new Map());
    return w.__aoClaims.get(householdId);
  };
  const claimSum=m=>S([...m.values()]);
  const original=w.ledger.transfer.bind(w.ledger);
  w.ledger.transfer=args=>{
    if(args?.kind!=='wage')return original(args);
    const country=w.countries.find(c=>c.id===args.countryId);
    const household=country?.households.find(h=>h.id===args.meta?.householdId);
    const firm=country?.firms.find(f=>f.id===args.meta?.firmId);
    const origin=String(args.meta?.firmId||'UNKNOWN'),claims=claimsFor(args.meta?.householdId),priorArrears=Math.max(0,F(household?.wageArrears)),priorClaimTotal=claimSum(claims),priorSame=Math.max(0,F(claims.get(origin))),priorOther=Math.max(0,priorClaimTotal-priorSame);
    const currentDue=Math.max(0,F(firm?.wage)),attemptedLegacy=Math.min(priorArrears,currentDue*.5),attemptedCrossEmployerLegacy=Math.max(0,attemptedLegacy-priorSame),requested=Math.max(0,F(args.amount));
    const paid=original(args),currentPaid=Math.min(currentDue,paid),currentShortfall=Math.max(0,currentDue-currentPaid),legacyPaid=Math.max(0,paid-currentPaid),sameOriginLegacyPaid=Math.min(priorSame,legacyPaid),crossEmployerLegacyPaid=Math.max(0,legacyPaid-sameOriginLegacyPaid);
    let remaining=legacyPaid;
    if(remaining>EPS&&priorSame>EPS){const x=Math.min(priorSame,remaining),left=priorSame-x;if(left>EPS)claims.set(origin,left);else claims.delete(origin);remaining-=x;}
    if(remaining>EPS){
      for(const [firmId,amount0] of [...claims.entries()].filter(([firmId])=>firmId!==origin).sort((a,b)=>a[0].localeCompare(b[0]))){
        if(remaining<=EPS)break;const amount=Math.max(0,F(amount0)),x=Math.min(amount,remaining),left=amount-x;if(left>EPS)claims.set(firmId,left);else claims.delete(firmId);remaining-=x;
      }
    }
    if(currentShortfall>EPS)claims.set(origin,Math.max(0,F(claims.get(origin)))+currentShortfall);
    const expectedClose=Math.max(0,priorArrears+currentDue-paid),claimClose=claimSum(claims);
    w.__aoWageRows.push({month:w.month,countryId:args.countryId,firmId:origin,householdId:args.meta?.householdId,priorArrears,priorClaimTotal,priorSame,priorOther,currentDue,attemptedLegacy,attemptedCrossEmployerLegacy,requested,paid,currentPaid,currentShortfall,legacyPaid,sameOriginLegacyPaid,crossEmployerLegacyPaid,expectedClose,claimClose});
    return paid;
  };
}

function arrearsTotal(w){return S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears)))));}
function claimTotal(w){let total=0;for(const claims of w.__aoClaims?.values?.()||[])total+=S([...claims.values()]);return total;}
function fingerprint(w){return JSON.stringify({month:w.month,countries:w.countries.map(c=>({id:c.id,macro:c.macro,firms:c.firms.map(f=>[f.id,f.active!==false,F(f.workers),F(f.desiredWorkers),F(f.output),F(f.sales),F(f.revenue),F(f.inventory),F(f.inputSpend),F(f.wageArrears),F(f.loanBalance),F(f.distressMonths),w.ledger.balance(f.accountId)]),households:c.households.map(h=>[h.id,!!h.employed,h.employerId,F(h.income),F(h.wageArrears),w.ledger.balance(h.accountId)]),settlement:w.ledger.totalBalance(c.id)}))});}

function buildWorld(seed,base,regime,observe=false){
  const w=makeWorld(seed);enableExactDiagnosticLaborRuntime(w);installNormalization(w,base);installEnvelopeState(w,regime);if(observe)installPayrollFlowObserver(w);return w;
}
function verifyObserverNoninterference(seed,base,regime){
  const a=buildWorld(seed,base,regime,false),b=buildWorld(seed,base,regime,true);
  for(let i=0;i<checkMonths;i++){a.stepMonth();b.stepMonth();}
  return fingerprint(a)===fingerprint(b);
}

function runOne(seed,base,regime){
  const observerNoninterference=verifyObserverNoninterference(seed,base,regime);assert.ok(observerNoninterference,`${regime}/${base}/${seed}: observer changed state`);
  const w=buildWorld(seed,base,regime,true),monthly=[],openingArrears=arrearsTotal(w);
  let priorStock=openingArrears,maxFlowResidual=0;
  for(let i=0;i<months;i++){
    const rowStart=w.__aoWageRows.length;
    w.stepMonth();
    const wageRows=w.__aoWageRows.slice(rowStart),currentDue=S(wageRows.map(r=>r.currentDue)),currentPaid=S(wageRows.map(r=>r.currentPaid)),currentShortfall=S(wageRows.map(r=>r.currentShortfall)),attemptedLegacy=S(wageRows.map(r=>r.attemptedLegacy)),attemptedCrossEmployerLegacy=S(wageRows.map(r=>r.attemptedCrossEmployerLegacy)),legacyPaid=S(wageRows.map(r=>r.legacyPaid)),crossEmployerLegacyPaid=S(wageRows.map(r=>r.crossEmployerLegacyPaid)),paid=S(wageRows.map(r=>r.paid)),stock=arrearsTotal(w),claims=claimTotal(w),flowResidual=(stock-priorStock)-(currentShortfall-legacyPaid),claimResidual=stock-claims;
    maxFlowResidual=Math.max(maxFlowResidual,Math.abs(flowResidual),Math.abs(claimResidual));
    monthly.push({month:w.month,currentDue,currentPaid,currentShortfall,attemptedLegacy,attemptedCrossEmployerLegacy,legacyPaid,crossEmployerLegacyPaid,paid,stock,claims,flowResidual,claimResidual,carriedOtherClaimPayments:wageRows.filter(r=>r.priorOther>TOL).length,wagePayments:wageRows.length,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),linked:S(w.countries.flatMap(c=>c.households.filter(h=>h.employed&&h.employerId).map(h=>Math.max(0,F(h.wageArrears))))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output))))});
    priorStock=stock;
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${regime}/${base}/${seed}: health`);
  const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
  assert.ok(accountingOk&&ledgerOk&&gdpOk,`${regime}/${base}/${seed}: accounting`);
  assert.ok(maxFlowResidual<1e-4,`${regime}/${base}/${seed}: arrears flow reconciliation ${maxFlowResidual}`);

  const totalDue=S(monthly.map(x=>x.currentDue)),totalCurrentPaid=S(monthly.map(x=>x.currentPaid)),totalShortfall=S(monthly.map(x=>x.currentShortfall)),totalAttemptedLegacy=S(monthly.map(x=>x.attemptedLegacy)),totalAttemptedCross=S(monthly.map(x=>x.attemptedCrossEmployerLegacy)),totalLegacyPaid=S(monthly.map(x=>x.legacyPaid)),totalCrossPaid=S(monthly.map(x=>x.crossEmployerLegacyPaid)),totalPaid=S(monthly.map(x=>x.paid)),totalWagePayments=S(monthly.map(x=>x.wagePayments)),carriedOtherClaimPayments=S(monthly.map(x=>x.carriedOtherClaimPayments)),finalStock=monthly.at(-1)?.stock||0,tail=monthly.slice(-6);
  const flow={
    currentCoverage:totalDue>0?totalCurrentPaid/totalDue:1,
    currentShortfallRate:totalDue>0?totalShortfall/totalDue:0,
    legacyServiceCoverage:totalAttemptedLegacy>0?totalLegacyPaid/totalAttemptedLegacy:1,
    legacyShareOfPaid:totalPaid>0?totalLegacyPaid/totalPaid:0,
    crossEmployerShareOfLegacyPaid:totalLegacyPaid>0?totalCrossPaid/totalLegacyPaid:0,
    crossEmployerShareOfAllPaid:totalPaid>0?totalCrossPaid/totalPaid:0,
    attemptedCrossEmployerShare:totalAttemptedLegacy>0?totalAttemptedCross/totalAttemptedLegacy:0,
    shareWagePaymentsCarryingOtherEmployerClaims:totalWagePayments>0?carriedOtherClaimPayments/totalWagePayments:0,
    cumulativeCurrentShortfall:totalShortfall,
    cumulativeLegacyPaid:totalLegacyPaid,
    cumulativeCrossEmployerLegacyPaid:totalCrossPaid,
    openingArrears,
    finalArrears:finalStock,
    netArrearsCreation:finalStock-openingArrears,
    maxFlowResidual,
    monthsCurrentCoverage95:monthly.filter(x=>x.currentDue<=EPS||x.currentPaid/x.currentDue>=.95).length/Math.max(1,monthly.length),
    monthsStockDeclining:monthly.filter((x,j)=>j>0&&x.stock<monthly[j-1].stock-TOL).length/Math.max(1,monthly.length-1)
  };
  const summary={unemployment:M(monthly.map(x=>x.unemployment)),terminalUnemployment:M(tail.map(x=>x.unemployment)),arrears:M(monthly.map(x=>x.stock)),terminalArrears:M(tail.map(x=>x.stock)),linked:M(monthly.map(x=>x.linked)),terminalLinked:M(tail.map(x=>x.linked)),gdp:M(monthly.map(x=>x.gdp)),output:M(monthly.map(x=>x.output)),exits:w.__aoExits};
  return{seed,base,regime,months,observerNoninterference,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__aoNorm,interventions:w.__aoInterventions,flow,summary};
}

const runs=[];for(const base of bases)for(const seed of seeds)for(const regime of regimes)runs.push(runOne(seed,base,regime));
const finite=runs.every(r=>[...Object.values(r.summary),...Object.values(r.flow)].every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({seed:r.seed,base:r.base,regime:r.regime,u:r.summary.unemployment,u6:r.summary.terminalUnemployment,arrears:r.summary.arrears,linked:r.summary.linked,gdp:r.summary.gdp,output:r.summary.output,exits:r.summary.exits,currentCoverage:r.flow.currentCoverage,currentShortfallRate:r.flow.currentShortfallRate,legacyServiceCoverage:r.flow.legacyServiceCoverage,legacyShareOfPaid:r.flow.legacyShareOfPaid,crossEmployerShareOfLegacyPaid:r.flow.crossEmployerShareOfLegacyPaid,crossEmployerShareOfAllPaid:r.flow.crossEmployerShareOfAllPaid,attemptedCrossEmployerShare:r.flow.attemptedCrossEmployerShare,shareWagePaymentsCarryingOtherEmployerClaims:r.flow.shareWagePaymentsCarryingOtherEmployerClaims,cumulativeCurrentShortfall:r.flow.cumulativeCurrentShortfall,cumulativeLegacyPaid:r.flow.cumulativeLegacyPaid,cumulativeCrossEmployerLegacyPaid:r.flow.cumulativeCrossEmployerLegacyPaid,finalArrears:r.flow.finalArrears,netArrearsCreation:r.flow.netArrearsCreation,monthsCurrentCoverage95:r.flow.monthsCurrentCoverage95,monthsStockDeclining:r.flow.monthsStockDeclining,maxFlowResidual:r.flow.maxFlowResidual}));
const report={workPackage:'WP-RV08-R4-AO',title:'Payroll Flow / Legacy Arrears Stock / Claim-Provenance Decomposition',note:'Diagnostic-only observer layered on the R4-AN staffing regimes. It does not change wage, staffing, credit, tax, settlement, arrears, cash, write-off, or exit accounting. The observer records each canonical wage transfer, reconciles aggregate arrears-stock change to newly created current-wage shortfall minus legacy-arrears repayment, and reconstructs a conservative employer-of-origin ledger for arrears. Same-employer claims are assumed repaid first, so measured cross-employer legacy payments are a lower bound on the burden transferred to a new employer.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,regimes,months,checkMonths,graceDistressMonths:GRACE_DISTRESS},gates:{observerNoninterference:runs.every(r=>r.observerNoninterference),allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length*regimes.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),arrearsFlowReconciles:runs.every(r=>r.flow.maxFlowResidual<1e-4),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
