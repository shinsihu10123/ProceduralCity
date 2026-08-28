# WP-RV08-R4-CG — Operating Cash-Conversion Cycle Decomposition — Closure

Date: 2026-08-28
Authoritative run: `33076562438`
Authoritative execution HEAD: `fccb4a0ccc583d00f7b613a14ac5286ccb1657e6`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / CAUSAL ATTRIBUTION STILL REQUIRES SETTLEMENT-OBSERVABILITY AUDIT**

All four 24-month shards completed successfully:
- Original A — `ECON-RV02-A`
- Original C — `ECON-RV02-C`
- Heldout E — `ECON-RV08-HOLDOUT-E`
- Heldout F — `ECON-RV08-HOLDOUT-F`

All shards passed no-mutation-by-audit, exact diagnostic replay, exact canonical replay, canonical accounting/ledger health, and observation-presence gates.

## Cross-seed results

| Metric | Original A | Original C | Heldout E | Heldout F |
|---|---:|---:|---:|---:|
| Active firm-months | 2705 | 2696 | 2665 | 2654 |
| Revenue below payroll share | 90.98% | 90.84% | 90.88% | 90.35% |
| Gross operating cash negative share | 91.72% | 91.62% | 91.89% | 91.18% |
| Mean sales/output ratio | 1.610 | 1.461 | 1.754 | 1.386 |
| Mean inventory/output ratio | 4.755 | 8.115 | 5.797 | 2.529 |
| Mean field revenue/payroll ratio | 0.01351 | 0.01311 | 0.01332 | 0.01197 |
| Mean absolute cash residual | 260.55 | 273.86 | 271.60 | 272.88 |
| Firm exits | 244 | 247 | 243 | 256 |

Cross-seed mean revenue-below-payroll share is about **90.76%** and mean operating-cash-negative share is about **91.60%**.

## Flag structure

The same structure repeats across original and heldout seeds:
- `INPUT_BLOCKED`: roughly 1.36k–1.45k firm-months;
- `PRODUCTION_WITHOUT_SALES`: roughly 670–722;
- `INVENTORY_ACCUMULATION`: roughly 449–521;
- `LOW_REALIZED_MARGIN`: roughly 1.18k–1.26k;
- `PAYROLL_DRAIN`: roughly 1.17k–1.25k;
- `DEBT_SERVICE_DRAIN`: 0 under the current classifier;
- `UNRESOLVED_ACCOUNTING_TIMING`: roughly 1.76k–1.83k;
- `CASH_CONVERSION_OK`: only 5–14 firm-months per seed.

## Interpretation

The evidence strongly rejects the hypothesis that the R4-CF-E repayment failure is primarily caused by debt service. It also shows that input blocking and weak realized operating margin coexist with widespread payroll pressure.

However, **R4-CG must not be used to authorize a wage cut or direct margin tuning.** The measured mean `firm.revenue / payrollDue` ratio is extremely low while sales/output ratios are not equivalently low, and the audit reports very large unexplained cash residuals in a majority of observed firm-months. Therefore the next dependency-safe task is to determine whether the apparent margin collapse is a real economic condition or partly an observability/timing mismatch between mutable firm fields and settlement-ledger cash flows.

Canonical goods-market code explicitly books successful household purchases as ledger transfers to the seller and increments seller `sales`, `revenue`, `consumerSales`, and `consumerRevenue`. Payroll settlement separately transfers firm cash to employed households. A ledger-native attribution audit is therefore required before any canonical margin/payroll modification.

## Decision

Do **not** mutate canonical wages, prices, payroll timing, trade credit, or bank rules yet.

Proceed to **WP-RV08-R4-CH — Settlement-Native Revenue / Payroll / Timing Attribution Audit**.

R4-CH must reconcile firm cash changes against ledger-native transaction classes and compare them to mutable end-of-month `firm.revenue`/`firm.sales` fields. Only after this observability gap is closed may the project run a causal factorial on demand realization, input procurement, and payroll timing.