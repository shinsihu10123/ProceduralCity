import assert from 'node:assert/strict';
import {
  REGION_HALF,
  ROAD_STANDARDS,
  createSpatialPlan,
  terrainHeight,
} from '../src/v3/spatial.js';

const plan = createSpatialPlan({ seed: 'new-horizon' });
const repeated = createSpatialPlan({ seed: 'new-horizon' });

assert.equal(plan.version, '3.0.0-clean-spatial-core');
assert.equal(plan.roads.length, 39);
assert.ok(plan.sites.length >= 300);
assert.equal(plan.diagnostics.bridges, 2);
assert.ok(plan.diagnostics.roadLengthKm > 12 && plan.diagnostics.roadLengthKm < 18);
assert.ok(plan.diagnostics.maximumSiteSlope < 14);
assert.deepEqual(plan.diagnostics, repeated.diagnostics, 'spatial generation must be deterministic');

const roadIds = new Set();
let bridgeRoads = 0;
let bridgePoints = 0;
for (const road of plan.roads) {
  assert.ok(!roadIds.has(road.id), `duplicate road id: ${road.id}`);
  roadIds.add(road.id);
  assert.ok(ROAD_STANDARDS[road.class], `unknown road class: ${road.class}`);
  assert.ok(road.points.length >= 3, `${road.id} has too few points`);
  assert.ok(Number.isFinite(road.length) && road.length > 25);
  let hasBridgePoint = false;
  for (const point of road.points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
    assert.ok(Math.abs(point.x) <= REGION_HALF + 1 && Math.abs(point.z) <= REGION_HALF + 1);
    const ground = terrainHeight(point.x, point.z, plan.seedValue);
    if (point.bridge) {
      hasBridgePoint = true;
      bridgePoints += 1;
    } else {
      assert.ok(point.y - ground >= 0.59, `${road.id} clips terrain`);
      assert.equal(plan.isWaterAt(point.x, point.z), false, `${road.id} enters water without a bridge`);
    }
  }
  if (hasBridgePoint) bridgeRoads += 1;
}
assert.equal(bridgeRoads, 2);
assert.ok(bridgePoints >= 6);

const siteIds = new Set();
for (const site of plan.sites) {
  assert.ok(!siteIds.has(site.id), `duplicate site id: ${site.id}`);
  siteIds.add(site.id);
  assert.ok(roadIds.has(site.roadId), `${site.id} has no frontage road`);
  assert.ok(site.lotWidth >= 8 && site.lotDepth >= 7 && site.lotArea > 100);
  assert.ok(site.slope < 14);
  assert.equal(plan.isWaterAt(site.x, site.z), false, `${site.id} is in water`);
  assert.ok(Number.isFinite(site.y) && Number.isFinite(site.suitability));
}

console.log(`v3 spatial: ${plan.roads.length} roads, ${plan.sites.length} sites, ${bridgeRoads} bridges`);
