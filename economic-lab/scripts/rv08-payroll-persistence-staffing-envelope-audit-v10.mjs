import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const states=(process.env.DIAG_STATES||'canonical').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(12,Number(process.env.DIAG_MONTHS||24));
const checkMonths=Math.max(3,Number(process.env.DIAG_CHECK_MONTHS||6));
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

function enableExactDiagnosticLaborRuntime(w){for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__alamNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__alamNorm++;}
    }
    done.add(c.id);return out;
  };
}

function installRampGrace(w,state){
  w.__alamInterventions=0;
  if(state!=='ramp-grace')return;
  const credit=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    const result=credit(c,month,signals);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const viable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      const current=Math.max(0,F(f.workers)),canonical=Math.max(0,F(f.desiredWorkers));
      if(viable&&physical>current){const ramp=Math.max(current,Math.round(Math.max(1,current)*(1+UP))),applied=Math.max(canonical,Math.min(physical,ramp));if(Math.abs(applied-canonical)>TOL){f.desiredWorkers=applied;w.__alamInterventions++;}}
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

function economicFingerprint(w){
  return JSON.stringify({month:w.month,countries:w.countries.map(c=>({
    id:c.id,macro:c.macro,
    firms:c.firms.map(f=>[f.id,f.active!==false,F(f.workers),F(f.desiredWorkers),F(f.productivity),F(f.price),F(f.wage),F(f.output),F(f.sales),F(f.revenue),F(f.inventory),f.inputInventory,F(f.inputSpend),F(f.wageArrears),F(f.loanBalance),F(f.creditMisses),F(f.distressMonths),w.ledger.balance(f.accountId)]),
    households:c.households.map(h=>[h.id,!!h.employed,h.employerId,F(h.wage),F(h.income),F(h.wageArrears),F(h.loanBalance),F(h.creditMisses),w.ledger.balance(h.accountId)]),
    loans:c.loans.map(l=>[l.id,l.status,F(l.outstanding),F(l.arrears),F(l.missedPayments),l.borrowerId]),
    settlementTotal:w.ledger.totalBalance(c.id)
  }))});
}

function buildWorld(seed,base,state,withObserver=false){
  const w=makeWorld(seed);enableExactDiagnosticLaborRuntime(w);installNormalization(w,base);installRampGrace(w,state);if(withObserver)installObserver(w,base);return w;
}

function verifyObserverNoninterference(seed,base,state){
  const plain=buildWorld(seed,base,state,false),observed=buildWorld(seed,base,state,true);
  for(let i=0;i<checkMonths;i++){plain.stepMonth();observed.stepMonth();}
  return economicFingerprint(plain)===economicFingerprint(observed);
}

function installObserver(w,base){
  w.__alamPlan=new Map();w.__alamOpen=new Map();w.__alamRows=[];

  const plan=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=plan(c);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const planViable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      w.__alamPlan.set(`${w.month}|${c.id}|${f.id}`,{rawPlan,physical,margin,planViable});
    }
    return out;
  };

  const accrue=w.accounting.accrueMonthlyWages.bind(w.accounting);
  w.accounting.accrueMonthlyWages=(c,month)=>{
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const p=w.__alamPlan.get(`${w.month}|${c.id}|${f.id}`);if(!p)continue;
      const staff=c.households.filter(h=>h.employed&&h.employerId===f.id),basePayroll=F(f.wage)*staff.length;
      w.__alamOpen.set(`${w.month}|${c.id}|${f.id}`,{
        month:w.month,countryId:c.id,firmId:f.id,base,planViable:p.planViable,rawPlan:p.rawPlan,physicalWorkers:p.physical,workers:staff.length,wage:F(f.wage),basePayroll,
        priorWorkerArrears:S(staff.map(h=>Math.max(0,F(h.wageArrears)))),cashBeforePayroll:w.ledger.balance(f.accountId),prePayrollRevenue:F(f.revenue),inputSpend:F(f.inputSpend),output:F(f.output),inventory:F(f.inventory),inventoryValue:F(f.inventory)*F(f.price),price:F(f.price),distressBefore:F(f.distressMonths),loanBefore:F(f.loanBalance)
      });
    }
    return accrue(c,month);
  };

  const incomeTax=w.fiscal.collectIncomeTaxes.bind(w.fiscal);
  w.fiscal.collectIncomeTaxes=(c,month)=>{
    const wages=w.ledger.entriesFor({month:w.month,countryId:c.id,kind:'wage'}),paidByFirm=new Map();
    for(const e of wages){const id=e.meta?.firmId;if(id)paidByFirm.set(id,(paidByFirm.get(id)||0)+F(e.amount));}
    for(const f of c.firms.filter(x=>x.industryId==='CONSUMER')){const row=w.__alamOpen.get(`${w.month}|${c.id}|${f.id}`);if(row){row.paidPayroll=paidByFirm.get(f.id)||0;row.cashAfterPayroll=w.ledger.balance(f.accountId);}}
    return incomeTax(c,month);
  };

  const exits=w.supply.evaluateExits.bind(w.supply);
  w.supply.evaluateExits=c=>{
    const monthRows=[];
    for(const f of c.firms.filter(x=>x.industryId==='CONSUMER')){
      const key=`${w.month}|${c.id}|${f.id}`,row=w.__alamOpen.get(key);if(!row)continue;
      row.endRevenue=F(f.revenue);row.postPayrollRevenue=Math.max(0,row.endRevenue-row.prePayrollRevenue);row.realizedContribution=Math.max(0,row.endRevenue-row.inputSpend);row.cashBeforeExit=w.ledger.balance(f.accountId);row.cashGap=Math.max(0,row.basePayroll-row.cashBeforePayroll);row.underpaid=F(row.paidPayroll)+TOL<row.basePayroll;row.timingCandidate=row.underpaid&&row.cashBeforePayroll+row.postPayrollRevenue+TOL>=row.basePayroll;row.loanEnd=F(f.loanBalance);row.distressEnd=F(f.distressMonths);row.activeBeforeExit=f.active!==false;monthRows.push(row);
    }
    const out=exits(c);
    for(const row of monthRows){const f=c.firms.find(x=>x.id===row.firmId);row.exitedThisMonth=!!f&&f.active===false;w.__alamRows.push(row);w.__alamOpen.delete(`${row.month}|${row.countryId}|${row.firmId}`);}
    return out;
  };
}

function firmKey(r){return `${r.countryId}|${r.firmId}`;}
function rowMap(rows){const m=new Map();for(const r of rows)m.set(`${firmKey(r)}|${r.month}`,r);return m;}

function summarizePersistence(rows){
  const viable=rows.filter(r=>r.planViable),map=rowMap(viable),starts=viable.filter(r=>r.underpaid&&r.month<=months-6),cohorts=[];
  for(const r of starts){
    const at=a=>map.get(`${firmKey(r)}|${r.month+a}`),prior=map.get(`${firmKey(r)}|${r.month-1}`),w3=[0,1,2].map(at),w7=[0,1,2,3,4,5,6].map(at),complete3=w3.every(Boolean),complete7=w7.every(Boolean),u3=w3.filter(x=>x?.underpaid).length,u7=w7.filter(x=>x?.underpaid).length,cumPayroll3=complete3?S(w3.map(x=>x.basePayroll)):0,cumContribution3=complete3?S(w3.map(x=>x.realizedContribution)):0,cumPayroll7=complete7?S(w7.map(x=>x.basePayroll)):0,cumContribution7=complete7?S(w7.map(x=>x.realizedContribution)):0;
    const salesEligible=!!prior&&F(prior.endRevenue)+TOL>=r.cashGap,inventoryEligible=r.inventoryValue+TOL>=r.cashGap,selfLiquidatingNow=r.postPayrollRevenue+TOL>=r.cashGap;
    cohorts.push({
      timingAtStart:r.timingCandidate,nextMonthCure:!!at(1)&&!at(1).underpaid,complete3,complete7,recurrent3:complete3&&u3>=2,persistent3:complete3&&u3===3,recurrentAge6:complete7&&u7>=3,structural3:complete3&&cumContribution3+TOL<cumPayroll3,structuralAge6:complete7&&cumContribution7+TOL<cumPayroll7,
      transitorySelfLiquidating:complete3&&r.timingCandidate&&!at(1).underpaid&&!at(2).underpaid,salesBackedUpperBound:salesEligible&&selfLiquidatingNow,inventoryBackedUpperBound:inventoryEligible&&selfLiquidatingNow,exitedByAge6:w7.some(x=>x?.exitedThisMonth),cashGap:r.cashGap,basePayroll:r.basePayroll,postPayrollRevenue:r.postPayrollRevenue,priorRevenue:F(prior?.endRevenue),inventoryValue:r.inventoryValue,cumPayroll3,cumContribution3,cumPayroll7,cumContribution7
    });
  }
  const n=Math.max(1,cohorts.length),c3=cohorts.filter(x=>x.complete3),c7=cohorts.filter(x=>x.complete7),d3=Math.max(1,c3.length),d7=Math.max(1,c7.length);
  return{
    viableRows:viable.length,underpaidRows:viable.filter(r=>r.underpaid).length,underpaidShare:viable.length?viable.filter(r=>r.underpaid).length/viable.length:0,cohortStarts:cohorts.length,
    shareTimingAtStart:cohorts.filter(x=>x.timingAtStart).length/n,shareNextMonthCure:cohorts.filter(x=>x.nextMonthCure).length/n,shareTransitorySelfLiquidating:cohorts.filter(x=>x.transitorySelfLiquidating).length/n,
    complete3:c3.length,shareRecurrent3:c3.filter(x=>x.recurrent3).length/d3,sharePersistent3:c3.filter(x=>x.persistent3).length/d3,shareStructural3:c3.filter(x=>x.structural3).length/d3,
    completeAge6:c7.length,shareRecurrentAge6:c7.filter(x=>x.recurrentAge6).length/d7,shareStructuralAge6:c7.filter(x=>x.structuralAge6).length/d7,shareExitedByAge6:c7.filter(x=>x.exitedByAge6).length/d7,
    shareSalesBackedUpperBound:cohorts.filter(x=>x.salesBackedUpperBound).length/n,shareInventoryBackedUpperBound:cohorts.filter(x=>x.inventoryBackedUpperBound).length/n,
    meanStartCashGap:M(cohorts.map(x=>x.cashGap)),p50StartCashGap:Q(cohorts.map(x=>x.cashGap),.5),meanPostPayrollRevenue:M(cohorts.map(x=>x.postPayrollRevenue))
  };
}

function summarizeEnvelope(rows){
  const viable=rows.filter(r=>r.planViable),map=rowMap(viable),obs=[];
  for(const r of viable){
    if(r.month<4)continue;
    const prev=[1,2,3].map(a=>map.get(`${firmKey(r)}|${r.month-a}`));if(!prev.every(Boolean))continue;
    const contributions=prev.map(x=>Math.max(0,F(x.realizedContribution))),meanContribution=M(contributions),minContribution=Math.min(...contributions),wage=Math.max(EPS,F(r.wage)),meanSupport=Math.max(0,Math.floor(meanContribution/wage)),floorSupport=Math.max(0,Math.floor(minContribution/wage)),physical=Math.max(1,F(r.physicalWorkers)),current=Math.max(0,F(r.workers)),physicalGap=Math.max(0,physical-current),interiorHeadroom=Math.max(0,Math.min(physical,meanSupport)-current);
    obs.push({current,physical,meanSupport,floorSupport,physicalGap,interiorHeadroom,meanSupportRatio:meanSupport/physical,currentRatio:current/physical,floorSupportRatio:floorSupport/physical});
  }
  const n=Math.max(1,obs.length),g=obs.filter(x=>x.physicalGap>0),gd=Math.max(1,g.length);
  return{
    rows:obs.length,meanCurrentToPhysical:M(obs.map(x=>x.currentRatio)),meanSupportToPhysical:M(obs.map(x=>x.meanSupportRatio)),p50SupportToPhysical:Q(obs.map(x=>x.meanSupportRatio),.5),meanFloorSupportToPhysical:M(obs.map(x=>x.floorSupportRatio)),
    shareMeanSupportAtLeastCurrent:obs.filter(x=>x.meanSupport>=x.current).length/n,shareFloorSupportAtLeastCurrent:obs.filter(x=>x.floorSupport>=x.current).length/n,shareMeanSupportAtLeastPhysical:obs.filter(x=>x.meanSupport>=x.physical).length/n,
    shareInteriorExpansionZone:obs.filter(x=>x.meanSupport>x.current&&x.meanSupport<x.physical).length/n,meanPhysicalGap:M(g.map(x=>x.physicalGap)),meanSupportableHeadroom:M(g.map(x=>x.interiorHeadroom)),meanHeadroomToPhysicalGap:M(g.map(x=>x.physicalGap>0?x.interiorHeadroom/x.physicalGap:0)),shareAnySupportableHeadroom:g.filter(x=>x.interiorHeadroom>0).length/gd
  };
}

function runOne(seed,base,state){
  const observerNoninterference=verifyObserverNoninterference(seed,base,state);assert.ok(observerNoninterference,`${state}/${base}/${seed}: observer changed economic state`);
  const w=buildWorld(seed,base,state,true),monthly=[];
  for(let i=0;i<months;i++){w.stepMonth();monthly.push({month:w.month,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),arrears:S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears))))),linked:S(w.countries.flatMap(c=>c.households.filter(h=>h.employed&&h.employerId).map(h=>Math.max(0,F(h.wageArrears))))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output))))});}
  const health=w.forceHealthCheck();assert.ok(health.ok,`${state}/${base}/${seed}: health`);const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${state}/${base}/${seed}: accounting`);
  const persistence=summarizePersistence(w.__alamRows),envelope=summarizeEnvelope(w.__alamRows);assert.ok(persistence.viableRows>0&&persistence.cohortStarts>0,`${state}/${base}/${seed}: no payroll cohort`);assert.ok(envelope.rows>0,`${state}/${base}/${seed}: no staffing envelope rows`);
  const tail=monthly.slice(-6);return{seed,base,state,months,observerNoninterference,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__alamNorm,interventions:w.__alamInterventions,persistence,envelope,summary:{unemployment:M(monthly.map(x=>x.unemployment)),terminalUnemployment:M(tail.map(x=>x.unemployment)),arrears:M(monthly.map(x=>x.arrears)),terminalArrears:M(tail.map(x=>x.arrears)),linked:M(monthly.map(x=>x.linked)),terminalLinked:M(tail.map(x=>x.linked)),gdp:M(monthly.map(x=>x.gdp)),output:M(monthly.map(x=>x.output))}};
}

const runs=[];for(const state of states)for(const base of bases)for(const seed of seeds)runs.push(runOne(seed,base,state));
const finite=runs.every(r=>[...Object.values(r.summary),...Object.values(r.persistence),...Object.values(r.envelope)].every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({seed:r.seed,base:r.base,state:r.state,u:r.summary.unemployment,u6:r.summary.terminalUnemployment,arrears:r.summary.arrears,linked:r.summary.linked,cohorts:r.persistence.cohortStarts,underpaidShare:r.persistence.underpaidShare,timingStart:r.persistence.shareTimingAtStart,nextCure:r.persistence.shareNextMonthCure,transitory:r.persistence.shareTransitorySelfLiquidating,recurrent3:r.persistence.shareRecurrent3,persistent3:r.persistence.sharePersistent3,structural3:r.persistence.shareStructural3,recurrentAge6:r.persistence.shareRecurrentAge6,structuralAge6:r.persistence.shareStructuralAge6,exitAge6:r.persistence.shareExitedByAge6,salesUpper:r.persistence.shareSalesBackedUpperBound,inventoryUpper:r.persistence.shareInventoryBackedUpperBound,currentPhysical:r.envelope.meanCurrentToPhysical,supportPhysical:r.envelope.meanSupportToPhysical,floorSupportPhysical:r.envelope.meanFloorSupportToPhysical,supportCurrent:r.envelope.shareMeanSupportAtLeastCurrent,floorSupportCurrent:r.envelope.shareFloorSupportAtLeastCurrent,fullPhysical:r.envelope.shareMeanSupportAtLeastPhysical,interiorZone:r.envelope.shareInteriorExpansionZone,headroomRatio:r.envelope.meanHeadroomToPhysicalGap,anyHeadroom:r.envelope.shareAnySupportableHeadroom}));
const report={workPackage:'WP-RV08-R4-AL-AM',title:'Payroll Shortfall Persistence / Revenue-Supported Staffing Envelope Audit',note:'Diagnostic-only. Observer instrumentation is fingerprint-checked for noninterference. No bridge, staffing envelope, cash, wage, tax, credit, settlement, or write-off rule is applied by AL/AM; ramp-grace is a previously defined diagnostic state used only for conditional comparison.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,states,months,checkMonths,graceDistressMonths:GRACE_DISTRESS},gates:{observerNoninterference:runs.every(r=>r.observerNoninterference),allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length*states.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),payrollCohortsObserved:runs.every(r=>r.persistence.cohortStarts>0),staffingEnvelopeObserved:runs.every(r=>r.envelope.rows>0),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
