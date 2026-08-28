# WP-RV08-R4-CS Closure — Sectoral Relative Value Coherence

Date: 2026-08-28
Mode: diagnostic only / canonical mutation locked
Authoritative run: `33165135005`
Run head: `cd8f069a4323641da4e6bf16ca125abeb49fe1b9`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / PERSISTENT SECTOR RELATIVE-VALUE DISPERSION CONFIRMED / COMMON SECTOR-BLIND NORMALIZATION REJECTED / CANONICAL MUTATION NOT APPROVED**

## Hard gates

All four seeds (Original A, Original C, Heldout E, Heldout F) passed:

- no mutation by audit
- exact diagnostic replay
- exact canonical replay
- hard accounting healthy
- finite positive observations
- all countries observed
- all industries observed
- deterministic relative-factor calculation

The final beacon also completed successfully.

## Cross-seed headline evidence

Consumer is used only as an internal relative reference (=1.0); this is not an empirical claim that the consumer sector is correctly calibrated.

| Seed | RESOURCE / CONSUMER median RULC | MATERIALS / CONSUMER | CAPITAL / CONSUMER | Median max/min sector spread | Share spread > 2 |
|---|---:|---:|---:|---:|---:|
| Original A | 2.3041 | 1.4476 | 0.5935 | 3.4332 | 1.0000 |
| Original C | 2.3266 | 1.5220 | 0.5807 | 3.4519 | 1.0000 |
| Heldout E | 2.4374 | 1.4995 | 0.6015 | 3.6210 | 1.0000 |
| Heldout F | 2.5594 | 1.4668 | 0.5798 | 4.0206 | 1.0000 |

The direction is stable across all four seeds:

`RESOURCE > MATERIALS > CONSUMER > CAPITAL`

in RULC burden. RESOURCE is roughly 2.3–2.6× the consumer RULC, MATERIALS about 1.45–1.52×, while CAPITAL is only about 0.58–0.60×.

## Interpretation

R4-CQ established that the absolute RULC level is a real, dimensionless calibration/technology defect rather than a monetary or quantity-unit relabel issue. R4-CS now establishes that the defect is also **sectorally non-uniform**.

Therefore a single sector-blind operation such as:

- divide every wage by one common factor,
- multiply every price by one common factor,
- multiply every industry's productivity/output by one common factor,

cannot simultaneously restore coherent relative value relationships across RESOURCE, MATERIALS, CAPITAL, and CONSUMER.

This does not identify which primitive parameter is wrong in each sector. The observed dispersion can arise from some combination of:

- industry price multipliers,
- productive capacity technology,
- input coefficients and upstream constraints,
- capital/human-capital productivity effects,
- commodity/bundle semantics,
- wage formation and labor composition.

The current evidence is sufficient to reject a common sector-blind scalar repair, but insufficient to authorize any sector-specific canonical parameter changes.

## Causal status after R4-CS

The Economic Lab collapse now has three confirmed calibration layers:

1. **Absolute real unit labor-cost incoherence** — RULC is far above economically viable cost-recovery scale.
2. **Independent household demand/capacity scale incoherence** — correcting the labor-value axis leaves a large second residual factor.
3. **Persistent sector relative-value incoherence** — the required labor-value correction is materially different across industries.

These interact with already-confirmed cash procurement, settlement, trade-credit, arrears, and exit feedback loops, but those financial/settlement mechanisms are amplifiers rather than sufficient root repairs.

## Mutation lock

R4-CS authorizes **no canonical mutation**. In particular it does not authorize:

- a global wage divisor,
- a global price multiplier,
- a global output/productivity multiplier,
- industry-specific price/productivity edits,
- procurement/trade-credit behavior switches,
- accounting behavior switches.

## Required next front

Proceed to **R4-CT — Economic Semantic Anchor Register** before constructing any canonical repair candidate.

The register must define, for every candidate calibration primitive:

- economic meaning,
- unit/dimension,
- stock vs flow status,
- period convention,
- aggregation level,
- sector applicability,
- observable/empirical anchor required,
- internal invariant constraints,
- allowed transformation family,
- prohibited silent rescaling,
- current evidence status,
- canonical mutation authorization status.

Any empirical target not already supported by repository evidence must remain explicitly `UNRESOLVED` rather than being invented.