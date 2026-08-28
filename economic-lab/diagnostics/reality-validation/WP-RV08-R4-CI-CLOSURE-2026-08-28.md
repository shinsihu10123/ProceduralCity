# WP-RV08-R4-CI Closure — Settlement Support Dependency

Date: 2026-08-28
Branch: `scratch/new-project-2026-08-12`
Authoritative run: `33137562473`
Run head: `b22547d703d7fb4ae5cdc07d1bc08699dae40a58`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / CANONICAL MUTATION NOT APPROVED**

R4-CI passed all harness and accounting gates across original A/C and heldout E/F. The result establishes that weak firm operating cash generation is not an artifact of the R4-CH observer. It also identifies the exact non-operating settlement kinds supporting firms.

## Hard gates

All four seeds passed:

- noMutationByAudit
- exactDiagnosticReplay
- exactCanonicalReplay
- hardAccountingHealthy
- observationsPresent
- cashReconciliationExact
- perKindReconciles

## Seed summaries

| Seed | Operating-only negative | +Finance negative | +Other negative | Actual settlement negative | Mean operating inflow | Mean payroll out | Mean finance net | Mean other net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Original A | 69.32% | 71.09% | 62.81% | 62.88% | 3.510 | 301.482 | 42.413 | 1.815 |
| Original C | 69.21% | 71.22% | 62.39% | 62.43% | 3.611 | 314.886 | 44.665 | 1.870 |
| Heldout E | 68.63% | 70.13% | 62.06% | 62.06% | 3.731 | 311.653 | 43.371 | 1.885 |
| Heldout F | 69.25% | 71.63% | 60.96% | 60.96% | 3.736 | 311.220 | 39.563 | 1.937 |

The cross-seed pattern is stable: roughly 69% of active firm-months are negative on operating cash flow alone, while actual settlement remains negative for roughly 61–63% even after finance and other flows.

## Exact settlement kinds recovered

The largest recurring firm-account kinds were:

- `wage` — dominant payroll outflow.
- `bank_loan_origination` — financing inflow.
- `equity_subscription` — financing inflow, with thousands of postings per run.
- `bank_loan_payment` — financing outflow.
- `goods_purchase` — consumer operating revenue.
- `interfirm_purchase` — B2B operating settlement.
- `capital_investment` — capital-goods operating settlement.
- `fx_export_receipt` / `fx_import_payment` — external settlement flows.
- `public_investment` and `government_consumption` — public-sector inflows to firms.
- `tariff_payment`, `corporate_tax` — fiscal outflows.

## Material causal findings

### 1. Operating revenue is structurally tiny relative to payroll settlement

Across all four seeds mean firm-month operating inflow is only about 3.5–3.7 settlement units, while realized payroll outflow is about 301–315. This order-of-magnitude gap survives corrected ledger-native accounting and heldout seeds.

### 2. Finance is not a clean rescue mechanism

Despite positive mean finance net flow, adding finance does not generally eliminate negative firm-months and sometimes increases the negative-share statistic because financing and repayment occur in different firm-months. Financing therefore cannot be treated as evidence that operating economics are viable.

### 3. `OTHER` is now explained rather than unknown

The prior R4-CH `OTHER` bucket is largely composed of FX settlement, public investment, government consumption, tariffs, and related flows. These flows improve the sign of a non-trivial subset of firm-months, but do not restore broad operating viability.

### 4. Industry heterogeneity is strong

Consumer firms are the most persistently weak operating cohort: operating-only negative shares are roughly 89–91% across the sampled seeds. Materials and resource firms are materially less negative, while capital-goods firms are intermediate but still weak.

### 5. The next question is scale coherence, not another financing patch

Given the stable gap between operating inflow and payroll, the next causal test must measure whether the model's wage, price, worker-count, output, and sales units are mutually coherent. Raising credit limits, adding trade credit, or injecting more equity before this test would risk financing a unit-scale inconsistency rather than correcting an economic mechanism.

## Artifact provenance

- Original A: artifact `9672622745`, digest `sha256:a2de8f42db537509ab7c4871e98d55d5e329aff50107376c8c4780d0eb1e2aec`
- Original C: artifact `9672624034`, digest `sha256:dd9f38b08472c2f9e0df8e13a96602700c90764e898232376a7cac54746c88d3`
- Heldout E: artifact `9672624439`, digest `sha256:5efaa05e2e7264641037cf404b5aafdc8881560a9925d604138fd63f71ba5117`
- Heldout F: artifact `9672630025`, digest `sha256:b5db5042d44cdde5579263a696c57ac77c627133541c3e0020850f7393a6dc1c`

## Lock state

Canonical labor, wage, pricing, banking, accounting, supply-chain, trade-credit, fiscal, and firm-behavior switches remain locked.

Next: **R4-CJ — Firm Unit-Scale / Payroll Burden / Break-Even Coherence Audit**.
