# WP-RV07 P53–P54 Accelerated Planner Batch — 2026-08-20

## Why this batch

P50 aligned the firm counterfactual audit to the model's own effective horizons and still found large, strategy-dependent forecast errors. In baseline control, RESOURCE/MATERIALS expansion plans substantially overpredict revenue, while defensive plans frequently underpredict future cash and sometimes realized revenue. This is an internal model-consistency problem, not an empirical calibration claim.

P53–P54 separate **which counterfactual components create the ranking** from **whether the cognitive firm planner is causally amplifying the collapse**.

## Shared controls

- Existing P2 diagnostic unit basis only (`initialPrice = initialWage`).
- `compact,baseline`; seeds `ECON-RV02-A/B/C`; 12 months.
- Canonical source edits: **0**.
- Fitted coefficients: **0**.
- Empirical realism claim: **NO**.

## P53 — Firm Counterfactual Component Decomposition

Read-only observer immediately after firm decisions / credit origination.

For every candidate in every firm decision reconstruct the canonical base-scenario cash mechanics from trace and current state:

- projected revenue,
- projected workers,
- wage cost,
- production-cost proxy,
- expected operating cash flow,
- cash projection horizon multiplier,
- reconstructed projected cash,
- distress risk,
- cognitive utility / expected utility.

For the selected plan, compare all components with the `유지` candidate and aggregate by sector / selected strategy.

Hard gate: reconstructed projected cash must match the canonical baseOutcome projected cash to floating-point tolerance.

Question: are plan rankings dominated by projected demand/revenue, labor cost, the production-cost proxy, or risk/utility terms?

## P54 — Firm Cognitive Planner Bypass × Capacity

2×2 causal upper-bound matrix:

1. unit-basis control,
2. firm cognitive planner bypass,
3. non-capital break-even capacity,
4. capacity + firm cognitive planner bypass.

Bypass sets **firm cognition only** to disabled before the simulation (and for canonical entrants), causing the already-existing `legacyFirmDecision` branch to execute. Household, bank, government, central-bank cognition and all settlement/accounting/market mechanisms remain unchanged.

This is not a repair candidate: legacy behavior is only a causal comparator.

Decision rule:
- large macro improvement under planner bypass => current cognitive planner is a major behavioral amplifier;
- little change => planner forecast errors are diagnostically real but not the collapse's main causal channel;
- strong interaction with capacity => planner errors become important once real-side feasibility is improved.
