# WP-RV07-P2 — Structural Unit-Basis Repair Ablation — Closure

Status: **PARTIAL PASS — VIABLE STRUCTURAL CANDIDATE, NOT READY TO MERGE**
Date: 2026-08-19

## Frozen economic semantics

Frozen baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Canonical economic mechanism changes in P2: **0**.
Canonical parameter tuning in P2: **0**.
Candidate merged: **NO**.

## Final corrected evidence

- candidate: `price-wage-basis`
- experimental rule: before world construction only, set each country's `initialPrice` monetary basis equal to its already-existing `initialWage` basis
- scales: compact + baseline
- seeds: `ECON-RV02-A/B/C`
- horizon: 12 months
- corrected run: `32224095707`
- corrected head: `479f9ce7c6ead47a771087c7d250ce9e14408333`
- artifact: `9354954900` / `economic-lab-wp-rv07-p2b`
- digest: `sha256:7a59ff51263944876d1edf06b2938077b27f6b47a4e9a6b9384dc745c832b0a3`

All corrected hard gates PASS:

- paired deterministic replay exact;
- frozen-control health PASS;
- candidate health PASS;
- complete variant × scale × seed × country × month coverage;
- frozen-control expenditure GDP identity reconciliation;
- candidate expenditure GDP identity reconciliation.

The earlier run `32223740276` is retained as failed-attempt evidence. Its local diagnostic reconstructed GDP without `netExports`; both economic worlds were healthy. The corrected runner restored the same `C + I + G + NX + ΔInventories` identity used by WP-RV05.

## A — VERIFIED EXISTING FACTS

### A1. The candidate removes most of the verified first-stage unit mismatch

Baseline full 12-month window:

- frozen consumer payroll / output value: `156.5464x`
- candidate: `2.1138x`
- candidate/control ratio: `0.01350`

Compact:

- frozen: `123.8113x`
- candidate: `2.7888x`
- candidate/control ratio: `0.02252`

The improvement is cross-scale.

Baseline months 1–3 are more decisive:

- candidate payroll / output value: `1.0382x`
- candidate consumer revenue / payroll: `3.5196x`
- candidate goods-budget fulfillment: `96.73%`

This contrasts with the frozen months 1–3 baseline:

- payroll / output value: `95.454x`
- revenue / payroll: `0.0372x`
- goods-budget fulfillment: `0.70%`

The initialization price-unit interpretation therefore directly attacks the structural mismatch diagnosed in P0/P1.

### A2. The candidate materially changes the real-side collapse path without being selected against a target path

Baseline full window:

- mean unemployment: frozen `40.38%` → candidate `25.14%`
- firm exits: frozen `394` → candidate `248`
- goods fulfillment: frozen `0.36%` → candidate `55.75%`
- consumer revenue / payroll: frozen `0.0160x` → candidate `1.6487x`

Compact shows the same direction.

These are descriptive outcomes, not empirical calibration targets and not P2 PASS criteria.

### A3. The candidate does not solve the full structural problem

Candidate baseline deteriorates over time:

- M1–3 payroll/output `1.0382x`, goods fulfillment `96.73%`, unemployment `5.72%`
- M4–6 payroll/output `0.8961x`, goods fulfillment `45.89%`, unemployment `11.01%`
- M7–9 payroll/output `1.4091x`, goods fulfillment `47.27%`, unemployment `34.22%`
- M10–12 payroll/output `5.1117x`, goods fulfillment `33.10%`, unemployment `49.61%`

By M10–12 consumer revenue/payroll also falls below one (`0.7724x`).

Thus `price-wage-basis` is a viable first-stage semantic repair candidate, but is not sufficient for canonical merge.

### A4. Better early real-side performance does not require more credit approval in this ablation

Baseline full-window credit approval rate:

- frozen: `7.34%`
- candidate: `4.37%`

Compact:

- frozen: `9.24%`
- candidate: `5.71%`

So the candidate's first-stage improvement cannot be described as a consequence of looser observed credit approval.

## B — DIAGNOSTIC LEADS

1. A second-stage failure remains after the initial unit-basis defect is largely removed.
2. Wage arrears begin rising while early candidate consumer revenue/payroll is above one. This is compatible with an intra-month liquidity/working-capital sequencing problem, but P2 alone does not prove it.
3. The actual domestic execution order in the frozen code is important: credit origination occurs before payroll; production and input procurement occur before payroll; payroll settlement occurs before household goods-market sales. Therefore a firm can be monthly-flow viable yet unable to bridge payroll using revenue that arrives later in the same month.
4. Later labor-plan feedback, inventory/input constraints, firm exits and finance may still contribute materially after the first-stage defect is repaired.

## C — HYPOTHESIS DISPOSITION

| Hypothesis | P2 disposition |
|---|---|
| The ~100x unit mismatch is irrelevant to the collapse | **FALSIFIED for the paired panel** |
| `price-wage-basis` resolves the initial mismatch | **STRONGLY SUPPORTED** |
| `price-wage-basis` alone repairs the whole economy | **FALSIFIED** |
| Residual collapse is specifically caused by working-capital timing | **OPEN — test next** |
| More credit approval is necessary for the observed first-stage improvement | **NOT SUPPORTED** |

## D — NEXT ACTION

**WP-RV07-P3 — Candidate Residual Failure Decomposition**.

P3 will keep the canonical model unchanged and compare frozen control with the P2 candidate at exact intra-month boundaries. It will distinguish:

- pre-payroll cash vs contractual payroll;
- credit available before payroll;
- actual payroll paid/unpaid and wage arrears;
- later household-goods revenue that arrives after payroll;
- input procurement / production shortages;
- plan and labor-demand changes;
- firm exit timing.

A specific working-capital repair will not be designed until P3 identifies the binding residual mechanism.

## Final result

**WP-RV07-P2: PARTIAL PASS — VIABLE STRUCTURAL CANDIDATE, NOT READY TO MERGE**

Canonical mechanism changes: **0**
Canonical parameter tuning: **0**
Empirical realism claim: **NO**
