import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const seed=(process.env.DIAG_SEED||'ECON-RV02-A').trim();
const months=Math.max(24,Number(process.env.DIAG_MONTHS||36));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}
function installNormalization(w){const target=new Set(['MATERIALS','CONSUMER']),done=new Set();w.__bmbnbqNorm=0;const original=w.supply.planProduction.bind(w.supply);w.supply.planProduction=c=>{const out=original(c);if(done.has(c.id))return out;const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),cap=F(f.capacity),required=margin>EPS&&cap>EPS?payroll/(margin*cap):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;if(factor>1+TOL){f.productivity*=factor;f.capacity=cap*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__bmbnbqNorm++;}}done.add(c.id);return out;};}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function finiteTree(x){if(typeof x==='number')return Number.isFinite(x);if(Array.isArray(x))return x.every(finiteTree);if(x&&typeof x==='object')return Object.values(x).every(finiteTree);return true;}

const w=makeWorld();
for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});
installNormalization(w);

const initialIds=new Map(w.countries.map(c=>[c.id,new Set(c.firms.map(f=>f.id))]));
const priorFirm=new Map();
const stressRun=new Map();
const entrants=new Map();
const creditApps=[];
const countryStats=new Map(w.countries.map(c=>[c.id,{
  wageComparisons:0,wageUp:0,wageDown:0,priceComparisons:0,priceMoves:0,
  stressedNoVacancy:0,stressedNoVacancyWageDown:0,stressedNoVacancyPriceMove:0,
  prolongedStress:0,prolongedStressWageDown:0,
  exits:0,entrantExits:0,entrantExitPayrollLiquidity:0,entrantExitCredit:0,entrantExitBoth:0,entrantExitOther:0
}]));

for(const c of w.countries)for(const f of c.firms)priorFirm.set(f.id,{active:f.active!==false,wage:F(f.wage),price:F(f.price),cash:F(w.ledger.balance(f.accountId)),arrears:F(f.wageArrears),creditMisses:F(f.creditMisses),workers:F(f.workers),desiredWorkers:F(f.desiredWorkers),output:F(f.output),revenue:F(f.revenue),capital:F(f.capitalStock),inventory:F(f.inventory)+S(Object.values(f.inputInventory||{}))});

const originalOriginate=w.banking.originateCredit.bind(w.banking);
w.banking.originateCredit=(country,month,signals)=>{
  const bank=country.banks?.[0];
  const bs=bank?w.accounting.entityStatement(bank.id,month).balanceSheet:{assets:0,equity:0};
  const maxAssets=F(bs.equity)/Math.max(.01,F(bank?.minCapitalRatio,.1));
  const bankHeadroom=Math.max(0,maxAssets-F(bs.assets));
  const apps=w.banking.buildApplications(country).map(a=>{
    const p=priorFirm.get(a.borrower.id)||{};
    return {month,countryId:country.id,borrowerId:a.borrower.id,kind:a.kind,sector:a.borrower.industryId||'HOUSEHOLD',requested:F(a.amount),cash:F(a.cash),debt:F(a.debt),arrears:F(a.arrears),incomeBase:F(a.incomeBase),payrollNeed:a.kind==='firm'?F(a.borrower.wage)*Math.max(1,F(a.borrower.desiredWorkers)):F(a.borrower.wage),priorRevenue:F(p.revenue),priorOutput:F(p.output),bankHeadroom,approved:false,loanAmount:0,follow3:null,follow6:null};
  });
  const before=new Set((country.loans||[]).map(l=>l.id));
  const out=originalOriginate(country,month,signals);
  const newLoans=(country.loans||[]).filter(l=>!before.has(l.id));
  const byBorrower=new Map();
  for(const l of newLoans){if(!byBorrower.has(l.borrowerId))byBorrower.set(l.borrowerId,[]);byBorrower.get(l.borrowerId).push(l);}
  for(const a of apps){const ls=byBorrower.get(a.borrowerId)||[];if(ls.length){a.approved=true;a.loanAmount=S(ls.map(l=>F(l.originalPrincipal)));}creditApps.push(a);const er=entrants.get(a.borrowerId);if(er&&a.approved&&er.firstCreditMonth===null)er.firstCreditMonth=month;}
  return out;
};

for(let i=0;i<months;i++){
  w.stepMonth();
  for(const c of w.countries){
    const st=countryStats.get(c.id),initial=initialIds.get(c.id);
    for(const f of c.firms){
      const p=priorFirm.get(f.id);
      if(!initial.has(f.id)&&!entrants.has(f.id))entrants.set(f.id,{firmId:f.id,countryId:c.id,industryId:f.industryId,birthMonth:w.month,birthCash:F(w.ledger.balance(f.accountId)),birthWorkers:F(f.workers),birthCapital:F(f.capitalStock),birthInventory:F(f.inventory)+S(Object.values(f.inputInventory||{})),firstHireMonth:F(f.workers)>0?w.month:null,firstOutputMonth:F(f.output)>EPS?w.month:null,firstRevenueMonth:F(f.revenue)>EPS?w.month:null,firstCreditMonth:null,firstDistressMonth:F(f.distressMonths)>0?w.month:null,exitMonth:f.active===false?w.month:null,exitReason:null,preExit:null});
      const er=entrants.get(f.id);
      if(er){if(er.firstHireMonth===null&&F(f.workers)>0)er.firstHireMonth=w.month;if(er.firstOutputMonth===null&&F(f.output)>EPS)er.firstOutputMonth=w.month;if(er.firstRevenueMonth===null&&F(f.revenue)>EPS)er.firstRevenueMonth=w.month;if(er.firstDistressMonth===null&&F(f.distressMonths)>0)er.firstDistressMonth=w.month;}
      if(p){
        if(f.active!==false){
          st.wageComparisons++;st.priceComparisons++;
          const dw=F(f.wage)-F(p.wage),dp=F(f.price)-F(p.price);
          if(dw>TOL)st.wageUp++;if(dw<-TOL)st.wageDown++;if(Math.abs(dp)>TOL)st.priceMoves++;
          const severe=F(f.wageArrears)>Math.max(100,F(f.wage)*Math.max(1,F(f.workers))*.5);
          const noVacancy=F(f.desiredWorkers)<=F(f.workers)+TOL;
          const key=f.id;
          const run=severe&&noVacancy?(stressRun.get(key)||0)+1:0;stressRun.set(key,run);
          if(severe&&noVacancy){st.stressedNoVacancy++;if(dw<-TOL)st.stressedNoVacancyWageDown++;if(Math.abs(dp)>TOL)st.stressedNoVacancyPriceMove++;}
          if(run>=3){st.prolongedStress++;if(dw<-TOL)st.prolongedStressWageDown++;}
        }
        if(p.active===true&&f.active===false){
          st.exits++;
          if(er){
            st.entrantExits++;er.exitMonth=w.month;er.preExit={...p};
            const severePayroll=F(p.arrears)>Math.max(100,F(p.wage)*Math.max(1,F(p.workers))*1.35);
            const severeCredit=F(p.creditMisses)>=5;
            const liquidityFailure=F(p.cash)<F(f.safeCash)*.025&&severePayroll;
            if(liquidityFailure&&severeCredit){st.entrantExitBoth++;er.exitReason='both';}
            else if(liquidityFailure){st.entrantExitPayrollLiquidity++;er.exitReason='payroll-liquidity';}
            else if(severeCredit){st.entrantExitCredit++;er.exitReason='credit';}
            else {st.entrantExitOther++;er.exitReason='other';}
          }
        }
      }
      priorFirm.set(f.id,{active:f.active!==false,wage:F(f.wage),price:F(f.price),cash:F(w.ledger.balance(f.accountId)),arrears:F(f.wageArrears),creditMisses:F(f.creditMisses),workers:F(f.workers),desiredWorkers:F(f.desiredWorkers),output:F(f.output),revenue:F(f.revenue),capital:F(f.capitalStock),inventory:F(f.inventory)+S(Object.values(f.inputInventory||{}))});
    }
  }
  for(const a of creditApps){const age=w.month-a.month;if((age===3&&a.follow3===null)||(age===6&&a.follow6===null)){const c=w.countries.find(x=>x.id===a.countryId);const f=c?.firms.find(x=>x.id===a.borrowerId);const h=c?.households.find(x=>x.id===a.borrowerId);const b=f||h;const v=b?{active:f?f.active!==false:true,employed:h?!!h.employed:null,output:f?F(f.output):0,revenue:f?F(f.revenue):0,arrears:F(b.wageArrears),creditMisses:F(b.creditMisses),loanBalance:F(b.loanBalance)}:{active:false,employed:null,output:0,revenue:0,arrears:0,creditMisses:0,loanBalance:0};if(age===3)a.follow3=v;else a.follow6=v;}}
}

const health=w.forceHealthCheck(),accountingOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),gdpOk=w.countries.every(c=>Math.abs(gdpResidual(c.macro))<1e-5);
assert.ok(accountingOk&&ledgerOk&&gdpOk&&w.__bmbnbqNorm>0,`${seed}: hard gate`);

const countries=[];
for(const c of w.countries){
  const st=countryStats.get(c.id),ers=[...entrants.values()].filter(e=>e.countryId===c.id),apps=creditApps.filter(a=>a.countryId===c.id),firmApps=apps.filter(a=>a.kind==='firm'),hhApps=apps.filter(a=>a.kind==='household');
  const appGroup=g=>({applications:g.length,approved:g.filter(a=>a.approved).length,approvalRate:g.length?g.filter(a=>a.approved).length/g.length:0,meanRequested:M(g.map(a=>a.requested)),meanArrears:M(g.map(a=>a.arrears)),meanPriorRevenue:M(g.map(a=>a.priorRevenue)),meanPayrollRequestRatio:M(g.filter(a=>a.payrollNeed>EPS).map(a=>a.requested/a.payrollNeed)),approvedMeanPriorRevenue:M(g.filter(a=>a.approved).map(a=>a.priorRevenue)),rejectedMeanPriorRevenue:M(g.filter(a=>!a.approved).map(a=>a.priorRevenue)),approved3mActiveShare:g.filter(a=>a.approved&&a.follow3).length?g.filter(a=>a.approved&&a.follow3).filter(a=>a.follow3.active).length/g.filter(a=>a.approved&&a.follow3).length:0,rejected3mActiveShare:g.filter(a=>!a.approved&&a.follow3).length?g.filter(a=>!a.approved&&a.follow3).filter(a=>a.follow3.active).length/g.filter(a=>!a.approved&&a.follow3).length:0});
  const sectors={};for(const sec of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])sectors[sec]=appGroup(firmApps.filter(a=>a.sector===sec));
  countries.push({countryId:c.id,wageRatchet:{wageChangeShare:st.wageComparisons?(st.wageUp+st.wageDown)/st.wageComparisons:0,wageUpShare:st.wageComparisons?st.wageUp/st.wageComparisons:0,wageDownShare:st.wageComparisons?st.wageDown/st.wageComparisons:0,priceMoveShare:st.priceComparisons?st.priceMoves/st.priceComparisons:0,stressedNoVacancyFirmMonths:st.stressedNoVacancy,stressedWageDownShare:st.stressedNoVacancy?st.stressedNoVacancyWageDown/st.stressedNoVacancy:0,stressedPriceMoveShare:st.stressedNoVacancy?st.stressedNoVacancyPriceMove/st.stressedNoVacancy:0,prolongedStressFirmMonths:st.prolongedStress,prolongedStressWageDownShare:st.prolongedStress?st.prolongedStressWageDown/st.prolongedStress:0},entrantFailure:{entrants:ers.length,exits:ers.filter(e=>e.exitMonth!==null).length,payrollLiquidity:st.entrantExitPayrollLiquidity,credit:st.entrantExitCredit,both:st.entrantExitBoth,other:st.entrantExitOther,firstDistressMeanMonths:M(ers.filter(e=>e.firstDistressMonth!==null).map(e=>e.firstDistressMonth-e.birthMonth)),firstOutputShare:ers.length?ers.filter(e=>e.firstOutputMonth!==null).length/ers.length:0,firstRevenueShare:ers.length?ers.filter(e=>e.firstRevenueMonth!==null).length/ers.length:0,firstCreditShare:ers.length?ers.filter(e=>e.firstCreditMonth!==null).length/ers.length:0,meanPreExitCash:M(ers.filter(e=>e.preExit).map(e=>e.preExit.cash)),meanPreExitArrears:M(ers.filter(e=>e.preExit).map(e=>e.preExit.arrears)),meanPreExitCreditMisses:M(ers.filter(e=>e.preExit).map(e=>e.preExit.creditMisses)),meanPreExitWorkers:M(ers.filter(e=>e.preExit).map(e=>e.preExit.workers)),meanPreExitRevenue:M(ers.filter(e=>e.preExit).map(e=>e.preExit.revenue)),meanPreExitOutput:M(ers.filter(e=>e.preExit).map(e=>e.preExit.output))},creditSelection:{all:appGroup(apps),firms:appGroup(firmApps),households:appGroup(hhApps),sectors,meanBankHeadroom:M(apps.map(a=>a.bankHeadroom))},terminal:{unemployment:F(c.macro?.unemployment),arrears:F(c.macro?.wageArrears),output:F(c.macro?.realOutput),gdp:F(c.macro?.gdp),activeFirms:F(c.macro?.activeFirms)}});
}
const report={workPackage:'WP-RV08-R4-BM-BN-BQ',title:'Integrated Wage Ratchet, Entrant Failure, Credit Underwriting Audit',generatedAt:new Date().toISOString(),configuration:{seed,months,base:'materials-consumer'},gates:{healthOk:health.ok,accountingOk,ledgerOk,gdpIdentityArithmetic:gdpOk,normalizationActivated:w.__bmbnbqNorm>0,completeMonths:w.month===months,finiteMetrics:finiteTree(countries),ok:true},countries};
assert.ok(finiteTree(countries),`${seed}: finite gate`);
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
