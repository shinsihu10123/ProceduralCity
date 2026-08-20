# WP-RV07 P36–P39 Expanded Root-Cause Batch — 2026-08-20

## Objective

Increase diagnostic breadth without changing canonical economics. The batch localizes the residual collapse left after P35 by separating four structural dimensions that are currently confounded: exact unit economics, relative-price initialization, intermediate-input dependence, and interaction between price coherence and physical capacity.

## Shared controls

- Base implementation: current `EconomicWorld` v0.10.
- Diagnostic seed transform retained from P2: country `initialPrice = initialWage`; this is an existing diagnostic candidate, not canonical.
- Scales: `compact,baseline`.
- Seeds: `ECON-RV02-A/B/C`.
- Horizon: 12 months.
- Canonical source edits: **0**.
- Fitted coefficients: **0**.
- Any intervention must be derived from existing model quantities or be explicitly labeled a causal upper bound.
- Determinism, health, ledger integrity, GDP identity, coverage and finite-value gates remain mandatory where applicable.

## P36 — Exact Unit-Factor Attribution Audit

Read-only observer installed immediately after canonical `planProduction`.

For each active firm/month record:
- capacity and capacity per worker,
- price/wage ratio,
- input coefficient and current mean supplier price,
- input cost per unit,
- contribution margin per physical output unit,
- payroll obligation,
- break-even capacity and break-even capacity multiplier,
- required price at canonical capacity,
- supported wage at canonical capacity,
- capacity component factors (`productivity`, capital effect, human-capital effect, RESOURCE effect, plan effect),
- whether current price is below input cost and whether canonical capacity is below labor break-even.

Purpose: mathematically locate which term(s) create the unit mismatch before further interventions.

## P37 — One-Time Derived Break-Even Relative-Price Initialization

Causal matrix with sector-target variants. Before month 1, compute each targeted firm's canonical static capacity from its existing workers/productivity/capital/human/resource factors. Set initial price only upward to:

`requiredPrice = inputCostPerOutput + payroll / canonicalCapacity`

For joint variants, derive prices topologically RESOURCE → MATERIALS → CONSUMER so updated upstream price is reflected downstream. No monthly price floor is retained afterward; normal price decisions resume.

Purpose: distinguish an initialization/relative-price defect from a continuing production or feedback defect.

## P38 — Intermediate-Input-Free Causal Upper Bound

Diagnostic upper-bound variants remove intermediate-input dependence for selected downstream sectors by setting firm-level `inputProduct = null` and `inputPerOutput = 0` before simulation. This is intentionally non-realistic and is not a repair candidate.

Purpose: determine the maximum causal contribution of intermediate-input requirements/topology. If even complete removal does not materially improve collapse, input coefficients cannot be the primary residual root.

## P39 — Price × Capacity Interaction Matrix

Four variants:
1. control,
2. derived one-time non-capital break-even initial prices,
3. P35-style non-capital break-even physical capacity normalization,
4. both together.

Purpose: test whether the residual collapse requires interaction between nominal relative-price coherence and physical unit capacity rather than either dimension alone.

## Decision rule

After all four complete:
- If P36 identifies extreme break-even multipliers concentrated in one factor and P37/P39 rescue the macro path, promote that factor chain to root-cause candidate.
- If P38 gives little benefit, demote intermediate-input coefficients as primary cause.
- If P39 combination materially outperforms both single interventions, classify the defect as a coupled unit-system inconsistency rather than one parameter error.
- If all remain insufficient, next batch targets stockout-censored demand beliefs, monthly stage topology and exit/entry propagation interactions.

## Expanded rerun marker — 2026-08-20 12:22 KST

Re-run P36–P39 concurrently against the current diagnostic branch state so their evidence is directly comparable with P49–P54 and the causal-closure cube. This marker changes no model mechanism or parameter.
