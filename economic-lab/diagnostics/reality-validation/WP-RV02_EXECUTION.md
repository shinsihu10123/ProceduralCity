# WP-RV02 — Baseline Reproduction & Compute Envelope

Status: EXECUTION REQUESTED
Date: 2026-08-18

## Frozen economic semantics

Economic Model Frozen Baseline remains commit `698d10749e2897d711e5bcee61913ac34e0650a0`.

This work package does not alter economic mechanisms or tune parameters.

## Execution scopes

1. R0 compact reproduction: 3 deterministic seeds × 36 months.
2. R1 baseline compute envelope: same 3 deterministic seeds × 36 months.

Both runs use the WP-RV01 read-only diagnostic recorder and require:

- v0.10 health gate PASS
- diagnostic reconciliation PASS
- complete country-month coverage
- labor stock-flow reconciliation
- GDP expenditure identity reconciliation
- firm-exit count reconciliation
- finite diagnostic state
- runtime and memory evidence

## Diagnostic refinements

The WP-RV02 runner independently records observed unemployment spells with left-censor flags so agents already unemployed at observation start are not treated as known-duration spells.

It also captures firm state immediately before each monthly simulation transition and reconciles firms that become inactive after the step, preserving a pre-exit snapshot for later WP-RV04 attribution work.

## Promotion rule

R2/R3 are not admitted automatically. R0/R1 runtime, memory, health, and evidence completeness must first be audited.
