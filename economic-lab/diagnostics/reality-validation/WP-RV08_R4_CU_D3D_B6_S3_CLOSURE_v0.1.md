# WP-RV08 R4-CU-D3D-B6-S3 Closure v0.1

## Decision

**LONG-HORIZON OR STRESS VALIDATION FAILED / NO RETUNING / ROUTE TO B7 / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative execution

- Source workflow run ID: `33362894408`
- Source workflow head SHA: `e39f96ff3585d7c5913551a22fdbe4be5ace4169`
- Source workflow URL: `https://github.com/shinsihu10123/ProceduralCity/actions/runs/33362894408`
- Aggregate artifact ID: `9747330570`
- Aggregate artifact digest: `sha256:ea997b5aa212c7957719afe56502c1c2fc31e3a8a20c039120cdae0a1c2d4805`
- Aggregate JSON SHA-256: `c3f0e122f09f6aa99c393ce75bbaa601e5160df51466a0204cd5ebe4c3c5b567`
- Closure generated at: `2026-08-31T06:11:28.622Z`
- Technical status: `PASS_TECHNICAL_LONG_HORIZON_STRESS_AGGREGATION`
- Economic decision: `LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING`
- Observed jobs: `12/12`

## Frozen dependency and primary

- S2 closure commit: `ed745e466cc3fee064a359ba28f33a50b0f67e28`
- S2 authoritative run: `33359245264`
- S2 replicated candidates: `V24_M16_C42`, `V1_M4_C42`, `V1_M16_C42`
- S3 control: `V1_M1_C42`
- S3 frozen primary: `V24_M16_C42`
- Primary retuning during S3: prohibited

## Frozen validation panel

- Validation seeds: `ECON-RV08-LONG-G`, `ECON-RV08-LONG-H`
- Horizon: 36 months
- Shock month: 13
- Windows: `FULL_36` months 1–36; `TERMINAL_12` months 25–36
- Jobs: 2 candidates × 2 seeds × 3 scenarios = 12

| Scenario | Role | Scheduled events | Event path |
|---|---|---:|---|
| BASELINE_36 | UNSHOCKED_LONG_HORIZON | 0 | none |
| SUPPLY_SHOCK_M13 | ADVERSE_REAL_PRODUCTIVITY_STRESS | 1 | productivity_shock@M13 |
| FINANCIAL_CONFIDENCE_STRESS_M13 | COMPOUND_CONFIDENCE_AND_BANK_RISK_STRESS | 2 | confidence_shock@M13, bank_risk_shock@M13 |

Scenario magnitudes are frozen adverse validation paths. They are not calibrated canonical parameter recommendations.

## Primary validation result

- All seed-scenario-window panels passed: **NO**
- Worst-window combined headline distance: 9007199254740991.000000
- Worst-window input-shortage ratio vs control: 1.721305
- Minimum window active-firm ratio vs control: 1.028571
- Minimum window purchasing-power ratio vs control: 0.862518
- Dependency-safe routing: `R4-CU-D3D-B7 demand-inventory topology and value-transformation diagnosis`

## Seed × scenario × window evidence

| Seed | Scenario | Window | Result | Labour share | Control labour | Consumption share | Control consumption | Input shortage ratio | Active-firm ratio | Purchasing-power ratio | Labour improvement | Consumption improvement | Shortage gate | Firm gate | Purchasing-power gate |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ECON-RV08-LONG-G | BASELINE_36 | FULL_36 | FAIL | 1.277530 | 1.336356 | 0.009531 | 0.000000 | 1.179174 | 1.200000 | 1.294206 | PASS | PASS | FAIL | PASS | PASS |
| ECON-RV08-LONG-G | BASELINE_36 | TERMINAL_12 | FAIL | 1.000000 | 1.000000 | 0.000000 | 0.000000 | 1.721305 | 1.032258 | 0.997494 | PASS | FAIL | FAIL | PASS | PASS |
| ECON-RV08-LONG-G | SUPPLY_SHOCK_M13 | FULL_36 | FAIL | 1.793918 | 1.228747 | 0.027645 | 0.000000 | 1.068793 | 1.200000 | 1.325538 | FAIL | PASS | FAIL | PASS | PASS |
| ECON-RV08-LONG-G | SUPPLY_SHOCK_M13 | TERMINAL_12 | FAIL | 1.000000 | 1.000000 | 0.000000 | 0.000000 | 1.577276 | 1.032258 | 0.948690 | FAIL | FAIL | FAIL | PASS | PASS |
| ECON-RV08-LONG-G | FINANCIAL_CONFIDENCE_STRESS_M13 | FULL_36 | FAIL | 1.180971 | 1.336356 | 0.011260 | 0.000000 | 1.182998 | 1.200000 | 1.279228 | PASS | PASS | FAIL | PASS | PASS |
| ECON-RV08-LONG-G | FINANCIAL_CONFIDENCE_STRESS_M13 | TERMINAL_12 | FAIL | 1.000000 | 1.000000 | 0.000000 | 0.000000 | 1.640687 | 1.032258 | 0.934699 | FAIL | FAIL | FAIL | PASS | PASS |
| ECON-RV08-LONG-H | BASELINE_36 | FULL_36 | FAIL | 1.546068 | 1.000000 | 0.014708 | 0.000000 | 0.794706 | 1.166667 | 0.985739 | FAIL | PASS | PASS | PASS | PASS |
| ECON-RV08-LONG-H | BASELINE_36 | TERMINAL_12 | FAIL | 1.000000 | 1.000000 | 0.000000 | 0.000000 | 1.603551 | 1.028571 | 0.987217 | FAIL | FAIL | FAIL | PASS | PASS |
| ECON-RV08-LONG-H | SUPPLY_SHOCK_M13 | FULL_36 | FAIL | 1.669086 | 1.000000 | 0.016968 | 0.000000 | 0.821883 | 1.225000 | 0.981414 | FAIL | PASS | PASS | PASS | PASS |
| ECON-RV08-LONG-H | SUPPLY_SHOCK_M13 | TERMINAL_12 | FAIL | 1.000000 | 1.000000 | 0.000000 | 0.000000 | 1.603776 | 1.028571 | 0.920035 | FAIL | FAIL | FAIL | PASS | PASS |
| ECON-RV08-LONG-H | FINANCIAL_CONFIDENCE_STRESS_M13 | FULL_36 | FAIL | 1.800310 | 1.068174 | 0.053576 | 0.000000 | 0.518613 | 1.190476 | 0.971030 | FAIL | PASS | PASS | PASS | PASS |
| ECON-RV08-LONG-H | FINANCIAL_CONFIDENCE_STRESS_M13 | TERMINAL_12 | FAIL | 1.253910 | 1.000000 | 0.017234 | 0.000000 | 1.360139 | 1.028571 | 0.862518 | FAIL | PASS | FAIL | PASS | PASS |

## Technical gates

| Gate | Result |
|---|---:|
| contractExact | PASS |
| sourceStage2PrimaryFrozen | PASS |
| candidatePanelExact | PASS |
| validationSeedPanelExact | PASS |
| scenarioPanelExact | PASS |
| frozenHorizonAndWindowsExact | PASS |
| expectedJobCount | PASS |
| completeResultCount | PASS |
| noDuplicateJobs | PASS |
| noMissingJobs | PASS |
| noUnexpectedJobs | PASS |
| allS3EnvelopesPassed | PASS |
| allSourceEngineIntegrityPassed | PASS |
| allExactReplayPassed | PASS |
| allAccountingHealthy | PASS |
| allScenarioSchedulesAppliedExactly | PASS |
| allPayloadHashesValid | PASS |
| allRowsCoverFrozenHorizon | PASS |
| controlPresentEveryPanel | PASS |
| primaryPresentEveryPanel | PASS |
| noFacilityDrawInC42Panel | PASS |
| allPanelsEvaluated | PASS |
| postHocRelaxationLocked | PASS |
| canonicalMutationLocked | PASS |

## Interpretation

S3 tests whether the single S2 primary remains directionally superior to canonical control over a longer horizon and under preregistered adverse paths. It does not show that empirical bands have been reached, does not convert scenario magnitudes into calibrated values and does not itself authorize canonical mutation.

At least one frozen seed-scenario-window panel failed. B6 closes without retuning. The next permitted front is `R4-CU-D3D-B7 demand-inventory topology and value-transformation diagnosis`.

## Canonical lock

This closure does **not** authorize:

- changing canonical productivity, input coefficients or procurement rules;
- changing prices, wages, household desired budgets, opening balances or taxes;
- changing the S3 primary, validation seeds, scenarios, shock month, horizon or windows;
- suppressing a failed stress panel or averaging it away;
- relaxing an eligibility gate after observing results;
- treating stress magnitudes or external empirical bands as direct canonical targets.
