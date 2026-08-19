# WP-RV07-P3 — Candidate Residual Failure Decomposition

Status: **EXECUTION REQUESTED**
Date: 2026-08-19

## Admission

- P0: stock-flow scale audit PASS.
- P1: nominal/physical unit mismatch VERIFIED.
- P2: `price-wage-basis` is a VIABLE STRUCTURAL CANDIDATE but NOT READY TO MERGE.

P3 is dependency-safe and diagnostic-only.

## Frozen economic semantics

Frozen baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Canonical economic mechanism changes: **0**.
Canonical parameter tuning: **0**.
Candidate merge authorization: **NO**.

## Corrected execution-order fact

The live domestic `stepCountry` order is:

1. debt service / fiscal begin;
2. firm plan;
3. credit origination;
4. labor clearing;
5. production planning / input procurement / production;
6. wage accrual and payroll settlement;
7. income tax / automatic transfers;
8. investment market;
9. household goods market;
10. settlement ingestion;
11. consumption tax;
12. government final demand;
13. corporate tax;
14. accounting close / firm exit evaluation.

Therefore **household goods revenue arrives after payroll settlement**. Government final demand is also after the household goods market in the current live code; P3 treats any earlier “government pre-emption” interpretation as superseded by this direct execution-order verification.

## Primary discriminating question

After P2 removes most of the initial wage/output unit mismatch, are residual payroll arrears generated because firms must fund payroll from cash/credit **before** same-month household-sales revenue arrives?

This is a working-capital sequencing hypothesis, not yet a finding.

## Paired panel

- variants: frozen control + `price-wage-basis` candidate
- scales: compact + baseline
- seeds: `ECON-RV02-A/B/C`
- horizon: 12 months
- runner: `economic-lab/scripts/candidate-residual-failure-diagnosis-v10.mjs`

## Read-only intra-month boundaries

P3 records:

- pre/post credit cash;
- pre/post input procurement cash and shortage;
- post-production output;
- pre-payroll cash and exact settlement due including arrears catch-up;
- post-payroll cash and wage arrears;
- post-investment cash;
- post-household-goods cash/revenue;
- post-government-demand cash;
- pre/post exit state.

For each consumer firm, P3 also tests whether a pre-payroll cash deficit would have been bridgeable by household-goods revenue received later in the same month. This counterfactual is descriptive only; it does not move transactions or rerun a decision.

## Hard gates

- exact observer non-interference for variant × scale controls;
- all v0.10 health gates;
- complete paired country-month coverage;
- exact domestic stage coverage and order;
- payroll ledger reconciliation to `lastMarkets.payroll`;
- household-goods ledger reconciliation to `lastMarkets.goods`;
- complete consumer-firm bridge coverage.

No unemployment, exit, revenue, or credit target is a PASS criterion.

## Decision rule

P3 can conclude:

- `WORKING-CAPITAL SEQUENCING VERIFIED` if cash-insufficient firms are materially bridgeable by later same-month goods revenue and the timing aligns with arrears/distress onset;
- `PARTIAL` if sequencing matters but is not dominant;
- `FALSIFIED / SECONDARY` if later revenue cannot explain pre-payroll deficits, requiring the next bottleneck to be selected from quantity/input/plan/finance channels.

No canonical repair is merged in P3.
