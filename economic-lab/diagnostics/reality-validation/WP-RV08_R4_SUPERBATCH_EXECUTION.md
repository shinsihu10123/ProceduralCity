# WP-RV08-R4 — Long-Horizon Propagation Superbatch

Status: **EXECUTION REQUESTED**
Date: 2026-08-20
Canonical mechanism changes authorized: **0**
Fitted parameter tuning authorized: **0**

## Purpose

R3 separates entrant regeneration from aggregate collapse: startup finance can strongly activate entrants, and the bank upper bound can eliminate entrant re-exit, yet 12-month aggregate unemployment remains near the control path. The next diagnostic cycle therefore widens the execution unit rather than advancing through one narrow ablation at a time.

R4 runs four independent but complementary 24-month workstreams in parallel.

## Common basis

- existing RV07/RV08 unit-basis counterfactual (`initialPrice = existing initialWage`);
- compact + baseline scales;
- seeds `ECON-RV02-A/B/C`;
- 24-month horizon;
- deterministic replay and script-native accounting/health gates retained;
- no canonical source merge;
- no external calibration;
- no fitted parameter search.

## R4-A — Residual propagation closure factorial

Script: `residual-propagation-closure-factorial-v10.mjs`

16 variants from:

- capacity basis: CONSUMER vs MATERIALS+CONSUMER;
- supply: canonical vs joint topological/full-cash supply;
- labor: canonical vs no-layoff upper bound;
- exits: canonical vs no-exit upper bound.

This is deliberately an upper-bound decomposition. It identifies how much of long-horizon collapse is mechanically attributable to labor contraction, firm destruction and supply propagation, and their interactions. The no-layoff/no-exit modes are diagnostic ceilings, not admissible production rules.

## R4-B — Solvency-aware propagation matrix

Script: `solvency-aware-propagation-matrix-v10.mjs`

10 variants from:

- CONSUMER vs MATERIALS+CONSUMER normalization;
- canonical propagation;
- financially supportable labor floor;
- objectively viable exit guard;
- labor floor + viable exit guard;
- no-exit upper bound.

This is the production-design-oriented counterpart to R4-A. It asks whether objective operating support and solvency semantics capture a large fraction of the upper-bound gains without deleting layoffs or exits indiscriminately.

## R4-C — Financially supportable labor-demand shadow audit

Script: `financially-supportable-labor-demand-audit-v10.mjs`

Run at 24 months to quantify, by sector and phase:

- canonical planned layoffs;
- contribution-supported workers;
- cash-payroll-supported workers;
- share of firm-months where canonical desired labor lies below conservative support;
- unit economic support after capacity normalization.

This is observation-only. It does not change labor allocation.

## R4-D — Entrant finance × supply long-horizon extension

Script: `rv08-entrant-regeneration-supply-matrix-v10.mjs`

Re-runs the full 8-variant R3 matrix at 24 months. This determines whether the 12-month conclusions are transitional or persistent:

- control;
- priority equity;
- safe-cash equity;
- bank upper bound;

crossed with canonical vs topological/full-cash supply.

## Cross-workstream decision logic

1. If R4-A no-layoff/no-exit upper bounds produce large long-horizon recovery but R4-B objective guards recover most of that gain, admit objective labor/solvency semantics into a repair candidate.
2. If only indiscriminate upper bounds work, do not merge them; decompose the missing operating-support state further.
3. If R4-C shows persistent canonical desired labor below conservative support at high frequency, labor-decision feedback becomes a primary repair target.
4. If R4-D bank/equity effects remain large for entrant survival but small for aggregate unemployment at 24 months, startup finance is retained as a separate regeneration institution rather than treated as a macro stabilization mechanism.
5. If R4-D supply improvements become large only late, carry supply sequencing as a complementary physical repair, not the primary labor repair.

## Required evidence

Each job must preserve its native determinism, health, ledger/accounting, finite-state and arithmetic-identity gates. Artifacts or logs are retained separately so a failure in one workstream does not erase evidence from the others.

## R4 verdict rule

R4 may close **PASS** if all four workstreams complete and permit a bounded causal ranking of:

- labor-demand propagation;
- exit/solvency propagation;
- physical supply propagation;
- entrant regeneration finance.

A successful R4 does **not** itself authorize production merge. It authorizes construction of the first coherent repair candidate and held-out validation plan.
