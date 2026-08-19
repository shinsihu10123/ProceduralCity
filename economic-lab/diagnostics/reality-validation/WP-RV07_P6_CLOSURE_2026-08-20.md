# WP-RV07-P6 Closure — Exact Procurement Stop-Reason Audit

Date: 2026-08-20
Verdict: **PASS — ACTUAL STOP BRANCH IDENTIFIED**

## Evidence

Workflow run: `32275136491`
Job: `96140657371`
Artifact: `economic-lab-wp-rv07-p6` / `9373724489`
Artifact SHA-256: `57665c7a2544da5aa0932ccd03144c3bdb78f6e4f60df0274b9010016895bfa8`

Hard gates all passed:

- exact source-equivalent traced replay
- health
- country-month coverage
- exact reconciliation to `lastIndustry.inputShortageUnits`
- all short cases classified
- five-transaction cap respected
- finite/non-negative shortage

## Verified diagnosis

Under the experimental unit-basis candidate, the dominant actual terminal branch is `BUDGET_EXHAUSTED`.

Baseline, full 12-month panel:

- short buyer cases: 1,281
- total shortage units: 5,848.41
- budget-exhausted cases: 996
- budget-exhausted shortage share: 80.62%
- no-stock cases: 283
- round-cap cases: 2
- algorithmically affordable residual cases: 0

Window pattern:

- M1-3: budget exhaustion explains 100% of shortage
- M4-6: budget exhaustion explains 100% of shortage
- M7-9: budget share 84.16%; physical no-stock begins to matter
- M10-12: budget share 58.53%; physical no-stock becomes a major co-constraint

Compact scale shows the same qualitative result: budget-exhausted shortage share is 73.11% over the full panel.

## Interpretation

A. VERIFIED EXISTING FACT: procurement begins with `budgetRemaining = buyer cash * 0.42` and terminates when that budget is exhausted.

A. VERIFIED EXISTING FACT: in the audited unit-basis runs, budget exhaustion is the dominant actual stop branch, not merely a necessary-condition flag.

A. VERIFIED EXISTING FACT: round-limit/search failure is negligible in this panel and there are zero cases where remaining stock and remaining procurement budget jointly could cover the shortage at an algorithmic stop.

B. DIAGNOSTIC LEAD: the 42% liquidity reservation rule is therefore the next causal mechanism to ablate. This does not establish that the rule is economically wrong; it may be protecting payroll or other obligations.

C. HYPOTHESIS H-P7: allowing procurement to use the buyer's full currently available cash, with every other procurement rule unchanged, will materially reduce early/mid-horizon input shortage. The effect on payroll, exits, consumption and unemployment is unknown ex ante and must be measured.

## Next admission

WP-RV07-P7 may run a single bounded causal ablation:

- control: existing unit-basis candidate + 42% procurement cash budget
- candidate: same unit-basis candidate + full available cash as procurement budget
- no fitted coefficient and no intermediate multiplier
- all other procurement/search/accounting rules unchanged

The full-cash variant is an upper-bound causal test, not a production repair proposal.

Canonical mechanism changes: **0**
Canonical parameter tuning: **0**
Empirical realism claim: **NO**
Repair merge authorization: **NO**
