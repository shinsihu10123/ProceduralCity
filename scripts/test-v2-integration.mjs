import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

const root = resolve(new URL('..', import.meta.url).pathname)
const files = [
  'src/v09-terrain-system.js.txt',
  'src/v11-terrain-hydrology.js.txt',
  'src/v11-urban-morphology.js.txt',
  'src/v11-render-pipeline.js.txt',
  'src/v2-world-system.js.txt',
  'src/v2-society-engine.js.txt',
  'src/v2-render-bridge.js.txt',
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
  camera: { target: [0, 0, 0], distance: 1000, pitch: 0.7, yaw: 0 },
  uploadCity: () => {},
  applyCameraPreset: () => {},
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail } },
})
context.window.dispatchEvent = () => {}

vm.runInContext(`
function hashString(value) { let hash=2166136261; for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)} return hash>>>0 }
function pushVertex(target,position,normal,color){target.push(...position,...normal,...color)}
function pushTriangle(target,a,b,c,normal,color){pushVertex(target,a,normal,color);pushVertex(target,b,normal,color);pushVertex(target,c,normal,color)}
function pushQuad(target,a,b,c,d,normal,color){pushTriangle(target,a,b,c,normal,color);pushTriangle(target,a,c,d,normal,color)}
function calculateNormal(a,b,c){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;return ny<0?[-nx,-ny,-nz]:[nx,ny,nz]}
function pushBox(target,x,y,z,width,height,depth,color,rotation=0,roofColor=null){const hw=width/2,hd=depth/2,cos=Math.cos(rotation),sin=Math.sin(rotation),t=(lx,ly,lz)=>[x+lx*cos-lz*sin,y+ly,z+lx*sin+lz*cos],n=(nx,ny,nz)=>[nx*cos-nz*sin,ny,nx*sin+nz*cos],a=t(-hw,0,-hd),b=t(hw,0,-hd),c=t(hw,height,-hd),d=t(-hw,height,-hd),e=t(-hw,0,hd),f=t(hw,0,hd),g=t(hw,height,hd),h=t(-hw,height,hd);pushQuad(target,a,b,c,d,n(0,0,-1),color);pushQuad(target,f,e,h,g,n(0,0,1),color);pushQuad(target,e,a,d,h,n(-1,0,0),color);pushQuad(target,b,f,g,c,n(1,0,0),color);pushQuad(target,d,c,g,h,[0,1,0],roofColor||color)}
function pushGableRoof(target,x,y,z,width,depth,roofHeight,color,rotation=0){const hw=width/2,hd=depth/2,cos=Math.cos(rotation),sin=Math.sin(rotation),t=(lx,ly,lz)=>[x+lx*cos-lz*sin,y+ly,z+lx*sin+lz*cos],a=t(-hw,0,-hd),b=t(hw,0,-hd),c=t(hw,0,hd),d=t(-hw,0,hd),e=t(0,roofHeight,-hd),f=t(0,roofHeight,hd);pushTriangle(target,a,b,e,calculateNormal(a,b,e),color);pushTriangle(target,c,d,f,calculateNormal(c,d,f),color);pushQuad(target,a,e,f,d,calculateNormal(a,e,f),color);pushQuad(target,b,c,f,e,calculateNormal(b,c,f),color)}
`, context)

for (let index = 0; index < sources.length; index += 1) vm.runInContext(sources[index], context, { filename: files[index] })

const city = vm.runInContext(`generateCity({seed:'seoul-2040',profile:'waterfront',gridSize:30,density:0.68,roughness:14,blockSize:5})`, context)
const world = context.window.ProceduralWorldSystemV2.create({ seed: 'seoul-2040' })
const society = context.window.ProceduralSocietyEngineV2.create(world, { seed: 'seoul-2040' })
const renderer = context.window.ProceduralCityV2Renderer
const worldGeometry = renderer.setWorld(world)
renderer.setCity(city)
const initial = renderer.composeSettlementGeometry(city, society.getSnapshot())
const year100Snapshot = society.simulate(1200)
const year100 = renderer.composeSettlementGeometry(city, year100Snapshot)

assert(ArrayBuffer.isView(city.renderLayers?.terrain) && city.renderLayers.terrain.BYTES_PER_ELEMENT === 4, 'v1.1 renderer did not expose terrain geometry')
assert(city.renderLayers.roads.length > 10 && city.renderLayers.buildings.length > 20, 'growth geometry chunks are missing')
assert(initial.activeBuildings.length >= 5 && initial.activeBuildings.length < city.renderLayers.buildings.length, 'initial settlement is not a partial build-out')
assert(year100.activeBuildings.length >= initial.activeBuildings.length, 'developed settlement lost constructed buildings')
assert(year100.activeRoads.length >= initial.activeRoads.length, 'developed settlement lost road corridors')
assert(initial.vertices.length < city.vertices.length, 'initial settlement renders the completed city')
assert(year100.vertices.length >= initial.vertices.length, 'growth visualization did not add geometry')
assert([...initial.vertices].every(Number.isFinite) && [...year100.vertices].every(Number.isFinite), 'settlement geometry contains non-finite values')
assert(worldGeometry.extent > 500 && worldGeometry.vertexCount > 50000, 'macro world geometry is too small')
assert([...worldGeometry.vertices].every(Number.isFinite), 'macro world geometry contains non-finite values')

console.log('v2 multi-scale integration tests passed.')
console.log(JSON.stringify({
  worldVertices: worldGeometry.vertexCount,
  worldExtent: Math.round(worldGeometry.extent),
  initial: { population: society.getHistory()[0].population, buildings: initial.activeBuildings.length, roads: initial.activeRoads.length, vertices: initial.vertices.length / 9 },
  year100: { population: year100Snapshot.population, buildings: year100.activeBuildings.length, roads: year100.activeRoads.length, vertices: year100.vertices.length / 9 },
  available: { buildings: city.renderLayers.buildings.length, roads: city.renderLayers.roads.length },
}, null, 2))
