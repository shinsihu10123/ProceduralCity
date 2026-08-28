# WP-RV08-R4-CM — Common Normalization Identification Closure

Date: 2026-08-28
Authoritative run: `33146676757`
Branch: `scratch/new-project-2026-08-12`
Run head: `de80d5f760773c703c034d4a47f9a24912498d29`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / COMMON SCALAR NORMALIZATION REJECTED / CANONICAL MUTATION NOT APPROVED**

R4-CM tested whether the unit-ontology mismatch confirmed by R4-CL could be repaired by one common positive scalar applied to productive value. All four 24-month matrix jobs completed successfully and all hard diagnostic gates passed.

## Matrix evidence

| Seed | Firm break-even factor median | Household-demand factor median | Demand/Firm median ratio | IQR overlap | scalarPlausible |
|---|---:|---:|---:|---:|---|
| Original A | 87.9506 | 601.4314 | 6.8383 | 0 | false |
| Original C | 87.4958 | 802.2455 | 9.1690 | 0 | false |
| Heldout E | 85.0856 | 646.5216 | 7.5985 | 0 | false |
| Heldout F | 86.1004 | 1003.6626 | 11.6569 | 0 | false |

The firm factor is `payroll / (capacity × price)`. The demand factor is `household desired consumption budget / consumer capacity value`.

Artifacts:
- Original A: `9676043160`
- Original C: `9676044423`
- Heldout E: `9676042233`
- Heldout F: `9676044771`

## Interpretation

The two required normalization distributions are structurally separated. Across all four seeds, their interquartile ranges do not overlap. A scalar near the firm median leaves household demand several multiples above consumer capacity. A scalar near the household-demand median removes the firm payroll deficit algebraically, but does so by imposing a much larger productive-value scale than firm break-even alone requires. The geometric-mean compromise likewise fails to normalize both systems simultaneously.

This rejects the hypothesis that the observed pathology is a single missing multiplier.

The evidence supports at least two independent dimensional constraints:

1. labor compensation relative to productive value;
2. household nominal consumption demand relative to consumer productive capacity.

However, R4-CM does **not** identify whether the first constraint should be repaired through price units, physical quantity units, labor-service units, wage units, or some combination. Those transformations are observationally equivalent under the R4-CM ratio metrics. Likewise, the household-demand constraint may be repaired through consumption-bundle semantics, household budget units, consumer-sector productive capacity, or a coupled transformation.

## Locked decisions

Do not yet:
- multiply canonical prices by a large constant;
- divide canonical wages by a large constant;
- multiply canonical output/capacity by a large constant;
- compress household desired-consumption budgets by a large constant;
- change firm counts, household counts, procurement, credit, payroll timing, or trade-credit rules as a substitute for unit repair.

Canonical economic behavior remains mutation-locked.

## Next dependency-safe step

Proceed to **R4-CN — Economic Unit Contract Identifiability + Stock/Flow Coherence Audit**.

R4-CN must distinguish what current evidence can identify from what remains underidentified. It must measure stock-to-flow anchors such as household deposits / wage, firm deposits / payroll, wage / productive-value-per-worker, and desired consumption / consumer capacity value, then evaluate observationally equivalent candidate normalization families without mutating the canonical world.

The purpose is not to select arbitrary constants. The purpose is to determine the minimum independent dimensions required by a coherent Economic Unit Contract and which dimensions need external empirical/semantic anchoring before canonical repair.