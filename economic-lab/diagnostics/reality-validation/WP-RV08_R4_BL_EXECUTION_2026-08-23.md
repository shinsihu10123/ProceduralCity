# WP-RV08 R4-BL — Firm Regeneration Capacity Ablation

Date: 2026-08-23
Mode: DIAGNOSTIC CAUSAL ABLATION
Status: EXECUTION CONTRACT

## Structural lead

Canonical `world.js` receives the full list of exit industries but creates replacement entrants for only `exitIndustries.slice(0, 2)` in each month. Therefore more than two same-month exits mechanically reduce the active-firm population even before entrant quality is considered.

Entrants themselves are created with zero workers, zero cash, zero finished inventory and zero capital in the base factory, so replacement count and replacement quality must be distinguished.

## Question

Is the per-month replacement cap a major cause of long-run firm-population loss, or does collapse persist even when every exit receives a same-month zero-resource replacement entrant?

## Matrix

Seeds: original A, original C, heldout E, heldout F.

Variants:
- `control`: canonical replacement cap (max two entrants per month)
- `full-replacement`: for exit events beyond the first two, create additional canonical entrants for every remaining exited industry; the normal world path still creates the first two.

Horizon: 24 months.

Total: 8 simulations.

## Invariants

The full-replacement variant does not alter entrant initialization, prices, wages, credit underwriting, payroll, production, taxes, goods matching, bankruptcy criteria, or accounting. Extra entrants use the existing `createEntrant` path.

## Outcomes

- actual exit count from active-state transitions
- actual entrant births from firm-ID additions
- terminal active firms
- unemployment
- output / GDP
- wage arrears
- entrant workers / output / revenue
- replacement ratio

## Interpretation

If active-firm count is restored but employment/output still collapse, the cap is a propagation amplifier rather than a root cause. If full replacement materially stabilizes the macroeconomy, firm regeneration capacity becomes a high-priority architecture candidate, still subject to entrant-quality validation.

No canonical repair is authorized.
