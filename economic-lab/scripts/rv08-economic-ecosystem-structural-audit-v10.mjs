import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed=(process.env.DIAG_SEED||'ECON-RV02-A').trim();
const base=(process.env.DIAG_BASE||'raw').trim();
const months=Math.max(12,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(seedText,raw){
  if(raw)return new EconomicWorld(seedText,{scaleProfile:'baseline',healthCheckInterval:0});
  const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());
  try{return new EconomicWorld(seedText,{scaleProfile:'baseline',healthCheckInterval:0});}
  finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}
}
function targetSectors(b){return b==='consumer'?new Set(['CONSUMER']):b==='materials-consumer'?new Set(['MATERIALS','CONSUMER']):new Set();}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function installNormalization(w,b){const target=targetSectors(b),done=new Set();w.__ecoNorm=0;if(!target.size)return;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__ecoNorm++;}}done.add(c.id);return out;};}
function buildWorld(){const raw=base==='raw';const w=makeWorld(seed,raw);for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});if(base==='consumer'||base==='materials-consumer')installNormalization(w,base);else w.__ecoNorm=0;return w;}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function corr(a,b){const n=Math.min(a.length,b.length);if(n<3)return 0;const x=a.slice(0,n).map(F),y=b.slice(0,n).map(F),mx=M(x),my=M(y),num=S(x.map((v,i)=>(v-mx)*(y[i]-my))),dx=Math.sqrt(S(x.map(v=>(v-mx)**2))),dy=Math.sqrt(S(y.map(v=>(v-my)**2)));return dx>EPS&&dy>EPS?num/(dx*dy):0;}
function firstMonth(rows,pred){const r=rows.find(pred);return r?r.month:null;}
function window(rows,a,b){const q=rows.filter(r=>r.month>=a&&r.month<=b);return{months:q.length,meanUnemployment:M(q.map(r=>r.unemployment)),meanGdp:M(q.map(r=>r.gdp)),meanOutput:M(q.map(r=>r.output)),meanArrears:M(q.map(r=>r.arrears)),exits:S(q.map(r=>r.exits)),entries:S(q.map(r=>r.entries)),meanActiveFirms:M(q.map(r=>r.activeFirms)),newCredit:S(q.map(r=>r.newCredit)),defaults:S(q.map(r=>r.defaults)),meanTransfers:M(q.map(r=>r.transfers)),meanUnmetDemand:M(q.map(r=>r.unmetDemand)),meanInputShortage:M(q.map(r=>r.inputShortage)),meanUnfilled:M(q.map(r=>r.unfilled)),meanPublicDebt:M(q.map(r=>r.publicDebt)),meanTradeAbs:M(q.map(r=>Math.abs(r.netExports)))};}

function initialCountry(c,w){
  const hs=c.households,fs=c.firms,active=fs.filter(f=>f.active!==false),inputFirms=active.filter(f=>f.inputProduct);
  const sampleH=hs[0]||{},sampleF=active[0]||{};
  const employed=hs.filter(h=>h.employed).length,firmWorkers=S(active.map(f=>f.workers)),desired=S(active.map(f=>f.desiredWorkers));
  const payroll=S(active.map(f=>Math.max(0,F(f.wage)*F(f.workers))));
  const firmCash=S(active.map(f=>Math.max(0,w.ledger.balance(f.accountId))));
  const inventoryPositive=active.filter(f=>F(f.inventory)>EPS).length;
  const zeroFlowWithInventory=active.filter(f=>F(f.inventory)>EPS&&F(f.sales)<=EPS&&F(f.revenue)<=EPS&&F(f.output)<=EPS).length;
  const zeroInput=inputFirms.filter(f=>S(Object.values(f.inputInventory||{}))<=EPS).length;
  const positiveCapital=active.filter(f=>F(f.capitalStock)>EPS).length;
  const noLoanFirms=active.filter(f=>F(f.loanBalance)<=EPS).length;
  const noLoanHouseholds=hs.filter(h=>F(h.loanBalance)<=EPS).length;
  const previousSalesOne=active.filter(f=>Math.abs(F(f.previousSales)-1)<1e-12).length;
  const nullPlan=active.filter(f=>f.currentPlan==null).length;
  const zeroIncomeEmployed=hs.filter(h=>h.employed&&F(h.income)<=EPS).length;
  const uniqueBeliefs=new Set(hs.map(h=>JSON.stringify(h.beliefs||{}))).size;
  const portfolioH=hs.filter(h=>Object.keys(h.portfolio||{}).length>0).length;
  const cognitionEpisodes=hs.reduce((s,h)=>s+(h.cognition?.memory?.episodes?.length||0),0)+active.reduce((s,f)=>s+(f.cognition?.memory?.episodes?.length||0),0);
  const fields={
    household:{age:own(sampleH,'age'),birthMonth:own(sampleH,'birthMonth'),deathMonth:own(sampleH,'deathMonth'),laborForceStatus:own(sampleH,'laborForceStatus'),student:own(sampleH,'student'),retired:own(sampleH,'retired'),householdMembers:own(sampleH,'members')||own(sampleH,'memberIds'),householdId:own(sampleH,'householdId')},
    firm:{age:own(sampleF,'age'),foundedMonth:own(sampleF,'foundedMonth'),ownerIds:own(sampleF,'ownerIds')||own(sampleF,'owners'),supplierIds:own(sampleF,'supplierIds')||own(sampleF,'suppliers'),contracts:own(sampleF,'contracts'),employeeTenure:own(sampleF,'employeeTenure')},
    country:{populationProcess:own(c,'births')||own(c,'deaths')||own(c,'populationHistory'),migration:own(c,'migration')||own(c,'netMigration'),laborForce:own(c,'laborForce')||own(c,'participationRate')}
  };
  return {countryId:c.id,population:hs.length,firms:fs.length,activeFirms:active.length,banks:c.banks?.length||0,governments:c.governments?.length||0,centralBanks:c.centralBanks?.length||0,employed,employmentShare:employed/Math.max(1,hs.length),firmWorkers,desiredWorkers:desired,firmWorkerVsEmployedGap:firmWorkers-employed,totalPayroll:payroll,totalFirmCash:firmCash,cashPayrollCoverage:firmCash/Math.max(EPS,payroll),inventoryPositiveShare:inventoryPositive/Math.max(1,active.length),zeroFlowWithInventoryShare:zeroFlowWithInventory/Math.max(1,active.length),inputFirmShare:inputFirms.length/Math.max(1,active.length),zeroInputInventoryShare:zeroInput/Math.max(1,inputFirms.length),positiveCapitalShare:positiveCapital/Math.max(1,active.length),noLoanFirmShare:noLoanFirms/Math.max(1,active.length),noLoanHouseholdShare:noLoanHouseholds/Math.max(1,hs.length),countryLoanCount:c.loans?.length||0,previousSalesExactlyOneShare:previousSalesOne/Math.max(1,active.length),nullPlanShare:nullPlan/Math.max(1,active.length),employedButZeroIncomeShare:zeroIncomeEmployed/Math.max(1,employed),uniqueHouseholdBeliefStates:uniqueBeliefs,householdsWithPortfolioShare:portfolioH/Math.max(1,hs.length),cognitionEpisodes,openingPublicDebt:F(c.lastFiscal?.outstandingDebt),openingPublicCapital:F(c.lastFiscal?.publicCapital),openingPolicyRate:F(c.lastMonetary?.policyRate),openingEquityMarketCap:F(c.lastAssetMarket?.marketCapitalization),openingForeignDebt:F(c.lastInternational?.foreignDebtWXU),openingNFA:F(c.lastInternational?.netForeignAssetsWXU),fields};
}
function dynamicRow(c,w){return{month:w.month,countryId:c.id,unemployment:F(c.macro?.unemployment),gdp:F(c.macro?.gdp),output:F(c.macro?.realOutput),sales:F(c.macro?.nominalSales),consumption:F(c.macro?.consumption),investment:F(c.macro?.grossInvestment)+F(c.macro?.publicInvestment),inventoryInvestment:F(c.macro?.inventoryInvestment),arrears:F(c.macro?.wageArrears),activeFirms:F(c.macro?.activeFirms),exits:F(c.macro?.firmExits),entries:F(c.macro?.firmEntries),newCredit:F(c.macro?.newCredit),defaults:F(c.macro?.loanDefaults),outstandingLoans:F(c.macro?.outstandingLoans),transfers:F(c.macro?.governmentTransfers),publicDebt:F(c.macro?.publicDebt),policyRate:F(c.macro?.policyRate),equityReturn:F(c.macro?.equityIndexReturn),netExports:F(c.macro?.netExports),externalStress:F(c.macro?.externalStress),inputShortage:F(c.macro?.inputShortageUnits),unmetDemand:F(c.macro?.unmetDemandRatio),hires:F(c.macro?.hires),layoffs:F(c.macro?.layoffs),unfilled:F(c.macro?.unfilledJobs),price:F(c.macro?.priceIndex),wage:F(c.macro?.avgWage)};}

const w=buildWorld();
const initial=w.countries.map(c=>initialCountry(c,w));
const rows=[];
for(let i=0;i<months;i++){w.stepMonth();for(const c of w.countries)rows.push(dynamicRow(c,w));}
const health=w.forceHealthCheck();
const accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
assert.ok(accountingOk&&ledgerOk&&gdpOk,`${seed}/${base}: accounting gate`);
const totalExits=S(rows.map(r=>r.exits)),first6Exits=S(rows.filter(r=>r.month<=6).map(r=>r.exits)),totalCredit=S(rows.map(r=>r.newCredit)),first6Credit=S(rows.filter(r=>r.month<=6).map(r=>r.newCredit));
const byCountry=w.countries.map(c=>{const q=rows.filter(r=>r.countryId===c.id),unemp=q.map(r=>r.unemployment),exits=q.map(r=>r.exits),arrears=q.map(r=>r.arrears),dU=q.map((r,i)=>i? r.unemployment-q[i-1].unemployment:0);return{countryId:c.id,windows:{m1_3:window(q,1,3),m4_6:window(q,4,6),m7_12:window(q,7,12),m13_24:window(q,13,Math.min(24,months))},crossings:{unemployment20:firstMonth(q,r=>r.unemployment>=.2),unemployment40:firstMonth(q,r=>r.unemployment>=.4),activeFirms75:firstMonth(q,r=>r.activeFirms<=initial.find(x=>x.countryId===c.id).activeFirms*.75),arrearsPositive:firstMonth(q,r=>r.arrears>EPS)},correlations:{priorExitsToUnemploymentChange:corr(exits.slice(0,-1),dU.slice(1)),priorArrearsToExits:corr(arrears.slice(0,-1),exits.slice(1)),exitsToUnemployment:corr(exits,unemp)}};});
const terminal=rows.filter(r=>r.month===months);
const report={workPackage:'WP-RV08-R4-AU-AV-AW',title:'Economic Ecosystem Structural Coherence / Cold-Start / Feedback Audit',note:'Diagnostic-only broad audit. raw = repository-native initial units; unit = only initialPrice normalized to initialWage; consumer/materials-consumer retain prior diagnostic productivity normalization. No canonical repair is applied.',generatedAt:new Date().toISOString(),configuration:{seed,base,months},gates:{healthOk:health.ok,accountingOk,ledgerOk,gdpIdentityArithmetic:gdpOk,normalizationActivated:(base==='consumer'||base==='materials-consumer')?w.__ecoNorm>0:true,ok:accountingOk&&ledgerOk&&gdpOk},initial,global:{initialHouseholds:S(initial.map(x=>x.population)),initialFirms:S(initial.map(x=>x.firms)),initialBanks:S(initial.map(x=>x.banks)),initialGovernments:S(initial.map(x=>x.governments)),initialCentralBanks:S(initial.map(x=>x.centralBanks)),first6ExitShare:totalExits>EPS?first6Exits/totalExits:0,first6CreditShare:totalCredit>EPS?first6Credit/totalCredit:0,totalExits,totalCredit,terminalMeanUnemployment:M(terminal.map(r=>r.unemployment)),terminalMeanActiveFirms:M(terminal.map(r=>r.activeFirms)),terminalMeanArrears:M(terminal.map(r=>r.arrears)),terminalMeanGdp:M(terminal.map(r=>r.gdp)),terminalMeanOutput:M(terminal.map(r=>r.output))},byCountry};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,configuration:report.configuration,gates:report.gates,global:report.global,initial:report.initial,byCountry:report.byCountry},null,2));
