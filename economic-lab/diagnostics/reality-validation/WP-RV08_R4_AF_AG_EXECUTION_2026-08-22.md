# WP-RV08 R4-AF / R4-AG — Labor Target Formation, Matching and Transition-Speed Audit

Date: 2026-08-22  
Status: EXECUTING  
Mode: ACTUAL DIAGNOSTIC EXECUTION / NO CANONICAL REPAIR

## 1. Dependency state

R4-AD and R4-AE are closed PASS diagnostics.

R4-AD established that plan-economically viable CONSUMER firms usually have only about 20–31% of the workforce required by the unconstrained demand/inventory production plan, and that workforce/capacity is the first production-execution loss in roughly 67–87% of viable observations.

R4-Y/Z already established that forcing employment to the physical production need is not a sufficient repair because it raises output/employment while generating very large current-worker wage arrears.

Therefore the next question is not "hire more workers". The next causal question is **where the workforce deficit comes from and whether the canonical adjustment clock is dynamically compatible with the firm's distress clock.**

## 2. R4-AF question — target formation versus matching

For each plan-viable firm-month, decompose physical workforce deficit into:

- **target-formation deficit**: physical workers required minus canonical `desiredWorkers`;
- **matching deficit**: canonical `desiredWorkers` minus actual workers obtained after the labor market;
- coherent remainder.

Primary hypotheses:

- **H-AF1:** the majority of the CONSUMER workforce deficit is already present in `desiredWorkers` before labor-market matching.
- **H-AF2:** labor-market matching is the primary source of the deficit even when the canonical target is physically adequate.

The script hard-checks the existing canonical target formula:

`desiredWorkers = round(max(1, workers) × (1 + clamp(hiringChange, -0.10, +0.12)))`

No target is altered by the audit.

## 3. R4-AG question — transition speed versus distress window

Canonical upward staffing adjustment is bounded at +12% per month and is based on current workforce, while canonical liquidity/credit distress produces exit after four distress months.

For every plan-viable firm-month the audit therefore computes:

- current workforce;
- current canonical target;
- physical workers implied by the production plan;
- months required to reach the physical workforce if staffing could compound at the full +12% upper bound every month;
- whether the gap can close within 4 months;
- whether it requires more than 8 months;
- how often the firm's AI plan is already hitting the +12% hiring bound.

Primary hypotheses:

- **H-AG1:** a large share of plan-viable CONSUMER observations cannot physically close the staffing gap within the four-month distress window even under continuous maximum upward adjustment.
- **H-AG2:** the staffing transition is fast enough that distress/exit timing is not structurally relevant.

## 4. Isolation

The audit is observational/read-only apart from the already-established diagnostic productive normalization and the previously defined diagnostic restructure comparison mode.

It does **not** change:

- wage levels;
- `desiredWorkers`;
- labor matching probability or hiring capacity;
- prices;
- procurement budgets;
- credit underwriting;
- payroll settlement;
- tax rules;
- canonical exit thresholds.

The exact diagnostic labor runtime path is allowed because prior equivalence testing established bit-exact state equivalence.

## 5. Matrix

12 independent shards:

- mode: canonical / diagnostic restructure;
- seed: original A / original C / held-out E;
- normalization: CONSUMER / MATERIALS+CONSUMER;
- horizon: 18 months.

Artifact retention: 90 days. Closure-grade compact evidence will be committed into the repository after synthesis.

## 6. Hard gates

- health PASS;
- complete matrix coverage;
- productive normalization active;
- canonical target formula exact at every captured observation;
- ledger integrity;
- general accounting integrity;
- GDP arithmetic identity;
- target observations present;
- CONSUMER plan-viable observations present;
- finite summary metrics.

## 7. Interpretation rule

If target-formation deficit dominates while actual/target matching is relatively high, the next frontier becomes production-informed labor planning and transition architecture, not labor-market matching.

If matching deficit dominates after an adequate target is formed, the next frontier returns to labor-market hiring-capacity/search/friction mechanics.

If the physical staffing gap generally requires materially longer than four months even at +12% growth, staffing-transition speed and distress/exit timing form a structural dynamic incompatibility that must be addressed before any production labor rule can be promoted.

No canonical repair merge is authorized by this execution document.