# WP-RV08-R3 — Entrant Regeneration Institution × Supply Complementarity Matrix

Status: **EXECUTION REQUESTED**
Date: 2026-08-20

## Why this WP is intentionally wider

The user authorized increasing the amount of work per execution cycle. R1 showed that current-plan working-capital timing is real but insufficient. R2 showed that replacement entrants remain incompatible with mature commercial-bank underwriting even after all hard constraints are experimentally relaxed unless the bank counterfactual preference is also bypassed.

Instead of testing one funding rule at a time and then separately retesting the supply chain, R3 evaluates entrant-finance institution choice and the previously verified supply-sequencing/procurement upper bound in one 4 × 2 matrix.

## Frozen comparison basis

All variants retain the RV07/RV08 structural unit-basis comparison (`initialPrice = existing initialWage`) used in R1/R2. This is still an experimental repair basis, not a merged canonical change.

Scales: compact, baseline.
Seeds: ECON-RV02-A/B/C.
Horizon: 12 months.

## Funding dimension

1. `control`
   - canonical asset market and canonical bank underwriting only.

2. `priority-equity`
   - replacement entrants are explicitly admitted to a first-month equity syndication pass;
   - raise size uses the existing asset-market primary-issuance algebra and market-cap constraint;
   - investors use the existing household eligibility, liquidity buffer and risk-budget rules;
   - every subscription is an actual household-cash → firm-cash transfer and uses the existing primary-subscription accounting entry.

3. `safe-cash-equity`
   - accounting-conserving startup-equity upper candidate;
   - first-month entrant raise aims at the already-existing canonical `safeCash` funding gap rather than inventing a fitted amount;
   - investor eligibility/risk budgets remain the canonical asset-market rules;
   - no money is created and no free cash/inventory is injected.

4. `bank-upper`
   - R2 all-hard+counterfactual bypass reproduced as an **upper-bound benchmark only**;
   - only rejected replacement-entrant applications are supplemented;
   - exact requested application amount/term and existing loan/accounting paths are used;
   - this is not a proposed production bank rule.

## Supply dimension

1. `canonical`
2. `topo-fullcash`
   - previously validated P72 diagnostic upper bound;
   - RESOURCE produces before MATERIALS procurement, MATERIALS before downstream procurement;
   - procurement may use available cash rather than the canonical 42% reservation;
   - accounting/settlement is preserved.

This gives 8 variants in one execution cycle.

## Decision questions

R3 closes, in one matrix:

- whether an explicit startup-equity institution can regenerate entrants without deleting bank risk constraints;
- whether a strong but accounting-conserving equity raise is materially more effective than simply prioritizing entrants under the existing tiny primary-issuance envelope;
- how much of entrant recovery remains supply-chain constrained after financing is restored;
- whether the commercial-bank all-hard+CF upper bound materially outperforms real-cash equity finance;
- whether supply improvements and entrant finance are complements or substitutes.

## Hard gates

- exact control observer non-interference;
- deterministic replay for every variant/scale;
- complete 8 × 2 × 3 coverage;
- health PASS;
- settlement ledger PASS;
- general accounting PASS;
- asset-market equity ownership/book reconciliation PASS;
- GDP arithmetic identity PASS;
- special equity path activates;
- bank upper-bound path activates;
- topological/full-cash path activates;
- no special funding reaches a non-entrant;
- special equity ledger amounts reconcile exactly to recorded special equity;
- special loan ledger amounts reconcile exactly to recorded special loans;
- finite macro and entrant metrics.

## Admission rule after R3

- If priority equity materially restores entrant production/revenue, prefer minimal institutional change.
- If only safe-cash equity restores regeneration, admit an explicit startup-capital institution for production design, but do not yet merge its amount/eligibility semantics without held-out validation.
- If bank upper bound is uniquely effective, investigate explicit risk-sharing/guarantee balance sheets rather than deleting bank constraints.
- If finance restores credit/equity but downstream output remains weak and topo-fullcash closes the gap, carry supply sequencing into the coherent repair bundle.
- If neither accounting-conserving equity mode materially works, reopen only the entrant physical/bootstrap boundary, not broad root-cause search.

Canonical implementation merge authorized in R3: **0**.
Fitted parameter tuning authorized in R3: **0**.
