import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';
import { COUNTRY_SEEDS } from '../src/config/countries.js';
import { setLaborMarketDiagnosticObserver } from '../src/markets/labor-market.js';

const scales=(process.env.DIAG_SCALES||'compact,baseline').split(',').map(x=>x.trim()).filter(Boolean);
const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A,ECON-RV02-B,ECON-RV02-C').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(1,Number(process.env.DIAG_MONTHS||12));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const EPS=1e-8,TOL=1e-7;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((s,v)=>s+finite(v),0),mean=a=>a.length?sum(a)/a.length:0,ratio=(a,b)=>Math.abs(finite(b))>EPS?finite(a)/finite(b):0;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,finite(x))),clone=v=>structuredClone(v);

function transformedSeeds(){return COUNTRY_SEEDS.map(seed=>({...seed,initialPrice:Math.max(EPS,finite(seed.initialWage,finite(seed.initialPrice,1)))}));}
function createWorld(scaleProfile,seedText){const original=COUNTRY_SEEDS.map(clone);COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...transformedSeeds());try{return new EconomicWorld(seedText,{scaleProfile,healthCheckInterval:0});}finally{COUNTRY_SEEDS.splice(0,COUNTRY_SEEDS.length,...original);}}
function gdpResidual(m){return finite(m?.gdp)-(finite(m?.consumption)+finite(m?.grossInvestment)+finite(m?.publicInvestment)+finite(m?.governmentConsumption)+finite(m?.inventoryInvestment)+finite(m?.netExports));}
function fingerprint(w){return {month:w.month,rng:clone(w.rng),countries:clone(w.countries),ledgerEntries:clone(w.ledger.entries),accounting:w.countries.map(c=>({id:c.id,report:w.accountingReport(c.id)}))};}
function requiredWorkers(country,f){
  const capitalEffect=0.72+Math.log1p(Math.max(0,finite(f.capitalStock)))*0.105;
  const humanEffect=0.82+finite(country.humanCapital)*0.30;
  const resourceEffect=f.industryId==='RESOURCE'?0.62+finite(country.resourceBase)*0.62:1;
  const planEffect=1+clamp(f.currentPlan?.productionChange||0,-0.12,0.15);
  const perWorker=Math.max(0,finite(f.productivity)*capitalEffect*humanEffect*resourceEffect*planEffect);
  const demandAnchor=Math.max(2,finite(f.previousSales),Math.max(0,finite(f.targetInventory)*0.42));
  const expectedDemand=demandAnchor*(1+clamp(f.beliefs?.demandGrowth||0,-0.18,0.22));
  const replenishment=Math.max(0,finite(f.targetInventory)-finite(f.inventory));
  const unconstrainedPlan=Math.max(0,expectedDemand*0.72+replenishment);
  const needed=perWorker>EPS?Math.ceil(unconstrainedPlan/(perWorker*1.08)):0;
  return Math.max(0,needed);
}
function sectorTotals(country,key){const out={RESOURCE:0,MATERIALS:0,CAPITAL:0,CONSUMER:0};for(const f of country.firms){if(f.active===false)continue;out[f.industryId]=(out[f.industryId]||0)+Math.max(0,finite(f[key]));}return out;}
function installP12Target(world){
  world.__rv07P13Pre=new Map();
  const original=world.banking.originateCredit.bind(world.banking);
  world.banking.originateCredit=(country,month,signals)=>{
    const result=original(country,month,signals);
    for(const f of country.firms){if(f.active===false)continue;f.desiredWorkers=requiredWorkers(country,f);}
    const currentWorkers=sectorTotals(country,'workers');
    const desiredWorkers=sectorTotals(country,'desiredWorkers');
    const totalDesired=sum(Object.values(desiredWorkers));
    const totalCurrent=sum(Object.values(currentWorkers));
    const households=country.households.length;
    const unemployedBefore=country.households.filter(h=>!h.employed).length;
    world.__rv07P13Pre.set(`${month}|${country.id}`,{households,unemployedBefore,totalDesired,totalCurrent,aggregateExcessDemand:Math.max(0,totalDesired-households),grossVacancies:Math.max(0,totalDesired-totalCurrent),sectorCurrent:currentWorkers,sectorDesired:desiredWorkers});
    return result;
  };
}
function run(scaleProfile,seed,horizon,observe=true,collect=true){
  const world=createWorld(scaleProfile,seed);installP12Target(world);const laborObs=new Map();
  setLaborMarketDiagnosticObserver(observe?payload=>laborObs.set(`${world.month}|${payload.countryId}`,clone(payload)):null);
  const rows=[];
  try{
    for(let i=0;i<horizon;i++){
      world.stepMonth();
      if(collect)for(const c of world.countries){
        const pre=world.__rv07P13Pre.get(`${world.month}|${c.id}`);const obs=laborObs.get(`${world.month}|${c.id}`);
        assert.ok(pre,`${scaleProfile}/${seed}/${world.month}/${c.id}: missing pre-labor snapshot`);
        assert.ok(obs,`${scaleProfile}/${seed}/${world.month}/${c.id}: missing labor observer`);
        const sectorActual=sectorTotals(c,'workers');
        const sectorUnfilled={};for(const k of ['RESOURCE','MATERIALS','CAPITAL','CONSUMER'])sectorUnfilled[k]=Math.max(0,finite(pre.sectorDesired[k])-finite(sectorActual[k]));
        const unfilled=finite(obs.result?.unfilled);
        rows.push({scaleProfile,seed,month:world.month,countryId:c.id,pre,sectorActual,sectorUnfilled,labor:{...clone(obs.result),...clone(obs.diagnostics)},decomposition:{aggregateLaborSupplyLowerBound:pre.aggregateExcessDemand,aggregateLaborSupplyLowerBoundShare:ratio(pre.aggregateExcessDemand,unfilled),residualBeyondAggregateSupply:Math.max(0,unfilled-pre.aggregateExcessDemand)},economy:{unemployment:finite(c.macro?.unemployment),wageArrears:finite(c.macro?.wageArrears),inputShortage:finite(c.lastIndustry?.inputShortageUnits),goodsFulfillment:ratio(finite(c.lastMarkets?.goods?.nominalConsumption??c.macro?.consumption),finite(c.lastMarkets?.goods?.desiredBudget)),gdpResidual:gdpResidual(c.macro)},ledgerOk:world.ledger.verifyCountry(c.id)?.ok===true});
      }
    }
  } finally { setLaborMarketDiagnosticObserver(null); }
  const health=world.forceHealthCheck();assert.ok(health.ok,`${scaleProfile}/${seed}: health failed`);return {world,rows,health,fingerprint:fingerprint(world)};
}

const ni=[];for(const s of scales){const seed=`ECON-RV07-P13-NI-${s}`,h=Math.min(3,months);const plain=run(s,seed,h,false,false).fingerprint,observed=run(s,seed,h,true,false).fingerprint;const exact=JSON.stringify(plain)===JSON.stringify(observed);assert.ok(exact,`${s}: labor observer perturbed P12 candidate state`);ni.push({scaleProfile:s,exact});}
const runs=[];for(const s of scales)for(const seed of seeds)runs.push(run(s,seed,months,true,true));const rows=runs.flatMap(x=>x.rows);
const windows=[{id:'M1-3',from:1,to:Math.min(3,months)},{id:'M4-6',from:4,to:Math.min(6,months)},{id:'M7-9',from:7,to:Math.min(9,months)},{id:'M10-12',from:10,to:months},{id:'FULL',from:1,to:months}].filter(w=>w.from<=w.to);
function agg(rs){const totalUnfilled=sum(rs.map(r=>r.labor.unfilled)),supplyLB=sum(rs.map(r=>r.decomposition.aggregateLaborSupplyLowerBound));return {countryMonths:rs.length,meanHouseholds:mean(rs.map(r=>r.pre.households)),meanDesiredWorkers:mean(rs.map(r=>r.pre.totalDesired)),meanCurrentWorkers:mean(rs.map(r=>r.pre.totalCurrent)),meanUnemployedBefore:mean(rs.map(r=>r.pre.unemployedBefore)),meanUnfilled:mean(rs.map(r=>r.labor.unfilled)),meanAggregateExcessDemand:mean(rs.map(r=>r.pre.aggregateExcessDemand)),aggregateSupplyLowerBoundShare:ratio(supplyLB,totalUnfilled),capacityBoundUnfilled:sum(rs.map(r=>r.labor.hiringCapacityBoundVacancies)),scanLimitUnfilled:sum(rs.map(r=>r.labor.scanLimitBoundVacancies)),noApplicantUnfilled:sum(rs.map(r=>r.labor.noApplicantVacancies)),meanGrossVacancies:mean(rs.map(r=>r.pre.grossVacancies)),sectorUnfilled:{RESOURCE:mean(rs.map(r=>r.sectorUnfilled.RESOURCE)),MATERIALS:mean(rs.map(r=>r.sectorUnfilled.MATERIALS)),CAPITAL:mean(rs.map(r=>r.sectorUnfilled.CAPITAL)),CONSUMER:mean(rs.map(r=>r.sectorUnfilled.CONSUMER))},meanUnemployment:mean(rs.map(r=>r.economy.unemployment)),meanWageArrears:mean(rs.map(r=>r.economy.wageArrears)),meanInputShortage:mean(rs.map(r=>r.economy.inputShortage)),meanGoodsFulfillment:mean(rs.map(r=>r.economy.goodsFulfillment))};}
const summary=[];for(const s of scales)for(const w of windows){const rs=rows.filter(r=>r.scaleProfile===s&&r.month>=w.from&&r.month<=w.to);summary.push({scaleProfile:s,window:w.id,...agg(rs)});}
const maxGdpResidual=Math.max(0,...rows.map(r=>Math.abs(r.economy.gdpResidual)));
const gates={observerNonInterferenceExact:ni.every(x=>x.exact),allHealthy:runs.every(x=>x.health?.ok===true),completeCoverage:rows.length===scales.length*seeds.length*months*4,allSnapshotsPresent:rows.every(r=>r.pre&&r.labor),laborDecompositionFinite:rows.every(r=>Number.isFinite(r.decomposition.aggregateLaborSupplyLowerBoundShare)),ledgerCountriesOk:rows.every(r=>r.ledgerOk),gdpIdentityReconciled:maxGdpResidual<TOL,finiteRows:rows.every(r=>Number.isFinite(r.pre.totalDesired)&&Number.isFinite(r.labor.unfilled))};gates.ok=Object.values(gates).every(Boolean);assert.ok(gates.ok,`WP-RV07-P13 gates failed: ${JSON.stringify(gates)}`);
console.table(summary.filter(x=>x.scaleProfile==='baseline').map(x=>({window:x.window,households:+x.meanHouseholds.toFixed(1),desired:+x.meanDesiredWorkers.toFixed(1),current:+x.meanCurrentWorkers.toFixed(1),unfilled:+x.meanUnfilled.toFixed(1),excess:+x.meanAggregateExcessDemand.toFixed(1),supplyLB:+x.aggregateSupplyLowerBoundShare.toFixed(3),capacity:x.capacityBoundUnfilled,scan:x.scanLimitUnfilled,noApplicant:x.noApplicantUnfilled,consumerGap:+x.sectorUnfilled.CONSUMER.toFixed(1)})));
console.log('WP_RV07_P13_GATES',JSON.stringify(gates));
const payload={workPackage:'WP-RV07-P13',title:'P12 labor-target feasibility and labor-market stop decomposition',generatedAt:new Date().toISOString(),configuration:{scales,seeds,months},observerNonInterference:ni,gates,reconciliation:{maxGdpResidual},summary,rows};if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(payload,null,2));console.log('WP_RV07_P13_OUTPUT',outputJson);}
