# WP-RV08 R4-AX Closure — Bootstrap / Opening Stock-Flow / Startup Grace Sensitivity

Date: 2026-08-22
Run: `32557961858`
Source SHA: `5961eb8bac47b1a67b41a9c40bebd6db0b47d297`
Coverage: **8/8 shards, 32/32 primary simulations, final beacon SUCCESS**
Verdict: **PASS — cold-start causal narrowing / FAIL-CONTINUE — simple prehistory buffers or startup grace are insufficient**

## Question

R4-AU–AW established a synthetic mature-looking opening state and a delayed stress pipeline. R4-AX asks whether two concrete startup inconsistencies are enough to explain the long-run collapse:

1. input-using firms start with zero inherited intermediate inventory;
2. bankruptcy/distress enforcement begins immediately even though all operational and institutional histories start fresh.

## Interventions

- `control`
- `input-buffer`: one opening production round of inherited intermediate stock, booked as opening equity and input inventory; no cash grant and no accounting imbalance.
- `grace6`: exits suppressed and distress clocks reset for months 1–6; all other economic processes continue.
- `input-buffer-grace6`.

The experiment uses the `unit` and prior `materials-consumer` diagnostic bases to avoid confusing this result with the already-known raw nominal-scale defect.

## Result 1 — inherited input buffers reduce the local startup shortage but do not stabilize the economy

Under MATERIALS+CONSUMER normalization, the opening input buffer reduces mean months-1–6 input shortage from **49.44 to 35.22** (~28.8% reduction).

But terminal outcomes do not improve:

- terminal unemployment: **81.51% control → 82.35% input-buffer**;
- active firms: **24.44 → 23.69**;
- terminal output: **14.73 → 11.47**;
- terminal arrears: **188.6k → 191.0k**.

Under the unit-only base, the input buffer slightly raises terminal GDP/output but still ends at **88.49% unemployment**, about **21.4 active firms**, and **201.9k arrears**.

Thus zero inherited inputs are a real startup inconsistency and can alter short-run execution, but they are not the deep collapse root.

## Result 2 — six months of startup grace postpones the cascade but stores more payroll distress

MATERIALS+CONSUMER:

- months-7–12 unemployment: **33.48% control → 25.74% grace6**;
- total exits: **215 → 171**;
- but months-7–12 arrears: **83.4k → 98.6k**;
- terminal unemployment: **81.51% → 82.30%**;
- terminal arrears: **188.6k → 206.8k**;
- terminal output: **14.73 → 10.01**.

Unit-only:

- months-7–12 unemployment: **39.63% → 29.81%**;
- total exits: **229.5 → 185**;
- but terminal unemployment remains **~89%** and terminal arrears rise from **202.8k to 229.8k**.

The system therefore uses the grace period mainly to keep distressed firms and workers attached while obligations accumulate. When canonical exit logic resumes, the underlying operating defect is still present.

## Result 3 — combining the two startup interventions does not create an emergent stable basin

The combination reduces medium-horizon unemployment during the protected interval but does not create a healthier long-run state.

MATERIALS+CONSUMER combination:

- mean unemployment across 24m falls to 39.85%,
- but terminal unemployment rises to **83.25%**,
- terminal active firms fall to **23.0**,
- terminal output falls to **8.76**,
- terminal arrears remain **205.8k**.

The unit-base combination behaves similarly: delayed unemployment, then ~88.8% terminal unemployment and 228.1k arrears.

## Hypothesis verdicts

- **H-AX-1: zero inherited input inventory is the primary cold-start cause** — **FALSIFIED**.
- **H-AX-2: the economy mainly needs several months to self-organize before normal bankruptcy rules begin** — **FALSIFIED as sufficient explanation**.
- **H-AX-3: input history and settling time together create a stable mature-like basin** — **FALSIFIED**.
- **H-AX-4: cold-start inconsistencies materially alter the path and timing of collapse** — **SUPPORTED**.
- **H-AX-5: the persistent root remains operating-system coherence after startup effects are neutralized** — **STRONGLY SUPPORTED**.

## Interpretation

This closes the simplest version of the “economy collapses only because it appears all at once” hypothesis.

The analogy to an ecosystem remains useful, but the evidence now says more precisely:

> the artificial cold start damages the ecosystem and changes its transient path, yet even when two important startup defects are softened, the endogenous economy still evolves into the same broad collapse basin.

The investigation therefore moves from **startup history alone** to the wider question of **which missing mature relationships, ownership structures, expectation diversity, institutional topology and adjustment clocks prevent the system from having realistic stabilizing feedbacks**.

No production prehistory generator is authorized from this result.

## Evidence

`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AX_BOOTSTRAP_PREHISTORY_COMPACT_2026-08-22.csv`
