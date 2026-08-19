# WP-RV07-P12 — Production-Requirement Labor-Demand Structural Ablation

## Status
EXECUTION-READY / DIAGNOSTIC ABLATION ONLY

## Admission
Admitted by WP-RV07-P10 in parallel with WP-RV07-P11.

P10 verified that desired production is capacity-bound in most firm-months, especially in the consumer sector, while worker counts decline through the horizon. P12 tests whether the frozen recursive labor target is a material propagation mechanism.

## Control
`unit-basis-control`

No labor-rule modification.

## Candidate
`unit-basis-production-required-labor`

Immediately before labor-market clearing, replace only `desiredWorkers` with a value derived entirely from existing production equations:

1. compute existing per-worker productive capacity using productivity, capital effect, human-capital effect, resource effect, and current production-plan effect;
2. compute existing demand anchor, expected demand, and replenishment;
3. compute existing unconstrained production plan;
4. set required desired workers to:

`ceil(unconstrainedPlan / (perWorkerCapacity * 1.08))`

No fitted coefficient is added. Existing `1.08` is reused because it is already the frozen desired-production capacity cap.

## What remains unchanged
- price/wage unit-basis candidate
- firm cognition and selected plan
- credit decision completed before the labor intervention
- labor matching/frictions
- wages
- supply-chain procurement
- production technology
- goods market
- accounting
- exit rule
- all other canonical code

## Why this is not a canonical repair
This is a causal ablation that asks whether employment demand linked to the already-existing production requirement materially changes the collapse path. It is not merge authorization and does not assert empirical realism.

## Outputs
Compare control vs candidate by window and scale:
- unemployment
- firm exits
- wage arrears
- goods fulfillment
- input shortage
- consumer output
- GDP
- total workers
- total desired workers
- hires / layoffs / unfilled vacancies

## Hard gates
- exact deterministic replay per variant
- health
- full coverage
- nonnegative integer required-worker targets
- intervention-row coverage
- ledger verification
- GDP identity reconciliation
- finite rows

## Interpretation
If the candidate materially reduces unemployment/exit and restores consumer output without creating offsetting payroll or supply failures, recursive labor targeting is promoted as a repair candidate.

If employment rises but arrears/exits worsen, the labor-capacity channel is real but interacts with working-capital/payroll constraints and cannot be repaired in isolation.

If macro outcomes barely move, recursive labor targeting is not a dominant residual cause.

## Run configuration
- scales: compact, baseline
- seeds: ECON-RV02-A/B/C
- horizon: 12 months

## Stop rule
No canonical merge, no coefficient fitting, no held-out validation claim, and no empirical-realism claim in this WP.
