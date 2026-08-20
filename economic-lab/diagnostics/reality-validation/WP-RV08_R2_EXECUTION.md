# WP-RV08-R2 — Entrant Underwriting Constraint × Current-Plan Timing Matrix

Status: **EXECUTION**
Date: 2026-08-20

## Purpose

R1 proved that current-plan input-finance timing is structurally stale but insufficient: replacement entrants still received zero credit under both provisional and post-plan current-input variants. P76 showed overlapping entrant rejection through bank-capital, affordability and risk constraints, while the bank counterfactual layer may remain independently restrictive once hard constraints are removed.

R2 therefore isolates the interaction between:

1. current-plan input-finance timing;
2. entrant risk constraint;
3. entrant affordability constraint;
4. entrant bank-capital constraint;
5. entrant counterfactual approve/reject preference.

## Boundary

R2 is an **experimental repair-isolation matrix**, not a canonical merge.

- Initial price basis remains the admitted structural unit-basis diagnostic (`initialPrice = existing initialWage` before world construction).
- Non-entrant commercial credit remains canonical.
- Entrant application amounts, terms and canonical underwriting traces are reused exactly; no fitted startup-loan coefficient is introduced.
- Constraint relief applies only to firms created through canonical replacement entry.
- Supplemental entrant loans use the existing ledger money-creation path and `AccountingSystem.recordLoanOrigination`, so balance-sheet accounting is preserved.
- Bank-capital-relief variants intentionally relax the regulatory capital gate as a causal upper bound; they are not production-ready.
- Counterfactual-relief variants intentionally bypass the bank AI approve/reject preference only after the selected hard-constraint experiment; they are not production-ready.

## Variants

1. `control`
2. `postplan`
3. `postplan-risk`
4. `postplan-afford`
5. `postplan-capital`
6. `postplan-risk-afford`
7. `postplan-risk-capital`
8. `postplan-afford-capital`
9. `postplan-all-hard`
10. `postplan-all-hard-cf`
11. `canonical-all-hard`
12. `canonical-all-hard-cf`

`postplan` variants defer credit until after canonical labor clearing and production planning, then build input financing from exact current desired production and on-hand inputs.

## Questions

R2 must answer:

- Which underwriting constraint or combination actually prevents entrant credit?
- Does current-plan timing materially interact with underwriting relief?
- Is relaxing hard constraints sufficient, or does the bank counterfactual preference independently block entrant regeneration?
- When entrant credit is restored, do downstream entrants actually produce, earn revenue and avoid re-exit?
- Does entrant regeneration improve unemployment/exit persistence without simply creating a larger accounting or arrears failure?

## Hard gates

- exact control observer non-interference;
- deterministic replay for every variant/scale;
- complete configured scale × seed × horizon coverage;
- health checks PASS;
- settlement/general accounting remains balanced;
- GDP identity reconciliation;
- post-plan intervention activated where requested;
- entrant applications/traces observed;
- each supplemental origination reconciles to ledger `bank_loan_origination` and borrower loan balance;
- no supplemental credit to non-entrants;
- finite macro/lifecycle evidence.

## Decision rule

- If one constraint relief restores entrant credit/productive regeneration while preserving bounded macro/financial state, admit it for R3 production-design refinement.
- If only `all-hard-cf` works, commercial-bank underwriting is structurally incompatible with zero-resource replacement entry; R3 must test a distinct accounting-conserving startup-finance institution rather than tuning bank risk parameters.
- If even all-hard/counterfactual relief does not restore downstream production, finance is not the remaining proximate regeneration blocker and entrant physical/bootstrap architecture must be reopened locally.

Canonical source merge authorized in R2: **0**.  
Fitted parameter tuning authorized: **0**.
