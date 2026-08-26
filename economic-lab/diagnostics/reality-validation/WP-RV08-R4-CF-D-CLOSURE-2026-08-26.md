# WP-RV08-R4-CF-D — Invoice / Trade-Credit Shadow Contract — Closure

Date: 2026-08-26
Authoritative run: `32937030390`
Authoritative run HEAD: `53c5ba11058f34e507f3519620e16cd0d86c068a`

## Verdict

**CLOSED / PASS AS SHADOW CAUSAL EVIDENCE / CANONICAL SWITCH NOT APPROVED**

All four 24-month seeds passed:
- Original A — `ECON-RV02-A`
- Original C — `ECON-RV02-C`
- Heldout E — `ECON-RV08-HOLDOUT-E`
- Heldout F — `ECON-RV08-HOLDOUT-F`

All hard gates passed on every seed:
- no canonical mutation;
- exact shadow replay;
- exact canonical replay;
- hard accounting / ledger health;
- physical ordering D0 <= D1 <= D2 <= D3;
- aggregate and buyer-level AP/AR conservation;
- no negative exposure;
- buyers and exposures observed;
- procurement recovery observed.

## 24-month averages

| Seed | Full-cash D0 | Net-30 D1 | Net-60 D2 | Inventory-only D3 | D1 incremental units | Mean D1 AP | Residual shortage D1 | D1 share of D3 recovery |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Original A | 226.8965 | 303.9638 | 303.9638 | 303.9638 | 77.0673 | 47.9370 | 22.9287 | 100% |
| Original C | 237.3251 | 313.0142 | 313.0142 | 313.0142 | 75.6891 | 46.1292 | 17.7820 | 100% |
| Heldout E | 237.3020 | 307.6769 | 307.6769 | 307.6769 | 70.3750 | 44.0533 | 17.9609 | 100% |
| Heldout F | 255.2670 | 323.5526 | 323.5526 | 323.5526 | 68.2856 | 42.0856 | 17.4387 | 100% |

Cross-seed mean incremental recovery under D1 is approximately **72.85 input units/month**. Cross-seed mean shadow buyer payable required to obtain that recovery is approximately **45.05 value units/month**.

## Interpretation

R4-CF-D establishes a strong **causal capability result**: an explicit matched AP/AR deferred-settlement channel can, on the tested monthly snapshots, recover the entire procurement gap between the full-current-cash envelope and the physically available supplier-inventory envelope across original and heldout seeds.

However, D1 = D2 = D3 in the measured averages. This means the one-month observable operating-scale exposure cap used for the Net-30 shadow family did **not bind** before the physical supplier-inventory ceiling. Consequently, the experiment does **not** establish that real firms could safely sustain the resulting receivable exposure, nor that Net-30 is the correct canonical institutional term. The current experiment does not carry invoices through time, test repayment, age receivables, charge losses, or impose seller balance-sheet risk.

Therefore canonical trade credit is **not approved yet**. The missing precondition is an intertemporal receivable/payable risk-capacity experiment.

## Causal frontier after R4-CF-D

Supported:
1. the 42% cash reservation is a secondary procurement restriction;
2. buyer settlement / working-capital architecture is a major procurement-side restriction;
3. matched AP/AR deferred settlement is mechanically capable of closing most of that restriction without violating physical or accounting conservation in shadow mode;
4. supplier inventory/production/timing remains the residual physical bottleneck after settlement relief.

Not yet supported:
- a canonical Net-30 or Net-60 term;
- unlimited seller-financed trade credit;
- zero-default receivables;
- automatic payment from future cash;
- seller solvency under accumulated receivables;
- final interest, discount, delinquency, recovery, provisioning, or bankruptcy rules.

## Next dependency-safe gate

Proceed to **WP-RV08-R4-CF-E — Trade-Credit Aging, Repayment & Seller Risk-Capacity Shadow Ledger** before any canonical supply-chain mutation.