# WP-RV07-P31 — Variable-Cost Price-Floor Causal Upper-Bound

## Purpose

P30 is a read-only feasibility test. P31 runs in parallel as a deliberately strong causal upper bound: if sector prices below optimistic variable cost are a major source of the objective cash deficit, preventing such underpricing should materially alter cash stress, employment, output and exits.

## Candidate

After canonical labor clearing and canonical `planProduction`, before procurement and product-market clearing, process the acyclic industry chain in order:

1. RESOURCE
2. MATERIALS
3. CAPITAL
4. CONSUMER

For each active firm with positive capacity, compute:

- labor cost per capacity unit = `wage * workers / capacity`;
- required input cost per output = `inputPerOutput * current mean upstream supplier price`;
- diagnostic variable-cost floor = their sum.

Set only the same-month transaction price to `max(current price, diagnostic floor)`. Upstream prices already floored in the current pass are used for downstream floors.

No wage, productivity, input coefficient, labor target, procurement budget, supplier matching, credit rule, exit rule or accounting formula is changed.

## Interpretation boundary

This is **not** a viable pricing rule and not a calibration target. It can create large price changes and demand-side effects. A positive result establishes causal importance of underpriced variable cost; a negative result rejects a simple cost-covering price fix.

## Hard gates

Deterministic replay, health, complete coverage, intervention activation, exact floor satisfaction, ledger integrity, GDP identity, finite rows.

Canonical mechanism changes: 0. Parameter tuning: 0. Repair authorization: NO. Empirical realism claim: NO.