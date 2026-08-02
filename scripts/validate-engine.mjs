import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const loaderPath = join(root, 'src', 'main.js')
const indexPath = join(root, 'index.html')
const loader = await readFile(loaderPath, 'utf8')
const html = await readFile(indexPath, 'utf8')

const sourceMatches = [...loader.matchAll(/['"]\.\/([^'"]+\.js\.txt)['"]/g)]
const sourceNames = sourceMatches.map((match) => match[1])
if (sourceNames.length === 0) throw new Error('No engine source parts are declared in src/main.js')
if (new Set(sourceNames).size !== sourceNames.length) throw new Error('Duplicate engine source part in src/main.js')

const requiredOrder = [
  'v10-shader-patch.js.txt',
  'main.part1.js.txt',
  'v09-terrain-system.js.txt',
  'v11-terrain-hydrology.js.txt',
  'v11-urban-morphology.js.txt',
  'v11-render-pipeline.js.txt',
  'v11-ui-layer.js.txt',
  'v2-world-system.js.txt',
  'v2-society-engine.js.txt',
  'v2-render-bridge.js.txt',
  'v2-ui-controller.js.txt',
]
let previousIndex = -1
for (const name of requiredOrder) {
  const index = sourceNames.indexOf(name)
  if (index < 0) throw new Error(`Required engine layer is missing: ${name}`)
  if (index <= previousIndex) throw new Error(`Engine layer order is invalid at ${name}`)
  previousIndex = index
}

const parts = []
for (const name of sourceNames) {
  const path = join(root, 'src', name)
  try {
    parts.push(await readFile(path, 'utf8'))
  } catch {
    throw new Error(`Missing engine source part: src/${name}`)
  }
}

const temporary = await mkdtemp(join(tmpdir(), 'procedural-city-'))
try {
  const combinedPath = join(temporary, 'combined-engine.mjs')
  await writeFile(combinedPath, parts.join(''), 'utf8')

  const targets = [
    loaderPath,
    combinedPath,
    join(root, 'src', 'living-city.js'),
    join(root, 'src', 'simulation.js'),
    join(root, 'src', 'ui-v5.js'),
  ]

  for (const target of targets) {
    const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' })
    if (result.status !== 0) {
      throw new Error(`JavaScript syntax check failed: ${target}\n${result.stderr || result.stdout}`)
    }
  }

  const ids = new Set([...html.matchAll(/\sid=['"]([^'"]+)['"]/g)].map((match) => match[1]))
  const queriedIds = new Set()
  for (const source of [loader, ...parts]) {
    for (const match of source.matchAll(/querySelector\(\s*['"]#([^'"]+)['"]\s*\)/g)) queriedIds.add(match[1])
  }
  const missingIds = [...queriedIds].filter((id) => !ids.has(id))
  if (missingIds.length) throw new Error(`Missing DOM IDs referenced by engine: ${missingIds.join(', ')}`)

  const required = ['city-canvas', 'loading', 'seed', 'generate', 'time-of-day', 'v2-run', 'v2-step', 'v2-society-hud']
  const absentRequired = required.filter((id) => !ids.has(id))
  if (absentRequired.length) throw new Error(`Required DOM IDs are absent: ${absentRequired.join(', ')}`)

  const combined = parts.join('')
  const invariants = [
    ['priority-flood-d8', 'drainage conditioning'],
    ['contourAlignedStreetTensor', 'terrain-aligned street morphology'],
    ['streetFrontingParcels', 'street-fronting parcel generation'],
    ['v1.1-reality-engine', 'v1.1 runtime marker'],
    ['2.0.0-living-world-alpha', 'v2 world runtime marker'],
    ['population-stock-flow', 'population accounting invariant'],
    ['frontageRoadId', 'growth-to-road dependency'],
  ]
  for (const [token, label] of invariants) {
    if (!combined.includes(token)) throw new Error(`Missing ${label} invariant: ${token}`)
  }

  console.log(`Validated ${sourceNames.length} engine layers and ${targets.length} JavaScript modules.`)
  console.log(`Combined engine size: ${parts.join('').length.toLocaleString()} characters.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
