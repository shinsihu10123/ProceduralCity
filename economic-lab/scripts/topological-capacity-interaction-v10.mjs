import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const sourcePath=resolve(here,'topological-supply-sequencing-ablation-v10.mjs');
let source=readFileSync(sourcePath,'utf8');

const corrections=[
 ["const firmOutput = sum((country.firms || []).filter(f => f.active !== false).map(f => Math.max(0, finite(f.output))));","const firmOutput = sum((country.firms || []).map(f => Math.max(0, finite(f.output))));"],
 ["const productionBoundErrors = (country.firms || []).filter(f => f.active !== false).map(f => {","const productionBoundErrors = (country.firms || []).map(f => {"],
 ["const bound = Math.max(0, Math.min(finite(f.desiredProduction), finite(f.capacity)));","const bound = Math.max(0, finite(f.capacity));"]
];
for(const[from,to]of corrections){assert.equal(source.includes(from),true,`P44 correction anchor missing: ${from}`);source=source.replace(from,to);}

const oldVariants=`const VARIANTS = Object.freeze([\n  Object.freeze({ id: 'unit-basis-control', staged: false }),\n  Object.freeze({ id: 'unit-basis-topological-same-month-supply', staged: true })\n]);`;
const newVariants=`const VARIANTS = Object.freeze([\n  Object.freeze({ id: 'unit-basis-control', staged: false, capacity: false }),\n  Object.freeze({ id: 'unit-basis-topological-same-month-supply', staged: true, capacity: false }),\n  Object.freeze({ id: 'unit-basis-noncapital-capacity', staged: false, capacity: true }),\n  Object.freeze({ id: 'unit-basis-topological-plus-capacity', staged: true, capacity: true })\n]);`;
assert.equal(source.includes(oldVariants),true,'P44 variant anchor missing');source=source.replace(oldVariants,newVariants);

const capacityCode=`
function installBreakEvenCapacityAblation(world) {
  world.__rv07P44CapacityApplications = 0;
  const originalPlan = world.supply.planProduction.bind(world.supply);
  const clampLocal = (x, lo, hi) => Math.max(lo, Math.min(hi, finite(x)));
  const supplierMeanPrice = (country, product) => {
    const sellers = activeFirms(country).filter(f => f.product === product && finite(f.price) > EPS);
    return sellers.length ? mean(sellers.map(f => f.price)) : 0;
  };
  const unconstrainedPlan = f => {
    const anchor = Math.max(2, finite(f.previousSales), finite(f.targetInventory) * 0.42);
    const expected = anchor * (1 + clampLocal(f.beliefs?.demandGrowth || 0, -0.18, 0.22));
    return Math.max(0, expected * 0.72 + Math.max(0, finite(f.targetInventory) - finite(f.inventory)));
  };
  world.supply.planProduction = country => {
    const out = originalPlan(country);
    const upstream = { raw_material: supplierMeanPrice(country, 'raw_material'), processed_material: supplierMeanPrice(country, 'processed_material') };
    for (const f of activeFirms(country).filter(x => ['RESOURCE','MATERIALS','CONSUMER'].includes(x.industryId))) {
      const inputCost = finite(f.inputPerOutput) * (f.inputProduct ? finite(upstream[f.inputProduct]) : 0);
      const margin = finite(f.price) - inputCost;
      const breakEven = margin > EPS ? finite(f.wage) * finite(f.workers) / margin : Infinity;
      if (Number.isFinite(breakEven) && breakEven > finite(f.capacity) + 1e-7) {
        f.capacity = breakEven;
        f.desiredProduction = Math.max(0, Math.min(f.capacity * 1.08, unconstrainedPlan(f)));
        world.__rv07P44CapacityApplications += 1;
      }
    }
    return out;
  };
}

`;
const gdpAnchor='function gdpResidual(macro) {';assert.equal(source.includes(gdpAnchor),true,'P44 insertion anchor missing');source=source.replace(gdpAnchor,capacityCode+gdpAnchor);

const oldInstall=`  if (variant.staged) installTopologicalSupplyAblation(world);\n  else world.__rv07P8Stage = new Map();`;
const newInstall=`  if (variant.capacity) installBreakEvenCapacityAblation(world);\n  if (variant.staged) installTopologicalSupplyAblation(world);\n  else world.__rv07P8Stage = new Map();`;
assert.equal(source.includes(oldInstall),true,'P44 run anchor missing');source=source.replace(oldInstall,newInstall);

const start=source.indexOf('const comparisons = {};');const end=source.indexOf('const maxShortageError',start);assert.ok(start>=0&&end>start,'P44 comparison block anchors missing');
const generalized=`const comparisons = {};\nfor (const scaleProfile of scales) {\n  comparisons[scaleProfile] = {};\n  for (const variant of VARIANTS.filter(v => v.id !== 'unit-basis-control')) {\n    comparisons[scaleProfile][variant.id] = {};\n    for (const window of windows) {\n      const control = summary.find(x => x.variant === 'unit-basis-control' && x.scaleProfile === scaleProfile && x.window === window.id);\n      const candidate = summary.find(x => x.variant === variant.id && x.scaleProfile === scaleProfile && x.window === window.id);\n      comparisons[scaleProfile][variant.id][window.id] = {\n        unemploymentDifference: candidate.meanUnemployment - control.meanUnemployment,\n        firmExitDifference: candidate.totalFirmExits - control.totalFirmExits,\n        wageArrearsDifference: candidate.meanWageArrears - control.meanWageArrears,\n        goodsFulfillmentDifference: candidate.meanGoodsFulfillmentRate - control.meanGoodsFulfillmentRate,\n        inputShortageDifference: candidate.meanInputShortageUnits - control.meanInputShortageUnits,\n        inputShortageRatio: ratio(candidate.meanInputShortageUnits, control.meanInputShortageUnits),\n        resourceOutputRatio: ratio(candidate.meanResourceOutput, control.meanResourceOutput),\n        materialsOutputRatio: ratio(candidate.meanMaterialsOutput, control.meanMaterialsOutput),\n        consumerOutputRatio: ratio(candidate.meanConsumerOutput, control.meanConsumerOutput),\n        gdpDifference: candidate.meanGdp - control.meanGdp\n      };\n    }\n  }\n}\n\n`;
source=source.slice(0,start)+generalized+source.slice(end);
source=source.replaceAll('WP-RV07-P8','WP-RV07-P44').replaceAll('WP_RV07_P8','WP_RV07_P44').replaceAll('__rv07P8','__rv07P44');
source=source.replace("description: 'Diagnostic-only topological same-month supply sequencing ablation on the unit-basis candidate.'","description: 'Diagnostic-only topological same-month supply x break-even capacity interaction.'");

const temp=resolve(here,`.rv07p44-runtime-${process.pid}.mjs`);writeFileSync(temp,source,'utf8');try{await import(`${pathToFileURL(temp).href}?run=${Date.now()}`);}finally{try{unlinkSync(temp)}catch{}}
