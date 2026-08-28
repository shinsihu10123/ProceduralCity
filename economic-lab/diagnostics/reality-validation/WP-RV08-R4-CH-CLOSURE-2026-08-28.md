# WP-RV08-R4-CH Closure — Settlement-Native Revenue / Payroll / Timing Attribution

Date: 2026-08-28
Branch: `scratch/new-project-2026-08-12`
Authoritative run: `33133421028`
Authoritative head: `066a72bb5f681b25f14d488e1714d41b01ec7a95`

## Verdict

**CLOSED / PASS AS MEASUREMENT CORRECTION + ECONOMIC DIAGNOSTIC EVIDENCE / CANONICAL ECONOMIC MUTATION NOT APPROVED**

The first R4-CH run was invalid because the diagnostic harness read non-existent `entry.from` / `entry.to` fields instead of ledger `postings`. That run is excluded from economic interpretation. The corrected postings-based run passed 4/4 seeds.

## Hard-gate result

All four seeds passed:

- no canonical mutation by audit
- exact diagnostic replay
- exact canonical replay
- hard accounting health
- settlement observations present
- finite revenue/payroll attribution
- exact cash reconciliation

Cash reconciliation residual is effectively machine epsilon (~3.6e-13 to ~4.1e-13 mean absolute), with zero firm-months above tolerance.

## 24-month evidence

| seed | mean ledger operating revenue | mean field revenue | ledger revenue positive share | payroll positive share | ledger revenue < payroll share | ledger operating margin negative share | mean ledger revenue/payroll ratio* |
|---|---:|---:|---:|---:|---:|---:|---:|
| Original A | 3.5096 | 5.3467 | 42.33% | 72.68% | 67.50% | 69.32% | 0.2285 |
| Original C | 3.6109 | 5.4947 | 44.32% | 71.88% | 67.14% | 69.21% | 0.2049 |
| Heldout E | 3.7311 | 5.6655 | 39.10% | 71.63% | 67.13% | 68.63% | 0.3073 |
| Heldout F | 3.7362 | 5.7202 | 44.54% | 72.87% | 66.24% | 69.25% | 0.2961 |

*Ratio computed where both ledger operating revenue and payroll are positive.

The field-based payroll proxy from R4-CG materially overstated the severity of the revenue/payroll ratio because `workers × wage` is not equivalent to actual settled payroll. However, the corrected settlement-native evidence still shows severe operating weakness: roughly two thirds of active firm-months have operating revenue below settled payroll, and roughly 69% have negative settlement-native operating margin before finance/non-operating support.

## Important new finding

Firms receive settlement flows much larger than operating revenue from categories currently classified as finance and OTHER. Mean finance inflow is roughly 23.5–30.5 per firm-month and mean OTHER inflow roughly 19.9–22.7, compared with operating revenue around 3.5–3.7. Therefore the next causal step must decompose those transaction kinds before any wage, price, demand, bankruptcy, credit, or subsidy repair is authorized.

## Decision

R4-CH resolves the measurement ambiguity from R4-CG:

1. the giant cash residual was a diagnostic-schema error, not a canonical cash-accounting defect;
2. actual settled payroll is far below the naive `workers × wage` proxy;
3. even after correcting payroll attribution, operating economics remain weak;
4. non-operating/finance settlement inflows are large enough to dominate firm cash movement and may be masking the primary mechanism.

Proceed to **R4-CI — Firm Settlement Kind Census + Operating Support Dependency Decomposition**.

Canonical economic mutation remains locked.
