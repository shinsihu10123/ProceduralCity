# WP-RV07 P55–P57 Exit / Regeneration Batch — 2026-08-20

## Why this batch

P43/P47 established that exit displacement is the dominant late unemployment amplifier. P48/P49 established persistent unemployment and weak productive replacement. Canonical source now confirms an additional structural fact: after a country-month's complete `exitIndustries` list is recorded, replacement entry is executed only for `exitIndustries.slice(0, 2)`. Thus at most two canonical entrants are created per country-month even when many firms exit in that country-month.

This batch separates the **replacement-count cap**, **entrant physical bootstrap**, and **real-side capacity feasibility**.

## Shared controls

- Existing P2 diagnostic unit basis (`initialPrice = initialWage`).
- `compact,baseline`; seeds `ECON-RV02-A/B/C`; 12 months.
- Canonical source edits: **0**.
- Fitted scalar tuning: **0**.
- Physical entrant bootstraps remain diagnostic upper bounds and are not accounting-complete repairs.

## P55 — Exact Exit-to-Entry Replacement Deficit Audit

Read-only.

For every country-month record:
- exits,
- canonical entries,
- `exitIndustries` full list,
- first two industries that receive canonical replacement,
- omitted replacement count `max(0, exits - 2)`,
- omitted replacement industries,
- active-firm count and cumulative active-firm loss.

Aggregate the share of exits not replaced by the canonical count rule and its timing/sector composition.

## P56 — Replacement Regeneration 2×2×2 Cube

Three diagnostic factors:

1. non-capital break-even capacity normalization,
2. full one-for-one replacement count,
3. entrant intermediate-input physical bootstrap.

`full replacement` reuses canonical `createEntrant`; inside the diagnostic exit wrapper, every exit beyond the canonical first two gets one additional entrant of the same industry immediately before the canonical first-two replacement loop executes. Thus the only count difference is `exitIndustries.slice(2)`.

`input bootstrap` gives a new downstream entrant the median positive same-industry intermediate-input units currently held by active peers; cash remains zero and no financial book value is created. This is a physical causal upper bound only.

Question: does one-for-one replacement, combined with the already-identified physical startup requirement and capacity feasibility, materially close the late exit hysteresis?

## P57 — Entrant Finance / Working-Capital Lifecycle Audit

Read-only control + capacity variants.

For every entrant by age record:
- cash,
- workers / desired workers,
- input inventory / input spend,
- output / revenue,
- wage arrears,
- loan balance,
- active loans whose borrower is the entrant,
- first positive-loan month,
- first positive-cash month,
- first positive-input-spend month,
- first positive-revenue month.

Purpose: determine whether zero-cash downstream entrants obtain working capital through the canonical banking layer or remain physically/financially stranded.

## Decision rules

- Large P55 omitted-replacement share promotes the replacement-count cap to a verified persistence mechanism.
- Strong P56 full-replacement effect without input bootstrap => count cap dominates.
- Strong effect only with count + input bootstrap => replacement quantity and physical startup are jointly required.
- Even the full P56 triple remaining weak => financial bootstrap / revenue access is the dominant regeneration bottleneck.
- P57 low entrant credit access plus persistent zero cash supports working-capital finance as the next entrant-specific causal target.
