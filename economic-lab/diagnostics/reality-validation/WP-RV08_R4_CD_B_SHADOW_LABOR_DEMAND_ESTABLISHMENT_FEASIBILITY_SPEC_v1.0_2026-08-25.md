# WP-RV08 R4-CD-B — Shadow Labor Demand + Establishment Feasibility Specification v1.0 — 2026-08-25

## Status

**SPECIFICATION PASS / SHADOW LABOR-DEMAND IMPLEMENTATION ELIGIBLE / CANONICAL HIRING AND PRODUCTION STILL LOCKED**

R4-CD-B converts the establishment/labor-demand half of R4-CD into an implementation contract for Stage M2 and supplies the firm-side observability needed before any person-level labor-market switch.

The purpose is to compute an auditable chain from planned production to physical labor requirement and financially feasible labor demand while leaving current `desiredWorkers`, hiring, production, payroll and exit behavior untouched.

## 1. Scope

R4-CD-B defines:

- establishment interpretation of current firm objects;
- shadow production-derived labor requirement;
- shadow financeable labor demand;
- establishment-size and density diagnostics;
- payroll and working-capital feasibility diagnostics;
- sector-specific configuration interface;
- entry-state and exit-state observability requirements;
- exact non-interference gates;
- later switch criteria for M3/M4.

Out of scope:

- changing current firm count;
- changing current productivity;
- changing current wage rates;
- changing current hiring or firing;
- changing production quantities;
- automatically injecting credit;
- liquidating or restructuring firms;
- recalibrating sectors against external empirical values.

## 2. Current-runtime compatibility

For R4-CD-B, each current canonical `firm` is interpreted as one operating establishment unless a future legal-firm layer explicitly introduces multi-establishment ownership.

The shadow layer reads current fields such as:

- `industryId`
- `active`
- `workers`
- `desiredWorkers`
- `wage`
- `productivity`
- `capacity`
- `desiredProduction`
- `currentPlan`
- `inputPerOutput`
- `inputProduct`
- `inputInventory`
- `inventory`
- `targetInventory`
- `output`
- `sales`
- `revenue`
- `cash` or ledger balance
- `loanBalance`
- `wageArrears`
- `distressMonths`

Missing values must be reported as missing/unsupported rather than silently replaced with calibration assumptions.

## 3. ShadowEstablishmentFeasibility record

Minimum per-establishment record:

- `firmId`
- `countryId`
- `sectorId`
- `active`
- `workerCount`
- `canonicalDesiredWorkers`
- `plannedOutput`
- `effectiveOutputPerLaborUnit`
- `physicalLaborNeed`
- `capacityLaborLimit`
- `payrollPerLaborUnit`
- `payrollRequiredForPhysicalNeed`
- `availableCash`
- `availableWorkingCapital`
- `financeableLaborUnits`
- `shadowDesiredLaborUnits`
- `shadowUnfilledLaborUnits`
- `revenuePayrollCoverage`
- `operatingPayrollCoverage` when operating cash-flow data exists
- `workingCapitalCoverage`
- `workingCapitalGap`
- `inputConstraintRatio`
- `laborConstraintRatio`
- `canonicalTargetGap`
- `shadowVsCanonicalDemandGap`
- `feasibilityFlags[]`

All numeric fields must be finite unless the record explicitly uses a documented `null` for unavailable quantities. `Infinity` must not be emitted into persisted JSON.

## 4. Planned-output source hierarchy

The shadow system must not invent demand.

Use the first valid source in this explicit hierarchy:

1. canonical `desiredProduction` when finite and non-negative;
2. selected canonical current plan output target if the schema exposes one;
3. a clearly named diagnostic planned-output reconstruction derived only from existing observable plan/sales/inventory fields;
4. otherwise `plannedOutput = null` and flag `PLAN_UNAVAILABLE`.

Any reconstruction must be isolated in one function and provenance-tagged. It must never write the reconstructed value back to the canonical firm.

## 5. Effective output per labor unit

The shadow physical requirement must use an inspectable formula.

Preferred contract:

`effectiveOutputPerLaborUnit = baseLaborProductivity × capitalFactor × technologyFactor × inputAvailabilityFactor`

For M2, where the current runtime does not expose these factors separately, a compatibility estimator may be used if and only if:

- the estimator is documented;
- its inputs are existing canonical fields;
- it does not change canonical state;
- it records which estimator version was used.

A minimum compatibility estimator may derive output per labor unit from a combination of current `productivity`, `capacity`, and worker/labor state. The estimator must not be calibrated merely to make unemployment look reasonable.

## 6. Physical labor need

When planned output and effective output per labor unit are available:

`physicalLaborNeed = plannedOutput / max(EPS, effectiveOutputPerLaborUnit)`

This quantity represents engineering/production requirement before cash or credit constraints.

Required flags:

- `PHYSICAL_NEED_UNAVAILABLE`
- `PHYSICAL_NEED_ZERO`
- `PHYSICAL_NEED_ABOVE_CURRENT_LABOR`
- `PHYSICAL_NEED_ABOVE_AVAILABLE_LABOR` at aggregate level when R4-CD-A data exists

## 7. Capacity labor limit

If the establishment has a meaningful capacity ceiling, define the corresponding maximum labor units usable under current capital/technology:

`capacityLaborLimit = capacityOutput / max(EPS, effectiveOutputPerLaborUnit)`

If capacity is unavailable, use `null` and flag it. Do not create an arbitrary ceiling.

## 8. Payroll requirement

Shadow payroll per labor unit must be traceable to current wage semantics.

For an initial compatibility layer:

`payrollPerLaborUnit = canonicalWagePerWorkerEquivalent`

if one labor unit is defined as one full-time-equivalent worker-month.

Then:

`payrollRequiredForPhysicalNeed = physicalLaborNeed × payrollPerLaborUnit`

When R4-CD-A introduces hours:

`payrollDue = Σ(hours × hourlyWage)`

may replace the compatibility expression.

No wage parameter may be adjusted in M2 to force viability.

## 9. Available working capital

M2 must separate immediately available cash from potentially financeable working capital.

At minimum report:

- `availableCash`: ledger/current cash available now;
- `existingUndrawnCredit`: only if represented in the runtime;
- `newCreditCapacity`: only if a non-mutating underwriting estimator can compute it;
- `availableWorkingCapital = availableCash + existingUndrawnCredit + admissibleNewCreditCapacity`.

If no reliable credit-capacity estimator exists, M2 must set that component to zero or `null` with provenance rather than assuming unlimited financing.

## 10. Financeable labor units

`financeableLaborUnits = availableWorkingCapital / max(EPS, payrollPerLaborUnit + variableNonLaborCostPerLaborUnit)`

If variable non-labor cost cannot yet be translated per labor unit, M2 may report two bounds:

- `cashPayrollFinanceableLaborUnits`
- `fullWorkingCapitalFinanceableLaborUnits` when input-cost information is available.

The bound used in `shadowDesiredLaborUnits` must be explicit.

## 11. Shadow desired labor demand

Conceptual identity:

`shadowDesiredLaborUnits = min(physicalLaborNeed, financeableLaborUnits, capacityLaborLimit)`

with unavailable bounds omitted rather than replaced by arbitrary numbers.

The record must preserve the decomposition. A low `shadowDesiredLaborUnits` is not automatically a labor-market failure: it can be a financing, production-plan, input or capacity failure.

## 12. Canonical-vs-shadow comparison

Per establishment calculate:

`canonicalTargetGap = canonicalDesiredWorkers - currentWorkers`

`shadowVsCanonicalDemandGap = shadowDesiredLaborUnits - canonicalDesiredWorkersEquivalent`

Required aggregate diagnostics:

- share where shadow physical need materially exceeds canonical desired workers;
- share where canonical desired workers exceed shadow financeable demand;
- share where both agree within tolerance;
- sector means/medians of the gap;
- worker-size-bin means/medians of the gap;
- share of establishments with revenue below payroll;
- share with positive wage arrears;
- share with zero workers;
- share with zero output;
- entry-age cohort comparison where available.

This directly extends the R4-CC census without rerunning R4-CC itself.

## 13. Revenue and payroll coverage

Required identities:

`revenuePayrollCoverage = recognizedRevenue / payrollDue`

`operatingPayrollCoverage = operatingCashInflow / payrollDue`

where operating cash inflow is available from diagnostics/accounting.

Required classifications:

- `< 0.5` severe payroll-undercoverage;
- `0.5–<1.0` undercoverage;
- `1.0–<1.5` narrow coverage;
- `>=1.5` stronger current-period coverage.

These bins are diagnostic labels, not empirical policy thresholds and must not trigger canonical behavior in M2.

## 14. Working-capital gap

Define near-term operating need from payroll plus required input procurement whenever those values are available:

`nearTermOperatingCashNeed = payrollNeed + inputPurchaseNeed + otherRequiredOperatingCash`

`workingCapitalGap = max(0, nearTermOperatingCashNeed - availableWorkingCapital)`

Required aggregate outputs:

- gap per establishment;
- gap per current worker;
- gap per physical labor unit;
- sector aggregate gap;
- entrant-vs-incumbent gap;
- relationship with subsequent canonical arrears and exits.

M2 is allowed to perform predictive association diagnostics but not causal repair claims.

## 15. Input feasibility

For input-using firms, calculate an explicit input availability ratio using required vs available input inventory/procurement when possible.

The shadow system must distinguish:

- production plan requiring labor but blocked by inputs;
- labor requirement genuinely implied by feasible production;
- current low output resulting from absent inputs.

A firm cannot be labeled `LABOR_SHORTAGE` merely because planned output is high if the same planned output is infeasible because critical inputs are unavailable.

## 16. Establishment-size diagnostics

Use at least the existing R4-CC worker-size bins for continuity:

- zero
- 1–2
- 3–5
- 6–10
- 11–20
- 21+

M2 must report by sector × size bin:

- active firm-months;
- worker count;
- canonical desired workers;
- physical labor need;
- shadow desired labor units;
- revenue/payroll coverage;
- working-capital gap;
- arrears incidence;
- exit incidence;
- entrant share.

This preserves comparability with the closed R4-CC evidence.

## 17. Sector configuration interface for later M4

M2 must define, but not yet calibrate, an inspectable sector establishment profile interface supporting:

- `targetEstablishmentDensity`
- `workerSizeDistribution`
- `laborProductivityDistribution`
- `capitalIntensityDistribution`
- `minimumEfficientScale`
- `startupEquityRequirement`
- `startupDebtRule`
- `startupPayrollReserveMonths`
- `initialInputInventoryRule`
- `initialFinishedInventoryRule`

No production defaults from this interface are authorized in M2. It exists to prevent later scalar global tuning.

## 18. Entry-state observability

For entrants, the shadow diagnostic must record at or near birth:

- entry month;
- initial cash;
- initial debt;
- initial fixed capital;
- initial input inventory;
- initial finished inventory;
- initial workers;
- initial desired workers;
- initial physical labor need;
- initial payroll reserve coverage;
- first sales/revenue month;
- first arrears month;
- first credit application/approval when observable;
- exit month/state.

This is designed to replace the previously cancelled broad BR lifecycle run with a narrower repository-native observability layer before deciding whether a new lifecycle experiment is still needed.

## 19. Exit-state compatibility

M2 does not change exit logic but should classify the observed canonical transition using available fields:

- active;
- distressed;
- exit candidate;
- inactive/closed.

When future explicit restructuring/liquidation states are added, the same diagnostic record should expand rather than be replaced.

Assets and claims must remain reported separately:

- cash;
- finished inventory;
- input inventory;
- fixed assets;
- wage arrears/payables;
- loans;
- taxes payable when observable.

## 20. Shadow storage and no-write boundary

Preferred location:

`economic-lab/src/research/shadow-labor-demand.js`

The subsystem may retain diagnostics in its own maps or non-enumerable world/country storage.

It is prohibited from writing to canonical:

- `firm.workers`
- `firm.desiredWorkers`
- `firm.wage`
- `firm.productivity`
- `firm.capacity`
- `firm.desiredProduction`
- `firm.currentPlan`
- `firm.cash`
- `firm.inventory`
- `firm.inputInventory`
- `firm.loanBalance`
- `firm.wageArrears`
- household employment state;
- ledger/GL;
- banking decisions;
- fiscal decisions;
- cognition state.

## 21. Exact-replay gate

As with R4-CD-A, enabling M2 shadow diagnostics must not alter canonical state.

For identical seed/horizon:

`canonicalStateDigest(control) === canonicalStateDigest(shadowA+shadowB)`

Required across original A, original C, heldout E and heldout F for a short horizon before longer diagnostics.

The digest must include at least:

- RNG state;
- canonical countries;
- ledger entries;
- accounting reports;
- macro history;
- firm entry/exit state;
- credit state.

## 22. Numerical validity gates

All must pass:

1. no persisted NaN/Infinity;
2. physical labor need is non-negative;
3. financeable labor units are non-negative;
4. shadow desired labor is non-negative;
5. when all three bounds exist, shadow desired labor does not exceed any bound beyond tolerance;
6. payroll requirements reconcile with wage/labor-unit definitions;
7. aggregate establishment worker count reconciles with canonical counts;
8. sector/size-bin totals reconcile with whole-economy totals;
9. missing plan/input/credit data are explicitly flagged;
10. observer/non-interference exact replay passes.

## 23. Causal interpretation gate

M2 outputs are diagnostic decomposition, not repair proof.

The following claims remain prohibited without later counterfactual experiments:

- “firm count is too high, therefore halve firms”;
- “wages are too high, therefore cut wages”;
- “productivity is too low, therefore multiply productivity”;
- “credit is too tight, therefore relax underwriting”;
- “labor shortage is the collapse root” solely because physical need exceeds available labor.

M2 is intended to tell us which constraint binds where and when, so later interventions can target actual mechanisms.

## 24. M2 closure requirements

R4-CD-B implementation can close only when:

- four-seed exact-replay non-interference passes;
- at least 24–36 months of shadow feasibility diagnostics complete;
- all sector and size bins are represented where canonical data permit;
- physical vs canonical desired labor gaps are reported;
- financeability decomposition is reported;
- input feasibility is separated from labor feasibility;
- entrant lifecycle observability is sufficient to decide whether a dedicated BR rerun is needed;
- no canonical economic behavior has changed.

## 25. Acceptance verdict

R4-CD-B v1.0 is **SPECIFICATION PASS**.

Together with R4-CD-A, it defines a dependency-safe route into M1/M2 shadow implementation while preserving the current production economy as the control.

## Checkpoint

`R4-CD-B = SPEC PASS / SHADOW LABOR-DEMAND IMPLEMENTATION AUTHORIZED SUBJECT TO R4-CD DESIGN-GATE CLOSURE`
