# WP-RV07-P5 — Supply-Chain Bottleneck Decomposition

Status: EXECUTION

## Purpose

Diagnose the residual deterioration that remains after the experimental WP-RV07 price/wage unit-basis correction. WP-RV07-P4 rejected same-month payroll bridging as a dominant repair candidate, while input shortages increased materially after the early window.

This WP is **diagnostic only**. It does not alter canonical economic mechanisms or tune parameters.

## Scope

- scales: compact, baseline
- seeds: ECON-RV02-A / B / C
- horizon: 12 months
- candidate basis: WP-RV07 price-wage unit basis, still non-canonical
- canonical mechanism changes: 0
- canonical parameter tuning: 0

## Existing mechanisms under observation

The current supply-chain implementation performs:

1. production planning;
2. input procurement from inventory already available at the procurement boundary;
3. production;
4. later final-demand markets.

Input procurement currently limits each buyer to `42%` of its current cash and at most five supplier-search rounds. Suppliers' current-month output is created only **after** the procurement stage.

P5 does not assume any of these mechanisms is wrong. It measures which constraints are actually binding.

## Required decomposition

For every input-using firm and month, record without changing simulation state:

- required input implied by desired production;
- input inventory on hand before procurement;
- net starting input need;
- buyer cash and existing procurement budget;
- sellable supplier inventory at procurement boundary;
- cheapest observed supplier price;
- affordability upper bound under the existing budget;
- actual units procured and spend;
- remaining supply shortage;
- output possible without the input constraint;
- exact output possible with procured input;
- actual output;
- output lost to the input constraint.

Aggregate by input product, especially `processed_material`, and measure current-month upstream supplier output that becomes available only after procurement.

## Diagnostic classifications

A buyer case may be tagged as:

- **definitely physical-stock insufficient**: available supplier stock is below the buyer's starting need;
- **definitely budget insufficient**: even buying at the cheapest currently sellable supplier price, the existing 42%-cash budget cannot cover starting need;
- **upper bounds could cover but shortage remains**: neither necessary upper bound explains the shortage, leaving allocation/search/order effects as a lead.

These tags are necessary-condition diagnostics only. They are not causal proof.

## Hard gates

P5 PASS requires:

- exact observer non-interference on compact and baseline replay;
- all world health checks pass;
- complete 3-seed × 12-month × 4-country coverage;
- procurement stock-flow reconciliation;
- production/input constraint reconciliation;
- `country.lastIndustry.inputShortageUnits` reconciliation;
- sector-output reconciliation;
- finite diagnostic metrics.

Economic outcomes do not determine the hard-gate result.

## Promotion rule

After P5:

- if a single structural bottleneck is strongly supported, construct one bounded causal ablation for that bottleneck;
- if multiple channels remain material, decompose further before repair;
- do not merge the unit-basis candidate or any new repair into canonical implementation until the repair chain passes accounting, determinism, multi-seed and held-out validation gates.
