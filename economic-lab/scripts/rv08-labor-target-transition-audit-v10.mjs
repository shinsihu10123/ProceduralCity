import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const bases=(process.env.DIAG_BASES||'consumer,materials-consumer').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(8,Number(process.env.DIAG_MONTHS||18));
const mode=(process.env.DIAG_MODE||'canonical').trim();
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7,UP=0.12,DISTRESS_WINDOW=4;
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
function monthsAtMaxGrowth(start,target){start=Math.max(1,F(start));target=Math.max(0,F(target));if(target<=start)return 0;return Math.ceil(Math.log(target/start)/Math.log(1+UP));}

function installNormalization(w,base){const target=targetSectors(base),done=new Set();w.__afNorm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__afNorm++;}}done.add(c.id);return out;};}
function installPrior(w){w.__afPrior=new Map();const begin=w.supply.beginMonth.bind(w.supply);w.supply.beginMonth=c=>{for(const f of c.firms)w.__afPrior.set(`${c.id}|${f.id}`,{workers:F(f.workers),sales:F(f.sales),revenue:F(f.revenue),inputSpend:F(f.inputSpend)});return begin(c);};}
function resize(c,f,target){target=Math.max(0,Math.min(Math.floor(target),Math.floor(F(f.workers))));const employees=c.households.filter(h=>h.employed&&h.employerId===f.id).sort((a,b)=>a.id.localeCompare(b.id)),keep=new Set(employees.slice(0,target).map(h=>h.id));for(const h of employees)if(!keep.has(h.id)){h.employed=false;h.employerId=null;}f.workers=keep.size;f.desiredWorkers=f.workers;}
function deactivate(c,f){for(const h of c.households)if(h.employed&&h.employerId===f.id){h.employed=false;h.employerId=null;}f.active=false;f.desiredWorkers=0;f.desiredProduction=0;f.workers=0;}
function restructureSignal(w,c,f){const cash=w.ledger.balance(f.accountId),workers=Math.max(0,F(f.workers)),wage=Math.max(EPS,F(f.wage)),severePayrollStress=F(f.wageArrears)>Math.max(100,wage*Math.max(1,workers)*1.35),severeCreditStress=F(f.creditMisses)>=5,liquidityFailure=cash<F(f.safeCash)*.025&&severePayrollStress,nextDistress=(liquidityFailure||severeCreditStress)?F(f.distressMonths)+1:Math.max(0,F(f.distressMonths)-1),inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,margin=F(f.price)-F(f.inputPerOutput)*inputPrice,pos=Math.max(0,margin),realized=Math.max(0,F(f.revenue)-F(f.inputSpend)),prior=w.__afPrior.get(`${c.id}|${f.id}`)||{},recent=pos*Math.max(0,F(prior.sales)),capacity=pos*Math.max(0,F(f.capacity)),support=Math.max(realized,recent,capacity),target=workers>0?Math.max(0,Math.min(workers,Math.floor((support+TOL)/wage))):0;return{severeCreditStress,nextDistress,target};}
function installExitMode(w){w.__afExits=0;w.__afRestructures=0;if(mode!=='restructure'){const orig=w.supply.evaluateExits.bind(w.supply);w.supply.evaluateExits=c=>{const x=orig(c);w.__afExits+=x.length;return x;};return;}w.supply.evaluateExits=c=>{const exited=[];for(const f of c.firms.filter(x=>x.active!==false)){const s=restructureSignal(w,c,f);f.distressMonths=s.nextDistress;if(f.distressMonths<DISTRESS_WINDOW)continue;if(!s.severeCreditStress&&s.target>0){resize(c,f,s.target);f.distressMonths=0;w.__afRestructures++;}else{deactivate(c,f);exited.push(f.industryId);w.__afExits++;}}return exited;};}

function installAudit(w,base){
  w.__afPre=new Map();w.__afRows=[];w.__afFormulaMismatch=0;
  const credit=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    for(const f of c.firms.filter(x=>x.active!==false)){
      const priorWorkers=Math.max(0,F(f.workers));
      const hiringChange=CL(f.currentPlan?.hiringChange||0,-.10,.12);
      const expectedTarget=Math.max(0,Math.round(Math.max(1,priorWorkers)*(1+hiringChange)));
      const target=Math.max(0,F(f.desiredWorkers));
      if(Math.abs(expectedTarget-target)>TOL)w.__afFormulaMismatch++;
      w.__afPre.set(`${w.month}|${c.id}|${f.id}`,{priorWorkers,target,hiringChange,expectedTarget,upCapHit:hiringChange>=UP-1e-9});
    }
    return credit(c,month,signals);
  };
  const plan=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=plan(c);
    for(const f of c.firms.filter(x=>x.active!==false)){
      const pre=w.__afPre.get(`${w.month}|${c.id}|${f.id}`);if(!pre)continue;
      const rawPlan=unconstrainedPlan(f);if(rawPlan<=EPS)continue;
      const cap1=oneWorkerCapacity(c,f),physical=Math.max(1,Math.ceil(rawPlan/cap1));
      const actual=Math.max(0,F(f.workers)),target=Math.max(0,F(pre.target)),prior=Math.max(0,F(pre.priorWorkers));
      const inputPrice=f.inputProduct?supplierMean(c,f.inputProduct):0,inputObserved=!f.inputProduct||inputPrice>EPS,unitMargin=F(f.price)-F(f.inputPerOutput)*inputPrice,expectedContribution=Math.max(0,unitMargin)*rawPlan,planViable=inputObserved&&unitMargin>EPS&&expectedContribution+TOL>=physical*Math.max(EPS,F(f.wage));
      const targetCapped=Math.min(physical,target),actualCapped=Math.min(physical,actual),totalDeficit=Math.max(0,physical-actualCapped),targetDeficit=Math.max(0,physical-targetCapped),matchingDeficit=Math.max(0,targetCapped-Math.min(actualCapped,targetCapped));
      const targetDeficitShare=totalDeficit>EPS?targetDeficit/totalDeficit:0,matchingDeficitShare=totalDeficit>EPS?matchingDeficit/totalDeficit:0;
      const monthsFromPrior=monthsAtMaxGrowth(prior,physical),monthsFromTarget=monthsAtMaxGrowth(Math.max(1,target),physical),maxReach4=Math.max(1,prior)*((1+UP)**DISTRESS_WINDOW);
      let classification='coherent_target_and_match';
      if(totalDeficit>physical*.1){classification=targetDeficit>=matchingDeficit?'target_formation_dominant':'matching_dominant';}
      w.__afRows.push({month:w.month,countryId:c.id,firmId:f.id,industryId:f.industryId,base,planViable,rawPlan,priorWorkers:prior,targetWorkers:target,actualWorkers:actual,physicalWorkers:physical,targetToPhysical:target/physical,actualToTarget:target>EPS?actual/target:(actual<=EPS?1:0),actualToPhysical:actual/physical,requestedGrowth:target/Math.max(1,prior)-1,requiredGrowth:physical/Math.max(1,prior)-1,upCapHit:pre.upCapHit,monthsFromPrior,monthsFromTarget,maxReach4,canReachWithin4:physical<=maxReach4+TOL,targetDeficit,matchingDeficit,totalDeficit,targetDeficitShare,matchingDeficitShare,classification});
    }
    return out;
  };
}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function summarize(rows){const viable=rows.filter(r=>r.planViable),def=viable.filter(r=>r.totalDeficit>EPS),classes={};for(const r of viable)classes[r.classification]=(classes[r.classification]||0)+1;for(const k of Object.keys(classes))classes[k]/=Math.max(1,viable.length);const totalDef=S(def.map(r=>r.totalDeficit)),targetDef=S(def.map(r=>r.targetDeficit)),matchDef=S(def.map(r=>r.matchingDeficit));return{rows:rows.length,planViableRows:viable.length,sharePlanViable:rows.length?viable.length/rows.length:0,meanPriorWorkers:M(viable.map(r=>r.priorWorkers)),meanTargetWorkers:M(viable.map(r=>r.targetWorkers)),meanActualWorkers:M(viable.map(r=>r.actualWorkers)),meanPhysicalWorkers:M(viable.map(r=>r.physicalWorkers)),meanTargetToPhysical:M(viable.map(r=>r.targetToPhysical)),p50TargetToPhysical:Q(viable.map(r=>r.targetToPhysical),.5),meanActualToTarget:M(viable.map(r=>Math.min(2,r.actualToTarget))),p50ActualToTarget:Q(viable.map(r=>Math.min(2,r.actualToTarget)),.5),meanActualToPhysical:M(viable.map(r=>r.actualToPhysical)),shareTargetBelow50Physical:viable.length?viable.filter(r=>r.targetToPhysical<.5).length/viable.length:0,shareActualBelow80Target:viable.length?viable.filter(r=>r.targetWorkers>EPS&&r.actualToTarget<.8).length/viable.length:0,weightedTargetDeficitShare:totalDef>EPS?targetDef/totalDef:0,weightedMatchingDeficitShare:totalDef>EPS?matchDef/totalDef:0,shareTargetFormationDominant:viable.length?viable.filter(r=>r.classification==='target_formation_dominant').length/viable.length:0,shareMatchingDominant:viable.length?viable.filter(r=>r.classification==='matching_dominant').length/viable.length:0,shareCoherent:viable.length?viable.filter(r=>r.classification==='coherent_target_and_match').length/viable.length:0,meanMonthsAtMaxGrowth:M(viable.map(r=>r.monthsFromPrior)),p50MonthsAtMaxGrowth:Q(viable.map(r=>r.monthsFromPrior),.5),p90MonthsAtMaxGrowth:Q(viable.map(r=>r.monthsFromPrior),.9),shareNeedsMoreThan4Months:viable.length?viable.filter(r=>r.monthsFromPrior>DISTRESS_WINDOW).length/viable.length:0,shareNeedsMoreThan8Months:viable.length?viable.filter(r=>r.monthsFromPrior>8).length/viable.length:0,shareUpCapHit:viable.length?viable.filter(r=>r.upCapHit).length/viable.length:0,meanRequestedGrowth:M(viable.map(r=>r.requestedGrowth)),meanRequiredGrowth:M(viable.map(r=>r.requiredGrowth)),classShares:classes};}
function run(base,seed){const w=makeWorld(seed);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});installNormalization(w,base);installPrior(w);installAudit(w,base);installExitMode(w);const monthly=[];for(let i=0;i<months;i++){w.stepMonth();monthly.push({month:w.month,unemployment:M(w.countries.map(c=>F(c.macro?.unemployment))),arrears:M(w.countries.map(c=>F(c.macro?.wageArrears))),gdp:M(w.countries.map(c=>F(c.macro?.gdp))),output:S(w.countries.flatMap(c=>c.firms.filter(f=>f.active!==false).map(f=>F(f.output))))});}const health=w.forceHealthCheck();assert.ok(health.ok,`${base}/${seed}: health`);const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);const industry=Object.fromEntries([...new Set(w.__afRows.map(r=>r.industryId))].sort().map(ind=>[ind,summarize(w.__afRows.filter(r=>r.industryId===ind))]));return{base,seed,mode,months,health,accountingOk,ledgerOk,gdpOk,normalizationApps:w.__afNorm||0,formulaMismatch:w.__afFormulaMismatch||0,exits:w.__afExits||0,restructures:w.__afRestructures||0,monthly,summary:summarize(w.__afRows),industry};}

const runs=[];for(const base of bases)for(const seed of seeds)runs.push(run(base,seed));
const gates={allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===bases.length*seeds.length,normalizationActivated:runs.every(r=>r.normalizationApps>0),targetFormulaExact:runs.every(r=>r.formulaMismatch===0),ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.accountingOk),gdpIdentityArithmetic:runs.every(r=>r.gdpOk),targetRowsObserved:runs.every(r=>r.summary.rows>0),consumerPlanViableObserved:runs.every(r=>r.industry.CONSUMER?.planViableRows>0),finiteRows:runs.every(r=>Object.values(r.summary).every(v=>typeof v!=='number'||Number.isFinite(v)))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`R4-AF/AG gates ${JSON.stringify(gates)}`);
const compact=runs.map(r=>{const c=r.industry.CONSUMER;return{base:r.base,seed:r.seed,mode:r.mode,u:M(r.monthly.map(x=>x.unemployment)),arrears:M(r.monthly.map(x=>x.arrears)),gdp:M(r.monthly.map(x=>x.gdp)),output:M(r.monthly.map(x=>x.output)),exits:r.exits,restructures:r.restructures,consumerPlanViable:c.sharePlanViable,targetPhysical:c.meanTargetToPhysical,actualTarget:c.meanActualToTarget,actualPhysical:c.meanActualToPhysical,targetDeficit:c.weightedTargetDeficitShare,matchingDeficit:c.weightedMatchingDeficitShare,targetDominant:c.shareTargetFormationDominant,matchingDominant:c.shareMatchingDominant,monthsMax:c.meanMonthsAtMaxGrowth,p50Months:c.p50MonthsAtMaxGrowth,p90Months:c.p90MonthsAtMaxGrowth,over4:c.shareNeedsMoreThan4Months,over8:c.shareNeedsMoreThan8Months,upCap:c.shareUpCapHit};});
console.log('WP-RV08-R4-AF/AG gates',gates);console.table(compact);console.log('WP-RV08-R4-AF/AG: PASS');
const payload={workPackage:'WP-RV08-R4-AF-AG',title:'Labor Target Formation / Matching + Transition-Speed Audit',note:'Read-only diagnostic. Decomposes the physical-workforce deficit into canonical target-formation versus labor-market fulfillment and compares the bounded +12% target transition with the four-month distress window.',generatedAt:new Date().toISOString(),configuration:{mode,bases,seeds,months,upwardTargetBound:UP,distressWindowMonths:DISTRESS_WINDOW},gates,compact,runs};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));}
