# WP-RV08 R4-AU / R4-AV / R4-AW Execution Contract

Date: 2026-08-22
Mode: diagnostic-only broad ecosystem audit
Workflow: `.github/workflows/economic-lab-rv08-r4-au-aw-ecosystem-audit.yml`
Script: `economic-lab/scripts/rv08-economic-ecosystem-structural-audit-v10.mjs`

## Purpose

The collapse investigation is widened from local economic mechanisms to the coherence of the simulated economy as an ecosystem. The key question is whether the world is initialized as a mature economy without the prehistory, relationships, stocks/flows and timescale consistency necessary to sustain that apparent maturity.

This work package does not assume cold start is the root cause. It tests whether cold-start inconsistency is a root, an amplifier, or merely a representation issue.

## R4-AU — Initial-State Coherence Census

At month 0, capture:

- households, firms, commercial banks, governments and central banks;
- employed household-agents, firm worker slots and desired workers;
- firm cash relative to one payroll;
- finished-goods inventory with zero contemporaneous output/sales/revenue;
- input-using firms with zero input inventory;
- positive installed capital;
- zero firm/household loan history;
- placeholder `previousSales=1` and null current plans;
- employed household-agents with zero current income;
- initial belief-state diversity;
- ownership/age/lifecycle/relationship/contract field presence;
- opening public debt, public capital, policy rate, asset-market and external-position state.

The purpose is to separate a coherent inherited state from a collection of independently seeded stocks.

## R4-AV — Cold-Start Concentration Audit

Run 24 months and compare four windows:

- months 1–3,
- months 4–6,
- months 7–12,
- months 13–24.

Measure where exits, credit creation, defaults, arrears, unemployment, output loss, input shortages, unmet demand, transfers, debt and external imbalances concentrate. Compute the share of all exits and new credit occurring in the first six months.

If a disproportionate share of collapse occurs immediately after initialization, a prehistory/maturity diagnostic becomes justified. If the collapse mainly develops later, cold start is an amplifier rather than the principal mechanism.

## R4-AW — Feedback Propagation Audit

For each country, capture threshold-crossing months and lagged associations:

- first unemployment ≥20%,
- first unemployment ≥40%,
- first active-firm count ≤75% of opening count,
- first positive wage arrears,
- prior-month exits → change in unemployment,
- prior-month arrears → next-month exits,
- exits ↔ unemployment.

These are diagnostic propagation measures, not causal proof by themselves. They are interpreted together with the already established intervention/ablation evidence.

## Experimental matrix

Four seeds:

- original A (`ECON-RV02-A`)
- original C (`ECON-RV02-C`)
- held-out E (`ECON-RV08-HOLDOUT-E`)
- held-out F (`ECON-RV08-HOLDOUT-F`)

Four bases:

- `raw`: repository-native wage/price units and original productive structure;
- `unit`: only initial price is placed on the same nominal scale as initial wage;
- `consumer`: unit normalization plus prior CONSUMER productive normalization diagnostic;
- `materials-consumer`: unit normalization plus MATERIALS+CONSUMER productive normalization diagnostic.

Total: **16 independent 24-month shards**.

This design is intentional. It allows the audit to distinguish defects that exist in the repository-native world from defects that remain after previously discovered unit/productivity problems are partially neutralized.

## Hard interpretation rules

- Raw collapse is not proof of cold-start causality because the known nominal-scale defect is present.
- A cold-start finding is strongest if it persists under `unit`, `consumer` and `materials-consumer` diagnostic bases.
- Correlations are leads; existing ablations/interventions remain the causal standard.
- A healthy-looking lower-arrears state is not a pass if GDP/output simply collapse more quickly.
- Accounting PASS does not imply economic realism.
- No initialized stock is declared unrealistic merely because it lacks history; materiality must be shown.

## Gates

Every shard records:

- ledger consistency,
- general accounting consistency,
- GDP arithmetic identity,
- long-run health result,
- complete 24-month output artifact.

A failed economic-health state remains useful diagnostic evidence if the execution and accounting gates remain valid; it is not silently discarded.

## Next dependency

If AU/AV/AW finds a strong first-6-month discontinuity that remains after nominal/productive normalization, the next dependency-safe experiment is **R4-AX Prehistory / Maturity Sensitivity**. That experiment must use explicitly diagnostic prehistory states and must not be described or merged as a production repair.
