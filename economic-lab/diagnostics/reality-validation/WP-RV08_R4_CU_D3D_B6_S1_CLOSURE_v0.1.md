# WP-RV08 R4-CU-D3D-B6-S1 Closure v0.1

## Decision

**CLOSED / TECHNICAL PASS / EIGHT ORIGINAL-SEED-ELIGIBLE CAUSAL CANDIDATES / THREE FROZEN HELDOUT FINALISTS / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative evidence

- Repository: `shinsihu10123/ProceduralCity`
- Branch: `scratch/new-project-2026-08-12`
- Authoritative head: `32c4753ee062e62f09789cb7a7492f2c6fdae354`
- GitHub Actions run: `33358631295`
- Workflow conclusion: `success`
- Preregistration gate: `success`
- Candidate screen: 18 candidates × 2 original seeds = 36 successful jobs
- Aggregate job: `99385724126`, `success`
- Final beacon job: `99385741820`, `success`
- Aggregate artifact: `r4-cu-d3d-b6-s1-authoritative-aggregate`
- Artifact ID: `9745969839`
- Artifact size: `20,758` bytes
- Artifact ZIP digest: `sha256:2048535126ade399b10133f74592bed193135da2d558ab02b07c691aa29f7aa7`
- Artifact expiry: `2026-11-29T04:53:29Z`

## Frozen Stage-1 factorial

The preregistered matrix was executed without changing the frozen candidate grid:

- Productive-value axis: `V ∈ {1, 24}`
- Material-efficiency axis: `M ∈ {1, 4, 16}`
- Working-capital axis: `W ∈ {C42, FULL, LINE1}`
- Control: `V1_M1_C42`
- Original seeds: `ECON-RV02-A`, `ECON-RV02-C`
- Horizon: 12 months

The screen retained exact replay, accounting, stock-flow reconstruction, procurement-mechanism and no-canonical-mutation gates. `LINE1` remained a firm-only bank facility with canonical debt service/default and no seller-created trade credit.

## Aggregate decision

The authoritative aggregate emitted:

- Economic decision: `ELIGIBLE_CAUSAL_FAMILIES_IDENTIFIED_FOR_B6_S2`
- Eligible candidates on both original seeds: `8`
- Maximum finalists allowed by the frozen contract: `3`
- Frozen heldout finalists:
  1. `V1_M16_C42`
  2. `V1_M4_C42`
  3. `V24_M16_C42`

All three finalists retain the canonical 42% cash-procurement rule. Therefore Stage 1 did not identify the full-cash or bank-line variants as the top heldout candidates. This is a screening outcome, not authorization to alter the canonical economy.

## Interpretation

Stage 1 supports continued causal testing of two mechanisms:

1. lower physical intermediate-input requirement per unit of output (`M4` or `M16`), and
2. the interaction between that material-efficiency change and sector-shaped productive-value capacity (`V24_M16`).

The result does not yet establish external validity. The three finalists were selected using only the two original seeds; heldout E/F remained unopened for finalist selection.

## Anti-tuning lock

This closure does **not** authorize:

- changing the three finalist values after seeing heldout results;
- adding a new candidate to the heldout matrix;
- relaxing labour-share, realized-consumption, input-shortage, active-firm or purchasing-power gates;
- assigning empirical reference cohorts directly to fictional countries;
- converting the external empirical bands into direct parameter targets;
- mutating canonical wages, prices, productivity, input coefficients, procurement or credit rules.

## Next dependency-safe front

`R4-CU-D3D-B6-S2`: run only the frozen control plus the three frozen finalists on heldout seeds `ECON-RV08-HOLDOUT-E` and `ECON-RV08-HOLDOUT-F`, using the same 12-month measurement surface and unchanged eligibility thresholds. No heldout-driven retuning is permitted.
