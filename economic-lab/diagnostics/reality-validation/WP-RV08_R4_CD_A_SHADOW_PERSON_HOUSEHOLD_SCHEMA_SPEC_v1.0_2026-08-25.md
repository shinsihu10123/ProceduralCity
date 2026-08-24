# WP-RV08 R4-CD-A — Shadow Person / Household Schema Specification v1.0 — 2026-08-25

## Status

**SPECIFICATION PASS / SHADOW-ONLY IMPLEMENTATION ELIGIBLE / CANONICAL LABOR BEHAVIOR STILL LOCKED**

R4-CD-A converts the person/household half of the R4-CD ontology gate into an implementation contract for Stage M1. It does not authorize changing hiring, wage settlement, unemployment calculation, household consumption, accounting, or any current canonical macro outcome.

The first implementation must be an observational shadow layer that can coexist with the current household-as-worker runtime while proving that person-level labor semantics can be represented without perturbing the existing simulation.

## 1. Scope

R4-CD-A defines:

- `ShadowPerson` schema;
- shadow household membership projection;
- demographic/labor-force profile inputs;
- deterministic initialization rules;
- derived labor-force diagnostics;
- serialization and observer boundaries;
- exact-replay non-interference gates;
- migration compatibility with `world-v10`.

Out of scope for M1:

- replacing `household.employed`;
- person-level hiring or firing;
- person-level wage settlement;
- person-level consumption;
- endogenous fertility, mortality or migration;
- endogenous education/retirement decisions;
- changing household accounts or balance sheets;
- recalibrating population scale.

## 2. Architectural placement

Recommended implementation location:

`economic-lab/src/research/shadow-person-household.js`

The shadow layer is research infrastructure, not yet a production economic subsystem.

`world-v10` may expose it only behind an explicit option, for example:

`new EconomicWorld(seed, { enableShadowPersonLayer: true, shadowDemographyProfile })`

The default production path must remain behaviorally identical to the pre-M1 runtime until a later gate explicitly authorizes otherwise.

## 3. ShadowPerson schema

Minimum immutable identity fields:

- `id`
- `householdId`
- `countryId`

Minimum demographic fields:

- `ageMonths`
- `alive`
- `workingAge`

Minimum labor-force fields:

- `laborForceStatus`
- `employmentStatus`
- `employerId`
- `hoursAvailable`
- `hoursWorked`
- `wageRate`
- `laborIncome`
- `effectiveSkillFactor`

Optional M1 metadata:

- `profileBucket`
- `projectionSource`
- `compatibilityHouseholdIndex`

Allowed `laborForceStatus` values:

- `outside`
- `participating`

Allowed `employmentStatus` values:

- `not_applicable`
- `employed_shadow`
- `unemployed_shadow`

M1 shadow employment is a projection only. It must never write back into the canonical household or firm objects.

## 4. Shadow household membership representation

The existing canonical household object remains the balance-sheet and consumption unit.

M1 may attach or expose a shadow membership view containing:

- `householdId`
- `memberIds[]`
- `memberCount`
- `workingAgeCount`
- `laborForceCount`
- `employedShadowCount`
- `unemployedShadowCount`
- `availableLaborHours`
- `workedLaborHours`
- `dependencyRatio`

The shadow membership view must not duplicate or mutate canonical household cash, wealth, loan, wage, income, consumption, employment or employer fields.

## 5. Configuration contract

No empirical demographic constant may be silently embedded in source code.

`shadowDemographyProfile` must be an explicit inspectable object. At minimum it must support:

- `id`
- `householdSizeDistribution`
- `ageDistribution` or age-bucket distribution
- `workingAgeMinMonths`
- `workingAgeMaxMonths`
- `participationByAgeBucket` or a documented participation rule
- `standardMonthlyHours`
- optional `skillFactorByBucket`

Example shape only, not an empirical default:

```js
{
  id: 'diagnostic-fixture',
  householdSizeDistribution: [
    { size: 1, share: 0.25 },
    { size: 2, share: 0.30 },
    { size: 3, share: 0.25 },
    { size: 4, share: 0.20 }
  ],
  ageDistribution: [
    { id: 'child', minMonths: 0, maxMonths: 17 * 12, share: 0.20 },
    { id: 'working', minMonths: 18 * 12, maxMonths: 64 * 12, share: 0.60 },
    { id: 'older', minMonths: 65 * 12, maxMonths: 100 * 12, share: 0.20 }
  ],
  workingAgeMinMonths: 18 * 12,
  workingAgeMaxMonths: 64 * 12,
  participationByAgeBucket: { working: 0.70 },
  standardMonthlyHours: 160
}
```

The values above are illustrative fixtures only and must never be promoted to calibration targets without provenance.

## 6. Deterministic projection requirement

M1 must not consume `world.rng` or any subsystem RNG.

Person generation must be deterministic from stable inputs such as:

- seed text;
- country id;
- household id/index;
- profile id;
- deterministic hash/ordering.

This requirement prevents shadow initialization from shifting the RNG stream and thereby altering canonical economic outcomes.

For a fixed world seed and profile:

- person count must be exact-repeat stable;
- household composition must be exact-repeat stable;
- age buckets must be exact-repeat stable;
- participation assignment must be exact-repeat stable.

## 7. Compatibility projection of current employment

M1 needs a bridge from the current household employment state to a person-level shadow view without changing canonical behavior.

Required compatibility rule:

1. build persons and household memberships;
2. identify labor-force-eligible persons in each household;
3. if canonical `household.employed === true`, assign at most one eligible shadow person as `employed_shadow` and preserve `household.employerId` only as a read-only shadow projection;
4. remaining participating persons are `unemployed_shadow`;
5. persons outside labor force are `not_applicable`;
6. if no eligible participating person exists for a canonically employed household, record a **compatibility contradiction** instead of altering either side.

This bridge intentionally reveals ontology contradictions rather than hiding them.

## 8. Hours and labor units

For each shadow person:

`availableLaborUnits = hoursAvailable / standardMonthlyHours × effectiveSkillFactor`

`workedLaborUnits = hoursWorked / standardMonthlyHours × effectiveSkillFactor`

M1 may project an employed canonical household to a configurable full-time-equivalent number of hours, but that value must come from the explicit profile.

No shadow labor-unit value may influence production or payroll in M1.

## 9. Derived diagnostics

Country-level shadow diagnostics must include:

- `persons`
- `households`
- `personsPerHousehold`
- `workingAgePersons`
- `workingAgeShare`
- `laborForcePersons`
- `laborForceParticipationRate`
- `shadowEmployedPersons`
- `shadowUnemployedPersons`
- `shadowUnemploymentRate`
- `availableLaborHours`
- `workedLaborHours`
- `availableLaborUnits`
- `workedLaborUnits`
- `canonicalEmployedHouseholds`
- `compatibilityContradictions`

Required identity:

`shadowUnemploymentRate = shadowUnemployedPersons / laborForcePersons`

when `laborForcePersons > 0`.

Required separation:

`persons !== households` is supported by schema even if a diagnostic fixture happens to generate one person per household.

## 10. Non-interference storage rule

The shadow layer must not be inserted into canonical enumerable country/household structures in a way that changes existing state digests, persistence payloads or accounting scans.

Preferred M1 storage approaches:

- a `WeakMap` owned by a `ShadowPersonHouseholdSystem`; or
- a non-enumerable property on the world/country object.

If `snapshot()` exposes shadow diagnostics, it must do so only when the shadow option is explicitly enabled and must not feed back into simulation logic.

## 11. No-write boundary

The M1 shadow subsystem is prohibited from writing to:

- `household.employed`
- `household.employerId`
- `household.wage`
- `household.income`
- `household.wealth`
- household account balances
- `firm.workers`
- `firm.desiredWorkers`
- `firm.wage`
- `firm.output`
- `firm.capacity`
- any ledger entry
- any GL entry
- any banking decision
- any fiscal decision
- any cognition decision state

The system may only read these values to construct diagnostics.

## 12. Exact-replay gate

M1 implementation must include a test or diagnostic runner that compares:

- control: shadow disabled;
- treatment: shadow enabled with a fixed diagnostic profile.

For identical seed and horizon, the following canonical quantities must be exact or cryptographically identical:

- month;
- RNG state;
- serialized canonical country state excluding explicitly shadow-only payload;
- ledger entries;
- accounting reports;
- macro histories;
- firm exits/entries;
- credit events;
- experiment events.

A convenient gate is a SHA-256 digest of the pre-existing canonical state surface.

Required verdict:

`canonicalStateDigest(control) === canonicalStateDigest(shadow)`

for at least original A, original C, heldout E and heldout F over a short replay horizon before any larger diagnostic run is authorized.

## 13. Schema validity gates

All must pass:

1. every shadow person belongs to exactly one household;
2. every `memberId` resolves to exactly one person;
3. no person belongs to multiple households;
4. person IDs are deterministic and unique;
5. age is finite and non-negative;
6. working-age status matches profile thresholds;
7. only working-age persons can participate unless a profile explicitly documents an exception;
8. employment implies participation;
9. worked hours do not exceed available hours by more than tolerance;
10. labor units are finite and non-negative;
11. household aggregates equal the sum of member records;
12. country aggregates equal the sum of household/person records.

## 14. Performance gate

M1 is observational infrastructure and must remain lightweight.

Required measurement:

- initialization wall time;
- memory/person count summary;
- monthly shadow-projection wall time if refreshed monthly.

No fixed production threshold is chosen here, but M1 closure must report the overhead separately from simulation step time.

## 15. Migration interface for later M3 switch

M1 should expose stable read APIs that later labor-market code can consume without reaching directly into internal maps:

- `persons(countryId)`
- `householdView(householdId)`
- `countrySummary(countryId)`
- `laborForce(countryId)`
- `availableLaborUnits(countryId)`
- `compatibilityReport(countryId)`

These methods are read-only in M1.

## 16. Acceptance verdict

R4-CD-A v1.0 is **SPECIFICATION PASS** when implemented exactly as a shadow subsystem with explicit profile inputs, deterministic allocation, strict no-write boundaries and exact replay verification.

It does not authorize person-level behavioral economics yet.

## Checkpoint

`R4-CD-A = SPEC PASS / M1 SHADOW PERSON-HOUSEHOLD IMPLEMENTATION AUTHORIZED SUBJECT TO R4-CD-B AND DESIGN-GATE CLOSURE`
