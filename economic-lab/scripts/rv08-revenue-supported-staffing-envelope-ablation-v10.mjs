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
const EPS=1e-8,TOL=1e-7,UP=0.12,DOWN=0.10,GRACE_DISTRESS=24;
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
  const target=targetSectors(base),done=new Set();w.__anNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__anNorm++;}
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

function installEnvelopeState(w,base,regime){
  w.__anHistory=new Map();w.__anDecisionRows=[];w.__anInterventions=0;w.__anExpansions=0;w.__anContractions=0;w.__anExits=0;
  const credit=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    const result=credit(c,month,signals);
    for(const f of c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER')){
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const physical=Math.max(1,Math.ceil(rawPlan/oneWorkerCapacity(c,f))),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice;
      const planViable=(!f.inputProduct||inputPrice>EPS)&&margin>EPS&&margin*rawPlan+TOL>=physical*Math.max(EPS,F(f.wage));
      const current=Math.max(0,Math.round(F(f.workers))),canonical=Math.max(0,Math.round(F(f.desiredWorkers))),key=`${c.id}|${f.id}`,hist=(w.__anHistory.get(key)||[]).slice(-3),wage=Math.max(EPS,F(f.wage));
      const ready=hist.length===3,meanSupport=ready?Math.max(0,Math.floor(M(hist)/wage)):null,floorSupport=ready?Math.max(0,Math.floor(Math.min(...hist)/wage)):null;
      let target=canonical,rawTarget=canonical;
      if(planViable){
        if(regime==='control'||!ready){
          if(physical>current)target=Math.max(canonical,Math.min(physical,moveToward(current,physical)));
        }else if(regime==='mean3-immediate'){
          rawTarget=Math.min(physical,meanSupport);target=rawTarget;
        }else if(regime==='mean3-ramp'){
          rawTarget=Math.min(physical,meanSupport);target=moveToward(current,rawTarget);
        }else if(regime==='floor3-ramp'){
          rawTarget=Math.min(physical,floorSupport);target=moveToward(current,rawTarget);
        }else if(regime==='hysteresis-ramp'){
          if(meanSupport>current)rawTarget=Math.min(physical,meanSupport);
          else if(floorSupport<current)rawTarget=Math.min(physical,floorSupport);
          else rawTarget=current;
          target=moveToward(current,rawTarget);
        }else throw new Error(`unknown regime ${regime}`);
      }
      target=Math.max(0,Math.round(F(target)));
      if(Math.abs(target-canonical)>TOL){f.desiredWorkers=target;w.__anInterventions++;if(target>canonical)w.__anExpansions++;else w.__anContractions++;}
      w.__anDecisionRows.push({month:w.month,countryId:c.id,firmId:f.id,base,regime,planViable,ready,current,canonical,physical,meanSupport,floorSupport,rawTarget,target});
    }
    return result;
  };

  w.supply.evaluateExits=c=>{
    const before=c.firms.filter(x=>x.active!==false&&x.industryId==='CONSUMER');
    for(const f of before){const key=`${c.id}|${f.id}`,hist=w.__anHistory.get(key)||[],contribution=Math.max(0,F(f.revenue)-F(f.inputSpend));hist.push(contribution);while(hist.length>3)hist.shift();w.__anHistory.set(key,hist);}
    const exited=[];
    for(const f of c.firms.filter(x=>x.active!==false)){
      const cash=w.ledger.balance(f.accountId),severePayroll=F(f.wageArrears)>Math.max(100,F(f.wage)*Math.max(1,F(f.workers))*1.35),severeCredit=F(f.creditMisses)>=5,liquidity=cash<F(f.safeCash)*.025&&severePayroll;
      if(liquidity||severeCredit)f.distressMonths=F(f.distressMonths)+1;else f.distressMonths=Math.max(0,F(f.distressMonths)-1);
      if(f.distressMonths<GRACE_DISTRESS)continue;
      f.active=false;f.desiredWorkers=0;f.desiredProduction=0;for(const h of c.households)if(h.employerId===f.id){h.employed=false;h.employerId=null;}f.workers=0;exited.push(f.industryId);w.__anExits++;
    }
    return exited;
  };
}

function buildWorld(seed,base,regime){const w=makeWorld(seed);enableExactDiagnosticLaborRuntime(w);installNormalization(w,base);installEnvelopeState(w,base,regime);return w;}
function fingerprint(w){return JSON.stringify({month:w.month,countries:w.countries.map(c=>({id:c.id,macro:c.macro,firms:c.firms.map(f=>[f.id,f.active!==false,F(f.workers),F(f.desiredWorkers),F(f.output),F(f.sales),F(f.revenue),F(f.inventory),F(f.inputSpend),F(f.wageArrears),F(f.loanBalance),F(f.distressMonths),w.ledger.balance(f.accountId)]),households:c.households.map(h=>[h.id,!!h.employed,h.employerId,F(h.income),F(h.wageArrears),w.ledger.balance(h.accountId)]),settlement:w.ledger.totalBalance(c.id)}))});}
function verifyControlDeterminism(seed,base){const a=buildWorld(seed,base,'control'),b=buildWorld(seed,base,'control');for(let i=0;i<checkMonths;i++){a.stepMonth();b.stepMonth();}return fingerprint(a)===fingerprint(b);}

function summarizeDecisions(rows,regime){
  const ready=rows.filter(r=>r.planViable&&r.ready),n=Math.max(1,ready.length),physicalGap=ready.filter(r=>r.physical>r.current),g=Math.max(1,physicalGap.length),supportRows=ready.filter(r=>r.meanSupport!==null&&r.floorSupport!==null),sd=Math.max(1,supportRows.length);
  return{
    readyRows:ready.length,
    shareTargetBelowCanonical:ready.filter(r=>r.target<r.canonical).length/n,
    shareTargetAboveCanonical:ready.filter(r=>r.target>r.canonical).length/n,
    shareTargetBelowCurrent:ready.filter(r=>r.target<r.current).length/n,
    shareTargetAboveCurrent:ready.filter(r=>r.target>r.current).length/n,
    meanCurrentToPhysical:M(ready.map(r=>r.current/Math.max(1,r.physical))),
    meanTargetToPhysical:M(ready.map(r=>r.target/Math.max(1,r.physical))),
    shareMeanSupportAtLeastCurrent:supportRows.filter(r=>r.meanSupport>=r.current).length/sd,
    shareFloorSupportAtLeastCurrent:supportRows.filter(r=>r.floorSupport>=r.current).length/sd,
    shareAnyPhysicalGap:physicalGap.length/n,
    shareTargetClosesAnyGap:physicalGap.filter(r=>r.target>r.current).length/g,
    meanGapClosure:M(physicalGap.map(r=>Math.max(0,Math.min(r.physical,r.target)-r.current)/Math.max(1,r.physical-r.current)))
  };
}

function runOne(seed,base,regime){
  const deterministicControl=verifyControlDeterminism(seed,base);assert.ok(deterministicControl,`${base}/${seed}: control nondeterminism`);
  const w=buildWorld(seed,base,regime),monthly=[];
  for(let i=0;i<months;i++){
    w.stepMonth();monthly.push({month:w.month,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),arrears:S(w.countries.flatMap(c=>c.households.map(h=>Math.max(0,F(h.wageArrears))))),linked:S(w.countries.flatMap(c=>c.households.filter(h=>h.employed&&h.employerId).map(h=>Math.max(0,F(h.wageArrears))))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output)))),activeFirms:S(w.countries.map(c=>c.firms.filter(f=>f.active!==false).length))});
  }
  const health=w.forceHealthCheck();assert.ok(health.ok,`${regime}/${base}/${seed}: health`);const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);assert.ok(accountingOk&&ledgerOk&&gdpOk,`${regime}/${base}/${seed}: accounting`);
  const decisions=summarizeDecisions(w.__anDecisionRows,regime);assert.ok(decisions.readyRows>0,`${regime}/${base}/${seed}: no ready decision rows`);
  const tail=monthly.slice(-6),summary={unemployment:M(monthly.map(x=>x.unemployment)),terminalUnemployment:M(tail.map(x=>x.unemployment)),arrears:M(monthly.map(x=>x.arrears)),terminalArrears:M(tail.map(x=>x.arrears)),linked:M(monthly.map(x=>x.linked)),terminalLinked:M(tail.map(x=>x.linked)),gdp:M(monthly.map(x=>x.gdp)),terminalGdp:M(tail.map(x=>x.gdp)),output:M(monthly.map(x=>x.output)),terminalOutput:M(tail.map(x=>x.output)),activeFirms:M(monthly.map(x=>x.activeFirms)),terminalActiveFirms:M(tail.map(x=>x.activeFirms)),exits:w.__anExits};
  return{seed,base,regime,months,deterministicControl,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__anNorm,interventions:w.__anInterventions,expansions:w.__anExpansions,contractions:w.__anContractions,decisions,summary};
}

const runs=[];for(const base of bases)for(const seed of seeds)for(const regime of regimes)runs.push(runOne(seed,base,regime));
const finite=runs.every(r=>[...Object.values(r.summary),...Object.values(r.decisions)].every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(finite,'non-finite result');
const compact=runs.map(r=>({seed:r.seed,base:r.base,regime:r.regime,u:r.summary.unemployment,u6:r.summary.terminalUnemployment,arrears:r.summary.arrears,arrears6:r.summary.terminalArrears,linked:r.summary.linked,linked6:r.summary.terminalLinked,gdp:r.summary.gdp,gdp6:r.summary.terminalGdp,output:r.summary.output,output6:r.summary.terminalOutput,active:r.summary.activeFirms,active6:r.summary.terminalActiveFirms,exits:r.summary.exits,interventions:r.interventions,expansions:r.expansions,contractions:r.contractions,readyRows:r.decisions.readyRows,targetBelowCanonical:r.decisions.shareTargetBelowCanonical,targetAboveCanonical:r.decisions.shareTargetAboveCanonical,targetBelowCurrent:r.decisions.shareTargetBelowCurrent,targetAboveCurrent:r.decisions.shareTargetAboveCurrent,currentPhysical:r.decisions.meanCurrentToPhysical,targetPhysical:r.decisions.meanTargetToPhysical,meanSupportCurrent:r.decisions.shareMeanSupportAtLeastCurrent,floorSupportCurrent:r.decisions.shareFloorSupportAtLeastCurrent,gapCloseShare:r.decisions.shareTargetClosesAnyGap,gapClosure:r.decisions.meanGapClosure}));
const report={workPackage:'WP-RV08-R4-AN',title:'Revenue-Supported Staffing Envelope Causal Ablation',note:'Diagnostic intervention only. Canonical credit is executed before staffing intervention. All regimes retain the same transformed unit basis, productive normalization, 24-month diagnostic distress grace, wages, taxes, settlement, accounting, and debt mechanics. Economic sufficiency is not a hard gate.',generatedAt:new Date().toISOString(),configuration:{seeds,bases,regimes,months,checkMonths,graceDistressMonths:GRACE_DISTRESS,upBound:UP,downBound:DOWN},gates:{deterministicControl:runs.every(r=>r.deterministicControl),allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===seeds.length*bases.length*regimes.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),readyDecisionRows:runs.every(r=>r.decisions.readyRows>0),interventionObserved:runs.filter(r=>r.regime!=='control').every(r=>r.interventions>0),finiteRows:finite,ok:true},compact,runs};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact},null,2));
