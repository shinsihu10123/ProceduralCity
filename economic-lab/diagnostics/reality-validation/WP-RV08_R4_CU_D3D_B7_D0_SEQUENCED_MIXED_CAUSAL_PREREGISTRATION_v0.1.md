# WP-RV08 R4-CU-D3D-B7-D0 Sequenced Mixed Causal Preregistration v0.1

## Decision entering this front

**B7 CLOSED AS `MIXED` / EXECUTE D1 BEFORE D6 / RECONCILE ONLY AFTER BOTH CHILD CLOSURES / B6 RETUNING PROHIBITED / CANONICAL MUTATION NOT AUTHORIZED**

The governing machine-readable contract is:

- `economic-lab/diagnostics/reality-validation/r4-cu-d3d-b7-d0-sequenced-mixed-causal-contract.json`

This document does not authorize a model correction. It freezes how the two dominant B7 mechanisms will be separated before any mechanism-specific change can be proposed.

## Frozen authoritative dependency

- B7 closure: `economic-lab/diagnostics/reality-validation/WP-RV08_R4_CU_D3D_B7_CLOSURE_v0.1.md`
- B7 closure commit: `53275393b6906e203640c4db60f00dbd67bd30c8`
- B7 workflow run: `33371200438`
- B7 workflow head SHA: `9bed96f445e87765431235c9ff7908bf73668e07`
- B7 aggregate artifact: `9750222167`
- B7 aggregate artifact digest: `sha256:a77cc56408882ecb5318a2c2dd116a3f5772ff520579bee68dd1b3b63ed381b2`
- Persisted aggregate SHA-256: `8618beb8a8de76f87fc553e008be107b19bb332d6d26f5e60e604f0223ccd03c`
- B7 technical status: `PASS_TECHNICAL_B7_DIAGNOSTIC_AGGREGATION`
- B7 observed jobs: `12/12`
- B7 decision: `MIXED`
- B7 route: `R4-CU-D3D-B7-D0 sequenced multi-mechanism causal preregistration`

The upstream B6-S3 decision remains frozen as `LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING`. D0 cannot reverse that decision.

## Why D0 is required

B7 found two dominant failed-primary mechanisms rather than one exclusive mechanism.

| Mechanism | Failed-primary panels | Primary prevalence | Control panels | Control prevalence | Primary-control delta | Dominant in primary |
|---|---:|---:|---:|---:|---:|---:|
| `INPUT_SUPPLIER_TOPOLOGY_BINDING` | 18/24 | 0.750000 | 12/24 | 0.500000 | +0.250000 | YES |
| `VALUE_TRANSFORMATION_BINDING` | 20/24 | 0.833333 | 23/24 | 0.958333 | -0.125000 | YES |
| `INPUT_CASH_BUDGET_BINDING` | 6/24 | 0.250000 | 12/24 | 0.500000 | -0.250000 | NO |
| `INPUT_SEARCH_EXECUTION_BINDING` | 0/24 | 0.000000 | 0/24 | 0.000000 | 0.000000 | NO |
| `DEMAND_INVENTORY_MISMATCH` | 0/24 | 0.000000 | 0/24 | 0.000000 | 0.000000 | NO |
| `GOODS_MARKET_MATCHING_BINDING` | 0/24 | 0.000000 | 0/24 | 0.000000 | 0.000000 | NO |

These prevalence values are diagnostic evidence, not causal estimates. They support the sequence but do not by themselves identify which mechanism is upstream.

The supplier-topology mechanism is tested first because it is both dominant and more prevalent in the failed primary than in control. The value-transformation mechanism is audited second because it is widespread in both candidates and is more prevalent in control. That pattern is consistent with a shared, downstream or measurement/valuation pathology, but D0 does not treat any of those interpretations as established.

## Frozen panel

D0 and its child fronts preserve the B7 panel exactly.

- Candidates: `V1_M1_C42`, `V24_M16_C42`
- Seeds: `ECON-RV08-LONG-G`, `ECON-RV08-LONG-H`
- Scenarios: `BASELINE_36`, `SUPPLY_SHOCK_M13`, `FINANCIAL_CONFIDENCE_STRESS_M13`
- Horizon: 36 months
- Shock month: 13
- Windows: `FULL_36`, `PRE_SHOCK_12`, `TRANSITION_12`, `TERMINAL_12`
- Source jobs: 2 candidates × 2 seeds × 3 scenarios = 12
- Seed × scenario × window panels per candidate: 24

No child front may add a favorable seed, remove an adverse scenario, shorten the horizon or redefine a window.

## Causal question

Does supplier reachability and inventory concentration create the failed-primary shortage path and then induce the observed value-transformation pathology, or do topology and value transformation remain independent or interacting bindings?

The preregistered null is that topology neutralization does not materially reduce input shortage or the normalized value-pathology index relative to the exact observed replay.

## Counterfactual cells

| Cell | Physical path | Value layer | Behavioral feedback |
|---|---|---|---:|
| `O` | Exact B7 observed replay | Raw and canonical accounting | YES |
| `T` | D1 reachability-only disposable shadow | Raw and canonical accounting | YES, inside disposable clone only |
| `O_R` | Exact B7 observed replay | D6 parallel reconciled-value observer | NO |
| `T_R` | D1 reachability-only disposable shadow | D6 parallel reconciled-value observer | NO |

`O_R` and `T_R` are observers, not alternative economies. They may recompute value bridges over realized transactions and quantities, but they may not change behavior, settlement or future state.

## Sequence 1 — D1 supplier topology and reachable inventory

The first child front is `R4-CU-D3D-B7-D1 supplier-topology and reachable-inventory causal isolation`.

D1 must create its own frozen child contract before execution. Its only authorized intervention family is a reachability-only intervention in a disposable noncanonical clone.

At the intervention boundary D1 may alter:

- the compatible-supplier reachability set;
- deterministic supplier traversal order;
- realized supplier links caused by that reachability change;
- downstream quantities and balances that arise endogenously from those links.

D1 may not alter at the intervention boundary:

- candidate identity or V/M/W values;
- seed, scenario or shock month;
- opening stock quantities or book values;
- supplier prices;
- buyer cash or the C42 procurement-budget rule;
- wages, demand plans, inventory targets, capacity or settlement rules.

D1 must report reachable supplier stock, concentration, purchased units, shortage attribution, realized links, production, sales, inventory, active firms, purchasing power and the raw value-pathology index.

The only D1 closure labels are:

- `TOPOLOGY_CAUSAL`
- `TOPOLOGY_NONCAUSAL`
- `TOPOLOGY_INDETERMINATE`

## Sequence 2 — D6 price-cost and value-added transformation

D6 begins only after an authoritative D1 closure exists. It must audit both `O` and `T` physical traces so that a shared value pathology is not incorrectly attributed to supplier topology.

D6 is observer-only. It may calculate:

- transaction-price revenue;
- COGS from realized sales;
- intermediate-input consumption;
- labour compensation accrual;
- finished-inventory book change;
- production and income GVA approaches;
- price-to-book-unit-cost distributions;
- below-cost firm and revenue shares;
- raw and reconciled value-pathology indices.

D6 may not change prices, wages, quantities, matching, settlement, inventory records, entry, exit or future behavior.

The only D6 closure labels are:

- `VALUE_REAL_ECONOMIC`
- `VALUE_MEASUREMENT_OR_VALUATION`
- `VALUE_MIXED`
- `VALUE_INDETERMINATE`

## Sequence 3 — D0-R1 reconciliation

`R4-CU-D3D-B7-D0-R1` may begin only after authoritative D1 and D6 closures exist. It applies the frozen estimands and classification rules; it may not create a new threshold or tie-break after seeing results.

The final labels are:

- `TOPOLOGY_UPSTREAM_OF_VALUE_TRANSFORMATION`
- `VALUE_TRANSFORMATION_INDEPENDENT_OF_TOPOLOGY`
- `PARALLEL_ADDITIVE_BINDINGS`
- `TOPOLOGY_VALUE_INTERACTION`
- `COMMON_CAUSE_OR_UNRESOLVED`
- `TECHNICAL_INDETERMINATE`

## Frozen estimands

- Input-shortage rate: total input-shortage units divided by total planned input need.
- Absolute topology effect: `inputShortageRate_O - inputShortageRate_T`.
- Relative topology effect: absolute topology effect divided by `max(inputShortageRate_O, 1e-9)`.
- Normalized value-pathology index: the maximum of:
  - nonpositive-GVA country-month share divided by the B7 threshold `0.25`;
  - below-cost revenue share divided by the B7 threshold `0.50`.
- Value effect of topology: value-pathology index in `O` minus the index in `T`.
- Observed value-observer gap: absolute difference between `O` and `O_R`.
- Topology-neutral value-observer gap: absolute difference between `T` and `T_R`.
- Topology-value interaction index: the absolute difference between the raw topology effect on value and the reconciled-observer topology effect on value.

## Frozen diagnostic thresholds

| Gate | Value |
|---|---:|
| Minimum absolute topology effect | 0.10 |
| Minimum relative topology effect | 0.20 |
| Minimum normalized value-index reduction | 0.20 |
| Value-binding index | 1.00 |
| Minimum large observer gap | 0.20 |
| Maximum additive interaction index | 0.10 |
| Minimum interaction index | 0.20 |
| Minimum replicated panel frequency | 0.50 |
| Maximum opposite-sign panel frequency | 0.25 |
| Both validation seeds required | YES |

These are causal-diagnostic classification thresholds only. They are not estimates of realistic canonical parameter values.

## Technical gates

Every child result must satisfy all of the following before it can enter reconciliation:

- exact observed replay;
- exact counterfactual replay;
- complete candidate × seed × scenario × window panel;
- exact scenario schedule;
- exact intervention identity hash;
- shortage-attribution identity;
- GVA-approach reconciliation;
- hard accounting health;
- unchanged B7 source evidence;
- aggregation only after all jobs finish;
- preservation of failed and adverse jobs;
- no threshold changes after observation.

A technical failure yields `TECHNICAL_INDETERMINATE`. It is not an economic result and may only route to repair of the failing diagnostic interface under the same contract.

## Retained sentinels

The following mechanisms remain measured even though they are not dominant child fronts:

- `INPUT_CASH_BUDGET_BINDING`
- `INPUT_SEARCH_EXECUTION_BINDING`
- `DEMAND_INVENTORY_MISMATCH`
- `GOODS_MARKET_MATCHING_BINDING`

A sentinel becoming newly dominant does not authorize an automatic new intervention. It requires a separate preregistration.

## Canonical lock

D0 and all of its children prohibit:

- changing the candidate panel or V/M/W values;
- retuning `V24_M16_C42`;
- changing canonical supplier sampling, prices, wages or C42 procurement rules;
- changing opening cash, wealth, inventories or book values;
- changing household desired budgets, demand plans or inventory targets;
- changing taxes, bank underwriting, trade credit, entry or exit rules;
- changing seeds, scenarios, shock month, horizon or windows;
- deleting a failed job or averaging an adverse panel away;
- relaxing a gate after observing results;
- reversing B6-S3 or B7;
- treating a shadow effect or diagnostic threshold as authorization for canonical mutation.

## Authorized next route

After this preregistration passes its contract gate, the only permitted next implementation front is:

`R4-CU-D3D-B7-D1 supplier-topology and reachable-inventory causal isolation`
