# WP-RV07-P4 Closure — Working-Capital Bridge Ablation

Date: 2026-08-20

## Verdict

**FAIL-CONTINUE — hard gates PASS, causal repair candidate rejected.**

The experiment was designed as a causal upper-bound test of the hypothesis that the residual deterioration remaining after the WP-RV07 unit-basis candidate is mainly caused by the fact that payroll is settled before household-goods revenue arrives in the same month.

The bridge itself was **not** a canonical model change and is **not admitted for merge**.

## Execution evidence

- GitHub Actions run: `32260190612`
- Head: `5e69447f6def876f86e0577d8dd901d68e95f80a`
- Artifact: `economic-lab-wp-rv07-p4`
- Artifact ID: `9367969690`
- Artifact digest: `sha256:1da3e65805b1a0d36889e6b96ee817d1f18314e623b43c2de1c9eaac74867b96`
- Scope: compact + baseline, 3 seeds, 12 months, paired unit-basis control vs collateralized payroll bridge.

## Hard gates

All hard gates passed:

- deterministic replay exact
- all world health checks
- complete coverage
- bridge issuance ledger reconciliation
- bridge repayment ledger reconciliation
- bridge loan structural validity
- settlement-ledger country verification
- GDP identity reconciliation

Therefore the negative result is interpretable as an economic/mechanism result rather than a broken accounting experiment.

## Verified outcome

### Baseline, full 12-month window

| Metric | Unit-basis control | Unit-basis + bridge | Difference |
|---|---:|---:|---:|
| Mean unemployment | 0.2514 | 0.2501 | -0.0013 |
| Firm exits | 248 | 252 | +4 |
| Mean wage arrears | 64,933.2 | 63,345.4 | -1,587.8 |
| Goods fulfillment | 0.5575 | 0.5513 | -0.0062 |
| Mean input shortage units | 40.6140 | 41.2512 approx. | +0.6372 |
| Bridge issued | 0 | 26,999.4 | — |
| Same-month bridge repayment rate | — | 0.9185 | — |

### Compact, full 12-month window

The bridge was directionally worse on several principal outcomes: unemployment increased by about 0.0084, exits increased by 1, wage arrears increased by about 280, and goods fulfillment declined by about 0.0040.

## Interpretation classification

### A — VERIFIED EXISTING FACT

1. The bridge can be implemented while preserving accounting and deterministic invariants.
2. In baseline, about 91.85% of issued bridge principal was repaid in the same month.
3. Despite this, aggregate unemployment and goods-market fulfillment were essentially unchanged, while firm exits increased slightly.
4. In the unit-basis control, baseline mean input shortage rose sharply after the early window: approximately 8.5 units in M1–3, 51.4 in M4–6, 43.1 in M7–9, and 59.5 in M10–12.

### B — DIAGNOSTIC LEAD

The payroll-before-sales timing channel exists, but it is not the dominant residual collapse mechanism over the 12-month horizon. The post-unit-basis residual increasingly coincides with intermediate-input shortage and supply-chain/output loss.

### C — HYPOTHESIS

The next hypothesis is that the remaining deterioration is generated mainly by one or more of the following supply-chain mechanisms:

- insufficient sellable upstream inventory at the procurement boundary;
- buyer cash-budget constraint in `procureInputs` (`42%` of current cash);
- supplier search / five-round procurement limitation;
- one-period timing between procurement and same-month upstream production;
- upstream production planning based on lagged realized sales and target inventory, producing a self-reinforcing intermediate-input shortage.

No one item above is yet established as the root cause.

## Decision

Do **not** merge the payroll bridge. Proceed to **WP-RV07-P5 Supply-Chain Bottleneck Decomposition** with diagnostic-only instrumentation and exact non-interference/reconciliation gates.
