import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

const root = resolve(new URL('..', import.meta.url).pathname)
const files = [
  'src/v09-terrain-system.js.txt',
  'src/v11-terrain-hydrology.js.txt',
  'src/v11-urban-morphology.js.txt',
  'src/v11-render-pipeline.js.txt',
]
const sources = await Promise.all(files.map((path) => readFile(resolve(root, path), 'utf8')))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const context = vm.createContext({
  window: {},
  console,
  performance,
  generateCity: () => ({ runtimeMode: 'fallback' }),
})

const geometrySource = `
function hashString(value) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) } return hash >>> 0 }
function pushVertex(target, position, normal, color) { target.push(...position, ...normal, ...color) }
function pushTriangle(target, a, b, c, normal, color) { pushVertex(target, a, normal, color); pushVertex(target, b, normal, color); pushVertex(target, c, normal, color) }
function pushQuad(target, a, b, c, d, normal, color) { pushTriangle(target, a, b, c, normal, color); pushTriangle(target, a, c, d, normal, color) }
function calculateNormal(a, b, c) { const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2]; let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx; const length=Math.hypot(nx,ny,nz)||1; nx/=length;ny/=length;nz/=length; return ny<0?[-nx,-ny,-nz]:[nx,ny,nz] }
function pushBox(target,x,y,z,width,height,depth,color,rotation=0,roofColor=null){const hw=width/2,hd=depth/2,cos=Math.cos(rotation),sin=Math.sin(rotation);const t=(lx,ly,lz)=>[x+lx*cos-lz*sin,y+ly,z+lx*sin+lz*cos];const n=(nx,ny,nz)=>[nx*cos-nz*sin,ny,nx*sin+nz*cos];const a=t(-hw,0,-hd),b=t(hw,0,-hd),c=t(hw,height,-hd),d=t(-hw,height,-hd),e=t(-hw,0,hd),f=t(hw,0,hd),g=t(hw,height,hd),h=t(-hw,height,hd);pushQuad(target,a,b,c,d,n(0,0,-1),color);pushQuad(target,f,e,h,g,n(0,0,1),color);pushQuad(target,e,a,d,h,n(-1,0,0),color);pushQuad(target,b,f,g,c,n(1,0,0),color);pushQuad(target,d,c,g,h,[0,1,0],roofColor||color)}
function pushGableRoof(target,x,y,z,width,depth,roofHeight,color,rotation=0){const hw=width/2,hd=depth/2,cos=Math.cos(rotation),sin=Math.sin(rotation);const t=(lx,ly,lz)=>[x+lx*cos-lz*sin,y+ly,z+lx*sin+lz*cos];const a=t(-hw,0,-hd),b=t(hw,0,-hd),c=t(hw,0,hd),d=t(-hw,0,hd),e=t(0,roofHeight,-hd),f=t(0,roofHeight,hd);pushTriangle(target,a,b,e,calculateNormal(a,b,e),color);pushTriangle(target,c,d,f,calculateNormal(c,d,f),color);pushQuad(target,a,e,f,d,calculateNormal(a,e,f),color);pushQuad(target,b,c,f,e,calculateNormal(b,c,f),color)}
`

vm.runInContext(geometrySource, context, { filename: 'geometry-test-runtime.js' })

for (let index = 0; index < sources.length; index += 1) vm.runInContext(sources[index], context, { filename: files[index] })

const city = vm.runInContext(`generateCity({
  seed: 'seoul-2040',
  profile: 'waterfront',
  gridSize: 30,
  density: 0.68,
  roughness: 14,
  blockSize: 5
})`, context)

assert(city.runtimeMode === 'v1.1-reality-engine', `unexpected runtime: ${city.runtimeMode}`)
assert(city.schemaVersion === 6, 'schema v6 was not produced')
assert(ArrayBuffer.isView(city.vertices) && city.vertices.BYTES_PER_ELEMENT === 4, 'render output is not a Float32Array')
assert(city.vertices.length > 100_000, `render output is unexpectedly sparse: ${city.vertices.length}`)
assert(city.vertices.length % 9 === 0, 'vertex stride is invalid')
assert([...city.vertices].every(Number.isFinite), 'render buffer contains non-finite values')
assert(city.buildings.length >= 20, 'rendered building set is too small')
assert(city.roads.length >= 30, 'rendered road-segment set is too small')
assert(city.realism?.drainageConditionedTerrain === true, 'reality flags are missing')
assert(city.metrics.population > 0 && city.metrics.jobs > 0, 'population or jobs were not derived')
assert(city.metrics.transitAccess >= 0 && city.metrics.transitAccess <= 1, 'transit accessibility is outside [0, 1]')

console.log('v1.1 render-pipeline test passed.')
console.log(JSON.stringify({
  runtimeMode: city.runtimeMode,
  vertices: city.vertices.length / 9,
  buildings: city.buildings.length,
  roadSegments: city.roads.length,
  roadLengthKm: Number(city.metrics.roadLengthKm.toFixed(2)),
  population: city.metrics.population,
  jobs: city.metrics.jobs,
  greenRatio: Number(city.metrics.greenRatio.toFixed(3)),
  transitAccess: Number(city.metrics.transitAccess.toFixed(3)),
  generationMs: Math.round(city.metrics.generationMs),
}, null, 2))
