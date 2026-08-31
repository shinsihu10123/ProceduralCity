# WP-RV08 R4-CU-D3D-B3 Model-Side National Accounts Closure v0.1

## Decision

**CLOSED / PASS AS INTERNALLY RECONCILED MODEL-SIDE COMPARATOR / SEVERE EMPIRICAL GAP EXPOSED / CANONICAL MUTATION NOT AUTHORIZED**

## Authoritative evidence

- Branch: `scratch/new-project-2026-08-12`
- Authoritative head: `039014ec511bfbd9d836ab6e7bb385c313d98b39`
- GitHub Actions run: `33355197080`
- Matrix: Original A/C + Heldout E/F, 24 months each
- Country-months per seed: 96
- Exact canonical replay: PASS on all seeds
- Exact diagnostic replay: PASS on all seeds
- Hard accounting health: PASS on all seeds
- Final beacon: SUCCESS

Artifacts:

| Case | Artifact ID | ZIP SHA-256 |
|---|---:|---|
| Original A | 9744907149 | `9b29c382a244d0758ccba51c85b5deb551bae8114edf14f95d72be67227b4e65` |
| Original C | 9744905232 | `947a923d12d08fa9fbc8269149e49875ba4bd82d0a3f5a59201d63e7f9ba2694` |
| Heldout E | 9744905859 | `cca7bb6cd3229ce58fbf71a78ae83027d56a96cb726d9df3df27bcb59ed99ded` |
| Heldout F | 9744911079 | `a1de101161cd2f8a048c5dac748241203d5482b4172fad328b7ca6b5420dbfe0` |

## Reconstruction integrity

All registered identities passed with maximum scaled residuals between `4.60e-13` and `7.02e-13`.

The following model-side boundaries now reconcile:

- firm wage accrual equals household wage-income accrual;
- opening wages payable plus accrual minus cash settlement equals closing wages payable;
- the matching household wage-receivable bridge;
- finished-goods and input-inventory book stock-flow identities;
- production- and income-side GVA proxies;
- household cash changes and settlement postings;
- settled wages, transfers, income taxes and disposable-income fields;
- household consumption expense, domestic purchases, consumer imports and product taxes;
- fiscal consumption tax and international tariff totals.

The canonical operational `macro.gdp` is numerically almost identical to the reconstructed market-price GDP proxy: its median ratio is `0.99992–0.99995` across the four seeds. The earlier collapse findings are therefore not explained by a gross discrepancy between these two GDP aggregations.

## Model-side distributions

| Seed | Median employee compensation / GVA | Share of country-months above 1.0 | Median realized consumption / cash disposable income | Median net saving / cash disposable income | Non-positive GVA share |
|---|---:|---:|---:|---:|---:|
| Original A | 2.1854 | 77.08% | 0.001237 | 0.998763 | 3.13% |
| Original C | 2.3000 | 86.46% | 0.001904 | 0.998096 | 1.04% |
| Heldout E | 2.0443 | 81.25% | 0.001424 | 0.998576 | 0.00% |
| Heldout F | 2.6964 | 88.54% | 0.001849 | 0.998151 | 3.13% |

The compensation ratios are fractions, not percentages. A median of `2.1854` means accrued employee compensation equals roughly **218.5% of reconstructed domestic GVA**, before adding the self-employed/mixed-income component present in the external ILO labour-income-share concept.

The household ratios are also fractions. Median realized household purchaser outlay is only about **0.12–0.19% of cash disposable household income**, while the corresponding net-saving-flow proxy is about **99.81–99.88%**.

## Denominator pathology

A small share of country-months has non-positive reconstructed GVA. Those observations produce negative or very large labour-share ratios, including the Heldout F minimum. They are retained rather than silently discarded. Robust medians and a positive-GVA sensitivity view are required in the next front.

This is an economic result, not an accounting failure: the stock-flow identities remain reconciled while the modeled value-added denominator can collapse to zero or below.

## Relation to admitted empirical evidence

R4-CU-D3D-B1 found provisional ILOSTAT labour-income-share cohort medians of about `53.12–58.96%`, with outer cohort IQR endpoints of about `52.16–60.71%`.

R4-CU-D3D-B2 found admitted OECD realized-consumption counterparts around `91.48–92.95%` of compatible net disposable income for the two coverage-admitted cohorts.

B3 does not yet declare a direct semantic equivalence. The model comparator omits employer social contributions, self-employed/mixed labour income and several national-accounts adjustments. Nevertheless, the observed model values are separated from the external reference evidence by orders of magnitude, not marginal definitional differences.

## Semantic gaps retained

No value was silently imputed for:

- employer social contributions;
- self-employed and mixed labour income;
- pension-entitlement adjustment;
- property income and social transfers in kind;
- bank FISIM and non-market government output;
- consumption of fixed capital.

Therefore B3 is an internally valid comparator, but not yet a direct canonical target.

## Anti-tuning lock

This closure does **not** authorize:

- dividing wages by the observed national labour-share wedge;
- multiplying productivity or prices until a reference median is hit;
- setting `desiredConsumptionBudget` to the OECD realized-consumption share;
- interpreting household deposit accumulation as net saving;
- removing non-positive-GVA observations after seeing their values;
- assigning an empirical cohort directly to a fictional country;
- canonical economic mutation.

## Next dependency-safe front

`R4-CU-D3D-B4`: perform the preregistered empirical-versus-model dimensionless gap audit using positive-denominator sensitivity views, preserve partial semantic-match flags, and decide which empirical bands may constrain shadow candidates without becoming direct canonical parameter targets.
