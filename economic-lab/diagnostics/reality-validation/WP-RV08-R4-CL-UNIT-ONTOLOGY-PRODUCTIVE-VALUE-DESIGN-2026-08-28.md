# WP-RV08-R4-CL — Unit Ontology / Productive Value / Aggregate Demand-Supply Scale Audit

Date: 2026-08-28
Mode: shadow diagnostic only
Canonical mutation: **FORBIDDEN**

## Why this gate exists

R4-CJ confirmed an extreme wage/price/output break-even mismatch. R4-CK then showed that even 100× and 300× one-axis algebraic normalization does not restore broad payroll coverage, while physically bounded full-capacity sell-through barely helps. The remaining question is dimensional: are wages, product prices, production quantities and household nominal budgets expressed on mutually coherent scales?

Repository anchors already show a suspicious combination: country initial wages are roughly 82–112 while initial consumer prices are roughly 0.90–1.06; production capacity is computed from workers × productivity × modest capital/human-capital multipliers, so one worker produces on the order of one product unit rather than ~100 units. This audit must quantify the dynamic consequence rather than mutate those anchors.

## Required measurements

Per country-month:

- configured `initialWage`, `initialPrice`, and their ratio;
- active workers and nominal payroll (`workers × wage`);
- actual settled payroll from ledger `wage` postings;
- total output, desired production and capacity;
- current output value (`Σ output × price`);
- capacity value ceiling (`Σ capacity × price`);
- consumer output value and consumer capacity value;
- household `desiredConsumptionBudget` aggregate;
- realized nominal household consumption and unmet budget;
- desired-budget / consumer-output-value ratio;
- desired-budget / consumer-capacity-value ratio;
- settled-payroll / output-value and settled-payroll / capacity-value ratios.

Per firm-month:

- workers, wage, price, output, desired production, capacity;
- output value per worker;
- capacity value per worker;
- wage / output-value-per-worker;
- wage / capacity-value-per-worker;
- payroll / output-value and payroll / capacity-value;
- industry.

## Causal classifications

`DEMAND_NOT_SCARCE` — aggregate household desired budget >= consumer capacity value.

`NOMINAL_PRODUCTIVE_VALUE_BELOW_PAYROLL` — settled payroll exceeds current output value.

`CAPACITY_VALUE_BELOW_PAYROLL` — even capacity × price is below settled payroll.

`UNIT_ONTOLOGY_STRESS` — median wage materially exceeds capacity value per worker.

`DEMAND_SCARCITY_PLAUSIBLE` — desired household budget is below consumer capacity value.

## Hard gates

- exact canonical replay;
- exact diagnostic replay;
- no canonical mutation by audit;
- accounting health;
- exact cash reconciliation for observed firm accounts;
- all four countries observed;
- all four industries observed;
- finite nonnegative value-scale metrics.

## Decision rule

If household desired nominal demand comfortably exceeds consumer capacity value while capacity value per worker remains far below wages, classify the dominant defect as **production/value-unit ontology incoherence**, not demand scarcity. The next phase may then design a coherent dimensional normalization contract, but still must not choose a multiplier ad hoc.

If household desired budget is actually below capacity value in major cohorts, demand formation remains a live co-cause and must be tested factorially before any scale correction.

No canonical coefficient or initialization value changes are authorized in R4-CL.