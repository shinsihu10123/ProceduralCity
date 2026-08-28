# WP-RV08-R4-CT — Economic Semantic Anchor Register

Date: 2026-08-28
Mode: calibration-contract construction only / no canonical mutation
Status: ACTIVE

## Purpose

R4-CT converts the R4-CQ/R4-CR/R4-CS diagnostic findings into an explicit economic-unit contract. It prevents future repairs from disguising economic behavior changes as unit conversions or from choosing arbitrary scalar factors merely because they reduce one observed residual.

## Rule zero

No canonical primitive may be changed until its semantic anchor is explicit and its target status is either:

- `INTERNAL_INVARIANT` — logically determined by accounting/dimensional consistency,
- `REPOSITORY_SUPPORTED` — supported by existing accepted project evidence,
- `EXTERNAL_EMPIRICAL_REQUIRED` — needs an external empirical target before calibration,
- `UNRESOLVED` — meaning/target not yet identified sufficiently.

`UNRESOLVED` and `EXTERNAL_EMPIRICAL_REQUIRED` are not permission to guess.

## Anchor classes

### A. Money and nominal stocks

#### A1 — Monetary unit M
- Meaning: common nominal accounting numeraire.
- Dimension: M.
- Type: unit definition, not an economic behavior parameter.
- Applies to: cash, deposits, wealth, debt principal, taxes, transfers, wages, prices × quantities, AP/AR.
- Internal invariant: a pure monetary redenomination must scale all M-denominated stocks and flows together and leave real ratios such as RULC unchanged.
- Current target status: `INTERNAL_INVARIANT`.
- Mutation authorization: `NO`.

#### A2 — Household cash/wealth stock
- Meaning: liquid nominal purchasing-power stock at a point in time.
- Dimension: M.
- Type: stock.
- Period: end/beginning of month depending observation point; must be stated.
- External empirical target: wealth/income or liquid-assets/income distribution by household class.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED` unless an accepted repository target already exists.
- Mutation authorization: `NO`.

#### A3 — Firm cash stock
- Meaning: liquid operating balance available to firms.
- Dimension: M.
- Type: stock.
- Empirical anchor candidate: cash relative to monthly payroll, purchases, or operating expenses by sector/firm class.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED`.
- Mutation authorization: `NO`.

### B. Labor and compensation

#### B1 — Wage
- Meaning: labor compensation per employed household/person per simulation month.
- Dimension: M / worker / month.
- Type: flow rate.
- Internal invariant: cannot be compared with unit price without a production quantity per worker and common period.
- Empirical anchor candidate: wage distribution and sector wage differentials, preferably normalized to a selected consumption basket or output-value measure.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED`.
- Mutation authorization: `NO`.

#### B2 — Employment unit
- Meaning: one employed labor unit represented by a household/person assignment.
- Dimension: worker.
- Type: state/count.
- Required semantic decision: whether one canonical employed household equals one person, one full-time-equivalent worker, or a household-level labor bundle.
- Status: `UNRESOLVED` pending person↔household migration contract.
- Mutation authorization: `NO`.

#### B3 — Payroll
- Meaning: wage obligations accrued/settled by a firm over one month.
- Dimension: M / month.
- Type: flow.
- Internal accounting anchor: labor accrual, wages payable, and cash settlement must remain reconcilable.
- Status: `INTERNAL_INVARIANT` for accounting identity; empirical magnitude still external.
- Mutation authorization: `NO`.

### C. Productive quantity and technology

#### C1 — Product unit Q_i by industry i
- Meaning: one physical/economic output unit of an industry's product.
- Dimension: Q_i.
- Type: flow quantity when produced/sold; stock quantity when held as inventory.
- Critical rule: RESOURCE, MATERIALS, CAPITAL, and CONSUMER units are not assumed mutually commensurable physical units.
- Required semantic decision: define the economic bundle represented by one Q_i.
- Status: `UNRESOLVED`.
- Mutation authorization: `NO`.

#### C2 — Capacity per worker
- Meaning: maximum producible Q_i per worker per month under the model's current capital/resource/human-capital state.
- Dimension: Q_i / worker / month.
- Type: technology flow capacity.
- Empirical anchor candidate: sector labor productivity in value-added/output terms after product-unit semantics are fixed.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED` plus dependency on C1.
- Mutation authorization: `NO`.

#### C3 — Input coefficient
- Meaning: upstream product quantity required per unit of downstream planned production.
- Dimension: Q_upstream / Q_downstream.
- Type: technology coefficient.
- Required anchor: internally coherent production recipe and, where realism is required, empirical input-output structure.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED`.
- Mutation authorization: `NO`.

#### C4 — Capital stock
- Meaning: productive capital services/state, not automatically monetary book value.
- Dimension: current model's productive-capital index unless explicitly converted.
- Type: stock/state.
- Required semantic decision: distinguish physical productive-capital index from nominal capital value M.
- Status: `UNRESOLVED`.
- Mutation authorization: `NO`.

### D. Prices and relative values

#### D1 — Unit price P_i
- Meaning: nominal transaction price per Q_i.
- Dimension: M / Q_i.
- Type: price.
- Internal invariant: P_i × Q_i is nominal transaction/output value M.
- Empirical anchor candidate: sector output-price indices/relative value anchors after Q_i bundle semantics are defined.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED` plus dependency on C1.
- Mutation authorization: `NO`.

#### D2 — Industry relative-price structure
- Meaning: relative value of RESOURCE, MATERIALS, CAPITAL, CONSUMER product bundles.
- Dimension: ratio of prices after bundle definitions.
- Diagnostic evidence: R4-CS shows sector-blind normalization is insufficient; it does not identify correct relative prices.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED`.
- Mutation authorization: `NO`.

#### D3 — Book unit cost
- Meaning: accounting carrying cost allocated to one finished-goods inventory unit.
- Dimension: M / Q_i.
- Type: accounting valuation.
- Internal invariant: wage accrual and other capitalized costs must reconcile to inventory/book-cost movements.
- Critical warning: a high bookUnitCost/price ratio can indicate either price inadequacy, quantity-unit/bundle mismatch, cost-allocation pathology, or combinations thereof.
- Status: `INTERNAL_INVARIANT` for accounting construction; economic adequacy unresolved.
- Mutation authorization: `NO`.

### E. Household consumption

#### E1 — Desired consumption budget
- Meaning: nominal expenditure flow a household attempts to allocate to consumption during a month.
- Dimension: M / month.
- Type: behavioral flow.
- Required distinction: this is not wealth stock and not physical consumption quantity.
- Empirical anchor candidate: consumption expenditure relative to disposable income and liquid wealth, by household state.
- Status: `EXTERNAL_EMPIRICAL_REQUIRED`.
- Mutation authorization: `NO`.

#### E2 — Consumer basket/bundle
- Meaning: real consumption services represented by consumer-sector product units.
- Dimension: Q_CONSUMER or a defined composite basket.
- Type: real quantity/bundle.
- Required semantic decision: what one consumer product unit buys in welfare/use terms.
- Status: `UNRESOLVED`.
- Mutation authorization: `NO`.

#### E3 — Real wage in consumer-basket units
- Meaning: wage divided by a consumer-basket price index.
- Dimension: consumer baskets / worker / month.
- Type: derived real purchasing-power metric.
- Required anchor: D1/D2/E2 definitions.
- Status: `DERIVED_AFTER_ANCHORS`.
- Mutation authorization: `NO`.

### F. Firm viability and macro coherence

#### F1 — Real Unit Labor Cost (RULC)
- Definition: wage / (price × capacity_per_worker), sector-specific.
- Dimension: dimensionless.
- Type: derived technology/value ratio.
- Invariance: unchanged by pure monetary redenomination and consistent quantity-unit relabel.
- Repository evidence: canonical medians are extremely high and sectorally dispersed.
- Status: `REPOSITORY_SUPPORTED` as a defect diagnostic; desired empirical target still external unless specified.
- Mutation authorization: `NO`.

#### F2 — Payroll coverage by productive value
- Meaning: whether full productive value at current/candidate prices can cover labor obligations.
- Dimension: dimensionless ratio.
- Type: derived viability metric.
- Status: `REPOSITORY_SUPPORTED` as current defect diagnostic.
- Mutation authorization: `NO`.

#### F3 — Household desired-demand / consumer-capacity value ratio
- Meaning: aggregate desired consumption expenditure divided by consumer productive capacity value in a country-month.
- Dimension: dimensionless.
- Type: derived demand-capacity metric.
- Repository evidence: large residual remains after labor-value normalization (R4-CR).
- Status: `REPOSITORY_SUPPORTED` as defect diagnostic; realistic target band external.
- Mutation authorization: `NO`.

## Sector-specific requirement from R4-CS

A future repair candidate must preserve explicit sector identities. It may not assume that one global scalar can normalize all sectors.

Any sector-specific candidate must expose at least:

- target RULC or labor-share concept,
- product-bundle definition,
- productive quantity anchor,
- price/relative-price anchor,
- input-output relation,
- wage differential assumption,
- consequences for household purchasing power,
- consequences for interfirm procurement and inventory valuation.

## Prohibited shortcuts

Until anchors are resolved, do not:

- divide wages by 100 because RULC is near 100,
- multiply prices by 100 because book cost is near 100× price,
- multiply physical output by 100 without redefining Q_i and all dependent coefficients,
- shrink desired consumption budgets by the R4-CR second factor without behavioral/empirical justification,
- assign separate sector factors solely to flatten R4-CS dispersion,
- call an isolated price/wage/output change a 'unit conversion'.

## Exit gate for R4-CT

R4-CT is complete when:

1. every calibration primitive has explicit dimension and economic meaning;
2. stock/flow/price/count distinctions are explicit;
3. dependencies between anchors are explicit;
4. unresolved empirical targets are marked rather than fabricated;
5. all known invariants from R4-CN through R4-CS are represented;
6. machine-readable register validation passes;
7. canonical mutation remains disabled.

After R4-CT, the next front is an empirical/semantic target acquisition and candidate-repair design stage, not immediate production mutation.