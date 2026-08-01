import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

const root = resolve(new URL('..', import.meta.url).pathname)
const sources = await Promise.all([
  'src/v09-terrain-system.js.txt',
  'src/v11-terrain-hydrology.js.txt',
  'src/v11-urban-morphology.js.txt',
].map((path) => readFile(resolve(root, path), 'utf8')))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function createRuntime() {
  const context = vm.createContext({ window: {}, console })
  for (const [index, source] of sources.entries()) vm.runInContext(source, context, { filename: `engine-layer-${index}.js` })
  return context.window
}

function generate(seed = 183746) {
  const runtime = createRuntime()
  const terrain = runtime.ProceduralTerrainSystemV09.create({
    seed,
    size: 82,
    worldSize: 980,
    relief: 62,
    erosionIterations: 8,
    seaLevel: -6,
  })
  runtime.ProceduralTerrainSystemV11.augment(terrain)
  const urban = runtime.ProceduralUrbanSystemV11.create(terrain, {
    seed: `test-${seed}`,
    profile: 'waterfront',
    density: 0.68,
    gridSize: 30,
  })
  return { terrain, urban }
}

const first = generate()
const second = generate()
const { terrain, urban } = first

assert(terrain.version === '1.1.0-hydrology-core', 'v1.1 hydrology did not activate')
assert(terrain.hydrology?.depressionConditioned === true, 'terrain is not drainage-conditioned')
assert(terrain.fields.floodRisk.length === terrain.size * terrain.size, 'flood-risk field size mismatch')
assert([...terrain.fields.floodRisk].every(Number.isFinite), 'flood-risk field contains non-finite values')
assert(Math.max(...terrain.fields.accumulation) > 20, 'drainage accumulation did not form a network')
assert([...terrain.fields.downstream].every((index) => index >= 0 && index < terrain.size * terrain.size), 'invalid downstream index')

assert(urban.version === '1.1.0-urban-morphology', 'v1.1 urban morphology did not activate')
assert(urban.centers.length >= 4, 'too few urban centers')
assert(urban.roads.filter((road) => road.class === 'arterial').length >= 3, 'arterial hierarchy is missing')
assert(urban.roads.some((road) => road.class === 'collector'), 'collector hierarchy is missing')
assert(urban.roads.some((road) => road.class === 'local'), 'local street fabric is missing')
assert(urban.parcels.length >= 35, `too few street-fronting parcels: ${urban.parcels.length}`)
assert(urban.buildings.length >= 20, `too few buildings: ${urban.buildings.length}`)
assert(urban.transit.stations.length >= 2, 'transit catchment model is missing')

const roadIds = new Set(urban.roads.map((road) => road.id))
for (const parcel of urban.parcels) {
  assert(roadIds.has(parcel.roadId), `parcel ${parcel.id} has no valid street frontage`)
  assert(terrain.waterAt(parcel.x, parcel.z) < 0.31, `parcel ${parcel.id} intersects water`)
  assert(parcel.slope <= 17.6, `parcel ${parcel.id} exceeds buildable slope`)
  assert(Array.isArray(parcel.polygon) && parcel.polygon.length >= 4, `parcel ${parcel.id} has no polygon`)
}

assert(urban.centers.length === second.urban.centers.length, 'seeded center count is not deterministic')
assert(urban.roads.length === second.urban.roads.length, 'seeded road count is not deterministic')
assert(urban.parcels.length === second.urban.parcels.length, 'seeded parcel count is not deterministic')
assert(urban.centers[0].x === second.urban.centers[0].x && urban.centers[0].z === second.urban.centers[0].z, 'seeded center placement is not deterministic')

console.log('v1.1 core tests passed.')
console.log(JSON.stringify({
  terrainCells: terrain.size * terrain.size,
  centers: urban.centers.length,
  roads: urban.roads.length,
  parcels: urban.parcels.length,
  buildings: urban.buildings.length,
  parks: urban.greenSpaces.length,
  stations: urban.transit.stations.length,
  floodExposure: Number(urban.diagnostics.floodExposure.toFixed(3)),
}, null, 2))
