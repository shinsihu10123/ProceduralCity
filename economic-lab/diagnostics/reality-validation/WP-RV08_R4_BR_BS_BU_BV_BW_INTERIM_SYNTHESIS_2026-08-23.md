# WP-RV08 R4-BR / BS / BU / BV / BW Interim Synthesis — 2026-08-23

## Status

**INTERIM SYNTHESIS — PARTIAL FRONTIER COMPLETION**

Actions run `32590980993` remains open because four long jobs are still running:

- R4-BR entrant finance lifecycle
- R4-BS underwriting timing matrix
- R4-BU demographic labor-force structure
- R4-BU labor eligibility counterfactual

The following fronts/jobs are already SUCCESS and their artifacts were inspected:

- R4-BR four-seed cash-flow waterfall: 4/4
- R4-BS credit rejection trace
- R4-BU working-age feasibility
- R4-BU household/person labor-unit ontology
- R4-BV stranded-assets audit
- R4-BV estate-recycling upper-bound matrix
- R4-BV accounting/tax/estate factorial
- R4-BV restructure/liquidation state machine
- R4-BW ecosystem structural audit
- R4-BW institutional maturity census

All inspected JSON artifacts report their own accounting/health/finite-data gates as PASS. This document intentionally does **not** close the whole BR–BW batch before the four remaining jobs finish.

## R4-BR — Exit-candidate cash-flow waterfall

Four independent seed shards completed for original A, original C, heldout E and heldout F, 36 months each. Four supply/base combinations were observed.

Aggregated candidate counts:

| Variant | Exit candidates | Exited | Liquidity-failure share | Severe-credit share | Operating inflow / payroll outflow |
|---|---:|---:|---:|---:|---:|
| consumer-canonical | 1,335 | 1,335 | 99.92% | 2.25% | 0.553 |
| consumer-topo-fullcash | 1,324 | 1,324 | 99.92% | 2.88% | 0.337 |
| materials-consumer-canonical | 1,333 | 1,333 | 99.85% | 3.30% | 0.812 |
| materials-consumer-topo-fullcash | 1,303 | 1,303 | 99.92% | 2.53% | 0.777 |

Additional common features:

- candidate mean closing cash is effectively zero;
- finance inflows are zero or negligible at the candidate stage;
- debt and tax outflows are small relative to payroll;
- operating inflows do not cover payroll, even before adding input outflows;
- perceived cash stress is ~0.99 in every aggregate variant.

### Interpretation

**A — VERIFIED:** immediate exit candidates are overwhelmingly an operating-cash / payroll-coverage failure, not a debt-service or corporate-tax trigger.

**A — VERIFIED:** generic supply topology / full-cash procurement does not remove the deficit.

**C — REJECTED:** severe credit delinquency is the proximate trigger for most candidate exits. Its incidence at the exit-candidate stage is only a few percent.

**B — LEAD:** the relevant credit question is earlier in the lifecycle: whether viable working capital arrives before the firm enters the near-zero-cash state.

R4-BR lifecycle timing remains open until the long entrant-lifecycle job completes.

## R4-BS — Credit rejection trace

The completed rejection-trace audit finds that the *first binding/reported* rejection category is dominated by `BANK_CAPITAL` across sectors and normalization regimes:

- RESOURCE: roughly 80–85% bank-capital first-gate share
- MATERIALS: roughly 86–88%
- CAPITAL: roughly 86–92%
- CONSUMER: roughly 98–99.6%

Affordability generally accounts for most of the remainder; the directly reported risk-limit first-gate share is small. However, the same trace shows:

- mean estimated default probability roughly 0.32–0.42;
- mean risk limit roughly 0.253;
- `riskAcceptableShare` is essentially zero in most cells;
- capital-safe share is very low, especially for CONSUMER;
- requested-to-income ratios are ~16× and liquidity-month measures are near zero.

### Interpretation

This is a **multiple-constraint credit failure**, not a safe basis for saying “the bank is simply too conservative.” Gate ordering makes bank capital the common first blocker, while borrower-risk and affordability metrics are also poor.

**A — VERIFIED:** bank balance-sheet headroom/capitalization is a major immediate credit-supply constraint in the trace.

**A — VERIFIED:** rejected applicant economics are also weak; removing bank capital alone would expose further risk/affordability gates.

**B — LEAD:** the next causal design must factor bank capitalization × underwriting × current-plan timing × entrant working-capital need rather than relax one threshold in isolation.

The larger underwriting/timing matrix remains in progress.

## R4-BU — Population, household/person ontology and labor feasibility

The household/person ontology audit confirms that the canonical household object is simultaneously used as:

- one labor slot (`employed`, `employerId`, wage, reservation wage, skill), and
- one household balance-sheet/consumption unit (wealth, account, savings, consumption, loan balance).

The inspected schema contains **zero explicit demographic fields** for age, birth/death, household size/members, children/dependents, student/retired state, labor-force participation or working-age eligibility.

Four-seed 36-month feasibility results under the consumer base are consistent:

- mean physical labor need: about **1.80–1.83 household-slots per household**;
- mean plan-economically-viable labor need: about **0.50–0.64 slots per household**;
- mean canonical desired jobs: only about **0.38–0.39 slots per household**.

At the current implicit assumption `1 household = 1 labor slot`:

- physical need exceeds available slots in roughly **83–92%** of observed months;
- viable need still exceeds slots in roughly **10–20%** of months;
- desired jobs never exceed the household pool on average because the target-formation mechanism is much lower than physical need.

At a hypothetical labor-force fraction of **60% of households**, the four seeds show approximately:

- viable need / labor force: **0.83–1.07**;
- viable need exceeds the labor force in roughly **44–49%** of months;
- desired jobs / labor force: roughly **0.64–0.65**;
- desired jobs exceed the labor force in roughly **27–32%** of months.

### Interpretation

This materially refines the earlier population question.

**C — REJECTED:** the collapse is simply caused by too few simulation agents. Canonical desired jobs remain far below physical need and large unemployment develops, so finite headcount alone is not the primary mechanism.

**A — VERIFIED:** the current household-as-one-worker ontology masks a major demographic modeling problem. Once a plausible working-age/participation fraction is imposed, even the plan-economically-viable labor requirement becomes close to or above feasible labor supply for a substantial fraction of months.

**B — STRONG LEAD:** population scale, household size, working-age share, participation and firm density must eventually be modeled separately. Merely multiplying household objects is not an adequate production repair because it simultaneously adds consumers, wealth accounts and workers.

The explicit eligibility counterfactual and demographic-structure long jobs remain in progress.

## R4-BV — Exit estates and stranded productive stocks

The four-seed stranded-asset audit confirms large quantities remain attached to inactive firms.

Consumer base:

- 1,335 exits
- ~4.68m finished-inventory book value observed at exit
- ~3.01m fixed assets at exit
- ~3.36m wages payable at exit
- immediate disposition of cash, finished inventory, fixed assets, wage payables and loans: **zero** in the diagnostic
- full-window inactive shares: ~67.3% of inventory book value, ~72.3% of physical inventory, ~38.3% of fixed assets, ~74.6% of wages payable

Materials+consumer base is similar:

- 1,333 exits
- inactive inventory book share ~67.9%
- inactive physical inventory share ~68.7%
- inactive fixed-asset share ~34.3%
- inactive wage-payable share ~73.0%

### Physical recycling upper-bound

The upper-bound recycling matrix separates capital from inventory transfer.

Consumer base vs no recycling:

- capital-only: unemployment -0.17 pp; consumer output +1.4%; essentially weak
- inventory-only: unemployment **-1.59 pp**; exits -189; consumer output **+17.9%**
- capital+inventory: unemployment **-1.66 pp**; exits -201; consumer output **+20.0%**; sales +16.2%
- entrant re-exit falls from 86.4% to 76.3% under capital+inventory

Materials+consumer base:

- capital-only: nearly neutral / slightly adverse unemployment
- inventory-only: unemployment **-3.83 pp**; exits -394; consumer output **+33.0%**
- capital+inventory: unemployment **-4.46 pp**; exits -362; consumer output **+34.2%**; sales +29.0%
- entrant re-exit falls from 86.7% to ~69.8% under capital+inventory

### Interpretation

**A — VERIFIED:** inactive estates strand economically material finished-goods/inventory stocks and fixed assets.

**A — VERIFIED:** in the upper-bound experiment, recycling **inventory** matters far more than transferring fixed capital alone.

**C — REJECTED:** stranded fixed capital by itself is the collapse root.

**C — REJECTED:** free physical recycling is sufficient; even the strongest upper-bound arm leaves severe collapse/re-exit.

**B — STRONG LEAD:** an accounting-preserving liquidation/secondary-market mechanism for inventory is worth testing. It must transfer value, pay a market/discounted price, and respect wage/creditor claims rather than create free wealth.

### Accounting representation

The accounting/tax/estate factorial shows that merely zeroing/reclassifying inactive book stocks does not rescue the real economy; it tends to reduce measured GDP/inventory investment and does little for unemployment or arrears. This again separates representation from real resource recovery.

### Restructure vs liquidation

The state-machine experiment replicates the earlier result at four-seed scale:

- consumer restructuring: mean unemployment about **-17.9 pp** vs control and 673 fewer exits, but arrears rise by ~90,988;
- materials+consumer restructuring: mean unemployment about **-28.0 pp**, 1,024 fewer exits, but arrears rise by ~91,925;
- adding estate handling raises output/active-firm retention further but does not remove the wage-liability problem.

Thus restructuring preserves employment/output at the cost of accumulating unpaid labor claims. It is not a solvency repair by itself.

## R4-BW — Economic ecosystem / institutional circulation census

The current completed BW scripts are **single-seed (`ECON-RV02-A`) raw-base structural censuses**. They are valuable architectural evidence but are not yet multi-seed causal evidence.

Opening-state facts include:

- 2,110 household objects, 170 firms, 4 banks, 4 governments, 4 central banks;
- household objects have no demographic/labor-force schema;
- all opening firms have positive finished inventory while `zeroFlowWithInventoryShare = 1`;
- input-using firms begin with zero input inventory;
- `previousSalesExactlyOneShare = 1`;
- `nullPlanShare = 1`;
- every initially employed household has zero current income before the first monthly settlement;
- only one unique household-belief state is present initially;
- household portfolio ownership is 0 at opening;
- cognition episode count is 0 at opening;
- no opening firm or household loans exist.

The 48-month institutional census later records:

- terminal active loans: 0;
- terminal public-share ratio ~4.1%; portfolio-owner share ~4.24%;
- only **2 job-to-job transitions**, versus 429 employment entries and 2,331 employment exits;
- 432 capital increases and **0 capital decreases** in the tracked census;
- 538 unique B2B pairs / 801 B2B transactions;
- 18 global funding contracts and 1,436 trade records.

### Interpretation

**A — VERIFIED ARCHITECTURAL FACT:** the initial state is highly synthetic and contains several cold-start conventions rather than a stationary/equilibrated prehistory.

**B — STRONG LEAD:** some early collapse dynamics may be amplified by initialization discontinuities: preloaded finished inventories, zero input inventories, arbitrary previous-sales anchors, no current household income, homogeneous beliefs and zero financial-contract stock.

**A — VERIFIED ARCHITECTURAL FACT:** the institutional network is sparse in several important channels, especially job-to-job mobility, household ownership breadth and persistent private credit.

**Limit:** because this BW evidence is one seed/raw base, the next stage must replicate these diagnostics across original+heldout seeds and must use explicit warm-start counterfactuals before assigning causal weight.

## Integrated frontier after completed jobs

The evidence now points away from any single scalar defect. The current collapse is better described as an interaction among:

1. production/revenue insufficient to cover current payroll at the exit frontier;
2. credit constrained both by bank capitalization and weak borrower economics;
3. a production-blind labor-target mechanism plus an under-specified household/person/labor-force ontology;
4. exit estates that trap large inventories and claims;
5. restructuring that preserves jobs without restoring current-payroll solvency;
6. nominal wage rigidity that amplifies arrears but is not sufficient to explain collapse;
7. a synthetic cold start and incomplete institutional circulation network.

The next acceleration stage should therefore test **interactions**, not one-variable threshold tuning.

## Remaining dependencies before full closure

Do not close BR–BW until artifacts arrive for:

- entrant finance lifecycle;
- underwriting/current-plan timing matrix;
- demographic labor-force structure;
- labor eligibility counterfactual.

These jobs remain independent and can finish while the next non-conflicting causal front is launched.
