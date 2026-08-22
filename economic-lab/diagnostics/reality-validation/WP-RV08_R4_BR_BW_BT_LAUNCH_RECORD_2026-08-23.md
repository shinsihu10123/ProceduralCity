# WP-RV08 R4-BR–BW + R4-BT Launch Record — 2026-08-23

## Purpose

Durable recovery record for the widened Economic Lab diagnostic frontier. This file records actual Actions launches and repository commits so later continuation can recover from repository truth without relying on conversation memory.

## Completed immediately before launch

R4-BM / R4-BN / R4-BQ were formally closed with corrected complete four-seed aggregation.

Complete integrated run `32584670965`:

- entrants: 922
- entrant exits: 797
- payroll/liquidity-classified entrant exits: 797
- firm credit applications: 891
- approvals: 35 (~3.93%)
- mean firm wage-change share: ~0.193%
- observed wage-down share: 0%
- mean price-move share: ~96.42%

Permanent closure/evidence:

- `WP-RV08_R4_BM_BN_BQ_CLOSURE_2026-08-23.md`
- `evidence/WP-RV08_R4_BM_BN_BQ_COMPACT_2026-08-23.csv`

## Wide-frontier execution contract

File:
`WP-RV08_R4_BR_BW_EXECUTION_2026-08-23.md`

Commit:
`00df501d007ba84007d2c527fe822e654b5c47e8`

## Wide-frontier workflow

Workflow:
`.github/workflows/economic-lab-rv08-r4-br-bw-wide-frontier.yml`

Launch commit:
`cd898dc4c5e417c47c7c11ffe069b95d011da5b2`

Actions run:
`32590980993`

Initial verified state:
- launch beacon success
- all reported diagnostic jobs in the first bounded status check had entered `in_progress`
- no job result had yet been interpreted

Launched fronts:

- R4-BR cash-flow waterfall: original A, original C, heldout E, heldout F as independent shards
- R4-BR entrant finance lifecycle
- R4-BS credit rejection trace
- R4-BS underwriting/current-plan timing matrix
- R4-BU demographic labor-force structure
- R4-BU working-age feasibility
- R4-BU household/person labor-unit ontology
- R4-BU labor eligibility counterfactual
- R4-BV exit-estate stranded-assets audit
- R4-BV estate recycling upper-bound matrix
- R4-BV accounting/tax/estate factorial
- R4-BV restructure/liquidation state machine
- R4-BW economic ecosystem structural audit
- R4-BW institutional maturity network census

This is intentionally a wider, dependency-safe parallel batch. Each front uploads an independent artifact/log.

## R4-BT wage-flexibility causal ablation

New script:
`economic-lab/scripts/rv08-wage-flexibility-stress-ablation-v10.mjs`

Script commit:
`853dc6b4b486d9a1d3c95ec5d966e2be4893ac4c`

Workflow:
`.github/workflows/economic-lab-rv08-r4-bt-wage-flexibility.yml`

Launch commit:
`83613beba00d429732dd11142400d7466dbc4b28`

Actions run:
`32591057266`

Initial verified state:
- commit status context `economic-lab/wp-rv08-r4-bt` = pending
- no economic result interpreted yet

Matrix:
- original A
- original C
- heldout E
- heldout F
- 36 months per regime

Regimes:
1. canonical control
2. stress-triggered -0.5% wage step
3. stress-triggered -1.0% wage step
4. stress-triggered -2.0% wage step with 80% anchor floor

The intervention is only applied to firms with workers, payroll/liquidity stress, and no current vacancy. It measures payroll relief against household labor income, consumption, real-wage proxy, output, GDP, unemployment, exits, credit, and arrears. Accounting, ledger, GDP-identity, health, deterministic-control, normalization, intervention-activation, and finite-data gates are hard requirements.

## Interpretation rule

Do not call a wage-flex regime a success merely because wage arrears fall. If household labor income, consumption, output, or employment collapse enough to offset the firm-side gain, classify the intervention as collapse displacement rather than repair.

Likewise, estate recycling is currently an upper-bound physical reallocation experiment unless an accounting-preserving arm's-length settlement mechanism is separately demonstrated.

## Next recovery action

On continuation:

1. perform one bounded status check of run `32590980993`;
2. perform one bounded status check of run `32591057266`;
3. fetch only completed artifacts or failed-job logs;
4. classify observational failure separately from workflow/instrumentation failure;
5. synthesize BR/BS/BU/BV/BW independently before cross-front interaction tests;
6. if BT passes, compare all four regimes across all four seedcases and explicitly test firm-side relief versus household-demand damage;
7. select only supported mechanisms for the next interaction/factorial stage (provisional R4-BX).

No canonical repair has been authorized.
