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
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

const fundingModes=['control','priority-equity','safe-cash-equity','bank-upper'];
const supplyModes=['canonical','topo-fullcash'];
const variants=[];
for(const funding of fundingModes)for(const supply of supplyModes)variants.push({id:`${funding}-${supply}`,funding,supply});

function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(scale,seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:scale,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}

function installEntrantTracking(w,v,scale,seed){
  w.__r3Entrants=new Map();
  const original=w.createEntrant.bind(w);
  w.createEntrant=(country,industryId)=>{
    const f=original(country,industryId);
    w.__r3Entrants.set(f.id,{variant:v.id,scaleProfile:scale,seed,countryId:country.id,firmId:f.id,industryId:f.industryId,birthMonth:w.month,everEquity:false,everCredit:false,everOutput:false,everRevenue:false,reexit:false,specialEquity:0,specialLoan:0,finalCash:0,finalWorkers:0,finalActive:true});
    return f;
  };
}

function updateEntrantOutcomes(w){
  for(const c of w.countries){
    const equityEntries=w.ledger.entriesFor({month:w.month,countryId:c.id,kind:'equity_subscription'});
    const loanEntries=w.ledger.entriesFor({month:w.month,countryId:c.id,kind:'bank_loan_origination'});
    const equityIds=new Set(equityEntries.map(e=>e.meta?.firmId).filter(Boolean));
    const loanIds=new Set(loanEntries.map(e=>e.meta?.borrowerId).filter(Boolean));
    for(const f of c.firms){
      const m=w.__r3Entrants?.get(f.id);if(!m)continue;
      if(equityIds.has(f.id))m.everEquity=true;
      if(loanIds.has(f.id))m.everCredit=true;
      if(F(f.output)>EPS)m.everOutput=true;
      if(F(f.revenue)>EPS)m.everRevenue=true;
      if(f.active===false)m.reexit=true;
      m.finalCash=w.ledger.balance(f.accountId);m.finalWorkers=F(f.workers);m.finalActive=f.active!==false;
    }
  }
}

function specialEquityTarget(f,mode){
  const cashGap=Math.max(0,F(f.safeCash)-F(f.cash));
  if(mode==='safe-cash-equity')return cashGap;
  const market=f.equityMarket;if(!market)return 0;
  return Math.min(Math.max(F(f.wage)*Math.max(1,F(f.desiredWorkers))*.22,cashGap*.45),F(market.marketCap)*.035);
}

function syndicateEntrantEquity(w,c,month,mode,metrics){
  const entrants=c.firms.filter(f=>f.active!==false&&w.__r3Entrants?.has(f.id)&&month-w.__r3Entrants.get(f.id).birthMonth===1&&f.equityMarket);
  for(const f of entrants.sort((a,b)=>a.id.localeCompare(b.id))){
    let remaining=Math.max(0,specialEquityTarget(f,mode));
    if(remaining<=EPS)continue;
    const investors=c.households
      .filter(h=>w.ledger.balance(h.accountId)>Math.max(25,F(h.wage)*1.1))
      .sort((a,b)=>(F(b.optimism)-F(b.riskAversion)*.35)-(F(a.optimism)-F(a.riskAversion)*.35));
    for(const h of investors.slice(0,20)){
      if(remaining<=EPS)break;
      const balance=w.ledger.balance(h.accountId),buffer=Math.max(F(h.wage)*(h.employed?1.15:1.8),20),excess=Math.max(0,balance-buffer);
      const riskBudget=excess*CL((1-F(h.riskAversion))*.11+Math.max(0,F(h.optimism))*.035,.008,.12);
      const requested=Math.min(remaining,riskBudget);
      if(requested<=EPS)continue;
      const price=Math.max(.03,F(f.equityMarket.sharePrice,.03));
      const paid=w.ledger.transfer({month,countryId:c.id,from:h.accountId,to:f.accountId,amount:requested,kind:'equity_subscription',meta:{householdId:h.id,firmId:f.id,sharePrice:price,rv08R3:true,mode}});
      if(paid<=EPS)continue;
      const shares=paid/price;
      w.assetMarket.recordPrimarySubscription(h,f,month,paid,shares);
      f.equityMarket.sharesOutstanding+=shares;f.equityMarket.publicShares+=shares;f.equityMarket.issuanceCumulative+=paid;f.equityMarket.marketCap=f.equityMarket.sharePrice*f.equityMarket.sharesOutstanding;
      remaining-=paid;
      metrics.primaryIssuance=F(metrics.primaryIssuance)+paid;metrics.primaryTransactions=F(metrics.primaryTransactions)+1;
      const meta=w.__r3Entrants.get(f.id);meta.specialEquity+=paid;
      w.__r3FundingRows.push({variant:w.__r3Variant,month,countryId:c.id,firmId:f.id,industryId:f.industryId,kind:'equity',mode,amount:paid,householdId:h.id});
    }
  }
  w.assetMarket.updateHouseholdPortfolioValues(c);
}

function installEquityInstitution(w,v){
  if(v.funding!=='priority-equity'&&v.funding!=='safe-cash-equity')return;
  const original=w.assetMarket.runMarket.bind(w.assetMarket);
  w.assetMarket.runMarket=(c,month)=>{const metrics=original(c,month);syndicateEntrantEquity(w,c,month,v.funding,metrics);Object.assign(metrics,w.assetMarket.verifyCountry(c));c.lastAssetMarket=metrics;return metrics;};
}

function installBankUpperBound(w,v){
  if(v.funding!=='bank-upper')return;
  w.__r3Queue=new Map();w.__r3Trace=[];w.__r3ActiveCountry=null;
  for(const c of w.countries){
    const bank=c.banks[0];let value=bank.lastTrace;
    Object.defineProperty(bank,'lastTrace',{enumerable:true,configurable:true,get(){return value;},set(x){value=x;if(w.__r3ActiveCountry===c.id&&x?.borrowerId)w.__r3Trace.push({month:w.month,countryId:c.id,borrowerId:x.borrowerId,trace:C(x)});}});
  }
  const originalBuild=w.banking.buildApplications.bind(w.banking);
  w.banking.buildApplications=c=>{const apps=originalBuild(c);w.__r3Queue.set(c.id,apps.slice());return apps;};
  const originalOriginate=w.banking.originateCredit.bind(w.banking);
  w.banking.originateCredit=(c,month,signals)=>{
    w.__r3ActiveCountry=c.id;const traceStart=w.__r3Trace.length;const metrics=originalOriginate(c,month,signals);w.__r3ActiveCountry=null;
    const apps=w.__r3Queue.get(c.id)||[],traces=w.__r3Trace.slice(traceStart).filter(x=>x.month===month&&x.countryId===c.id),traceBy=new Map(traces.map(x=>[x.borrowerId,x.trace]));
    const originated=new Set(w.ledger.entriesFor({month,countryId:c.id,kind:'bank_loan_origination'}).map(e=>e.meta?.borrowerId).filter(Boolean));
    const bank=c.banks[0];
    for(const app of apps){
      if(app.kind!=='firm'||!w.__r3Entrants?.has(app.borrower.id)||originated.has(app.borrower.id))continue;
      const trace=traceBy.get(app.borrower.id);if(!trace)continue;
      const amount=Math.max(0,F(app.amount));if(amount<=EPS)continue;
      const created=w.ledger.adjustMoney({month,countryId:c.id,accountId:app.borrower.accountId,amount,kind:'bank_loan_origination',meta:{bankId:bank.id,borrowerId:app.borrower.id,rv08R3:true,mode:'bank-upper'}});
      if(created<=EPS)continue;
      const annualRate=Math.max(0,F(trace.forecast?.annualRate,F(bank.baseAnnualRate)+F(bank.loanMarkup)));
      const loan={id:`LN-R3-${String(w.banking.loanSequence++).padStart(8,'0')}`,countryId:c.id,bankId:bank.id,borrowerId:app.borrower.id,borrowerKind:'firm',originalPrincipal:created,outstanding:created,annualRate,monthlyRate:annualRate/12,termMonths:app.termMonths,originatedMonth:month,nextPaymentMonth:month+1,missedPayments:0,arrears:0,status:'active',estimatedDefaultProbabilityAtOrigination:F(trace.forecast?.estimatedDefaultProbability)};
      c.loans.push(loan);app.borrower.loanBalance=F(app.borrower.loanBalance)+created;w.accounting.recordLoanOrigination({country:c,bank,borrower:app.borrower,loan,month,amount:created});
      metrics.approved=F(metrics.approved)+1;metrics.newCredit=F(metrics.newCredit)+created;metrics.moneyCreated=F(metrics.moneyCreated)+created;originated.add(app.borrower.id);
      const meta=w.__r3Entrants.get(app.borrower.id);meta.specialLoan+=created;
      w.__r3FundingRows.push({variant:w.__r3Variant,month,countryId:c.id,firmId:app.borrower.id,industryId:app.borrower.industryId,kind:'loan',mode:'bank-upper',amount:created});
    }
    metrics.outstandingLoans=c.loans.reduce((s,l)=>s+(l.status==='active'?F(l.outstanding):0),0);return metrics;
  };
}

function chooseSupplier(candidates,rng,sampleSize=7){const pool=(candidates||[]).filter(f=>f.active!==false&&F(f.inventory)>EPS);if(!pool.length)return null;let best=null,bestScore=Infinity;const tries=Math.min(sampleSize,pool.length),seen=new Set();for(let k=0;k<tries;k++){let i=rng.int(0,pool.length),guard=0;while(seen.has(i)&&guard++<pool.length*2)i=(i+1)%pool.length;seen.add(i);const f=pool[i],reliability=.78+Math.min(.35,F(f.productivity)*.18),score=F(f.price)/Math.max(.1,reliability)*(.97+rng.next()*.06);if(score<bestScore){bestScore=score;best=f;}}return best;}
function procureGroup(w,c,month,metrics,buyers){const firms=c.firms.filter(f=>f.active!==false),byProduct=new Map();for(const seller of firms){if(!byProduct.has(seller.product))byProduct.set(seller.product,[]);byProduct.get(seller.product).push(seller);}let startNeed=0,shortage=0,spend=0;for(const buyer of [...buyers].sort((a,b)=>a.id.localeCompare(b.id))){const product=buyer.inputProduct;if(!product)continue;const required=Math.max(0,F(buyer.desiredProduction)*F(buyer.inputPerOutput)),onHand=Math.max(0,F(buyer.inputInventory?.[product]));let remaining=Math.max(0,required-onHand),budget=Math.max(0,w.ledger.balance(buyer.accountId)),initial=remaining;startNeed+=initial;for(let round=0;round<5&&remaining>EPS&&budget>EPS;round++){const seller=chooseSupplier(byProduct.get(product),w.rng,6+round*2);if(!seller||seller.id===buyer.id)break;const units=Math.min(remaining,F(seller.inventory),budget/Math.max(.01,F(seller.price)));if(units<=EPS)break;const requested=units*F(seller.price),paid=w.ledger.transfer({month,countryId:c.id,from:buyer.accountId,to:seller.accountId,amount:requested,kind:'interfirm_purchase',meta:{buyerId:buyer.id,sellerId:seller.id,product,units}});if(paid<=EPS)break;const settled=paid/F(seller.price),unitCost=Math.max(0,F(seller.bookUnitCost,F(seller.price)*.45)),sellerCost=Math.min(Math.max(0,w.accounting.gl.naturalBalance(seller.id,'inventory')),settled*unitCost);seller.inventory=Math.max(0,F(seller.inventory)-settled);seller.b2bSales+=settled;seller.b2bRevenue+=paid;seller.revenue+=paid;seller.sales+=settled;buyer.inputInventory[product]=F(buyer.inputInventory?.[product])+settled;buyer.inputBookValues[product]=F(buyer.inputBookValues?.[product])+paid;buyer.inputSpend+=paid;budget=Math.max(0,budget-paid);remaining=Math.max(0,remaining-settled);spend+=paid;w.accounting.recordInterfirmPurchase({buyer,seller,month,amount:paid,units:settled,cost:sellerCost,product});metrics.b2bTransactions++;metrics.b2bSpend+=paid;metrics.b2bUnits+=settled;}buyer.supplyShortage=Math.max(0,remaining);metrics.inputShortageUnits+=initial>0?Math.max(0,remaining):0;shortage+=Math.max(0,remaining);}return{startNeed,shortage,spend};}
function produceFirm(w,c,month,metrics,f){let output=Math.max(0,Math.min(F(f.desiredProduction),F(f.capacity)));if(f.inputProduct){const p=f.inputProduct,available=Math.max(0,F(f.inputInventory?.[p])),maxByInput=available/Math.max(EPS,F(f.inputPerOutput));output=Math.min(output,maxByInput);const used=output*F(f.inputPerOutput);if(used>EPS&&available>EPS){const book=Math.max(0,F(f.inputBookValues?.[p])),value=Math.min(book,book*(used/available));f.inputInventory[p]=Math.max(0,available-used);f.inputBookValues[p]=Math.max(0,book-value);if(value>EPS)w.accounting.recordInputConsumption({firm:f,month,amount:value,product:p,units:used});}}f.output=Math.max(0,output);f.inventory=F(f.inventory)+f.output;metrics.sectorOutputs[f.industryId]=(metrics.sectorOutputs[f.industryId]||0)+f.output;return f.output;}
function installSupplyMode(w,v){w.__r3SupplyCalls=0;if(v.supply!=='topo-fullcash')return;w.supply.procureInputs=(c,month)=>{const metrics=w.supply.emptyMetrics(c),firms=c.firms.filter(f=>f.active!==false),resources=firms.filter(f=>f.industryId==='RESOURCE').sort((a,b)=>a.id.localeCompare(b.id)),materials=firms.filter(f=>f.industryId==='MATERIALS').sort((a,b)=>a.id.localeCompare(b.id)),downstream=firms.filter(f=>f.industryId==='CAPITAL'||f.industryId==='CONSUMER').sort((a,b)=>a.id.localeCompare(b.id));for(const f of resources)produceFirm(w,c,month,metrics,f);procureGroup(w,c,month,metrics,materials);for(const f of materials)produceFirm(w,c,month,metrics,f);procureGroup(w,c,month,metrics,downstream);for(const f of downstream)produceFirm(w,c,month,metrics,f);w.__r3SupplyCalls++;return metrics;};w.supply.produce=(c,month,metrics)=>metrics;}

function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function digest(w){const h=createHash('sha256'),put=x=>h.update(JSON.stringify(x));put({month:w.month,rng:w.rng});for(const c of w.countries){put(c);put(w.accountingReport(c.id));}for(const e of w.ledger.entries)put(e);return h.digest('hex');}
function macroRow(w,v,scale,seed,c){const m=c.macro||{};return{variant:v.id,funding:v.funding,supply:v.supply,scaleProfile:scale,seed,month:w.month,countryId:c.id,unemployment:F(m.unemployment),exits:F(m.firmExits),entries:F(m.firmEntries),wageArrears:F(m.wageArrears),fulfillment:1-F(m.unmetDemandRatio),shortage:F(m.inputShortageUnits),resource:F(m.resourceOutput),materials:F(m.materialsOutput),consumer:F(m.consumerGoodsOutput),firmCash:F(m.firmCash),creditApproved:F(m.creditApproved),newCredit:F(m.newCredit),defaults:F(m.loanDefaults),assetPrimary:F(m.equityPrimaryIssuance)};}

function configure(w,v,scale,seed,instrument=true){if(!instrument)return;w.__r3Variant=v.id;w.__r3FundingRows=[];installEntrantTracking(w,v,scale,seed);installEquityInstitution(w,v);installBankUpperBound(w,v);installSupplyMode(w,v);}
function run(v,scale,seed,h,instrument=true,capture=false){const w=makeWorld(scale,seed);configure(w,v,scale,seed,instrument);const rows=[];for(let i=0;i<h;i++){w.stepMonth();if(instrument)updateEntrantOutcomes(w);for(const c of w.countries)rows.push(macroRow(w,v,scale,seed,c));}const health=w.forceHealthCheck();assert.ok(health.ok,`${v.id}/${scale}/${seed}: health`);const ledgerOk=w.countries.every(c=>w.ledger.verifyCountry(c.id)?.ok===true),generalOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false),assetOk=w.countries.every(c=>w.assetMarket.verifyCountry(c)?.accountingOk===true),maxGdp=Math.max(0,...w.countries.map(c=>Math.abs(gdpResidual(c.macro))));return{variant:v.id,funding:v.funding,supply:v.supply,scaleProfile:scale,seed,rows,health,ledgerOk,generalOk,assetOk,maxGdp,entrants:instrument?[...w.__r3Entrants.values()].map(C):[],fundingRows:instrument?w.__r3FundingRows.map(C):[],supplyCalls:w.__r3SupplyCalls||0,specialEquityLedger:instrument?S(w.ledger.entries.filter(e=>e.kind==='equity_subscription'&&e.meta?.rv08R3===true).map(e=>e.amount)):0,specialLoanLedger:instrument?S(w.ledger.entries.filter(e=>e.kind==='bank_loan_origination'&&e.meta?.rv08R3===true).map(e=>e.amount)):0,fingerprint:capture?digest(w):null};}

const niV=variants.find(v=>v.funding==='control'&&v.supply==='canonical'),niScale=scales[0],niSeed='ECON-RV08-R3-NI',niH=Math.min(5,months);
const niRaw=run(niV,niScale,niSeed,niH,false,true).fingerprint,niObserved=run(niV,niScale,niSeed,niH,true,true).fingerprint;
const controlObserverNonInterferenceExact=niRaw===niObserved;assert.ok(controlObserverNonInterferenceExact,'R3 control instrumentation non-interference');
const deterministic=[];for(const v of variants)for(const scale of scales){const seed=`ECON-RV08-R3-DET-${v.id}-${scale}`,h=Math.min(3,months),a=run(v,scale,seed,h,true,true).fingerprint,b=run(v,scale,seed,h,true,true).fingerprint;assert.equal(a,b,`${v.id}/${scale}: deterministic replay`);deterministic.push({variant:v.id,scale,exact:true});}
const runs=[];for(const v of variants)for(const scale of scales)for(const seed of seeds)runs.push(run(v,scale,seed,months,true,false));
const rows=runs.flatMap(r=>r.rows),entrants=runs.flatMap(r=>r.entrants),fundingRows=runs.flatMap(r=>r.fundingRows.map(x=>({...x,scaleProfile:r.scaleProfile,seed:r.seed})));
const windows=[['M1-3',1,Math.min(3,months)],['M4-6',4,Math.min(6,months)],['M7-9',7,Math.min(9,months)],['M10-12',10,months],['FULL',1,months]].filter(x=>x[1]<=x[2]);
function agg(a){return{observations:a.length,unemployment:M(a.map(x=>x.unemployment)),exits:S(a.map(x=>x.exits)),entries:S(a.map(x=>x.entries)),wageArrears:M(a.map(x=>x.wageArrears)),fulfillment:M(a.map(x=>x.fulfillment)),shortage:M(a.map(x=>x.shortage)),resource:M(a.map(x=>x.resource)),materials:M(a.map(x=>x.materials)),consumer:M(a.map(x=>x.consumer)),firmCash:M(a.map(x=>x.firmCash)),creditApproved:S(a.map(x=>x.creditApproved)),newCredit:S(a.map(x=>x.newCredit)),defaults:S(a.map(x=>x.defaults)),assetPrimary:S(a.map(x=>x.assetPrimary))};}
const summary=[];for(const v of variants)for(const scale of scales)for(const [window,a,b] of windows)summary.push({variant:v.id,funding:v.funding,supply:v.supply,scaleProfile:scale,window,...agg(rows.filter(x=>x.variant===v.id&&x.scaleProfile===scale&&x.month>=a&&x.month<=b))});
function entrantAgg(v,scale){const es=entrants.filter(e=>e.variant===v.id&&e.scaleProfile===scale),down=es.filter(e=>e.industryId!=='RESOURCE'),share=(a,p)=>a.length?a.filter(p).length/a.length:0;return{variant:v.id,funding:v.funding,supply:v.supply,scaleProfile:scale,births:es.length,everEquityShare:share(es,e=>e.everEquity),everCreditShare:share(es,e=>e.everCredit),everOutputShare:share(es,e=>e.everOutput),everRevenueShare:share(es,e=>e.everRevenue),reexitShare:share(es,e=>e.reexit),downstreamBirths:down.length,downstreamOutputShare:share(down,e=>e.everOutput),downstreamRevenueShare:share(down,e=>e.everRevenue),specialEquity:S(es.map(e=>e.specialEquity)),specialLoan:S(es.map(e=>e.specialLoan)),meanFinalCash:M(es.map(e=>e.finalCash)),meanFinalWorkers:M(es.map(e=>e.finalWorkers))};}
const entrantSummary=variants.flatMap(v=>scales.map(scale=>entrantAgg(v,scale)));
const equityRows=fundingRows.filter(x=>x.kind==='equity'),loanRows=fundingRows.filter(x=>x.kind==='loan');
const equityRowsTotal=S(equityRows.map(x=>x.amount)),loanRowsTotal=S(loanRows.map(x=>x.amount)),equityLedgerTotal=S(runs.map(r=>r.specialEquityLedger)),loanLedgerTotal=S(runs.map(r=>r.specialLoanLedger));
const entrantKeys=new Set(entrants.map(e=>`${e.variant}|${e.scaleProfile}|${e.seed}|${e.countryId}|${e.firmId}`));
const noNonEntrantSpecialFunding=fundingRows.every(x=>entrantKeys.has(`${x.variant}|${x.scaleProfile}|${x.seed}|${x.countryId}|${x.firmId}`));
const gates={controlObserverNonInterferenceExact,deterministicReplayExact:deterministic.every(x=>x.exact),allHealthy:runs.every(r=>r.health.ok),completeCoverage:runs.length===variants.length*scales.length*seeds.length,ledgerCountriesOk:runs.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.generalOk),assetAccountingOk:runs.every(r=>r.assetOk),gdpIdentityReconciled:runs.every(r=>r.maxGdp<=TOL),equityInstitutionActivated:equityRows.length>0,bankUpperActivated:loanRows.length>0,topologicalFullCashActivated:runs.filter(r=>r.supply==='topo-fullcash').every(r=>r.supplyCalls===months*COUNTRY_SEEDS.length),noSpecialFundingToNonEntrants:noNonEntrantSpecialFunding,specialEquityLedgerReconciled:Math.abs(equityRowsTotal-equityLedgerTotal)<=TOL,specialLoanLedgerReconciled:Math.abs(loanRowsTotal-loanLedgerTotal)<=TOL,finiteRows:rows.every(r=>Object.values(r).every(v=>typeof v!=='number'||Number.isFinite(v))),finiteEntrants:entrants.every(e=>Object.values(e).every(v=>typeof v!=='number'||Number.isFinite(v)))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`R3 gates ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.scaleProfile==='baseline'&&x.window==='FULL').map(x=>({variant:x.variant,u:+x.unemployment.toFixed(4),exits:x.exits,arrears:+x.wageArrears.toFixed(0),fulfill:+x.fulfillment.toFixed(3),short:+x.shortage.toFixed(1),consumer:+x.consumer.toFixed(1),credit:+x.newCredit.toFixed(0),equity:+x.assetPrimary.toFixed(0)})));
console.table(entrantSummary.filter(x=>x.scaleProfile==='baseline').map(x=>({variant:x.variant,births:x.births,equity:+x.everEquityShare.toFixed(3),credit:+x.everCreditShare.toFixed(3),downOutput:+x.downstreamOutputShare.toFixed(3),downRevenue:+x.downstreamRevenueShare.toFixed(3),reexit:+x.reexitShare.toFixed(3),specialEq:+x.specialEquity.toFixed(0),specialLoan:+x.specialLoan.toFixed(0)})));
console.log('WP_RV08_R3_GATES',JSON.stringify(gates));
console.log('WP_RV08_R3_SUMMARY',JSON.stringify(summary));
console.log('WP_RV08_R3_ENTRANTS',JSON.stringify(entrantSummary));
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify({workPackage:'WP-RV08-R3',title:'Entrant regeneration institution x supply complementarity matrix',generatedAt:new Date().toISOString(),configuration:{variants,scales,seeds,months},gates,summary,entrantSummary,fundingTotals:{equityRows:equityRows.length,equityRowsTotal,loanRows:loanRows.length,loanRowsTotal}},null,2));console.log('WP_RV08_R3_OUTPUT',outputJson);}
