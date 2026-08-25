# R4-CE-D Working-Capital-Aware Labor Demand Envelope — Design Gate

Status: **DESIGN ACTIVE / CANONICAL MUTATION LOCKED**

Date: 2026-08-25
Depends on: R4-CD M2, R4-CE-A, R4-CE-B, R4-CE-C

## 1. Problem statement

R4-CE-C proved the person-level allocator and household pooling path can operate deterministically without mutating canonical state. It also showed that the current shadow demand signal is too restrictive to authorize a labor-market behavioral switch.

At month 12 the four seeds allocated only 65–82 persons out of 2166 labor-force persons. Yet establishment demand was almost completely filled. This means the allocator itself is not the binding bottleneck. The bottleneck is the upstream labor-demand envelope.

The existing M2 estimator intentionally uses a cash-only lower bound. It records unresolved `existingUndrawnCredit` and `admissibleNewCreditCapacity` fields as null and treats `availableWorkingCapital` as current cash. That is diagnostically useful, but not sufficient for production labor demand.

## 2. Objective

Construct a deterministic, read-only, accounting-safe per-establishment envelope that distinguishes **physical labor requirement** from **financially feasible labor demand** and identifies the binding financial or input constraint without issuing credit, changing balances, changing employment, or changing production.

R4-CE-D is a measurement and counterfactual-envelope package. It is not a policy/tuning package and it is not a canonical behavior switch.

## 3. Required establishment-level quantities

For every active establishment, produce the following fields at each observation month.

### 3.1 Physical side

- `plannedOutput`
- `effectiveOutputPerLaborUnit`
- `physicalLaborNeed`
- `capacityLaborLimit`
- `requiredInputUnits`
- `availableInputUnits`
- `inputCostPerOutput`
- `inputCostForPhysicalPlan`
- `inputConstrainedLaborCeiling`

### 3.2 Existing financial resources

- `depositCash`
- `existingLoanPrincipal`
- `scheduledDebtServiceCurrentMonth`
- `existingUndrawnCommittedCredit`
- `liquidWorkingCapitalBeforeNewCredit`

No value may be invented. If the current banking model has no committed undrawn facility concept, the field must be explicitly zero with source `NOT_MODELED`, not inferred from a desired outcome.

### 3.3 Underwriting counterfactual

Without originating a loan or mutating any bank/firm object, reconstruct the current underwriting decision for a **working-capital purpose** and report:

- `workingCapitalCreditRequested`
- `workingCapitalCreditAdmissible`
- `underwritingApproved`
- `underwritingRejectReason`
- `underwritingRate`
- `underwritingMaturity`
- `underwritingCollateralOrCapacityProxy`
- `underwritingTraceSource`

The counterfactual must call either a pure/read-only underwriting function or a faithful extracted evaluator. It must not call an origination function that changes state.

### 3.4 Financeable labor envelopes

Calculate at least four nested labor ceilings:

1. `cashOnlyFinanceableLabor`
2. `existingFacilityFinanceableLabor`
3. `admissibleCreditFinanceableLabor`
4. `fullFinanceableLabor`

The final `fullFinanceableLabor` must be bounded by physical labor need, production capacity, input availability, payroll requirement and working-capital availability.

### 3.5 Binding constraint classification

Exactly one primary binding class must be emitted per establishment, using deterministic tie-breaking:

- `PHYSICAL_NEED`
- `PRODUCTION_CAPACITY`
- `INPUT_AVAILABILITY`
- `CASH_WORKING_CAPITAL`
- `EXISTING_CREDIT_LIMIT`
- `NEW_CREDIT_UNDERWRITING`
- `PAYROLL_COST`
- `NO_BINDING_CONSTRAINT`
- `UNRESOLVED_MODEL_GAP`

Secondary constraints may also be listed.

## 4. Accounting and causality invariants

R4-CE-D must satisfy all of the following:

1. World digest before/after the read-only envelope must be identical.
2. Ledger entry count and every ledger entry must be identical.
3. Bank deposits, reserves, equity, loan book and NPL state must be identical.
4. Firm cash, debt, wage, employment, production and inventory must be identical.
5. Household state must be identical.
6. The envelope may observe current underwriting parameters but may not tune them.
7. No credit approval rate target may be imposed.
8. No attempt may be made to force shadow labor demand toward legacy employment counts.

## 5. Validation matrix

Minimum validation:

- original seeds: `ECON-RV02-A`, `ECON-RV02-C`
- held-out seeds: `ECON-RV08-HOLDOUT-E`, `ECON-RV08-HOLDOUT-F`
- horizon: 24 months minimum

Required gates:

- exact canonical replay
- exact envelope replay
- no state mutation
- all required numeric fields finite or explicitly `null/not-modeled` by contract
- nested labor ceilings monotonic where their definitions require monotonicity
- full financeable labor never exceeds physical/capacity/input bounds
- underwriting reconstruction deterministic
- hard accounting/ledger health preserved

## 6. Decision outputs

R4-CE-D must answer these questions before closure:

1. How much of the R4-CE-C labor-demand collapse is caused by the cash-only lower bound?
2. How much additional labor demand is supported by current-bank-model credit rules without changing those rules?
3. Which constraint binds most often by sector and establishment size?
4. Does current underwriting meaningfully bridge payroll/input working-capital gaps, or is credit structure itself still too weak?
5. Is the resulting full financeable demand still far below physical need and canonical employment?

## 7. Stop gate

A person-level behavioral labor switch remains blocked if any of the following is true:

- R4-CE-D cannot reproduce underwriting without mutation;
- the full financeable envelope is unstable or nondeterministic;
- accounting invariants fail;
- full financeable labor remains structurally collapsed and the causal source is not isolated;
- the only way to obtain plausible employment is arbitrary credit/wage/productivity tuning.

## 8. Implementation sequence

### R4-CE-D1 — Banking contract extraction

Map the current banking/origination path into a read-only underwriting contract. Identify every input, output, rejection branch and state mutation in the canonical path.

### R4-CE-D2 — Pure underwriting evaluator

Implement a research-only evaluator that reproduces canonical underwriting decisions without booking a loan.

### R4-CE-D3 — Working-capital envelope

Extend the shadow labor-demand measurement with existing-resource, counterfactual-credit and full financeability layers.

### R4-CE-D4 — Multi-seed 24-month gate

Run original + held-out seeds, recover artifacts, aggregate by sector/size, and issue PASS/PARTIAL/BLOCKED.

## 9. Current checkpoint

`R4-CE-D-DESIGN-v1 / D1-BANKING-CONTRACT-EXTRACTION-NEXT / PERSON-BEHAVIORAL-SWITCH-LOCKED`
