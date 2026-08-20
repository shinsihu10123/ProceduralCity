# WP-RV07 P45–P47 Accelerated Root-Cause Batch — 2026-08-20

## Why this batch now

P41–P43 materially narrowed the residual collapse:

- firms enter decisions after `supply.beginMonth` has reset `f.supplyShortage = 0`, so cognitive `supplyStress` is mechanically zero at decision time;
- suppressing planned layoffs lowers baseline pooled unemployment from about 25.1% to 21.4%, but raises arrears;
- suppressing firm exits lowers baseline pooled unemployment to about 12.4%, with the effect concentrated from M7 onward;
- break-even capacity plus exit suppression lowers pooled unemployment to about 11.8%.

The next fastest path is to test the missing supply-stress state directly, audit whether the firm counterfactual plan is systematically misaligned with realized outcomes, and run a three-factor causal-closure upper bound.

## Shared controls

- Existing P2 diagnostic unit basis only (`initialPrice = initialWage`).
- Scales `compact,baseline`; seeds `ECON-RV02-A/B/C`; 12 months.
- Canonical source edits: **0**.
- Fitted coefficient tuning: **0**.
- Every intervention is diagnostic only.

## P45 — Prior-Month Supply-Stress Visibility × Capacity

Matrix:
1. control,
2. prior-supply-stress visible at firm decision,
3. non-capital break-even capacity,
4. capacity + prior-supply-stress visible.

Intervention: immediately before canonical `supply.beginMonth`, save each firm's previous `supplyShortage`. Call canonical begin-month reset, then restore that saved shortage only until the current firm's decision has been made. Current-month procurement later overwrites shortage canonically. This changes no settlement, output, price, wage, or inventory rule directly.

Question: does the current reset ordering materially distort firm strategy and labor demand?

## P46 — Firm Counterfactual Projection vs Realized Outcome Audit

Read-only observer. At firm decision time capture:
- selected plan,
- selected candidate base projected revenue, projected cash, distress risk,
- cash, workers, wage, previous sales, price, sector.

After the monthly step capture:
- realized revenue,
- end cash and cash change,
- output/sales,
- wage arrears,
- exit state.

Aggregate projection error by sector and selected strategy. This is an internal model-consistency audit, not empirical calibration.

## P47 — Causal-Closure Upper-Bound Cube

Full 2×2×2 matrix over:
- non-capital break-even physical capacity,
- no planned labor-market layoffs,
- no firm exit transition.

The triple upper-bound answers whether the already identified channels account for nearly all endogenous unemployment above the initial baseline. No-layoff does not force new hiring; no-exit suppresses only the exit boundary; capacity reuses P35.

## Decision rules

- Strong P45 effect: supply-state reset is promoted to causal behavioral defect.
- Large systematic P46 projection errors concentrated in RESOURCE/MATERIALS defensive plans: firm counterfactual cash-flow model becomes next repair target.
- P47 triple approaching initial unemployment: unit feasibility → planned labor contraction → exit displacement is sufficient as the dominant collapse chain.
- P47 triple still materially high: residual must be localized to vacancy generation/hiring rules, stage topology, or other firm decision state.
