# WP-RV07-P76 — Replacement Entrant Exact Credit-Rejection Trace Decomposition

## Objective

P75 proved that replacement entrants are mechanically eligible for credit applications and survive the actual application queue, yet no observed entrant receives a loan. P76 identifies the exact canonical rejection branch for every entrant application without modifying the bank decision.

## Scenarios

1. P2 unit-basis control.
2. CONSUMER static productivity normalization.
3. MATERIALS + CONSUMER static productivity normalization.

## Instrumentation

- Wrap `createEntrant()` only to identify replacement cohorts.
- Wrap `BankSystem.buildApplications()` only to record actual queued entrant applications and their application fields.
- Intercept assignments to the existing bank `lastTrace` property through a transparent getter/setter. The setter records each canonical `evaluateCreditApplication()` trace and then preserves exactly the assigned trace value.
- Do not call the bank evaluator a second time and do not consume extra RNG.

For each entrant credit decision record:

- requested amount, cash, debt, arrears, income base and term;
- estimated default probability and risk limit;
- current/projected bank capital ratio and capital safety;
- payment burden and affordability;
- `riskAcceptable`;
- selected approval/rejection;
- exact canonical `trace.reason`;
- counterfactual approval-vs-rejection utilities when present;
- entrant age and industry.

## Exact rejection categories

Map the canonical reason into:

- `BANK_CAPITAL`
- `AFFORDABILITY`
- `RISK_LIMIT`
- `COUNTERFACTUAL_REJECTION`
- `APPROVED_DECISION`
- `OTHER`

No inferred category may override the canonical trace reason.

## Hard gates

- exact observer non-interference;
- exact deterministic replay;
- all runs healthy;
- complete scenario × scale × seed coverage;
- replacement entrants observed;
- entrant queued applications observed;
- exact trace coverage: every queued entrant application receives one captured bank decision trace;
- ledger verification;
- GDP identity reconciliation;
- finite decision metrics.

## Decision rule

- If `BANK_CAPITAL` dominates, the replacement-regeneration failure is tied to the late banking-capital state; next causal upper bound should isolate entrant-specific capital capacity without changing underwriting.
- If `RISK_LIMIT` or `COUNTERFACTUAL_REJECTION` dominates, the bank cognition/underwriting layer is the direct post-queue blocker; test an entrant-only approval upper bound before proposing a policy.
- If `AFFORDABILITY` dominates, inspect the application income-base/payment-burden semantics for zero-resource entrants.
- If rejection is mixed, run a minimal factorial separating bank-capital and underwriting constraints.

P75's credit-stage input-need blindness remains a separate pipeline defect regardless of the rejection branch and must not be conflated with approval causality.

## Authority

Canonical economic changes: 0. Parameter tuning: 0. Repair merge: NO. Held-out seeds: NO. Empirical realism claim: NO.
