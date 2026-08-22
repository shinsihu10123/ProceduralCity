# WP-RV08 R4-AP Execution — Population Sufficiency / Labor Feasibility / Scale Sensitivity

Date: 2026-08-22
Mode: diagnostic-only causal probe

## Question

The current collapse diagnosis has established that labor matching usually fills the labor targets firms actually request, while those targets can remain far below the labor implied by production plans. A remaining structural question is whether the Economic Lab is also operating at an internally infeasible population/firm scale.

The baseline seed contains 2,110 households and 170 firms across four countries, or about 12.4 households per firm. Initial firm desired-worker counts are generated independently of the aggregate labor force, and `relinkEmployment()` truncates realized employment when the household pool is exhausted. Therefore population/firm density and finite-agent scale are legitimate diagnostic targets.

## R4-AP design

R4-AP separates three related but distinct questions.

1. **Population sufficiency:** Does the summed physical labor requirement implied by concurrent production plans exceed the total household labor pool? The audit records both total physical requirement and the subset belonging to plan-economically viable firms.
2. **Finite-size sensitivity:** Does doubling households and firms together materially change normalized outcomes? If yes, the baseline may be too small and subject to discreteness/network-thinning artifacts.
3. **Household/firm density sensitivity:** What happens when households are doubled while firms are fixed, or firms are doubled while households are fixed? These are deliberate counterfactual density probes, not proposed repairs. They jointly change labor supply, demand, firm competition, and aggregate balance-sheet scale, so their interpretation is comparative rather than a pure labor-supply identification.

Profiles:

- `baseline`: households ×1, firms ×1
- `balanced2`: households ×2, firms ×2
- `households2`: households ×2, firms ×1
- `firms2`: households ×1, firms ×2

Coverage:

- seeds: original A/C + held-out E/F
- normalization bases: CONSUMER and MATERIALS+CONSUMER
- 24 months per job
- 4 population profiles
- 32 independent primary jobs

## Measurements

Each country-month records:

- households and active firms;
- actual workers and requested/desired workers;
- unconstrained-plan physical worker requirement;
- physical worker requirement for plan-economically viable firms;
- physical-need/population and desired-jobs/population ratios;
- desired-to-physical labor ratio;
- target fill ratio;
- unemployment and unfilled requested jobs;
- GDP, output and wage arrears normalized per household.

The initial census additionally records households per firm, desired jobs per household, actual workers per household, and initial unemployment.

## Hard gates

- observer noninterference fingerprint check;
- health PASS;
- settlement ledger PASS;
- general accounting PASS;
- GDP identity arithmetic PASS;
- productive normalization activation;
- complete population observation rows;
- finite metrics.

## Interpretation gates

- If balanced ×2 scaling leaves normalized physical-need, unemployment, output, and arrears dynamics broadly unchanged, a simple 'too few agents' finite-size root is weakened.
- If balanced ×2 materially improves normalized stability, finite-size/discreteness becomes a major causal lead.
- If baseline physical labor need persistently exceeds the full household pool, the model has a direct aggregate labor-feasibility inconsistency independent of matching quality.
- If household-only ×2 changes outcomes far more than balanced ×2, household/firm density is structurally material; this does not by itself distinguish labor supply from additional household demand.
- If firm-only ×2 sharply worsens labor feasibility, the current firm-count-to-population ratio is likely part of the structural problem.

No scale profile from R4-AP is authorized as a production repair. The purpose is to determine whether the current baseline population/firm architecture itself is a causal contributor.
