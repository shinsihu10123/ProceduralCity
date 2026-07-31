import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(new URL('..', import.meta.url).pathname)
const loaderPath = join(root, 'src', 'main.js')
const indexPath = join(root, 'index.html')
const loader = await readFile(loaderPath, 'utf8')
const html = await readFile(indexPath, 'utf8')

const partMatches = [...loader.matchAll(/['"]\.\/(main\.part[^'"]+\.js\.txt)['"]/g)]
const partNames = partMatches.map((match) => match[1])
if (partNames.length === 0) throw new Error('No engine source parts are declared in src/main.js')
if (new Set(partNames).size !== partNames.length) throw new Error('Duplicate engine source part in src/main.js')

const parts = []
for (const name of partNames) {
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

  const required = ['city-canvas', 'loading', 'seed', 'generate', 'time-of-day']
  const absentRequired = required.filter((id) => !ids.has(id))
  if (absentRequired.length) throw new Error(`Required DOM IDs are absent: ${absentRequired.join(', ')}`)

  console.log(`Validated ${partNames.length} engine parts and ${targets.length} JavaScript modules.`)
  console.log(`Combined engine size: ${parts.join('').length.toLocaleString()} characters.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
