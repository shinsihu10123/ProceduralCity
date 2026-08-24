# WP-RV08 R4-CD M2 Closure — Shadow Labor Demand + Establishment Feasibility — 2026-08-25

## Verdict

**PASS / FOUR-SEED 24-MONTH EXACT-REPLAY CONFIRMED / SHADOW LABOR-DEMAND DECOMPOSITION OPERATIONAL / MAJOR INPUT + CURRENT-CASH FEASIBILITY STRESS OBSERVED / M3 BEHAVIORAL SWITCH NOT YET AUTHORIZED**

R4-CD M2 is formally closed as a non-interfering diagnostic layer.

## Provenance

- repository: `shinsihu10123/ProceduralCity`
- branch: `scratch/new-project-2026-08-12`
- workflow head SHA: `ad0419e65813c377aea8cd25ab1d8ade6fb0a531`
- workflow run: `32757315102`
- implementation: `economic-lab/src/research/shadow-labor-demand.js`
- integration: `economic-lab/src/core/world-v10.js`
- diagnostic: `economic-lab/scripts/rv08-r4-cd-m2-shadow-labor-demand-exact-replay-v10.mjs`
- horizon: 24 months
- seeds: original A, original C, heldout E, heldout F
- matrix jobs: 4/4 success
- artifacts: 4/4 present and inspected

## Gate result

Every shard reports:

- `exactReplay = true`
- `canonicalSummaryExact = true`
- `personValidationOk = true`
- `laborValidationOk = true`
- `allHardGates = true`
- `diagnosticsObserved = true`
- `gates.ok = true`

The M1+M2 shadow systems therefore leave the tested canonical state unchanged over 24 months while continuously reading person, household and establishment feasibility state.

## M2 estimator contract

M2 intentionally does not invent a new production technology.

The physical labor estimator inverts the current canonical supply-chain capacity equation:

- capital effect from current `capitalStock`;
- human-capital effect from country state;
- resource-sector factor where applicable;
- current production-plan factor;
- current firm productivity.

This yields a current-runtime-compatible `effectiveOutputPerLaborUnit`, then:

`physicalLaborNeed = desiredProduction / effectiveOutputPerLaborUnit`.

The financeability estimator is deliberately conservative:

- immediate ledger cash is counted;
- no hypothetical new credit is manufactured;
- no undrawn credit is assumed when the runtime does not represent it;
- input cost uses current supplier prices where observable.

Therefore `shadowDesiredLaborUnits` is a **current-cash / observed-input lower-bound diagnostic**, not a claim about economically optimal employment under a mature working-capital market.

## Cross-seed / cross-country mean diagnostic

Averaging the 16 seed-country summaries across the 24-month windows:

| Metric | Mean |
|---|---:|
| Active establishments | **26.85** |
| Current workers | **167.79** |
| Canonical desired workers | **173.09** |
| Production-derived physical labor need | **168.11** |
| Cash/input-financeable shadow desired labor units | **65.03** |
| Establishment share where physical need > canonical target | **88.12%** |
| Establishment share where canonical target > cash/input-financeable shadow demand | **63.02%** |
| Revenue-below-current-payroll share | **92.56%** |
| Wage-arrears-positive share | **38.88%** |
| Input-constrained share | **74.63%** |
| Current-working-capital-gap share | **42.88%** |

The reported shadow labor-supply coverage ratios are high under the diagnostic demographic fixture because the fixture deliberately creates a multi-person population and is **not calibrated**. They must not be interpreted as evidence that the production economy has empirically excessive labor supply.

## Identification result 1 — current production plan and current labor target are much closer in aggregate than older coarse diagnostics implied

At the seed-country aggregate level, mean current workers (~167.8), canonical desired workers (~173.1) and M2 production-derived physical labor need (~168.1) are of similar magnitude.

This is an important refinement.

It means the earlier finding that broad physical-labor requirement could greatly exceed canonical desired jobs cannot simply be generalized to every definition of physical need. M2 uses the **current canonical planned-output/capacity equation itself** and therefore asks a narrower question: how much labor is implied by the production plan the runtime is actually attempting at that moment?

Under this narrower definition, aggregate current labor targets are not off by an order of magnitude.

However, establishment-level disagreement remains widespread: physical need exceeds canonical target in ~88% of establishment observations, while aggregation cancels many positive/negative gaps.

## Identification result 2 — firm-level feasibility stress remains severe even when current plan and labor target are similar in aggregate

The strongest replicated M2 signals are not a simple worker-count mismatch. They are:

- ~92.6% revenue-below-current-payroll incidence;
- ~74.6% input-constrained incidence;
- ~42.9% current-working-capital-gap incidence;
- ~38.9% wage-arrears incidence.

This is consistent with the closed R4-CC and BR/BV evidence that the firm system often cannot convert plans, payroll and inventories into self-financing operating circulation.

## Identification result 3 — current-cash financeability is far below canonical desired labor for many establishments

The current-cash/input lower-bound produces about 65 shadow desired labor units against ~173 canonical desired workers on average, and ~63% of establishments have canonical targets above this lower-bound.

This does **not** prove canonical labor demand is excessive.

It proves that under current immediate cash plus observed input costs, many canonical labor targets require financing that is not available in cash at that moment.

The unresolved economic question is therefore whether a realistic working-capital / receivables / credit mechanism should bridge this gap, or whether plans themselves are too aggressive relative to viable sales. That question belongs to a later causal credit-working-capital experiment, not to M2 shadow code.

## Identification result 4 — input availability is a first-class constraint

Roughly three quarters of active establishment observations are flagged input-constrained under the current planned output.

Therefore future labor-demand design must not diagnose every gap as a hiring shortage. A firm can simultaneously have a labor plan and insufficient intermediate inputs.

M3/M4 must preserve explicit separation among:

- plan/demand constraint;
- physical labor requirement;
- labor availability;
- input availability;
- current cash;
- external working-capital finance;
- realized sales/revenue.

## Relation to previous evidence

M2 strengthens rather than erases the previous frontier:

- R4-AP remains valid that person/household/firm density semantics are not jointly coherent and cannot be repaired by simple object multiplication;
- R4-CC remains valid that firm-level payroll viability is structurally weak across seeds;
- BR remains valid that exit candidates exhibit operating-cash/payroll failure;
- BV remains valid that inactive estates strand material inventories/claims;
- BW remains valid that the opening institutional network contains cold-start conventions and sparse persistent private credit.

M2 adds a more precise decomposition of *where* current labor-plan feasibility breaks.

## What is NOT authorized

The following remain prohibited:

- switching canonical employment from households to persons;
- cutting or multiplying firm counts;
- multiplying productivity;
- cutting wages;
- setting `desiredWorkers = physicalLaborNeed` directly;
- setting `desiredWorkers = shadowDesiredLaborUnits` directly;
- injecting cash or credit to make the lower-bound pass;
- treating the diagnostic demographic fixture as population calibration;
- treating the cash-only financeability bound as optimal labor demand.

## Next gate

The next dependency-safe stage is **R4-CE — M3 Behavioral Switch Precondition Design**, not an immediate behavioral switch.

R4-CE must define and validate at least:

1. person-level employment contracts and wage settlement accounting;
2. household aggregation of multiple person incomes;
3. labor-force unemployment accounting migration;
4. employer-side labor-unit demand and allocation;
5. current-cash vs working-capital finance separation;
6. input-constrained production compatibility;
7. old-path control flag and exact accounting regression;
8. calibration inputs that remain external rather than hard-coded.

Only after that design gate closes may a controlled M3 experiment switch hiring from household slots to person/labor units.

## Checkpoint

`CHECKPOINT = R4-CD-M2-CLOSED-PASS / FOUR-SEED-24M-EXACT-REPLAY / PERSON+LABOR-SHADOW-LAYERS-OPERATIONAL / R4-CE-M3-PRECONDITION-DESIGN-NEXT / CANONICAL-BEHAVIOR-LOCKED`
