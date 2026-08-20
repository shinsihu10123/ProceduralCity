import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0,clone=v=>structuredClone(v);
function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function fingerprint(w){return {month:w.month,rng:clone(w.rng),countries:clone(w.countries),ledgerEntries:clone(w.ledger.entries),accounting:w.countries.map(c=>({id:c.id,report:w.accountingReport(c.id)}))};}
function supplierMean(country,product){const fs=country.firms.filter(f=>f.active!==false&&f.product===product&&finite(f.price)>EPS);return fs.length?mean(fs.map(f=>f.price)):0;}
function installPriceFloor(world){
  world.__rv07P31={applications:0,raisedAmount:0,checks:[]};
  const plan=world.supply.planProduction.bind(world.supply);
  world.supply.planProduction=country=>{
    const out=plan(country);
    const active=country.firms.filter(f=>f.active!==false);
    const stages=[['RESOURCE',null],['MATERIALS','raw_material'],['CAPITAL','processed_material'],['CONSUMER','processed_material']];
    for(const [industryId,inputProduct] of stages){
      const upstream=inputProduct?supplierMean(country,inputProduct):0;
      for(const f of active.filter(x=>x.industryId===industryId)){
        const cap=finite(f.capacity),payroll=finite(f.wage)*finite(f.workers),laborPerUnit=cap>EPS?payroll/cap:0,inputPerUnit=finite(f.inputPerOutput)*upstream,floor=laborPerUnit+inputPerUnit,before=finite(f.price);
        if(cap>EPS&&floor>before+TOL){f.price=floor;world.__rv07P31.applications+=1;world.__rv07P31.raisedAmount+=floor-before;}
        world.__rv07P31.checks.push({month:world.month,countryId:country.id,firmId:f.id,industryId,before,after:finite(f.price),floor,capacity:cap,laborPerUnit,inputPerUnit,upstream});
      }
    }
    return out;
  };
}
function runVariant(variant,scaleProfile,seed,horizon){const world=createWorld(scaleProfile,seed);if(variant==='unit-basis-variable-cost-price-floor')installPriceFloor(world);const rows=[];for(let i=0;i<horizon;i++){world.stepMonth();for(const c of world.countries)rows.push({variant,scaleProfile,seed,month:world.month,countryId:c.id,unemployment:finite(c.macro?.unemployment),exits:finite(c.macro?.firmExits),wageArrears:finite(c.macro?.wageArrears),goodsFulfillment:1-finite(c.macro?.unmetDemandRatio),inputShortage:finite(c.macro?.inputShortageUnits),resourceOutput:finite(c.macro?.resourceOutput),materialsOutput:finite(c.macro?.materialsOutput),capitalOutput:finite(c.macro?.capitalGoodsOutput),consumerOutput:finite(c.macro?.consumerGoodsOutput),priceIndex:finite(c.macro?.priceIndex),nominalSales:finite(c.macro?.nominalSales),consumption:finite(c.macro?.consumption),firmCash:finite(c.macro?.firmCash),gdp:finite(c.macro?.gdp),gdpResidual:gdpResidual(c.macro),ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});}const health=world.forceHealthCheck();assert.ok(health.ok,`${variant}/${scaleProfile}/${seed}: health failed`);const checks=world.__rv07P31?.checks||[];return {variant,scaleProfile,seed,world,rows,checks,applications:world.__rv07P31?.applications||0,raisedAmount:world.__rv07P31?.raisedAmount||0,health,fingerprint:fingerprint(world)};}
const variants=['unit-basis-control','unit-basis-variable-cost-price-floor'];
const determinism=[];for(const v of variants)for(const s of scales){const seed=`ECON-RV07-P31-DET-${v}-${s}`,h=Math.min(3,months);const a=runVariant(v,s,seed,h).fingerprint,b=runVariant(v,s,seed,h).fingerprint,exact=JSON.stringify(a)===JSON.stringify(b);assert.ok(exact,`${v}/${s}: nondeterministic`);determinism.push({variant:v,scaleProfile:s,exact});}
const runs=[];for(const v of variants)for(const s of scales)for(const seed of seeds)runs.push(runVariant(v,s,seed,months));const rows=runs.flatMap(r=>r.rows),checks=runs.flatMap(r=>r.checks);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function aggregate(rs){return {countryMonths:rs.length,meanUnemployment:mean(rs.map(r=>r.unemployment)),totalExits:sum(rs.map(r=>r.exits)),meanWageArrears:mean(rs.map(r=>r.wageArrears)),meanGoodsFulfillment:mean(rs.map(r=>r.goodsFulfillment)),meanInputShortage:mean(rs.map(r=>r.inputShortage)),meanResourceOutput:mean(rs.map(r=>r.resourceOutput)),meanMaterialsOutput:mean(rs.map(r=>r.materialsOutput)),meanCapitalOutput:mean(rs.map(r=>r.capitalOutput)),meanConsumerOutput:mean(rs.map(r=>r.consumerOutput)),meanPriceIndex:mean(rs.map(r=>r.priceIndex)),meanNominalSales:mean(rs.map(r=>r.nominalSales)),meanConsumption:mean(rs.map(r=>r.consumption)),meanFirmCash:mean(rs.map(r=>r.firmCash)),meanGdp:mean(rs.map(r=>r.gdp))};}
const summary=[];for(const v of variants)for(const s of scales)for(const w of windows)summary.push({variant:v,scaleProfile:s,window:w.id,...aggregate(rows.filter(r=>r.variant===v&&r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to))});
const comparison={};for(const s of scales){comparison[s]={};for(const w of windows){const c=summary.find(x=>x.variant==='unit-basis-control'&&x.scaleProfile===s&&x.window===w.id),a=summary.find(x=>x.variant==='unit-basis-variable-cost-price-floor'&&x.scaleProfile===s&&x.window===w.id);comparison[s][w.id]={unemploymentDifference:a.meanUnemployment-c.meanUnemployment,exitDifference:a.totalExits-c.totalExits,wageArrearsDifference:a.meanWageArrears-c.meanWageArrears,goodsFulfillmentDifference:a.meanGoodsFulfillment-c.meanGoodsFulfillment,inputShortageDifference:a.meanInputShortage-c.meanInputShortage,resourceOutputRatio:ratio(a.meanResourceOutput,c.meanResourceOutput),materialsOutputRatio:ratio(a.meanMaterialsOutput,c.meanMaterialsOutput),consumerOutputRatio:ratio(a.meanConsumerOutput,c.meanConsumerOutput),priceIndexRatio:ratio(a.meanPriceIndex,c.meanPriceIndex),nominalSalesRatio:ratio(a.meanNominalSales,c.meanNominalSales),consumptionRatio:ratio(a.meanConsumption,c.meanConsumption),firmCashDifference:a.meanFirmCash-c.meanFirmCash,gdpDifference:a.meanGdp-c.meanGdp};}}
const candidateRuns=runs.filter(r=>r.variant==='unit-basis-variable-cost-price-floor'),maxFloorViolation=Math.max(0,...checks.filter(x=>x.capacity>EPS).map(x=>Math.max(0,x.floor-x.after))),maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.gdpResidual)));
const gates={deterministicReplayExact:determinism.every(x=>x.exact),allHealthy:runs.every(r=>r.health?.ok===true),completeCoverage:rows.length===variants.length*scales.length*seeds.length*months*4,interventionActuallyApplied:candidateRuns.reduce((s,r)=>s+r.applications,0)>0,priceFloorSatisfied:maxFloorViolation<TOL,ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.unemployment)&&Number.isFinite(r.priceIndex))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P31 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.window==='FULL').map(x=>({variant:x.variant,scale:x.scaleProfile,u:+x.meanUnemployment.toFixed(4),exits:x.totalExits,arrears:+x.meanWageArrears.toFixed(1),fulfill:+x.meanGoodsFulfillment.toFixed(4),shortage:+x.meanInputShortage.toFixed(2),consumer:+x.meanConsumerOutput.toFixed(2),price:+x.meanPriceIndex.toFixed(2),sales:+x.meanNominalSales.toFixed(1),firmCash:+x.meanFirmCash.toFixed(1)})));
console.log('WP_RV07_P31_COMPARISON',JSON.stringify(comparison));
console.log('WP_RV07_P31_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P31',title:'Variable-cost price-floor causal upper-bound',generatedAt:new Date().toISOString(),configuration:{variants,scales,seeds,months},determinism,gates,reconciliation:{maxFloorViolation,maxGdpResidual},summary,comparison,applications:candidateRuns.map(r=>({scaleProfile:r.scaleProfile,seed:r.seed,applications:r.applications,raisedAmount:r.raisedAmount})),checks,rows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P31_OUTPUT',outputJson);}
