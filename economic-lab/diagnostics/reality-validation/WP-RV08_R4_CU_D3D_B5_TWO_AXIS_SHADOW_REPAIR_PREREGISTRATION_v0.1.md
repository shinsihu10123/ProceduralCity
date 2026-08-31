# WP-RV08 R4-CU-D3D-B5 Two-Axis Shadow Repair Family Preregistration v0.1

## Decision status

**PREREGISTERED SHADOW SCREEN / CANONICAL MUTATION NOT AUTHORIZED / NO WINNER SELECTED IN ADVANCE**

## Dependency checkpoint

B4 admitted two broad empirical envelopes for **shadow-candidate scoring only**:

- labour-income-share outer cohort-IQR envelope: `0.521557–0.607117`;
- realized household-consumption-flow outer cohort-IQR envelope: `0.883763–0.979344`.

B4 did not authorize using the observed gap as a direct parameter multiplier. B5 therefore uses a coarse, preregistered mechanism grid and ranks outcomes only after all candidates are executed.

## Mechanism hypothesis

The first admissible repair family must preserve nominal household purchasing power and avoid blind price or wage changes.

### Axis V — sectoral real productive-value recovery

Axis V multiplies firm real productivity while leaving initial prices, wages, deposits, firm cash, household wealth, desired budgets, tax rates and credit rules unchanged.

A fixed rounded sector shape is used to reflect the previously established sector ordering without fitting each sector to an empirical target:

| Sector | Shape multiplier |
|---|---:|
| RESOURCE | 2.00 |
| MATERIALS | 1.40 |
| CAPITAL | 0.65 |
| CONSUMER | 1.00 |

The common V grid is `24, 48, 96`. These are coarse log-spaced screening levels, not inverses of B4 gap factors and not canonical recommendations.

### Axis C — consumer final-output yield

Axis C applies an additional real-productivity multiplier only to CONSUMER firms. The C grid is `1, 2, 4, 8, 16`.

This tests whether general sectoral value recovery is insufficient unless consumer final-output capacity expands further. Material coefficients, procurement cash caps, market rules and desired household budgets are left unchanged in this first family. Consequently, a candidate can fail because intermediate inputs or working capital cannot support its nominal capacity; that failure is evidence, not something to conceal.

### Control

`CTRL` leaves the world unchanged.

The full Stage-1 family contains 16 candidates: one control plus the 15 `V × C` combinations.

## Dynamic consistency

The shadow multiplier is applied:

- to every initial firm after canonical world construction;
- exactly once to every replacement entrant through an overridden entrant hook;
- never to inactive firms retroactively;
- without changing the canonical source modules or persisted configuration.

Every firm receives provenance tags containing its unmodified productivity and the applied shadow factors.

## Protected nominal surface

Before simulation starts, a candidate world must match an unmodified control world exactly on:

- firm and household identities;
- firm prices and wages;
- household wages and reservation wages;
- all opening settlement-ledger balances;
- firm cash and safe-cash fields;
- household wealth;
- desired-consumption-budget fields;
- industry assignment and input coefficients;
- country fiscal, financial-access and demand parameters.

Only firm productivity and explicit B5 provenance tags may differ.

## Stage-1 execution

- Seeds: `ECON-RV02-A`, `ECON-RV02-C`
- Horizon: 12 months
- Scale: baseline
- Candidate jobs: 32
- Exact paired replay: required inside every candidate/seed job
- Hard accounting health: required
- Results aggregated only after all matrix jobs complete

Heldout E/F are reserved for Stage 2 and may not influence Stage-1 candidate ranking.

## Measurement surface

Each candidate reports the B3-compatible monthly country measures plus operational safety indicators:

- positive-GVA employee-compensation share;
- realized household purchaser outlay / cash disposable income;
- net household saving-flow proxy;
- non-positive-GVA incidence;
- goods-budget fulfillment;
- payroll paid and unpaid;
- wage arrears;
- active firms, exits and entries;
- input shortage and B2B procurement;
- unemployment;
- nominal household purchasing-power proxy (`average wage / price index`);
- firm cash and household cash;
- GDP and accounting residuals.

## Stage-1 ranking rule

No single weighted score may silently select a winner.

A candidate becomes `PARETO_ELIGIBLE` only if, on both Original seeds:

1. its labour-share log-distance to the admitted labour band is lower than control;
2. its realized-consumption log-distance to the admitted household-flow band is lower than control;
3. exact replay and hard accounting gates pass;
4. protected nominal surfaces were unchanged;
5. median active firms remain at least 50% of paired control;
6. median nominal household purchasing power remains at least 80% of paired control;
7. no direct desired-budget, wage, price, cash, credit or procurement mutation occurred.

Eligible candidates are ordered by worst-seed two-axis distance, then by non-positive-GVA share, firm retention and input-shortage burden. At most three structurally distinct candidates may advance to Heldout Stage 2. If no candidate is eligible, B5 must close with `FAMILY_INSUFFICIENT`, not tune the grid after seeing outcomes.

## Interpretation safeguards

- Reaching an empirical band does not prove the mechanism is correct.
- Missing an empirical band does not justify changing desired budgets or prices inside Stage 1.
- A high productivity factor is a shadow hypothesis about the current physical-output calibration, not a claim about real historical productivity growth.
- Candidate comparison must retain the control and all failed cases.

## Canonical lock

B5 does not authorize changes to:

- `COUNTRY_SEEDS`;
- `INDUSTRIES`;
- `EconomicWorld` source;
- wage, price, cash or wealth initialization;
- `desiredConsumptionBudget` logic;
- input coefficients;
- procurement, trade-credit or bank-credit rules;
- canonical production coefficients.

## Next front

- If Stage 1 yields eligible candidates: `R4-CU-D3D-B5-S2` 24-month Heldout E/F replication and full survival/supply-chain gate.
- If Stage 1 yields none: close with `FAMILY_INSUFFICIENT` and open a separate input-output/working-capital mechanism family without retuning the failed V×C grid.
