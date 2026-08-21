# WP-RV08 R4-X — Post-Restructure Realized Payroll Coverage Audit

Date: 2026-08-21
Mode: **ACTUAL EXECUTION — DIAGNOSTIC ONLY**
Canonical mechanism merge: **PROHIBITED**
Parameter tuning: **PROHIBITED**
Empirical realism claim: **PROHIBITED**

## Admission basis

R4-O/P and held-out S show that operating/multi restructuring materially lowers exits and unemployment but increases total wage arrears. Early R4-V decomposition shows that the incremental arrears penalty is not primarily detached former-worker claims: operating/multi rules reduce the unemployed/orphan arrears share while total arrears rise. Repeated restructuring is also common.

The next dependency-safe question is therefore whether the workforce retained by the operating-support rule is actually supported by realized post-restructure payroll cashflow in the following months.

## Design

R4-X reproduces the operating-rule restructure-vs-liquidate diagnostic without estate recycling or supply relief, isolating labor/operating coherence.

For each restructure event, a six-month cohort follows the same firm and records:

- retained workers and wage;
- base payroll obligation;
- actual payroll paid to currently linked workers;
- payroll-paid / base-payroll coverage;
- realized operating contribution (`revenue - inputSpend`) / payroll coverage;
- firm cash / payroll coverage;
- currently linked household wage arrears;
- physical output and sales;
- input shortage;
- distress state;
- restructure recurrence.

No wage claim is written off or serviced by a new mechanism. No workforce rule is changed beyond reproducing the already-admitted operating restructure diagnostic.

## Execution matrix

Baseline scale, 36 months, one seed per job:

Original:
- ECON-RV02-A
- ECON-RV02-B
- ECON-RV02-C

Held-out:
- ECON-RV08-HOLDOUT-D
- ECON-RV08-HOLDOUT-E
- ECON-RV08-HOLDOUT-F

Each job evaluates both CONSUMER and MATERIALS+CONSUMER normalization bases.

## Hypotheses

- H-X1: post-restructure realized operating contribution remains below retained payroll for a large share of cohorts.
- H-X2: actual payroll coverage remains below one and linked-worker arrears remain positive after restructuring.
- H-X3: firms that repeatedly return to restructuring show persistent post-event coverage deficits rather than only detached legacy claims.
- H-X4: if post-restructure coverage is broadly adequate, then the arrears penalty must instead come from another settlement/order mechanism and the current frontier must be revised.

## Hard gates

- exact observer non-interference;
- deterministic replay;
- health;
- requested run coverage;
- normalization activation;
- restructure-event activation;
- at least age-1 and age-3 follow-up coverage;
- ledger integrity;
- general accounting integrity;
- GDP arithmetic identity;
- finite cohort metrics.

## Interpretation boundary

This is a causal audit of the existing diagnostic restructuring rule, not a production repair. Even if the audit identifies a better shadow workforce size, no rule may be merged until it survives original/held-out and long-horizon arrears-discipline validation.