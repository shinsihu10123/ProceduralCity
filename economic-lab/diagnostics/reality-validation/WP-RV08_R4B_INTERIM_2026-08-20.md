# WP-RV08-R4B Interim — 24-Month Solvency-Aware Propagation Matrix

Date: 2026-08-20
Workflow run: `32369764253`
Job: `96427364908`
Status: **PASS (sub-workstream complete)**
Artifact: `economic-lab-wp-rv08-r4-b`, ID `9406824937`
Artifact SHA256: `bf0b1d324f3855919bf5f9abc3e211e9338da83cab46c70002297cc7e0013bdc`
Canonical mechanism changes: **0**
Fitted parameter tuning: **0**

## Hard gates

All PASS:

- deterministic replay exact;
- health;
- complete 10-variant × 2-scale × 3-seed × 24-month coverage;
- capacity normalization activation;
- labor-support-floor activation;
- exit-candidate evaluation;
- no-exit diagnostic upper-bound activation;
- zero reported exits under the no-exit upper bound;
- settlement ledger;
- GDP arithmetic identity;
- finite rows.

## Baseline 24-month pooled results

| Variant | Unemployment | Exits | Wage arrears | Fulfillment | Input shortage | Layoffs | Consumer output |
|---|---:|---:|---:|---:|---:|---:|---:|
| consumer-control | 0.4753 | 666 | 108,454 | 0.389 | 76.1 | 1,427 | 92.4 |
| consumer-support-labor-floor | 0.4828 | 681 | 114,350 | 0.381 | 77.0 | 1,354 | 89.0 |
| consumer-viable-exit-guard | 0.4759 | 666 | 108,620 | 0.389 | 75.7 | 1,441 | 92.8 |
| consumer-support-floor-plus-viable-exit | 0.4804 | 678 | 114,403 | 0.387 | 77.0 | 1,349 | 90.4 |
| consumer-no-exit-upper-bound | 0.1772 | 0 | 181,026 | 0.581 | 127.6 | 2,666 | 127.3 |
| materials-consumer-control | 0.4399 | 644 | 101,604 | 0.488 | 92.0 | 1,581 | 118.3 |
| materials-consumer-support-labor-floor | 0.4395 | 632 | 106,004 | 0.491 | 89.9 | 1,503 | 116.5 |
| materials-consumer-viable-exit-guard | 0.4440 | 636 | 101,461 | 0.490 | 90.3 | 1,574 | 117.5 |
| materials-consumer-support-floor-plus-viable-exit | 0.4380 | 636 | 106,293 | 0.489 | 90.2 | 1,504 | 116.5 |
| materials-consumer-no-exit-upper-bound | 0.1828 | 0 | 164,072 | 0.752 | 144.9 | 2,660 | 172.6 |

## Causal interpretation

### A — VERIFIED EXISTING FACT

1. The financially-supportable labor floor does not stabilize the 24-month baseline. In the CONSUMER basis it worsens pooled unemployment from 0.4753 to 0.4828 and raises arrears; in MATERIALS+CONSUMER its unemployment effect is essentially zero.
2. The current `objectivelyViableNow` exit guard is almost inactive. Across baseline seeds it protects only a handful of exit candidates and has negligible macro effect.
3. The no-exit upper bound has an extremely large effect: unemployment falls by about 0.298 in the CONSUMER basis and about 0.257 in MATERIALS+CONSUMER over the pooled 24-month window.
4. The no-exit upper bound also materially increases output/fulfillment, but it simultaneously produces much larger wage arrears and input shortages.
5. Therefore firm destruction / exit propagation is a major causal amplifier of the employment collapse, but indiscriminately preventing exit is not a coherent repair because it preserves severely distressed firms and liabilities.

### B — DIAGNOSTIC LEAD

The currently tested viability criterion — realized operating contribution in the current month being sufficient for current payroll, conditional on liquidity failure and no severe credit stress — is too narrow to identify the subset of firms whose continued existence generates the enormous no-exit upper-bound gain.

The next decomposition must evaluate exit candidates using **counterfactual operating potential**, not only already-collapsed realized revenue. Candidate dimensions include:

- recent / censored demand rather than only current realized sales;
- physical output capacity and contribution margin;
- input availability and supply shortage;
- finished-goods inventory and ability to generate cash from existing stock;
- current and lagged cash / arrears trajectory;
- debt-service and credit-miss state;
- whether exit is caused primarily by a transient liquidity gap versus structurally negative unit economics.

### C — HYPOTHESIS

A large part of the no-exit gain may come from firms that are not `viable now` under collapsed realized revenue but would be viable under a short bridge if their productive relationships and demand path were preserved. Another part is likely genuine zombie-firm preservation. These two populations must be separated before any repair is admissible.

### D — PROPOSED CHANGE

None admitted. The no-exit mode remains a diagnostic ceiling only.

## Sub-verdict

**PASS — EXIT/DESTRUCTION PROPAGATION IS A LARGE MACRO AMPLIFIER, BUT THE CURRENT REALIZED-REVENUE VIABILITY GUARD IS FAR TOO NARROW AND NO-EXIT CREATES ZOMBIE/ARREARS PATHOLOGY. EXIT-CANDIDATE COUNTERFACTUAL VIABILITY DECOMPOSITION IS NOW HIGH PRIORITY.**
