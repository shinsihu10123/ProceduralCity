# WP-RV08 R4-AN Execution — Revenue-Supported Staffing Envelope Causal Ablation

Date: 2026-08-22

## Purpose

R4-AL/AM established two facts that must now be tested causally rather than interpreted as a repair proposal:

1. post-bottleneck payroll shortfalls are predominantly recurrent/persistent rather than isolated one-month timing gaps;
2. trailing realized contribution defines a non-trivial staffing interior between current employment and the full physical labor requirement.

R4-AN therefore tests whether a **smoothed, bounded, trailing-realization staffing rule** can reduce current-worker arrears without reproducing the earlier failure mode in which affordability caps merely create mass unemployment/output collapse.

## Claim class

**C / D — diagnostic hypothesis and diagnostic intervention only.**

No canonical architecture or production rule is changed by this work package.

## Fixed background state

All R4-AN regimes preserve:

- transformed nominal/unit basis (`initialPrice = initialWage`);
- productive normalization on the selected base;
- exact diagnostic labor runtime;
- canonical credit origination before the staffing intervention;
- canonical wages, taxes, settlement, debt service/default, goods market, and accounting;
- the same 24-month diagnostic distress grace used in the R4-AL/AM post-bottleneck state.

No bridge loan, subsidy, wage cut, tax change, write-off, estate recycling, or supply sequencing intervention is introduced.

## Regimes

Five regimes are compared inside every seed/base shard.

1. `control` — existing ramp-grace physical expansion logic.
2. `mean3-immediate` — target `min(physical workers, floor(mean trailing 3m realized contribution / wage))` immediately. This is an intentionally sharp upper-bound test for transition shock.
3. `mean3-ramp` — the same mean-support target, but movement toward the target is bounded by the canonical hiring-change envelope: +12% / -10% per month.
4. `floor3-ramp` — uses the minimum trailing 3m realized contribution as the support target, with the same canonical movement bounds.
5. `hysteresis-ramp` — expands toward mean support when mean support exceeds current staffing, contracts toward minimum support only when the minimum falls below current staffing, otherwise holds current staffing; movement remains bounded by +12% / -10%.

No support rule applies until three comparable realized-contribution observations exist. Before then, the regime follows the control physical-ramp behavior to avoid mechanical entrant/startup suppression.

## Matrix

- Seeds: original A, original C, held-out E, held-out F
- Bases: `consumer`, `materials-consumer`
- Primary shard count: 8
- Regimes per shard: 5
- Primary simulations: 40
- Horizon: 36 months
- Determinism check: two independently constructed 6-month control worlds per seed/base check

## Outcomes

Primary economic outcomes:

- mean and terminal-6m unemployment;
- mean and terminal-6m total wage arrears;
- mean and terminal-6m linked/current-worker arrears;
- GDP;
- physical output;
- active firms;
- exits.

Staffing-transition diagnostics:

- intervention/expansion/contraction counts;
- share target below/above canonical request;
- share target below/above current staffing;
- current staffing / physical requirement;
- target staffing / physical requirement;
- trailing mean/minimum support relative to current staffing;
- share and magnitude of physical labor gap closed.

## Hard gates

The workflow may pass mechanically only if:

- control determinism passes;
- every shard is healthy;
- all seed/base/regime cells are present;
- productive normalization activates;
- ledger and general accounting verification pass;
- expenditure GDP arithmetic passes;
- staffing decision rows exist;
- every non-control regime actually intervenes;
- all reported numeric rows are finite.

**Economic sufficiency is deliberately not a hard gate.** A regime that lowers arrears by collapsing employment or output is an economic failure even if every mechanical gate passes.

## Interpretation gates

A staffing-envelope candidate is materially supported only if, across original and held-out seeds:

- arrears and linked arrears improve relative to control;
- unemployment does not jump enough to explain the arrears improvement mechanically;
- physical output and active-firm survival are not materially destroyed;
- improvement persists into the terminal six-month window.

If `mean3-immediate` fails while `mean3-ramp` succeeds, transition speed is a causal part of the defect. If both mean rules fail but hysteresis improves the joint employment/arrears frontier, volatility rather than average support is the key staffing-state variable. If all envelope rules reduce arrears only through labor destruction, the labor-target formula is not sufficient and the frontier returns to revenue realization / production execution / contract settlement sequencing.

## Workflow

`.github/workflows/economic-lab-rv08-r4-an-staffing-envelope.yml`
