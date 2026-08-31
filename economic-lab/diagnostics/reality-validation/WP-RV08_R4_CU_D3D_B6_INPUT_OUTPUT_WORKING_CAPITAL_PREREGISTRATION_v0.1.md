# WP-RV08 R4-CU-D3D-B6 Input–Output and Working-Capital Shadow Family Preregistration v0.1

## Decision status

**PREREGISTERED SEPARATE FAMILY / B5 GRID NOT RETUNED / CANONICAL MUTATION NOT AUTHORIZED**

## Dependency checkpoint

B5-S1 closed with `FAMILY_INSUFFICIENT`. All productivity-only candidates improved household realized-flow distance but failed labour-value distance on at least one Original seed, while input-shortage burdens rose to roughly 11–16 times paired control.

B6 does not add intermediate values to the failed B5 grid and does not promote the best failed candidate. It opens a different mechanism family that isolates:

1. labour-side productive capacity;
2. material input intensity;
3. procurement settlement architecture;
4. dynamic repayment capacity.

Prior R4-CF results are treated as dependencies rather than repeated conclusions:

- full-current-cash procurement recovers only a small part of the canonical procurement gap;
- deferred settlement can mechanically unlock supplier inventory in a one-period envelope;
- trade credit alone becomes dynamically unsustainable under the canonical operating cycle.

B6 asks whether material-efficiency coherence and a bank-funded production-backed working-capital line jointly change that result.

## Frozen factorial

### Axis V — labour-side value-productivity interaction probe

`V ∈ {1, 24}`

- `V1`: canonical firm productivity.
- `V24`: the lowest B5 value-recovery level with the already frozen sector shape:
  - RESOURCE 2.0
  - MATERIALS 1.4
  - CAPITAL 0.65
  - CONSUMER 1.0

`V24` is retained only as a fixed interaction probe. It is not a B5 winner and may not be adjusted after seeing B6 results.

### Axis M — material-efficiency coherence

`M ∈ {1, 4, 16}`

For firms with an intermediate input:

`shadow inputPerOutput = canonical inputPerOutput / M`.

This represents a coarse multi-factor/material-efficiency hypothesis. It does not change supplier inventory, buyer cash, prices, wages or the physical conservation rule. All consumed input units and book values remain accounted for.

### Axis W — procurement settlement architecture

`W ∈ {C42, FULL, LINE1}`

- `C42`: canonical procurement budget `42% of current buyer cash`.
- `FULL`: up to `100% of current buyer cash`; no money or credit is created.
- `LINE1`: up to `100% of cash` after a production-backed bank working-capital draw.

`LINE1` contract:

- draw occurs only immediately before actual intermediate-input procurement;
- requested draw is the estimated purchase-cost shortfall;
- borrower limit is one month of estimated payroll plus planned input cost;
- active facility debt reduces unused line capacity;
- bank-capital constraints are enforced through the canonical bank capital cap;
- seller receives cash through the normal interfirm settlement path;
- each draw creates matched borrower liability, bank loan asset and deposit money through canonical accounting methods;
- canonical monthly debt service, interest, missed-payment and default logic applies from the following month;
- no loan may fund household consumption, dividends or an arbitrary cash buffer;
- no seller trade-credit exposure is created.

The full family contains 18 candidates: `2 × 3 × 3`. `V1_M1_C42` is the canonical control.

## Shadow application and entrant contract

- V and M are applied after canonical construction and exactly once to every replacement entrant.
- W modifies only the shadow procurement method and B6-tagged loan origination path.
- No canonical source file or persisted configuration is changed.
- Candidate and base-value provenance tags are required.
- The `V1_M1_C42` control must reproduce an unmodified canonical world exactly, apart from diagnostic output that is not stored in world state.

## Protected surface

Before month 1, every candidate must match its paired canonical world on:

- all identities and industry assignments;
- prices and wages;
- opening cash/deposits, firm safe cash and household wealth;
- desired-consumption-budget fields;
- physical inventories and inventory book values;
- capital stocks;
- fiscal parameters, financial access and demand parameters;
- bank opening balance sheet;
- credit, goods-market and firm-decision rules.

Allowed initial differences are only firm productivity and `inputPerOutput`, with explicit B6 provenance.

## Stage-1 execution

- Original A and Original C only
- 12 months
- 18 candidates × 2 seeds = 36 matrix jobs
- Heldout E/F reserved for Stage 2
- exact replay, hard accounting and reconstruction identities required in every job
- control/candidate ranking performed only after all jobs finish

## Measurement surface

B6 retains the B3/B5 model-side comparator surface and adds mechanism-native measures:

- employee compensation / positive GVA;
- realized household purchaser outlay / cash disposable income;
- net household saving-flow proxy;
- non-positive-GVA incidence;
- planned input need, purchased input units and input-shortage units;
- B2B settlement value;
- procurement budget utilization;
- B6 facility applications, approvals, requested draw, actual draw and bank-capital denial;
- facility originations, outstanding principal, arrears, debt service, defaults and charge-offs;
- goods fulfillment, payroll settlement, wage arrears, unemployment;
- active firms, exits and entries;
- nominal household purchasing power;
- GDP, cash and accounting residuals.

## Eligibility gate

A non-control candidate is Stage-1 eligible only if on **both** Original seeds:

1. labour-share log-distance to the B4 labour band improves versus canonical control;
2. realized-consumption log-distance to the B4 household-flow band improves versus canonical control;
3. median input-shortage burden does not exceed canonical control;
4. median active firms remain at least 50% of control;
5. median nominal purchasing power remains at least 80% of control;
6. exact replay, hard accounting and protected-surface gates pass;
7. no price, wage, desired-budget, opening-cash, tax, goods-market or canonical credit-rule mutation occurs.

For `LINE1` candidates, both seeds must additionally satisfy:

- terminal facility arrears ratio no greater than 50%;
- cumulative facility charge-offs no greater than 25% of cumulative facility originations;
- terminal facility debt no greater than two months of terminal firm sales;
- at least one facility draw is observed.

A candidate that improves the headline empirical distances by accumulating unserviceable debt is not eligible.

## Ranking and mechanism identification

Eligible candidates are ranked by:

1. worst-seed two-axis empirical distance;
2. worst-seed input-shortage ratio;
3. non-positive-GVA share;
4. facility loss/arrears burden;
5. firm retention.

At most three candidates advance, with at most one finalist per `(V, M)` pair so that working-capital variants cannot crowd out mechanism diversity.

The factorial also reports component contrasts:

- `V24 - V1` at fixed M/W;
- `M4/M16 - M1` at fixed V/W;
- `FULL - C42` at fixed V/M;
- `LINE1 - FULL` at fixed V/M.

These contrasts are causal shadow comparisons, not canonical parameter recommendations.

## Failure rule

If no candidate is eligible, B6 must close without retuning. The next front must diagnose whether the remaining block lies in demand forecasting/inventory targets, supplier topology, or the price-cost/value-added transformation.

## Canonical lock

B6 does not authorize changes to canonical productivity, input coefficients, procurement budget, bank underwriting, credit limits, prices, wages, desired budgets, cash, taxes or market rules.
