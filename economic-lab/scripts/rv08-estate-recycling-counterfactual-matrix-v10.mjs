import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const C=v=>structuredClone(v);
const S=a=>a.reduce((s,v)=>s+F(v),0);
const M=a=>a.length?S(a)/a.length:0;
const R=(a,b)=>Math.abs(F(b))>EPS?F(a)/F(b):0;
const CL=(x,l,h)=>Math.max(l,Math.min(h,F(x)));

const bases=['consumer','materials-consumer'];
const dispositions=['none','capital','inventory','capital-inventory'];
const variants=bases.flatMap(base=>dispositions.map(disposition=>({id:`${base}-${disposition}`,base,disposition})));

function targetSectors(base){return base==='consumer'?new Set(['CONSUMER']):new Set(['MATERIALS','CONSUMER']);}
function transformedSeeds(){return COUNTRY_SEEDS.map(s=>({...s,initialPrice:Math.max(EPS,F(s.initialWage,F(s.initialPrice,1)))}));}
function makeWorld(scale,seed){const old=COUNTRY_SEEDS.map(C);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seed,{scaleProfile:scale,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...old);}}
function supplierMean(c,p){const a=c.firms.filter(f=>f.active!==false&&f.product===p&&F(f.price)>EPS);return a.length?M(a.map(f=>f.price)):0;}
function unconstrainedPlan(f){const anchor=Math.max(2,F(f.previousSales),F(f.targetInventory)*.42),expected=anchor*(1+CL(f.beliefs?.demandGrowth||0,-.18,.22)),replen=Math.max(0,F(f.targetInventory)-F(f.inventory));return Math.max(0,expected*.72+replen);}

function installNormalization(w,base){
  const target=targetSectors(base),done=new Set();w.__r4iNorm=0;
  const original=w.supply.planProduction.bind(w.supply);
  w.supply.planProduction=c=>{
    const out=original(c);if(done.has(c.id))return out;
    const prices={raw_material:supplierMean(c,'raw_material'),processed_material:supplierMean(c,'processed_material')};
    for(const f of c.firms.filter(x=>x.active!==false&&target.has(x.industryId))){
      const inputCost=F(f.inputPerOutput)*(f.inputProduct?F(prices[f.inputProduct]):0),margin=F(f.price)-inputCost,payroll=F(f.wage)*F(f.workers),baseCapacity=F(f.capacity),required=margin>EPS&&baseCapacity>EPS?payroll/(margin*baseCapacity):Infinity,factor=Number.isFinite(required)?Math.max(1,required):1;
      if(factor>1+TOL){f.productivity*=factor;f.capacity=baseCapacity*factor;f.desiredProduction=Math.max(0,Math.min(f.capacity*1.08,unconstrainedPlan(f)));w.__r4iNorm++;}
    }
    done.add(c.id);return out;
  };
}

function physicalSnapshot(f){return{capitalStock:Math.max(0,F(f.capitalStock)),finished:Math.max(0,F(f.inventory)),inputs:Object.fromEntries(Object.entries(f.inputInventory||{}).map(([k,v])=>[k,Math.max(0,F(v))])),workers:Math.max(0,F(f.workers))};}
function queueKey(countryId,industryId){return `${countryId}|${industryId}`;}

function installEstateRecycling(w,v,instrument=true){
  w.__r4iQueues=new Map();w.__r4iExitEstates=[];w.__r4iTransfers=[];w.__r4iEntrants=new Map();w.__r4iTransferResidual=0;
  const originalExit=w.supply.evaluateExits.bind(w.supply);
  w.supply.evaluateExits=c=>{
    const before=new Map(c.firms.filter(f=>f.active!==false).map(f=>[f.id,{industryId:f.industryId,state:physicalSnapshot(f)}]));
    const industries=originalExit(c);
    if(!instrument)return industries;
    for(const f of c.firms){
      const b=before.get(f.id);if(!b||f.active!==false)continue;
      const estate={month:w.month,countryId:c.id,firmId:f.id,industryId:b.industryId,...b.state};
      w.__r4iExitEstates.push(estate);
      const k=queueKey(c.id,b.industryId);if(!w.__r4iQueues.has(k))w.__r4iQueues.set(k,[]);w.__r4iQueues.get(k).push({source:f,estate});
    }
    return industries;
  };

  const originalCreate=w.createEntrant.bind(w);
  w.createEntrant=(c,industryId)=>{
    const entrant=originalCreate(c,industryId);
    const meta={month:w.month,countryId:c.id,firmId:entrant.id,industryId:entrant.industryId,disposition:v.disposition,receivedCapital:0,receivedFinished:0,receivedInputs:0,sourceFirmId:null,everOutput:false,everRevenue:false,reexit:false};
    if(instrument&&v.disposition!=='none'){
      const q=w.__r4iQueues.get(queueKey(c.id,industryId))||[];
      const item=q.shift();
      if(item){
        const source=item.source;meta.sourceFirmId=source.id;
        let capital=0,finished=0,inputUnits=0;
        if(v.disposition==='capital'||v.disposition==='capital-inventory'){
          capital=Math.max(0,F(source.capitalStock));const beforeSource=F(source.capitalStock),beforeTarget=F(entrant.capitalStock);source.capitalStock=0;entrant.capitalStock=beforeTarget+capital;w.__r4iTransferResidual=Math.max(w.__r4iTransferResidual,Math.abs((beforeSource+beforeTarget)-(F(source.capitalStock)+F(entrant.capitalStock))));
        }
        if(v.disposition==='inventory'||v.disposition==='capital-inventory'){
          finished=Math.max(0,F(source.inventory));const beforeSource=F(source.inventory),beforeTarget=F(entrant.inventory);source.inventory=0;entrant.inventory=beforeTarget+finished;w.__r4iTransferResidual=Math.max(w.__r4iTransferResidual,Math.abs((beforeSource+beforeTarget)-(F(source.inventory)+F(entrant.inventory))));
          for(const [product,value] of Object.entries(source.inputInventory||{})){
            const units=Math.max(0,F(value)),target=F(entrant.inputInventory?.[product]);
            if(!(product in entrant.inputInventory))entrant.inputInventory[product]=0;
            source.inputInventory[product]=0;entrant.inputInventory[product]=target+units;inputUnits+=units;
            w.__r4iTransferResidual=Math.max(w.__r4iTransferResidual,Math.abs((units+target)-(F(source.inputInventory[product])+F(entrant.inputInventory[product]))));
          }
        }
        meta.receivedCapital=capital;meta.receivedFinished=finished;meta.receivedInputs=inputUnits;
        w.__r4iTransfers.push({variant:v.id,disposition:v.disposition,month:w.month,countryId:c.id,industryId,sourceFirmId:source.id,entrantFirmId:entrant.id,capital,finished,inputUnits});
      }
    }
    w.__r4iEntrants.set(entrant.id,meta);return entrant;
  };
}

function updateEntrants(w){for(const c of w.countries)for(const f of c.firms){const m=w.__r4iEntrants.get(f.id);if(!m)continue;if(F(f.output)>EPS)m.everOutput=true;if(F(f.revenue)>EPS)m.everRevenue=true;if(f.active===false)m.reexit=true;}}
function gdpResidual(m){return F(m?.gdp)-(F(m?.consumption)+F(m?.grossInvestment)+F(m?.publicInvestment)+F(m?.governmentConsumption)+F(m?.inventoryInvestment)+F(m?.netExports));}
function digest(w){const h=createHash('sha256'),put=v=>h.update(JSON.stringify(v));put({month:w.month,rng:w.rng});for(const c of w.countries){put(c);put(w.accountingReport(c.id));}for(const e of w.ledger.entries)put(e);return h.digest('hex');}
function row(w,v,scale,seed,c){const m=c.macro||{};return{variant:v.id,base:v.base,disposition:v.disposition,scaleProfile:scale,seed,month:w.month,countryId:c.id,unemployment:F(m.unemployment),exits:F(m.firmExits),entries:F(m.firmEntries),activeFirms:F(m.activeFirms),arrears:F(m.wageArrears),fulfillment:1-F(m.unmetDemandRatio),shortage:F(m.inputShortageUnits),resource:F(m.resourceOutput),materials:F(m.materialsOutput),capital:F(m.capitalGoodsOutput),consumer:F(m.consumerGoodsOutput),cash:F(m.firmCash),sales:F(m.nominalSales),gdpResidual:gdpResidual(m),ledgerOk:w.ledger.verifyCountry(c.id)?.ok===true};}

function run(v,scale,seed,h,instrument=true,capture=false){
  const w=makeWorld(scale,seed);installNormalization(w,v.base);installEstateRecycling(w,v,instrument);const rows=[];
  for(let i=0;i<h;i++){w.stepMonth();if(instrument)updateEntrants(w);for(const c of w.countries)rows.push(row(w,v,scale,seed,c));}
  const health=w.forceHealthCheck();assert.ok(health.ok,`${v.id}/${scale}/${seed}: health`);
  const generalOk=w.countries.every(c=>w.accounting.verifyCountry(c,w.ledger,w.month)?.ok!==false);
  return{variant:v.id,scaleProfile:scale,seed,rows,health,generalOk,normalizationApps:w.__r4iNorm||0,exitEstates:instrument?w.__r4iExitEstates:[],transfers:instrument?w.__r4iTransfers:[],entrants:instrument?[...w.__r4iEntrants.values()]:[],transferResidual:w.__r4iTransferResidual||0,fingerprint:capture?digest(w):null};
}

const niV=variants.find(v=>v.base==='consumer'&&v.disposition==='none'),niScale=scales[0],niSeed='ECON-RV08-R4I-NI',niH=Math.min(4,months);
const niRaw=run(niV,niScale,niSeed,niH,false,true).fingerprint,niObserved=run(niV,niScale,niSeed,niH,true,true).fingerprint,observerNonInterferenceExact=niRaw===niObserved;assert.ok(observerNonInterferenceExact,'R4-I observer non-interference');
const deterministic=[];for(const v of variants)for(const scale of scales){const seed=`ECON-RV08-R4I-DET-${v.id}-${scale}`,h=Math.min(3,months),a=run(v,scale,seed,h,true,true).fingerprint,b=run(v,scale,seed,h,true,true).fingerprint;assert.equal(a,b,`${v.id}/${scale}: deterministic`);deterministic.push({variant:v.id,scaleProfile:scale,exact:true});}
const runs=[];for(const v of variants)for(const scale of scales)for(const seed of seeds)runs.push(run(v,scale,seed,months,true,false));
const rows=runs.flatMap(r=>r.rows),transfers=runs.flatMap(r=>r.transfers.map(x=>({...x,scaleProfile:r.scaleProfile,seed:r.seed}))),entrants=runs.flatMap(r=>r.entrants.map(x=>({...x,scaleProfile:r.scaleProfile,seed:r.seed,variant:r.variant})));
const windows=[['M1-6',1,Math.min(6,months)],['M7-12',7,Math.min(12,months)],['M13-18',13,Math.min(18,months)],['M19-24',19,months],['FULL',1,months]].filter(x=>x[1]<=x[2]);
function agg(a){return{countryMonths:a.length,unemployment:M(a.map(x=>x.unemployment)),exits:S(a.map(x=>x.exits)),entries:S(a.map(x=>x.entries)),activeFirms:M(a.map(x=>x.activeFirms)),arrears:M(a.map(x=>x.arrears)),fulfillment:M(a.map(x=>x.fulfillment)),shortage:M(a.map(x=>x.shortage)),resource:M(a.map(x=>x.resource)),materials:M(a.map(x=>x.materials)),capital:M(a.map(x=>x.capital)),consumer:M(a.map(x=>x.consumer)),cash:M(a.map(x=>x.cash)),sales:M(a.map(x=>x.sales))};}
const summary=[];for(const v of variants)for(const scale of scales)for(const [window,a,b] of windows)summary.push({variant:v.id,base:v.base,disposition:v.disposition,scaleProfile:scale,window,...agg(rows.filter(x=>x.variant===v.id&&x.scaleProfile===scale&&x.month>=a&&x.month<=b))});
const transferSummary=[];for(const v of variants)for(const scale of scales){const t=transfers.filter(x=>x.variant===v.id&&x.scaleProfile===scale),e=entrants.filter(x=>x.variant===v.id&&x.scaleProfile===scale);transferSummary.push({variant:v.id,base:v.base,disposition:v.disposition,scaleProfile:scale,transfers:t.length,capital:S(t.map(x=>x.capital)),finished:S(t.map(x=>x.finished)),inputs:S(t.map(x=>x.inputUnits)),entrants:e.length,entrantOutputShare:e.length?e.filter(x=>x.everOutput).length/e.length:0,entrantRevenueShare:e.length?e.filter(x=>x.everRevenue).length/e.length:0,entrantReexitShare:e.length?e.filter(x=>x.reexit).length/e.length:0});}
const comparisons={};for(const base of bases)for(const scale of scales){const c=summary.find(x=>x.base===base&&x.disposition==='none'&&x.scaleProfile===scale&&x.window==='FULL');comparisons[`${base}|${scale}`]={};for(const x of summary.filter(y=>y.base===base&&y.scaleProfile===scale&&y.window==='FULL'&&y.disposition!=='none'))comparisons[`${base}|${scale}`][x.disposition]={unemploymentDifference:x.unemployment-c.unemployment,exitDifference:x.exits-c.exits,entryDifference:x.entries-c.entries,arrearsDifference:x.arrears-c.arrears,fulfillmentDifference:x.fulfillment-c.fulfillment,shortageDifference:x.shortage-c.shortage,resourceRatio:R(x.resource,c.resource),materialsRatio:R(x.materials,c.materials),consumerRatio:R(x.consumer,c.consumer),salesRatio:R(x.sales,c.sales)};}
const transferVariants=runs.filter(r=>variants.find(v=>v.id===r.variant)?.disposition!=='none');
const gates={observerNonInterferenceExact,deterministicReplayExact:deterministic.every(x=>x.exact),allHealthy:runs.every(r=>r.health.ok),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,normalizationActivated:runs.every(r=>r.normalizationApps>0),recyclingActivated:transferVariants.some(r=>r.transfers.length>0),capitalModeTransfersCapital:runs.filter(r=>['capital','capital-inventory'].includes(variants.find(v=>v.id===r.variant)?.disposition)).every(r=>r.transfers.some(t=>t.capital>EPS)),inventoryModeTransfersInventory:runs.filter(r=>['inventory','capital-inventory'].includes(variants.find(v=>v.id===r.variant)?.disposition)).every(r=>r.transfers.some(t=>t.finished>EPS||t.inputUnits>EPS)),physicalTransferConserved:runs.every(r=>r.transferResidual<=TOL),ledgerCountriesOk:rows.every(r=>r.ledgerOk),generalAccountingOk:runs.every(r=>r.generalOk),gdpIdentityArithmetic:rows.every(r=>Math.abs(r.gdpResidual)<=TOL),finiteRows:rows.every(r=>Object.values(r).every(v=>typeof v!=='number'||Number.isFinite(v)))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`R4-I gates ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.scaleProfile==='baseline'&&x.window==='FULL').map(x=>({variant:x.variant,u:+x.unemployment.toFixed(4),exits:x.exits,entries:x.entries,active:+x.activeFirms.toFixed(1),arrears:+x.arrears.toFixed(0),fulfill:+x.fulfillment.toFixed(3),short:+x.shortage.toFixed(1),materials:+x.materials.toFixed(1),consumer:+x.consumer.toFixed(1)})));
console.table(transferSummary.filter(x=>x.scaleProfile==='baseline').map(x=>({variant:x.variant,transfers:x.transfers,capital:+x.capital.toFixed(1),finished:+x.finished.toFixed(1),inputs:+x.inputs.toFixed(1),entrantOutput:+x.entrantOutputShare.toFixed(3),entrantRevenue:+x.entrantRevenueShare.toFixed(3),reexit:+x.entrantReexitShare.toFixed(3)})));
console.log('WP_RV08_R4I_COMPARISONS',JSON.stringify(comparisons));console.log('WP_RV08_R4I_GATES',JSON.stringify(gates));
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify({workPackage:'WP-RV08-R4I',title:'Estate physical-stock recycling counterfactual matrix',generatedAt:new Date().toISOString(),methodology:{mechanismChanges:0,parameterTuning:0,diagnosticOnly:true,physicalTransferOnly:true,accountingCaution:'Transferred operational capital/inventory is intentionally not rebooked across legal entities. GDP is retained only as an arithmetic identity gate and MUST NOT be used as a causal endpoint in this WP.'},configuration:{variants,scales,seeds,months},gates,summary,transferSummary,comparisons,transfers,entrants,rows},null,2));console.log('WP_RV08_R4I_OUTPUT',outputJson);}
