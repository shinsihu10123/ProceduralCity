# WP-RV07-P14 — Capacity-Bound Layoff Guard Structural Ablation

## Objective

Test a minimal, parameter-free alternative to the infeasible P12 full production-requirement labor target.

The candidate changes only one decision boundary in the diagnostic world:

> If the canonical firm target would lay off existing workers **and** the firm's current workforce is already insufficient to meet its own unconstrained production plan, do not reduce staffing below the current worker count for that month.

The candidate does not create a hiring target above current staffing. It only blocks self-defeating contraction under an already binding production-capacity constraint.

## Structural rule

After canonical firm decision and credit origination, before labor clearing:

1. preserve canonical `desiredWorkers`;
2. derive current per-worker capacity from the frozen production equation;
3. derive the current unconstrained production plan from frozen demand-anchor/replenishment equations;
4. compute current workforce capacity cap using the frozen `1.08` production cap;
5. if `canonicalDesiredWorkers < currentWorkers` and `unconstrainedPlan > currentWorkforceCapacityCap`, set `desiredWorkers = currentWorkers`;
6. otherwise leave the canonical target unchanged.

No new fitted coefficient, labor multiplier, wage subsidy, credit rule, price rule, or hiring quota is introduced.

## Comparison

- `unit-basis-control`
- `unit-basis-capacity-bound-layoff-guard`

Scales: compact, baseline.
Seeds: ECON-RV02-A/B/C.
Horizon: 12 months.

## Measures

- unemployment;
- firm exits;
- wage arrears;
- goods fulfillment;
- input shortage;
- RESOURCE/MATERIALS/CONSUMER output;
- workers and desired workers;
- hires, layoffs, unfilled vacancies;
- number of guarded firm-months and preserved worker slots;
- GDP identity.

## Hard gates

- exact deterministic replay for both variants;
- health PASS;
- complete coverage;
- intervention rows present;
- guard equation validation;
- guard never creates a target above current staffing unless canonical already did so;
- settlement ledger PASS;
- GDP identity PASS;
- finite outputs.

## Interpretation rule

A meaningful repair lead requires joint improvement in employment/capacity outcomes without a large deterioration in payroll arrears, exits, or supply-chain stress.

Even a successful result is only a structural repair candidate. It is not a canonical merge or empirical calibration authorization.
