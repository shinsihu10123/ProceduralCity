import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

const root = resolve(new URL('..', import.meta.url).pathname)
const source = await readFile(resolve(root, 'src/v2-world-system.js.txt'), 'utf8')
const context = vm.createContext({ window: {}, console, performance })
vm.runInContext(source, context, { filename: 'v2-world-system.js.txt' })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function digest(world) {
  let height = 0
  let rivers = 0
  let countries = 0
  for (let index = 0; index < world.fields.elevation.length; index += 97) {
    height += Math.round(world.fields.elevation[index] * 10)
    rivers += Math.round(world.fields.river[index] * 1000)
    countries += world.countryId[index]
  }
  return `${height}:${rivers}:${countries}:${world.settlement.index}:${world.countries.map((country) => country.name).join('|')}`
}

const create = context.window.ProceduralWorldSystemV2.create
const first = create({ seed: 'seoul-2040', size: 96, spanKm: 2400 })
const repeat = create({ seed: 'seoul-2040', size: 96, spanKm: 2400 })

assert(first.version === '2.0.0-living-world-alpha', 'unexpected world runtime')
assert(first.size === 96 && first.spanKm === 2400, 'world scale contract failed')
assert(first.diagnostics.landRatio > 0.28 && first.diagnostics.landRatio < 0.68, `implausible land ratio: ${first.diagnostics.landRatio}`)
assert(first.countries.length >= 8 && first.countries.length <= 14, `country count outside design range: ${first.countries.length}`)
assert(first.trade.length >= first.countries.length, 'trade graph is too sparse')
assert(first.diagnostics.riverCells > 40, 'conditioned hydrology produced too few river cells')
assert(first.settlement.elevationM > 0 && first.settlement.countryId >= 0, 'settlement site is not valid land')
assert(first.settlement.suitability > 0.45, `settlement suitability is too low: ${first.settlement.suitability}`)
assert(first.countries.every((country) => country.cells > 0 && country.population > 0 && country.gdp > 0), 'country stock is invalid')
assert(first.trade.every((edge) => edge.a !== edge.b && edge.volume >= 0 && edge.tariff >= 0), 'trade edge is invalid')
assert(digest(first) === digest(repeat), 'world generation is not deterministic for an identical seed')

let checkedDrainage = 0
for (let index = 0; index < first.fields.hydrology.downstream.length; index += 1) {
  const next = first.fields.hydrology.downstream[index]
  if (next < 0 || first.fields.elevation[index] <= 0) continue
  assert(first.fields.hydrology.filled[next] <= first.fields.hydrology.filled[index] + 0.01, 'conditioned drainage climbs uphill')
  checkedDrainage += 1
}
assert(checkedDrainage > 1000, 'too few land drainage links were checked')

const alternate = create({ seed: 'delta-17', size: 96, spanKm: 2400 })
assert(digest(first) !== digest(alternate), 'different seeds produced the same world digest')

console.log('v2 world-system tests passed.')
console.log(JSON.stringify({
  spanKm: first.spanKm,
  cells: first.size * first.size,
  landRatio: Number(first.diagnostics.landRatio.toFixed(3)),
  plates: first.diagnostics.tectonicPlates,
  countries: first.countries.length,
  riverCells: first.diagnostics.riverCells,
  tradeLinks: first.trade.length,
  settlement: {
    country: first.settlement.countryName,
    biome: first.settlement.biome,
    elevationM: Math.round(first.settlement.elevationM),
    suitability: Number(first.settlement.suitability.toFixed(3)),
  },
}, null, 2))
