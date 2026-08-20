# WP-RV08-R2 Closure — Entrant Underwriting Constraint × Current-Plan Timing Matrix

Date: 2026-08-20
Status: **PASS**
Canonical mechanism changes: **0**
Fitted parameter tuning: **0**

## Execution evidence

Recovery workflow run: `32368676999`
Recovery job: `96423928266`
Conclusion: **SUCCESS**
Artifact: `economic-lab-wp-rv08-r2-recovery`, ID `9406422084`
Artifact SHA256: `ef1a8e803a218f444d2b83b4662093d2407019fbeee192e49f1088461ce2fb82`

The recovery reran the full matrix while suppressing the previous giant JSON serialization. The economic experiment itself and every hard gate completed successfully.

## Hard gates

All PASS:

- control observer non-interference exact;
- deterministic replay exact;
- health;
- complete variant/scale/seed coverage;
- settlement ledger;
- general accounting;
- GDP arithmetic identity;
- post-plan timing activation;
- entrant birth and underwriting trace coverage;
- underwriting-relief activation;
- no supplemental credit to non-entrants;
- positive supplemental credit in the admitted upper bound;
- finite macro and entrant lifecycle rows.

## Baseline entrant evidence

### Canonical / post-plan without counterfactual bypass

`control`, `postplan`, every single hard-constraint relaxation, every two-way relaxation, and `postplan-all-hard` produced **zero supplemental entrant loans**.

Representative baseline:

- control: births 159, ever credit 0, downstream output 0, downstream revenue 0, re-exit 39.6%;
- postplan-all-hard: births 151, ever credit 0, downstream output 0, downstream revenue 0, re-exit 40.4%.

Changing credit timing to after current production planning therefore does not by itself open the replacement-entrant credit channel.

### Hard constraints + bank counterfactual preference bypass

`postplan-all-hard-cf` baseline:

- births 129;
- supplemental loan events 418;
- supplemental credit 253,622;
- ever-credit share 89.15%;
- ever-output share 89.15%;
- downstream output share 87.32%;
- downstream revenue share 42.25%;
- re-exit share 0%.

`canonical-all-hard-cf` baseline:

- births 132;
- supplemental loan events 432;
- supplemental credit 259,275;
- ever-credit share 88.64%;
- ever-output share 88.64%;
- downstream output share 85.33%;
- downstream revenue share 37.33%;
- re-exit share 0%.

## Claim ledger

### A — VERIFIED EXISTING FACT

1. Replacement entrants receive no canonical credit in the tested unit-basis economy.
2. Moving underwriting to the post-plan point does not materially change that result.
3. Relaxing risk, affordability and capital constraints individually or jointly, including all three simultaneously, still does not open entrant credit.
4. Credit activates only in the experimental upper bound that also bypasses the bank counterfactual preference/rejection layer.
5. Once that upper-bound credit activates, entrant production activation rises sharply and re-exit falls to zero over the 12-month diagnostic horizon.

### B — DIAGNOSTIC LEAD

The replacement entrant is structurally incompatible with the current mature-firm commercial-bank decision objective, not merely blocked by one numeric underwriting threshold.

### C — HYPOTHESIS

A distinct startup-capital / risk-sharing institution is likely a better production-design direction than deleting the commercial bank's risk constraints.

### D — PROPOSED CHANGE

None admitted by R2. R3 must compare accounting-conserving startup equity with the bank upper bound and supply-chain complementarity.

## Verdict

**PASS — ENTRANT CREDIT FAILURE IS A STRUCTURAL UNDERWRITING-OBJECTIVE / INSTITUTION MISMATCH, NOT A SINGLE HARD-CONSTRAINT OR TIMING BUG.**
