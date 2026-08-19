# WP-RV07-P7 Closure — Procurement Cash-Reservation Ablation

Date: 2026-08-20

Verdict: **FAIL-CONTINUE — HARD GATES PASS, CASH-RESERVATION REPAIR REJECTED**

## A. VERIFIED EXISTING FACTS

- GitHub Actions run `32276330611` completed successfully.
- Artifact: `economic-lab-wp-rv07-p7`, artifact ID `9374181856`, SHA-256 `f1289658a49d5ebba3b765868870bab8f89e8c3ab4f78f99bb8938cf33096127`.
- All hard gates passed: deterministic replay, health, complete coverage, supply-shortage reconciliation, settlement-ledger verification, GDP identity, finite rows.
- The control preserved the existing procurement budget rule `cash × 0.42`.
- The causal upper-bound candidate changed only the procurement cash reservation by permitting use of full currently available cash. Supplier selection, round cap, prices, transaction order, inventory transfer, and accounting logic were otherwise preserved.
- Canonical economic mechanism changes: 0.
- Canonical parameter tuning: 0.
- Repair merge: 0.

## B. DIAGNOSTIC RESULTS

### Baseline, full 12-month panel

| Metric | Unit-basis control | Full-cash procurement | Difference |
|---|---:|---:|---:|
| Mean unemployment | 0.2514 | 0.2524 | +0.0010 |
| Firm exits | 248 | 253 | +5 |
| Mean wage arrears | 64,933.2 | 64,416.5 | -516.7 |
| Goods fulfillment | 0.5575 | 0.5667 | +0.0093 |
| Mean input shortage | 40.614 | 36.353 | -4.261 |
| Input shortage ratio | 1.000 | 0.895 | -10.5% |

The candidate reduced baseline input shortage by only about 10.5% over the full horizon. It did not materially reduce unemployment and increased firm exits by five.

### Baseline windows

- M1–3: input shortage ratio 0.907; unemployment essentially unchanged.
- M4–6: input shortage ratio 0.911; unemployment +0.0037.
- M7–9: input shortage ratio 0.887; unemployment -0.0038 but exits +2.
- M10–12: input shortage ratio 0.885; goods fulfillment +0.0348, unemployment +0.0039, exits +3.

### Compact

The same qualitative conclusion held. Full-cash procurement reduced input shortage modestly but did not stabilize the economy; full-horizon unemployment increased from 0.2217 to 0.2283 and exits increased from 57 to 61.

## C. HYPOTHESIS VERDICT

### H-PB1

> The existing `cash × 0.42` procurement reservation is the dominant residual cause of the post-unit-basis collapse.

**FALSIFIED AS DOMINANT ROOT CAUSE.**

WP-RV07-P6 correctly identified `BUDGET_EXHAUSTED` as the dominant terminal branch under the frozen procurement rule. WP-RV07-P7 shows, however, that removing the reservation all the way to the full-cash upper bound removes only a minority of aggregate shortage and does not stabilize unemployment or firm survival. Therefore the stop-branch label was causal with respect to the local procurement transaction, but the 42% reservation itself is not the dominant system-level root cause.

## B. NEXT DIAGNOSTIC LEAD

WP-RV07-P5 found that same-month upstream production was often large relative to shortage that had already been recorded before production. The frozen monthly order is globally:

`planProduction → procureInputs(all industries) → produce(all industries)`.

The industry graph is acyclic:

`RESOURCE → MATERIALS → {CAPITAL, CONSUMER}`.

Therefore upstream output created later in the same month is unavailable to downstream procurement earlier in that month. This sequencing remains a stronger structural lead than further procurement-budget tuning.

## D. PROPOSED NEXT CHANGE

Proceed to a bounded diagnostic-only **topological same-month supply sequencing ablation**:

`produce RESOURCE → procure+produce MATERIALS → procure+produce CAPITAL/CONSUMER`.

The existing 42% procurement budget, supplier search, five-round limit, prices, settlement, and accounting mechanisms remain unchanged so that the ablation isolates physical availability timing.

This is not yet a production repair. In particular, selling same-month upstream output before the later wage-accrual stage raises cost-recognition semantics that must be addressed separately before any merge.
