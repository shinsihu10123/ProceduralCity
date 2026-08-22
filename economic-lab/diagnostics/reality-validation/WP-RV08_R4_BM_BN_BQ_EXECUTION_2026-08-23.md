# WP-RV08 R4-BM / BN / BQ — Integrated Wage Ratchet, Entrant Failure, Credit Underwriting Audit

Date: 2026-08-23
Mode: OBSERVATIONAL DIAGNOSTIC / NON-CANONICAL
Status: EXECUTION CONTRACT

## Why this batch is integrated

R4-BF–BK and R4-BL exposed three high-priority structural leads that can be inspected from the same canonical trajectory without running separate worlds:

1. firm wages almost never move while prices do;
2. zero-resource entrants all disappear before six operational months;
3. a one-bank credit system approves only about 2% of applications.

To increase execution throughput, one 36-month instrumented world per seed will audit all three simultaneously.

Seeds: original A, original C, heldout E, heldout F.
Base: established initial-price + MATERIALS/CONSUMER diagnostic normalization.

## R4-BM — Wage Ratchet / Downward Adjustment Opportunity

Observe firm-month wage and price changes and identify stressed firm-months where:
- payroll arrears are material,
- the firm is not suffering an unfilled-vacancy shortage,
- a downward labor-cost adjustment could in principle be relevant.

Measure whether wages ever fall in those states, whether prices continue to move, and whether prolonged-arrears firms receive any endogenous nominal-wage relief.

This is an audit of the existing wage mechanism, not a recommendation for wage cuts.

## R4-BN — Entrant Failure Mechanism Cohort

For every post-month-0 entrant track:
- birth resources
- first hire/output/revenue/credit
- distress path
- pre-exit cash, payroll arrears, credit misses, workers, output, revenue, capital, inventory
- exit classification using the existing canonical exit predicates:
  - payroll-liquidity failure
  - severe credit stress
  - both
  - other/transition ambiguity

Also measure how many entrants ever establish sustained output/revenue before exit.

## R4-BQ — Credit Underwriting / Repayability Selection

Wrap the existing public `BankSystem.originateCredit` call observationally. Immediately before the canonical origination routine, record the exact application set returned by the canonical `buildApplications` method. Immediately after it returns, map newly created loans back to applicants.

Measure approval by:
- borrower type
- firm sector
- requested amount
- cash / debt / arrears
- payroll-relative request size
- initial bank capital headroom
- firm productive state

Then follow approved and rejected firm applicants for subsequent survival, output/revenue and distress.

The wrapper must return the untouched canonical result and must consume no RNG itself.

## Hard gates

- 36 complete months
- health OK
- settlement ledger OK
- general accounting OK
- GDP arithmetic identity OK
- normalization active
- finite result tree

No wage rule, entrant resources, credit decision, bank capital rule, bankruptcy rule, price rule, or transfer rule is changed.

## Decision value

This batch decides where to spend the next causal-ablation budget:

- if stressed wages never adjust downward, design a bounded wage-contract causal test;
- if entrants mainly fail by payroll-liquidity before credit stress, prioritize startup operating-capital/production coherence rather than entry count;
- if rejected borrowers are mostly non-repayable/structurally unproductive, looser credit is unsafe; if viable borrowers are rejected en masse, underwriting/capital architecture becomes a stronger candidate.
