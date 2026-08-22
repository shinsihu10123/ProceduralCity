# WP-RV08 R4-BF–BK — Economic Ecosystem Lifecycle Wide Sweep Closure

Date: 2026-08-23
Run: `32583693606`
Workflow source: `55f38fe8dd7fc949ff9b18f56b55e448e6c3a92f`
Coverage: 4/4 seed shards, 48 months each, 16 country×seed rows
Verdict: **PASS — structural-realism narrowing / FAIL-CONTINUE — no single repair sufficiency claim**

## Gates

All shards passed health, transaction-ledger, general-accounting, GDP arithmetic, normalization activation, complete-horizon and finite-metric gates.

## R4-BF — Entrant lifecycle / replacement quality

Across the 16 country×seed rows:

- mean entrants per country over 48 months: **83.44**
- entrants born with zero cash: **100%**
- zero capital: **100%**
- zero inventory: **100%**
- zero workers: **100%**
- survive through 3 operational months: **100%**
- survive through 6 operational months: **0% in every row**
- produce within 3 months: mean **35.86%**
- produce within 6 months: mean **39.84%**
- earn revenue within 3 months: mean **24.13%**
- earn revenue within 6 months: mean **28.77%**
- never produce before exit/horizon: mean **63.12%**
- never earn revenue before exit/horizon: mean **73.87%**
- never acquire capital: **100%**

**BF-1: STRONGLY SUPPORTED.** Canonical replacement firms are not functioning as mature ecological successors. They are zero-resource startups, most never become productive/revenue-generating, and none of the observed cohorts survive to six operational months.

This result separates *firm birth* from *productive replacement*. A count of entries is not equivalent to restoration of productive capacity.

## R4-BG — Circular-flow ownership / profit distribution

- dividend-like settlement entries: **0 / all 16 rows**
- dividend-like amount: **0**
- terminal public-share ratio: mean **1.14%**
- terminal household portfolio-owner share: mean **4.50%**
- positive firm-profit periods exist, and primary equity issuance occurs, but no runtime dividend/profit-distribution settlement was observed.

**BG-1: SUPPORTED AS STRUCTURAL INCOMPLETENESS; CAUSAL ROLE UNVERIFIED.** Profit-to-household recycling through ownership is extremely sparse. This is a mature-economy circular-flow gap, but it is not yet proven to be a collapse root.

## R4-BH — Capital lifecycle

- capital-stock reduction events: **0 in all 16 rows**
- capital removal / addition ratio: **0**
- terminal inactive/stranded capital share: mean **73.62%**, range **49.88–97.42%**

**BH-1: STRONGLY SUPPORTED AS A REALISM DEFECT.** Capital investment can raise productive capital, but no depreciation/liquidation/reallocation reduction path was observed, while failed firms retain large capital stocks.

This likely biases capacity upward, so the absence of depreciation must not automatically be labeled a collapse cause. It is nevertheless a major stock-flow/lifecycle defect.

## R4-BI — Banking architecture

- commercial banks per country: **1 in every row**
- mean credit-application approval rate: **2.11%**, range **0.31–7.34%**
- mean applications per country×seed horizon: **1,481**
- mean approvals/originations: **29.25**
- mean defaults: **14.31**

**BI-1: VERIFIED ARCHITECTURE + HIGH-PRIORITY LEAD.** The banking system is completely institutionally concentrated and underwriting is extremely restrictive in the tested state. Causal importance requires credit-specific ablation (R4-BE2 and later underwriting decomposition).

## R4-BJ — Labor reallocation topology

Direct job-to-job switching accounts for only **1.32%** of employer-state changes on average (range 0–2.83%). Reallocation is overwhelmingly mediated by job loss/unemployment and later re-entry.

**BJ-1: STRONGLY SUPPORTED.** The model lacks a mature direct worker-reallocation channel. This can slow structural adaptation, though prior evidence shows generic labor matching is not the initial root of the collapse.

## R4-BK — Price / wage adjustment asymmetry

- monthly firm-price change share: mean **96.88%**
- monthly firm-wage change share: mean **0.188%**
- price changes are small but nearly continuous; wages are almost completely fixed.

Canonical source confirms the mechanism: firm prices are adjusted through `decision.priceChange` every firm-decision cycle, while firm wages only rise when a vacancy remains unfilled; no symmetric downward wage bargaining path exists.

**BK-1: STRONGLY SUPPORTED.** Nominal adjustment is highly asymmetric. Relative labor cost is therefore much more likely to adjust through employment, output, arrears and exit than through wage renegotiation. Causal importance remains to be isolated before repair design.

## Supply-network side channel

Repeated buyer–seller transactions become material: mean repeat-transaction share **60.19%**. This supports prior AY evidence that B2B relationships do mature endogenously; the economy is not completely relationship-free after startup.

## Long-run state

At month 48 under the established M+C diagnostic normalization, mean terminal unemployment is **96.25%**. Therefore the newly verified lifecycle/ownership/capital/banking/reallocation/wage defects coexist with an extremely strong collapse attractor even after earlier unit-economics normalization.

## Integrated interpretation

The result materially strengthens the ecosystem hypothesis. The simulation is not failing because one market is missing a scalar parameter. Multiple lifecycle loops are incomplete or asymmetric:

`firm failure -> weak zero-resource entrant -> little productive replacement`

`capital formation -> no depreciation/liquidation -> stranded inactive capital`

`profit generation -> sparse household ownership -> essentially no dividend recycling`

`worker separation -> unemployment -> slow re-entry, almost no direct job-to-job mobility`

`price adjustment -> continuous / wage adjustment -> almost absent`

`credit demand -> one bank -> very low approval`

These findings are now structural facts/leads. They do **not** authorize a bundled repair. R4-BL separates replacement quantity from replacement quality; R4-BE2 isolates the current credit stabilizer; corrected R4-BC2 isolates whether synchronization comes from cognition or common economic conditions.
