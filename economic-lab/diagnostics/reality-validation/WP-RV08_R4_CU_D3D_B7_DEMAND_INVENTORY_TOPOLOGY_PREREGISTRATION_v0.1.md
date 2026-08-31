# WP-RV08 R4-CU-D3D-B7 Demand–Inventory Topology and Value-Transformation Diagnosis Preregistration v0.1

## Decision status

**DIAGNOSTIC FRONT FROZEN / B6-S3 FAILURE RETAINED / NO CANDIDATE RETUNING / CANONICAL MUTATION NOT AUTHORIZED**

## Dependency checkpoint

R4-CU-D3D-B6-S3 completed all 12 technical jobs but failed the frozen long-horizon and stress eligibility surface. The authoritative closure is:

- closure commit: `ab50c676947a6215a7d58acce9302cda5fb02611`;
- source run: `33362894408`;
- aggregate artifact: `9747330570`;
- decision: `LONG_HORIZON_OR_STRESS_VALIDATION_FAILED_NO_RETUNING`;
- next required front: `R4-CU-D3D-B7 demand-inventory topology and value-transformation diagnosis`.

B7 does not reopen B6 candidate selection. It observes the failed S3 panel to identify the temporal and accounting sequence that produces the terminal collapse.

## Frozen diagnostic panel

B7 replays exactly the S3 panel:

- canonical control: `V1_M1_C42`;
- failed long-horizon primary diagnostic probe: `V24_M16_C42`;
- seeds: `ECON-RV08-LONG-G`, `ECON-RV08-LONG-H`;
- scenarios: `BASELINE_36`, `SUPPLY_SHOCK_M13`, `FINANCIAL_CONFIDENCE_STRESS_M13`;
- horizon: 36 months;
- jobs: `2 candidates × 2 seeds × 3 scenarios = 12`.

The scenario schedules and candidate values remain byte-for-byte identical to B6-S3.

## Diagnostic questions

B7 distinguishes six non-exclusive mechanism labels:

1. **Input supplier-topology binding** — compatible suppliers or physically reachable inventory are insufficient.
2. **Input cash-budget binding** — compatible stock exists, but the frozen C42 cash envelope cannot purchase it.
3. **Input search/execution binding** — stock and cash are sufficient in the full compatible set, but realized supplier sampling or settlement leaves residual shortage.
4. **Demand–inventory mismatch** — planned production remains high relative to realized sales while finished inventory sits materially above target, without severe input shortage.
5. **Goods-market matching binding** — household budget remains unmet while consumer inventory still exists, or clearing stops because of seller sampling/round limits.
6. **Value-transformation binding** — throughput occurs but price-to-book-cost, COGS, inventory valuation or GVA transformation produces non-positive value added.

The labels may form a sequence. B7 does not force a single-mechanism answer.

## Read-only observer contract

The observer may wrap existing methods only to record inputs and outputs. It may not alter return values, world fields, decisions, prices, wages, inventories, cash, ledgers, RNG state, scenario schedules or candidate values.

The observer records:

- production demand anchors, expected demand, replenishment, desired production and capacity;
- compatible supplier count, inventory, concentration, top share and prices;
- planned input need, actual purchases and observed shortage;
- shortage attribution into topology, cash-budget and residual search/execution components;
- household desired budget, realized consumption, remaining inventory and clearing-stop reasons;
- sales revenue, COGS, input consumption, labour accrual, inventory book change and both GVA approaches;
- price/book-unit-cost and below-cost exposure;
- sector and country-month aggregates.

Every job is executed twice by the existing B6 diagnostic engine. B7 observer output must also reproduce exactly across both executions.

## Attribution identities

For every buyer-month:

`observed input shortage`

`= topology-attributed shortage`

`+ cash-budget-attributed shortage`

`+ search/execution-attributed shortage`.

The decomposition is ordered and conservative:

1. physical compatible-stock deficit;
2. remaining deficit explainable by the C42 budget under sorted compatible supplier prices;
3. residual realized-procurement deficit.

This attribution is diagnostic and does not claim a canonical counterfactual policy.

For value transformation, production-side and income-side GVA must reconcile within the existing diagnostic tolerance.

## Frozen windows

B7 reports:

- `FULL_36`: months 1–36;
- `PRE_SHOCK_12`: months 1–12;
- `TRANSITION_12`: months 13–24;
- `TERMINAL_12`: months 25–36.

Mechanism onset requires two consecutive classified months. Dominance requires the label to appear in at least half of the relevant terminal panels. These are classification thresholds, not empirical calibration targets.

## Aggregate decision

The aggregate produces:

- per-candidate, per-seed, per-scenario and per-window continuous metrics;
- paired primary-minus-control contrasts;
- sustained onset month for each mechanism;
- terminal-panel frequency;
- a temporal mechanism sequence;
- the dependency-safe next diagnostic front.

Possible decisions are:

- `SINGLE_DOMINANT_MECHANISM_IDENTIFIED`;
- `SEQUENCED_MULTIPLE_MECHANISMS_IDENTIFIED`;
- `NO_SINGLE_MECHANISM_DOMINANT_CONTINUOUS_EVIDENCE_ONLY`.

No B7 decision authorizes canonical mutation.

## Canonical lock

B7 prohibits:

- changing `V24`, `M16` or `C42`;
- adding a new candidate;
- changing seeds, scenarios, months or windows;
- changing inventory targets, supplier sampling or goods clearing before measurement;
- changing prices, wages, household desired budgets, cash, taxes, bank underwriting or credit rules;
- relaxing the diagnostic classification thresholds after observing results;
- treating an external empirical band as a direct parameter target.
