# WP-RV07-P13 — Labor-Target Feasibility and Labor-Market Stop Decomposition

## Objective

Explain why the strong P12 production-requirement labor target creates roughly one thousand unfilled vacancies per country-month at baseline scale.

This WP does **not** change the canonical economy and does not propose a calibrated labor target. It runs the already-rejected P12 diagnostic candidate and observes its labor market exactly.

## Questions

1. Is aggregate desired employment itself larger than the household labor force?
2. How much unfilled labor is mathematically unavoidable from aggregate labor-supply limits?
3. How much additional unfilled demand is caused by the frozen hiring-capacity, scan-limit, or no-applicant branches?
4. Which industries carry the largest desired-worker versus actual-worker gaps?
5. Does the labor observer preserve exact candidate state?

## Method

- Unit-basis diagnostic world only.
- Scales: compact, baseline.
- Seeds: ECON-RV02-A/B/C.
- Horizon: 12 months.
- Reuse the P12 production-requirement target exactly.
- Attach the existing labor-market diagnostic observer.
- Snapshot aggregate/sector desired workers immediately before labor clearing.
- Reconcile labor-market `unfilled` against aggregate labor-supply lower bounds and exact labor stop diagnostics.

## Hard gates

- exact observer non-interference against the same P12 candidate;
- health PASS;
- complete scale/seed/month/country coverage;
- pre-labor target snapshots present;
- labor stop diagnostics present and finite;
- settlement ledger PASS;
- GDP identity reconciliation PASS.

## Claim discipline

A — Source equations and gate results only.

B — Labor-target feasibility and stop-branch counts after gates pass.

C — Repair hypotheses only after the decomposition is known.

D — No repair in P13.

## Exit rule

PASS if the P12 infeasibility is decomposed without perturbing candidate state. BLOCKED if observer non-interference or reconciliation fails.
