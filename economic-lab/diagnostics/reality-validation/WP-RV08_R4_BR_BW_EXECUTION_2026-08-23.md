# WP-RV08 R4-BR–BW Wide-Frontier Execution Contract — 2026-08-23

## Mode

**ACTUAL EXECUTION / WIDE-BATCH / DIAGNOSE BEFORE REPAIR**

This work package widens the Economic Lab causal frontier after R4-BM / R4-BN / R4-BQ. It is designed for throughput: independent diagnostic fronts execute in parallel, preserve separate artifacts, and are synthesized only after their own hard gates are inspected.

No result in this batch authorizes a canonical repair by itself.

## Repository truth

- repository: `shinsihu10123/ProceduralCity`
- branch: `scratch/new-project-2026-08-12`
- frozen historical baseline remains unchanged
- current source / branch HEAD / Actions / artifacts override conversational memory

## Shared execution policy

- original and heldout seed coverage whenever the script supports external seeds
- primary horizon: 36 months
- structural ecosystem census may run 48 months where its own contract requires it
- transformed unit basis and diagnostic productive normalization are preserved only where the reused diagnostic already defines them
- observer instrumentation must be state-neutral and must pass the script's own non-interference gate when available
- ledger/accounting/GDP/finite-data/health gates remain hard gates where the reused script exposes them
- an intervention result is a causal diagnostic, not a production patch
- artifacts are retained independently so failure or improvement in one subsystem cannot hide another subsystem

## Frontier map

### R4-BR — Entrant payroll/liquidity ultimate-cause waterfall

R4-BN established that the complete four-seed set contains 922 entrants, 797 entrant exits, and all 797 classified entrant exits reach the payroll/liquidity trigger. R4-BR now decomposes the mechanism *before* that trigger.

Questions:

- Does the entrant obtain workers before distress?
- Does it obtain working capital / credit before first payroll?
- Does it acquire required inputs and productive capital?
- Does it produce before the liquidity clock advances?
- Does it realize revenue before payroll becomes binding?
- What are pre-payroll cash, current payroll need, wage arrears, revenue, output, working-capital need, debt service, taxes, investment drains, and credit misses?
- At what entrant age does each stage first occur?
- Which sector and seed combinations fail at which stage?

Primary reused diagnostics:

- `rv08-exit-candidate-cashflow-waterfall-v10.mjs`
- `entrant-finance-lifecycle-audit-v10.mjs`

Hypotheses:

- H-BR-1: zero/low startup liquidity causes entrants to enter payroll distress before the first sustainable revenue cycle.
- H-BR-2: labor/input/capital bootstrap failure precedes liquidity failure for a material subset.
- H-BR-3: credit timing or absence compounds but does not independently explain all entrant failures.

### R4-BS — Credit rejection path and underwriting-timing decomposition

R4-BQ observed 891 firm applications and only 35 approvals (~3.93%), while approved borrowers had much higher prior revenue and modestly higher survival. R4-BS separates borrower weakness from banking constraints.

Questions:

- application generated vs no application
- bank balance-sheet/headroom constraint
- requested amount relative to payroll and working-capital need
- hard risk / affordability / capital constraints
- timing: canonical pre-plan application vs post-plan exact need
- entrant-specific supplemental credit effects
- approval, output, revenue, re-exit, defaults, and charge-offs

Primary reused diagnostics:

- `entrant-credit-rejection-trace-audit-v10.mjs`
- `rv08-entrant-underwriting-timing-matrix-v10.mjs`

Hypotheses:

- H-BS-1: low approval is materially applicant-quality driven.
- H-BS-2: canonical credit timing understates current-plan working-capital needs.
- H-BS-3: relaxing underwriting alone creates credit/default problems unless production/revenue viability also improves.

### R4-BT — Wage-flexibility causal frontier

R4-BM found firm wages change in only ~0.193% of comparable firm-months, with no observed wage-down event, while prices move in ~96.42%. Canonical labor-market source contains upward vacancy-driven wage adjustment but no symmetric downward payroll-stress mechanism in the currently verified source.

This front is explicitly causal and must measure both sides of the trade-off:

- payroll affordability / wage arrears / exits
- unemployment / hiring / vacancies
- household labor income / consumption
- real wage relative to price level
- output and revenue

Initial regimes to implement after source-safe validation:

1. canonical control
2. mild stress-triggered nominal wage reduction
3. stronger bounded stress-triggered wage reduction
4. bounded wage reduction with a real/nominal floor

A fall in arrears accompanied by equally destructive household-demand collapse is **not** a successful repair.

Hypotheses:

- H-BT-1: nominal wage rigidity materially amplifies payroll distress.
- H-BT-2: aggressive wage flexibility merely transfers the collapse from firms to household demand.
- H-BT-3: an interior bounded zone may exist, but only if real-income and demand damage remain contained.

R4-BT is kept as its own causal workflow so implementation validation failure cannot block the observational wide frontier.

### R4-BU — Labor-force / demographic ontology

Canonical unemployment currently treats household units as the labor denominator and lacks a mature working-age / participation ontology. This front distinguishes a measurement defect from a behavioral defect.

Questions:

- population unit vs household unit vs person-equivalent interpretation
- working-age feasibility
- participation / eligibility overlay
- measurement-only denominator change vs actual labor eligibility change
- employment, output, household income, consumption, fiscal burden, and dependency-ratio implications

Primary reused diagnostics:

- `rv08-demographic-labor-force-structure-audit-v10.mjs`
- `rv08-working-age-labor-force-feasibility-audit-v10.mjs`
- `rv08-household-person-labor-unit-ontology-audit-v10.mjs`
- `rv08-labor-eligibility-counterfactual-v10.mjs`

Rule: simply lowering the reported unemployment denominator is never counted as an economic improvement.

### R4-BV — Exit estate liquidation / physical asset recycling

Prior audits show a large stock of capital can remain with inactive firms. R4-BV expands the liquidation/recycling diagnosis.

Questions:

- capital and inventory trapped at exit
- immediate vs delayed recycling
- recycling while preserving worker claims
- estate/accounting/tax treatment
- active-capital share, entrant bootstrap, output, employment, arrears, creditor/wage recovery

Primary reused diagnostics:

- `rv08-exit-estate-stranded-assets-audit-v10.mjs`
- `rv08-estate-recycling-counterfactual-matrix-v10.mjs`
- `rv08-accounting-tax-estate-factorial-v10.mjs`
- `rv08-restructure-liquidation-state-machine-v10.mjs`

Important limitation: the existing estate-recycling matrix is an **upper-bound physical reallocation experiment** and is not automatically an accounting-preserving arm's-length liquidation market. A production repair must not create free wealth.

### R4-BW — Ownership / profit / institutional circulation

This front audits whether firm surplus is transmitted into household ownership income, savings, consumption, investment, and re-capitalization strongly enough to form a closed macroeconomic circulation.

Questions:

- household equity/portfolio penetration
- public vs household ownership stocks
- dividend/profit distribution pathways if present
- retained earnings vs household income circulation
- bank/firm/household network maturity
- inactive/active firm stock and capital concentration
- institutional breadth and missing market nodes

Primary reused diagnostics:

- `rv08-economic-ecosystem-structural-audit-v10.mjs`
- `rv08-institutional-maturity-network-census-v10.mjs`

A stock-ownership observation is not enough; later causal work must trace actual ledger flows before adding a dividend rule.

## Execution architecture

The initial wide workflow runs the mature existing diagnostics in parallel. Jobs remain independent and upload logs and native JSON/CSV outputs when produced. It is intentionally broader than the previous single-question batches.

Target parallel fronts:

- BR cash-flow waterfall: 4 seed shards
- BR entrant lifecycle: 1 four-seed baseline job
- BS rejection trace: 1 job
- BS underwriting/timing matrix: 1 four-seed baseline job
- BU demographic structure: 1 job
- BU working-age feasibility: 1 job
- BU household/person ontology: 1 job
- BU eligibility counterfactual: 1 job
- BV stranded-estate audit: 1 job
- BV recycling matrix: 1 job
- BV accounting/tax/estate factorial: 1 job
- BV restructure/liquidation state machine: 1 job
- BW ecosystem structural audit: 1 job
- BW institutional network census: 1 job

This produces a substantially wider evidence surface in one Actions launch instead of waiting for serial front-by-front execution.

## Synthesis gate

Do not produce a structural repair recommendation until:

1. artifacts are complete enough to distinguish execution failure from economic failure;
2. each result is classified as existing fact, diagnostic lead, hypothesis, or proposed change;
3. original vs heldout agreement is inspected where available;
4. accounting/ledger/GDP/observer invariants are checked;
5. improvements are tested for displacement into another subsystem;
6. proximate triggers are not mislabeled as ultimate causes.

## Immediate follow-on

After the observational wide frontier is launched, R4-BT is implemented and run separately. Then a synthesis batch selects only evidence-supported mechanisms for higher-order factorial interaction tests (provisional R4-BX) rather than brute-force tuning.
