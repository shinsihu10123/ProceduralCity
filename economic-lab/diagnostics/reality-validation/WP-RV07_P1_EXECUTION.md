# WP-RV07-P1 — Unit-Economics / Wage-Output Coherence Audit

Status: **EXECUTION REQUESTED**
Date: 2026-08-19

Frozen economic baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes authorized: **0**.
Parameter tuning authorized: **0**.

## Admission

WP-RV07-P0 passed and verified a scale-invariant household-goods shortage at both compact and baseline scales. The shortage exists from month 1, is not explained by intermediate-input shortage, and is not solely caused by government demand.

P1 tests the promoted structural lead directly: whether contractual payroll and household purchasing-power scale are incompatible with physical output valued at the frozen model prices.

## Experiment

- scales: compact, baseline
- seeds: ECON-RV02-A, ECON-RV02-B, ECON-RV02-C
- horizon: 3 months
- runner: `economic-lab/scripts/unit-economics-audit-v10.mjs`

## Measurements

At the exact production boundary and after settlement:

- active workers;
- contractual payroll obligation (`wage × workers`);
- physical output units;
- physical output value at current model prices;
- actual payroll transferred through the ledger;
- realized firm revenue;
- pre-payroll firm cash runway;
- consumer-sector and whole-economy ratios.

## Hard gates

- exact observer non-interference;
- all v0.10 health gates;
- complete scale × seed × country × month coverage;
- exact wage-ledger reconciliation to `lastMarkets.payroll`.

The ratio values themselves are measurements, not pass/fail targets. No coefficient is changed to force a desired ratio.

## Decision rule

If the payroll/output-value mismatch is large, immediate, scale-invariant and ledger-reconciled, WP-RV07 may promote **unit-coherence repair** as a structural candidate. The next stage must still use an explicit ablation and held-out validation; it may not tune a coefficient until the collapse disappears.
