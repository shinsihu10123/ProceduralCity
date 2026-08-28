# WP-RV08-R4-CJ Closure — 2026-08-28

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / UNIT-SCALE INCOHERENCE CONFIRMED / CANONICAL MUTATION NOT YET APPROVED**

## Authoritative execution

- Branch: `scratch/new-project-2026-08-12`
- Run: `33137843392`
- Run head: `3ccfc452f013d550ddc5b1b2e3c1114b2d525194`
- Matrix: Original A, Original C, Heldout E, Heldout F
- Horizon: 24 months each
- Result: 4/4 matrix jobs PASS; final beacon PASS.

All hard diagnostic gates passed in every seed: exact diagnostic replay, exact canonical replay, hard accounting health, exact cash reconciliation, finite break-even values, observations present, and all four countries observed.

## Cross-seed result

The same structural pattern reproduced across original and heldout seeds.

| Metric | Original A | Original C | Heldout E | Heldout F |
|---|---:|---:|---:|---:|
| Mean operating revenue / firm-month | 3.510 | 3.611 | 3.731 | 3.736 |
| Mean actual payroll settlement | 301.482 | 314.886 | 311.653 | 311.220 |
| Mean workers | 5.861 | 6.033 | 6.042 | 6.109 |
| Mean wage | 96.321 | 96.323 | 94.880 | 96.426 |
| Mean product price | 0.946 | 0.936 | 0.929 | 0.973 |
| Mean sales units | 4.543 | 4.716 | 4.855 | 4.959 |
| Mean output units | 4.982 | 5.291 | 5.268 | 5.481 |
| Median actual-payroll break-even units | 106.57 | 108.82 | 103.63 | 109.33 |
| Median wage / price ratio | 106.58 | 106.88 | 104.17 | 106.59 |
| Physical-output-insufficient share | 63.29% | 62.69% | 62.36% | 60.36% |
| Nominal-payroll-scale-stress share | 90.98% | 90.84% | 90.88% | 90.35% |
| Price-wage-scale-stress share | 90.43% | 90.36% | 90.32% | 90.13% |
| Operating revenue covers payroll | 5.18% | 4.75% | 4.50% | 6.63% |

The typical active firm produces and sells only a few model output units per month while one worker's wage is roughly one hundred product-price units. A payroll-paying firm therefore commonly needs roughly one hundred-plus units of sales at the current price merely to cover the actual wage settlement, despite actual output commonly being around five units.

## Industry evidence

The mismatch is not confined to one industry. Consumer firms show the most pervasive physical insufficiency (roughly 82–86% across observed seeds), while resource and materials firms also exhibit extremely high wage-to-price and payroll break-even requirements. Capital-goods firms perform relatively better but still show widespread scale stress.

Therefore the finding is not adequately explained as a single consumer-demand problem, a single supply-chain bottleneck, or a single industry's bad pricing rule.

## Interpretation

R4-CJ confirms a **unit-scale coherence defect** between at least three canonical dimensions:

1. wage/payroll denomination,
2. product price denomination,
3. physical production/sales quantity scale.

It does **not** by itself identify which dimension is the canonical defect. Multiplying prices, dividing wages, or multiplying physical output can each algebraically improve break-even coverage, but those transformations have materially different general-equilibrium meanings. A repair must therefore not be selected by whichever scalar makes the ratio look normal.

This also explains why previous financing and trade-credit diagnostics could provide temporary liquidity relief without restoring durable viability: financing cannot repair an underlying nominal/physical scale mismatch.

## Locked decisions

The following remain prohibited after R4-CJ:

- arbitrary wage reduction;
- arbitrary product-price multiplication;
- arbitrary output multiplication;
- broader bank credit or trade-credit limits to mask the gap;
- canonical labor/supply-chain/accounting/banking behavior switches based only on this result.

## Next causal gate

Proceed to **R4-CK — Unit-Scale Factorial Shadow Normalization Audit**.

R4-CK must remain mutation-free and compare independent counterfactual scalars for payroll, price/revenue denomination, and physical quantity capacity. It must report which scalar families can restore payroll coverage, how large the required normalization is, and whether the result is stable across countries/industries/seeds. The purpose is causal localization, not calibration.
