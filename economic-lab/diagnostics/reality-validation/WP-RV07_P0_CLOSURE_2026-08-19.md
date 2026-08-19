# WP-RV07-P0 — Stock-Flow Scale Audit — Closure

Status: **PASS — STRUCTURAL SCALE DEFECT VERIFIED**
Date: 2026-08-19

## Frozen semantics

Frozen economic baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in P0: **0**.
Parameter tuning in P0: **0**.

## Final evidence

- run: `32220394225`
- head: `63ffd3572f9bdeab8122154fefd34d055706bae1`
- artifact: `9353733572` / `economic-lab-wp-rv07-p0`
- artifact digest: `sha256:a12f322c77ce34dacc0e4a1de22acf67c20621865ed5f0d475f4d39747d48d3d`
- scales: `compact`, `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 3 months
- country-month observations: 72

All hard gates passed: exact observer non-interference, health, complete coverage, production physical-flow reconciliation, government purchase reconciliation, household market boundary reconciliation and goods-budget identity reconciliation.

## A — VERIFIED EXISTING FACTS

### A1. The shortage is scale-invariant across compact and baseline

Across all 3 months:

| Metric | compact | baseline |
|---|---:|---:|
| desired budget / household | 61.05 | 59.51 |
| opening inventory value / desired budget | 2.62% | 2.36% |
| post-production inventory value / desired budget | 1.11% | 1.08% |
| household-market opening inventory / desired budget | 0.717% | 0.698% |
| household budget fulfillment | 0.717% | 0.698% |
| country-months ending with zero eligible sellers | 100% | 100% |
| positive-budget households left unmet | 99.684% | 99.631% |

The same structural pattern survives a 4x population/firm scale change. This is therefore not a compact-profile artifact.

### A2. The shortage exists immediately in month 1

Month 1 baseline averages:

- desired household budget / household: `64.68`
- opening consumer inventory value / desired budget: `2.13%`
- post-production consumer inventory value / desired budget: `2.39%`
- household-market opening inventory value / desired budget: `1.58%`
- household budget fulfillment: `1.58%`
- country paths ending with zero eligible sellers: `100%`

The defect exists before the later mass-exit phase.

### A3. Intermediate-input shortage is not the binding P0 explanation

Mean `inputShortage / desiredProduction` is effectively zero at both scales over the promoted 3-month panel.

The observed consumer shortage therefore cannot be attributed to missing intermediate inputs in this P0 window.

### A4. Government final demand depletes scarce consumer inventory, but is not sufficient to explain the shortage

Month 1 government consumption removes about `34%` of post-production consumer inventory value at both scales. However post-production consumer inventory itself covers only about `2.4–2.6%` of household desired budget before government demand occurs.

Thus government pre-emption amplifies the scarcity but does not create the underlying order-of-magnitude shortage.

### A5. The physical production scale is extremely small relative to generated purchasing power

Baseline month 1 averages show only about `22.34` consumer-capacity units per 100 households, while desired household budget is about `64.68` currency units per household and consumer-good prices are initialized near 1 currency unit per physical unit.

Source inspection confirms country initial wages are `82–112` while initial consumer prices are near `0.90–1.06`, and production capacity is computed from approximately one physical output unit per worker times dimensionless productivity/capital/human-capital multipliers.

This creates a strong structural lead that nominal wage/income scale and physical output-value scale are not mutually coherent.

## B — DIAGNOSTIC LEADS

1. **Primary lead:** wage/income purchasing power is generated at roughly two orders of magnitude above per-worker physical output value.
2. Initial inventory is also too small to bridge that flow mismatch; it is exhausted in every observed country-month.
3. The household goods market is behaving consistently with its coded rule: it spends until sellers run out, then records unmet budget. The market-clearing code is not the P0 reconciliation failure.
4. Firm demand inference is exposed to a censored realized-sales signal after stockout, so a downstream false-demand-contraction channel remains structurally plausible.

## C — HYPOTHESIS DISPOSITION

| Hypothesis | P0 disposition |
|---|---|
| compact scale causes the shortage | **FALSIFIED** |
| intermediate inputs are the initial binding constraint | **NOT SUPPORTED in P0** |
| government demand is the sole initial cause | **FALSIFIED** |
| consumer supply value is structurally too small relative to generated household purchasing power | **STRONGLY SUPPORTED** |
| the specific wage/output unit inconsistency is the dominant root defect | **PROMOTED TO P1 DIRECT AUDIT** |

## D — NEXT ACTION

Proceed to **WP-RV07-P1 — Unit-Economics / Wage-Output Coherence Audit**.

P1 must directly measure, at the exact production/payroll boundaries:

- contractual payroll obligation;
- actual payroll paid;
- physical output value at current prices;
- realized firm revenue;
- cash runway relative to payroll;
- consumer-sector and whole-economy ratios;
- compact vs baseline invariance.

No repair is authorized until P1 determines whether the nominal wage/output-value mismatch is directly present in the frozen model state.

## Final result

**WP-RV07-P0: PASS — STRUCTURAL SCALE DEFECT VERIFIED; REPAIR NOT YET AUTHORIZED**
