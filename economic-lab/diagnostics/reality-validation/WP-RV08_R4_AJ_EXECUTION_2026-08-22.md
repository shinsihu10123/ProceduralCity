# WP-RV08 R4-AJ — Payroll-Before-Revenue Working-Capital Timing Audit

Date: 2026-08-22  
Status: EXECUTING  
Mode: ACTUAL DIAGNOSTIC EXECUTION / OBSERVATIONAL TIMING AUDIT / NO CANONICAL REPAIR

## 1. Dependency state

R4-AH/AI is closed PASS.

The prior matrix established two facts that must be reconciled:

1. preserving firms and increasing staffing can substantially restore employment/output;
2. the same regimes accumulate very large linked/current-worker wage arrears.

Source order additionally shows that canonical payroll settlement occurs after production but **before** the household goods market. CONSUMER firms therefore settle current wages before receiving the current month's household consumer-goods revenue.

This is a source-level timing lead, not yet a causal conclusion.

## 2. R4-AJ question

For plan-economically viable CONSUMER firm-months, determine how often payroll under-funding is:

- already unavoidable even after including revenue realized later in the same month; or
- a timing/working-capital gap where cash is insufficient at payroll time but the same month's later revenue would have covered current base wages.

The audit records the firm state at four canonical moments:

1. after production/procurement and immediately before payroll;
2. immediately after payroll settlement;
3. immediately after the household goods market;
4. after remaining same-month government/tax flows and immediately before exit evaluation.

## 3. Key measures

For each captured CONSUMER firm-month:

- current linked workers;
- current base payroll = wage × workers;
- limited prior-arrears service due under the canonical payroll rule;
- cash immediately before payroll;
- actual payroll paid;
- post-payroll household consumer revenue;
- all additional firm revenue realized after payroll;
- cash immediately after payroll and after the goods market;
- whether current base payroll was underpaid;
- whether cash + later consumer revenue could have covered current base payroll;
- whether cash + all later same-month revenue could have covered current base payroll;
- whether the gap remains even after all later same-month revenue.

Primary classifications:

- `timing candidate`: current base payroll underpaid, but pre-payroll cash + later same-month total revenue >= current base payroll;
- `consumer timing candidate`: same condition using household consumer revenue only;
- `operating gap after revenue`: current base payroll underpaid and still not coverable after adding all later same-month revenue.

These are counterfactual affordability classifications only. R4-AJ does not move transactions or create money.

## 4. Exposure modes

Two observational states are compared:

- `canonical`: productive normalization only, otherwise canonical staffing and four-month distress/exit;
- `ramp-grace`: the previously diagnosed maximum +12% staffing ramp plus 24-month diagnostic distress threshold, used only to expose the high-employment/high-arrears state found in R4-AH/AI.

The `ramp-grace` state is not a repair candidate and is not merged into canonical source.

## 5. Matrix

12 independent shards:

- mode: canonical / ramp-grace;
- seed: original A / original C / held-out E;
- normalization: CONSUMER / MATERIALS+CONSUMER;
- horizon: 18 months.

Artifact retention: 90 days. Closure-grade compact results will be committed repository-native after synthesis.

## 6. Hard gates

- health PASS;
- 12/12 shard coverage;
- productive normalization active;
- ledger integrity;
- general accounting integrity;
- GDP arithmetic identity;
- plan-viable CONSUMER observations present;
- finite summary values.

Economic sufficiency is not a workflow gate.

## 7. Interpretation rule

If a large share of actual current-payroll underpayment becomes affordable once same-month post-payroll revenue is included, the next dependency-safe test is a bounded working-capital/settlement-timing counterfactual that preserves accounting and explicitly repays any bridge.

If most underpaid payroll remains unaffordable even after later same-month revenue, working-capital timing is secondary and the frontier remains operating-margin/revenue sufficiency rather than transaction order.

Mixed results should be decomposed by base, seed, employment state and revenue source rather than converted into one global repair rule.

No canonical repair merge is authorized by R4-AJ.
