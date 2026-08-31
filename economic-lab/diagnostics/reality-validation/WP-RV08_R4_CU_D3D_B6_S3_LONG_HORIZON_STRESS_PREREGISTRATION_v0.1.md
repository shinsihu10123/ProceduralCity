# WP-RV08 R4-CU-D3D-B6-S3 Long-Horizon and Stress Validation Preregistration v0.1

## Decision status

**PREREGISTERED / SINGLE STAGE-2 PRIMARY ONLY / 36-MONTH LONG-HORIZON AND STRESS VALIDATION / NO RETUNING / CANONICAL MUTATION NOT AUTHORIZED**

## Dependency checkpoint

R4-CU-D3D-B6-S2 completed 8 of 8 frozen heldout jobs and confirmed all three Stage-1 finalists on both untouched heldout seeds. The frozen Stage-2 primary is `V24_M16_C42`, selected by the preregistered lowest worst-heldout two-axis distance rule. The authoritative S2 closure is commit `ed745e466cc3fee064a359ba28f33a50b0f67e28`.

S3 does not reopen finalist selection. It evaluates only:

- canonical control `V1_M1_C42`;
- frozen primary `V24_M16_C42`.

No other B6 candidate may enter S3, and no V, M or W value may be changed.

## Validation question

S3 asks whether the S2 primary remains directionally superior to canonical control:

1. over a 36-month horizon rather than the prior 12-month screen;
2. after a frozen adverse real-productivity shock;
3. after a frozen compound confidence and bank-risk shock;
4. in both the full 36-month window and the terminal post-stress 12-month window.

This is a causal robustness test, not a parameter-calibration exercise.

## Frozen panel

### Candidates

- Control: `V1_M1_C42`
- Primary: `V24_M16_C42`

Both retain `C42`; no FULL procurement or LINE1 facility is introduced.

### Validation seeds

- `ECON-RV08-LONG-G`
- `ECON-RV08-LONG-H`

These seed labels are frozen before S3 execution and were not used in S1 or S2.

### Horizon and windows

- Total horizon: 36 months
- Frozen shock month: month 13
- Full window: months 1–36
- Terminal window: months 25–36

The terminal window measures persistence and recovery after two complete post-shock years. Window boundaries may not be changed after results are observed.

## Frozen scenarios

### `BASELINE_36`

No experiment event. This is the unshocked long-horizon comparison.

### `SUPPLY_SHOCK_M13`

At month 13, the existing `ExperimentSystem` applies a `productivity_shock` with factor `0.75` to every country. The value is a coarse adverse scenario magnitude, not a calibrated recommendation.

### `FINANCIAL_CONFIDENCE_STRESS_M13`

At month 13, the existing `ExperimentSystem` applies both:

- `confidence_shock`, delta `-0.35`, to households, firms and banks;
- `bank_risk_shock`, delta `+0.35`, to banks.

The same schedule is applied to paired control and primary worlds. The events alter only the scenario path; they do not alter the frozen B6 candidate mechanism.

## Execution matrix

- 2 candidates
- 2 validation seeds
- 3 scenarios
- 12 candidate-seed-scenario jobs
- 36 months per job
- exact canonical replay and exact diagnostic replay required
- hard accounting, reconstruction, protected-surface and scenario-event identity gates required

## Frozen eligibility rule

The primary passes S3 only if every seed-scenario panel passes in both the full and terminal windows. Each window must satisfy:

1. labour-share log-distance to the external validation band is strictly lower than paired control;
2. realized-consumption log-distance is strictly lower than paired control;
3. median input shortage does not exceed paired control;
4. median active firms remain at least 50% of paired control;
5. median nominal purchasing power remains at least 80% of paired control;
6. positive-GVA and positive-income observations exist;
7. all source-engine, replay, accounting, protected-surface and scenario-schedule gates pass.

One failed seed, scenario or window is sufficient to fail S3. No averaging may hide a failed panel.

## Failure and pass routing

- Pass: `R4-CU-D3D-B6-S4 canonical-change preregistration and safety review`
- Fail: `R4-CU-D3D-B7 demand-inventory topology and value-transformation diagnosis`

A pass does not mutate canonical parameters. It permits only a separate preregistration and safety review. A failure closes B6 without retuning.

## Canonical lock

S3 does not authorize changes to canonical productivity, input coefficients, procurement rules, prices, wages, opening cash, household desired budgets, taxes, bank underwriting, goods-market rules, credit rules or seed configuration.
