import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EconomicWorld } from '../src/core/world-v10.js';

const seeds=(process.env.DIAG_SEEDS||'ECON-RV02-A').split(',').map(x=>x.trim()).filter(Boolean);
const months=Math.max(12,Number(process.env.DIAG_MONTHS||24));
const outputJson=process.env.OUTPUT_JSON?resolve(process.env.OUTPUT_JSON):null;
const shares=(process.env.DIAG_LF_SHARES||'0.5,0.6,0.7,0.8,0.9,1').split(',').map(Number).filter(x=>Number.isFinite(x)&&x>0&&x<=1);
const F=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const M=a=>a.length?a.reduce((s,v)=>s+F(v),0)/a.length:0;

function makeWorld(seed){
  const w=new EconomicWorld(seed,{scaleProfile:'baseline',healthCheckInterval:0});
  for(const c of w.countries)Object.defineProperty(c,'__diagnosticExactLaborRuntime',{value:true,writable:true,configurable:true,enumerable:false});
  return w;
}

function structuralFields(country){
  const hs=country.households;
  const hasAny=(keys)=>hs.some(h=>keys.some(k=>Object.prototype.hasOwnProperty.call(h,k)));
  return {
    hasAgeField:hasAny(['age','ageYears','birthYear','birthMonth']),
    hasLifeState:hasAny(['alive','deceased','deathMonth']),
    hasRetirementState:hasAny(['retired','retirementAge','student','child']),
    hasLaborForceState:hasAny(['laborForceEligible','laborForceStatus','participating','participation']),
  };
}

function snapshotCountry(c){
  const population=c.households.length;
  const employed=c.households.filter(h=>h.employed).length;
  const currentUnemployment=1-employed/Math.max(1,population);
  const shadow={};
  for(const p of shares){
    const laborForce=Math.max(employed,Math.round(population*p));
    shadow[String(p)]=1-employed/Math.max(1,laborForce);
  }
  return {population,employed,currentUnemployment,macroUnemployment:F(c.macro?.unemployment),shadow};
}

function runOne(seed){
  const w=makeWorld(seed);
  const initialIds=new Map(w.countries.map(c=>[c.id,c.households.map(h=>h.id).sort()]));
  const fields=Object.fromEntries(w.countries.map(c=>[c.id,structuralFields(c)]));
  const monthly=[];
  for(let i=0;i<months;i++){
    w.stepMonth();
    monthly.push({month:w.month,countries:w.countries.map(c=>({countryId:c.id,...snapshotCountry(c)}))});
  }
  const health=w.forceHealthCheck();
  assert.ok(health.ok,`${seed}: health`);
  const populationStatic=w.countries.every(c=>{
    const ids=c.households.map(h=>h.id).sort();
    const base=initialIds.get(c.id)||[];
    return ids.length===base.length&&ids.every((id,i)=>id===base[i]);
  });
  const unemploymentFormulaMatches=monthly.every(m=>m.countries.every(c=>Math.abs(c.currentUnemployment-c.macroUnemployment)<1e-9));
  const noDemographicFields=Object.values(fields).every(x=>!x.hasAgeField&&!x.hasLifeState&&!x.hasRetirementState&&!x.hasLaborForceState);
  assert.ok(populationStatic,`${seed}: household population changed`);
  assert.ok(unemploymentFormulaMatches,`${seed}: unemployment denominator mismatch`);
  assert.ok(noDemographicFields,`${seed}: unexpected demographic fields present; inspect model before interpretation`);
  const flat=monthly.flatMap(m=>m.countries.map(c=>({...c,month:m.month})));
  const shadowMean={};
  for(const p of shares)shadowMean[String(p)]=M(flat.map(x=>x.shadow[String(p)]));
  return {
    seed,months,health,populationStatic,unemploymentFormulaMatches,noDemographicFields,fields,
    initialHouseholds:w.countries.reduce((s,c)=>s+(initialIds.get(c.id)?.length||0),0),
    finalHouseholds:w.countries.reduce((s,c)=>s+c.households.length,0),
    meanCurrentUnemployment:M(flat.map(x=>x.currentUnemployment)),
    terminalCurrentUnemployment:M(monthly.slice(-6).flatMap(m=>m.countries.map(c=>c.currentUnemployment))),
    shadowMeanUnemployment:shadowMean,
    terminalEmploymentShare:M(monthly.slice(-6).flatMap(m=>m.countries.map(c=>c.employed/Math.max(1,c.population))))
  };
}

const runs=seeds.map(runOne);
const report={
  workPackage:'WP-RV08-R4-AQ',
  title:'Demographic / Labor-Force Semantics and Population Invariance Audit',
  note:'Diagnostic-only. Shadow labor-force shares are denominator sensitivity calculations, not demographic calibration and do not alter simulation state.',
  generatedAt:new Date().toISOString(),
  configuration:{seeds,months,laborForceShareSensitivity:shares},
  gates:{allHealthy:runs.every(r=>r.health.ok),populationStatic:runs.every(r=>r.populationStatic),unemploymentFormulaMatches:runs.every(r=>r.unemploymentFormulaMatches),noDemographicFields:runs.every(r=>r.noDemographicFields),completeCoverage:runs.length===seeds.length,ok:true},
  compact:runs.map(r=>({seed:r.seed,months:r.months,initialHouseholds:r.initialHouseholds,finalHouseholds:r.finalHouseholds,meanCurrentUnemployment:r.meanCurrentUnemployment,terminalCurrentUnemployment:r.terminalCurrentUnemployment,terminalEmploymentShare:r.terminalEmploymentShare,shadowMeanUnemployment:r.shadowMeanUnemployment})),
  runs
};
if(outputJson){mkdirSync(dirname(outputJson),{recursive:true});writeFileSync(outputJson,JSON.stringify(report,null,2));}
console.log(JSON.stringify({workPackage:report.workPackage,gates:report.gates,compact:report.compact},null,2));
