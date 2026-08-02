import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

const root = resolve(new URL('..', import.meta.url).pathname)
const sources = await Promise.all([
  'src/v2-world-system.js.txt',
  'src/v2-society-engine.js.txt',
].map((path) => readFile(resolve(root, path), 'utf8')))
const context = vm.createContext({ window: {}, console, performance })
for (const source of sources) vm.runInContext(source, context)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const world = context.window.ProceduralWorldSystemV2.create({ seed: 'seoul-2040' })
const engine = context.window.ProceduralSocietyEngineV2.create(world, { seed: 'seoul-2040', foundingYear: 2026 })
const initial = engine.getSnapshot()
const milestones = [initial]
for (let year = 10; year <= 100; year += 10) milestones.push(engine.simulate(120))
const final = engine.getSnapshot()

assert(initial.population >= 20 && initial.population <= 100, `simulation did not begin as a small settlement: ${initial.population}`)
assert(final.date.year === 100, `simulation clock drifted: ${final.date.year}`)
assert(final.population > initial.population, 'viable reference settlement did not grow at all')
assert(final.development.constructedBuildings > initial.development.constructedBuildings, 'endogenous construction did not occur')
assert(final.housing.units >= initial.housing.units, 'housing stock shrank without demolition model')
assert(final.firms >= 5, 'essential firm system collapsed')
assert(final.representativeHouseholds >= initial.representativeHouseholds, 'representative household resolution did not scale')
assert(final.economy.annualizedGdp > 0 && final.economy.gdpPerCapita > 0, 'economic accounts are empty')
assert(final.government.revenue >= 0 && Number.isFinite(final.government.cash) && Number.isFinite(final.government.debt), 'government accounts are invalid')
assert(Object.values(final.utilities).every((utility) => utility.capacity > 0 && utility.reliability >= 0 && utility.reliability <= 1), 'utility service bounds failed')
assert(final.environment.airQuality >= 0 && final.environment.airQuality <= 100, 'air quality is outside [0, 100]')
assert(engine.audit().length === 0, `stock-flow audit failed: ${engine.audit().join(', ')}`)
assert(milestones.every((snapshot, index) => index === 0 || snapshot.development.constructedBuildings >= milestones[index - 1].development.constructedBuildings), 'constructed building stock is not monotonic')
assert(engine.getHistory().length >= 100, 'annual history was not retained')
assert(['housing-start', 'housing-complete', 'public-project', 'project-complete'].some((type) => (final.diagnostics.eventCounts[type] || 0) > 0), 'development decisions did not emit evidence events')

const alternateWorld = context.window.ProceduralWorldSystemV2.create({ seed: 'mountain-valley' })
const alternate = context.window.ProceduralSocietyEngineV2.create(alternateWorld, { seed: 'mountain-valley' })
const alternateFinal = alternate.simulate(1200)
assert(alternateFinal.population !== final.population || alternateFinal.firms !== final.firms, 'different physical worlds produced identical social outcomes')
assert(alternate.audit().length === 0, `alternate stock-flow audit failed: ${alternate.audit().join(', ')}`)

console.log('v2 society-engine tests passed.')
console.log(JSON.stringify({
  initial: { population: initial.population, households: initial.households, firms: initial.firms, stage: initial.stage },
  year100: {
    population: final.population,
    households: final.households,
    firms: final.firms,
    jobs: final.labor.jobs,
    unemploymentRate: Number(final.labor.unemploymentRate.toFixed(3)),
    housingUnits: Math.round(final.housing.units),
    buildings: final.development.constructedBuildings,
    stage: final.stage,
    utilityReliability: Number(final.diagnostics.utilityReliability.toFixed(3)),
    approval: Number(final.government.approval.toFixed(3)),
  },
}, null, 2))
