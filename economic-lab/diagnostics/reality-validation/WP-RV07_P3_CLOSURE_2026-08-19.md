# WP-RV07-P3 Closure — Residual Failure Decomposition

Date: 2026-08-19

## Verdict

**PASS — working-capital timing is a verified residual transmission channel, but not the sole remaining cause.**

This closure is diagnostic only. It does not merge any economic mechanism or parameter change.

## Evidence source

- Workflow run: `32224683094`
- Head: `10c5bb2d93bc0ccf65dd92a4d65738ea89ec1c3c`
- Artifact: `economic-lab-wp-rv07-p3`
- Frozen economic baseline authority: `698d10749e2897d711e5bcee61913ac34e0650a0`

## Hard gates

All passed:

- observer non-interference exact
- long-run health
- complete country-month coverage
- payroll ledger reconciliation
- goods ledger reconciliation
- exact stage coverage
- exact bridgeability coverage

## Verified findings

### A. Price/wage unit-basis candidate still removes the dominant first-order mismatch

The price-wage-basis ablation remains materially different from the frozen control and substantially reduces the original payroll/output mismatch.

This does **not** make the candidate canonical or merge-ready.

### B. Same-month liquidity timing is a real residual channel under the candidate

For the price-wage-basis candidate, baseline scale, 3 seeds × 12 months:

- cash-insufficient consumer-firm payroll events: `300`
- share of those firm events whose payroll shortfall could have been covered by household-goods revenue arriving later in the same month: `0.4467`
- share of cash-insufficient payroll value bridgeable by later same-month household-goods revenue: `0.4643`

The bridgeable share is strongly time-varying:

- M1–3: firm share `0.9091`, payroll-value share `0.9131`
- M4–6: firm share `0.7895`, payroll-value share `0.7714`
- M7–9: firm share `0.5761`, payroll-value share `0.5722`
- M10–12: firm share `0.2754`, payroll-value share `0.3308`

Interpretation: early in the candidate path, many payroll failures are consistent with an intra-month working-capital timing problem. By M10–12, most remaining payroll stress is no longer explainable by timing alone.

### C. The residual failure becomes progressively more structural

For the price-wage-basis candidate at baseline scale:

- mean unemployment rises from `0.0572` in M1–3 to `0.4961` in M10–12
- total exits rise from `0` in M1–3 to `118` in M10–12
- consumer input-shortage / desired-production rises from `0.0031` to `0.1891`
- goods revenue / payroll-settlement due falls from `2.6075` to `0.4536`

Therefore working-capital timing is a verified residual amplifier/channel, but the late-horizon collapse also contains real output/input/revenue weakness.

## Classification

- **A VERIFIED EXISTING FACT:** current monthly execution settles payroll before household-goods revenue.
- **A VERIFIED EXISTING FACT:** under the price-wage-basis candidate, a large share of early cash-insufficient payroll events is bridgeable by later same-month goods revenue.
- **B DIAGNOSTIC LEAD:** an explicit working-capital bridge may remove a material portion of early residual payroll stress.
- **B DIAGNOSTIC LEAD:** late-horizon input shortage and declining revenue coverage require separate diagnosis even if a bridge helps.
- **D PROPOSED CHANGE:** test, without merging, a collateral-constrained same-month payroll working-capital bridge as a causal ablation.

## Next gate

Run WP-RV07-P4 as a paired ablation:

1. `price-wage-basis` control candidate
2. `price-wage-basis + collateralized payroll bridge`

The bridge experiment must be explicit, temporary, accounting-reconciled, bank-capital constrained, and non-calibrated. Outcome improvement is descriptive only; determinism, accounting and health remain the hard gates.
