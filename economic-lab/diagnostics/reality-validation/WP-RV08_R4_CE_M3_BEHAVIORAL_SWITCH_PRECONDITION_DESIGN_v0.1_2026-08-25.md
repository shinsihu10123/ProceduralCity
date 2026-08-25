# WP-RV08 R4-CE — M3 Behavioral Switch Precondition Design v0.1 — 2026-08-25

## Status

**DESIGN PASS CANDIDATE / M3 EXPERIMENTAL SWITCH MAY NOT BE ENABLED UNTIL ACCOUNTING + CONTROL CONTRACT IS IMPLEMENTED / DEFAULT CANONICAL PATH REMAINS LOCKED**

R4-CE defines the boundary between the completed non-interfering M1/M2 shadow layers and any future person-level labor-market behavior.

R4-CD M2 closed with four-seed / 24-month exact replay and established that the next problem is not a scalar worker-count patch. The runtime must migrate the labor contract, wage accounting, household income aggregation and unemployment accounting coherently, while keeping working-capital and input constraints separately observable.

This document is grounded in the current v0.10 runtime rather than an abstract redesign.

## 1. Current canonical coupling that M3 must break deliberately

The current runtime couples five concepts that become distinct under a person ontology.

### 1.1 Household object is the labor-market applicant

`markets/labor-market.js` currently builds the labor pool directly from `country.households`.

Each household carries:

- `employed`;
- `employerId`;
- `wage`;
- `reservationWage`;
- `skill`;
- `wageArrears`.

Hiring writes employment directly onto the household and increments integer `firm.workers`.

### 1.2 Household object is also the wage settlement recipient

`settlePayroll()` transfers cash from a firm deposit account directly to the household deposit account using settlement metadata `{ firmId, householdId }`.

Thus the existing labor contract is structurally:

`Firm -> HouseholdAccount`.

M3 must become:

`Firm -> Person labor claim -> Household pooling account`

without creating a new un-reconciled money layer.

### 1.3 Wage accrual is posted on the household GL entity

`AccountingSystem.accrueMonthlyWages()` currently posts:

- household: Dr `wage_receivable`, Cr `wage_income`;
- firm: Dr `inventory`, Cr `wages_payable`.

The household is therefore simultaneously the economic family unit and the employee counterparty.

M3 cannot merely change labor matching while leaving this accounting identity untouched.

### 1.4 Macro unemployment denominator is household count

`macroFrom()` currently computes:

`unemployment = 1 - employedHouseholds / households`.

Under M3 the canonical unemployment measure must use participating persons:

`unemployment = unemployedLaborForcePersons / laborForcePersons`.

The old household-rate must remain available as an explicit compatibility diagnostic during the transition.

### 1.5 Production capacity uses integer firm workers

`SupplyChainSystem.planProduction()` currently derives labor capacity from:

`firm.workers * firm.productivity * capitalEffect * humanEffect * ...`

M3 therefore affects real production as soon as `firm.workers` semantics change. A controlled switch requires a labor-unit adapter rather than silently reinterpreting an integer field.

## 2. M3 architectural rule

M3 is an **experimental alternate labor path**, not a destructive replacement.

The production runtime must expose an explicit mode:

- `legacy_household_slots` — existing behavior;
- `person_labor_units_experimental` — new M3 behavior.

Default remains `legacy_household_slots` until M3 is separately validated and authorized.

No mixed implicit mode is allowed.

## 3. Person-level employment contract

A person-level employment relation is represented by an explicit contract record rather than only boolean employment fields.

Minimum contract:

```text
EmploymentContract
  id
  countryId
  personId
  householdId
  firmId
  startMonth
  endMonth | null
  status: active | ended
  standardMonthlyHours
  contractedHours
  hoursWorked
  wageRatePerHour
  grossWageDue
  wagePaid
  wageArrears
  skillFactor
  source: m3-person-labor
```

### Hard invariants

1. An active contract references exactly one existing person, household and active firm.
2. A person may have at most one active primary contract in first M3 implementation.
3. `person.householdId` must equal `contract.householdId`.
4. `hoursWorked <= contractedHours <= hoursAvailable`.
5. `grossWageDue = hoursWorked * wageRatePerHour` within floating tolerance.
6. A firm's total employed labor units equal the sum of its active contract labor units, not an independently mutated count.
7. Ending a contract does not erase unpaid wage claims.

## 4. Household income aggregation contract

Households remain the consumption / balance-sheet / deposit-account unit in first M3.

Persons do **not** receive independent deposit accounts in the initial switch. This avoids multiplying bank deposits and monetary accounts before a separate financial-person ontology is justified.

Person wage income is a sub-ledger attribution whose cash settles into the owning household account.

For household `h`:

`householdLaborIncome = Σ(person wage cash receipts in h)`

`householdWageReceivable = Σ(person unpaid accrued wages in h)`

`householdDisposableIncome = laborIncome + transfers + otherIncome - taxes`

### Required separation

The runtime must distinguish:

- person gross wage due;
- person wage cash paid;
- person wage arrears;
- household aggregated labor income;
- household total disposable income.

A household containing two employed persons may therefore receive two wage settlements while remaining one consumption/accounting unit.

## 5. Accounting design for first M3

R4-CE deliberately avoids creating a full General Ledger entity for every Person in the first behavioral switch. That would conflate labor ontology migration with a much larger accounting-entity migration.

Instead:

### 5.1 Legal accounting entity

Household remains the GL counterparty for wage receivable and wage income.

### 5.2 Person attribution

Every wage accrual and cash settlement must carry:

- `personId`;
- `contractId`;
- `householdId`;
- `firmId`;
- `hoursWorked`;
- `wageRatePerHour`.

### 5.3 Accrual

For each active person contract:

**Household books**

- Dr `wage_receivable` = gross wage due
- Cr `wage_income` = gross wage due

**Firm books**

- Dr `inventory` = gross wage due
- Cr `wages_payable` = gross wage due

The postings remain entity-balanced, while metadata identifies the person whose labor generated the claim.

### 5.4 Cash settlement

Cash settlement remains:

**Household**

- Dr `cash`
- Cr `wage_receivable`

**Firm**

- Dr `wages_payable`
- Cr `cash`

Settlement metadata must include person and contract IDs.

### 5.5 Arrears

Person-level arrears are operational attribution records.

Firm-level wages payable remain the authoritative accounting liability.

The following reconciliation must hold:

`Σ active+ended unpaid person wage claims for firm ~= GL wages_payable(firm)`

subject only to explicitly documented historical migration adjustments.

## 6. Wage and hours semantics

M3 must stop treating one worker as exactly one fixed monthly wage unit.

Define:

`laborUnits = hoursWorked / standardMonthlyHours * effectiveSkillFactor`

`grossWageDue = hoursWorked * wageRatePerHour`

The first M3 experiment may simplify by assigning:

- one standard monthly-hours parameter;
- one primary job maximum;
- skill factor from the existing shadow-person fixture;
- firm wage offer converted to hourly rate by `legacyFirmMonthlyWage / standardMonthlyHours`.

This conversion is a **compatibility bridge**, not empirical calibration.

## 7. Employer-side demand and allocation

M3 must not set labor demand equal to M2's cash-only lower bound.

The employer demand pipeline is:

1. canonical planned output signal;
2. M2 physical labor need;
3. input feasibility;
4. explicit labor target before finance;
5. available working capital including separately modeled finance;
6. final experiment labor demand;
7. matching and realized labor units.

### Initial M3 switch target

For the first isolated labor-ontology experiment, use a conservative compatibility target that preserves the current production plan rather than attempting a simultaneous working-capital repair.

The M3 labor target must therefore be derived from **production-required labor units**, but the experiment report must separately expose whether that target is:

- current-cash financeable;
- dependent on external finance;
- input constrained.

No target may silently erase a financing gap.

## 8. Matching contract

Candidate persons are only:

- alive;
- working-age;
- labor-force participants;
- not already holding an active primary contract;
- with positive hours available.

Firm ranking may retain legacy wage/skill/search-friction behavior for the first controlled experiment, but every stochastic component must use the world RNG and remain deterministic for a fixed seed.

Required matching outputs:

- hiresPersons;
- separationsPersons;
- jobToJobTransitions;
- unfilledLaborUnits;
- unfilledPersonsEquivalent;
- applications/scans;
- reservation-wage rejections;
- stochastic-match rejections;
- labor-supply bound vacancies;
- hiring-capacity bound vacancies.

## 9. Production adapter contract

A new adapter must expose both concepts without ambiguous field reuse:

- `firm.legacyWorkerSlots` or equivalent diagnostic read;
- `firm.employedLaborUnits`;
- `firm.employedPersonCount`.

For `legacy_household_slots`:

- current `firm.workers` remains authoritative.

For `person_labor_units_experimental`:

- production capacity reads `employedLaborUnits` through an explicit adapter;
- `firm.workers` may be populated as a compatibility count, but must not be the source of labor capacity.

This prevents a fractional labor-unit system from being accidentally rounded through the existing integer worker field.

## 10. Unemployment and labor statistics migration

During M3 A/B tests expose both series:

- `legacyHouseholdUnemploymentRate`;
- `personLaborForceUnemploymentRate`.

In experimental mode, canonical `macro.unemployment` may point to the person-labor-force rate **only inside that experiment path**.

Required accompanying statistics:

- persons;
- working-age persons;
- labor-force persons;
- employed persons;
- unemployed persons;
- participation rate;
- employment/population ratio;
- available labor hours;
- worked labor hours;
- available labor units;
- employed labor units.

No unemployment result is interpretable for calibration until the demographic profile is replaced with an empirical target profile.

## 11. Working-capital separation

M2 found a large gap between production labor requirements and current-cash financeability.

M3 must not solve that gap by construction.

Employer feasibility must expose:

`cashWorkingCapital`

`committedUndrawnCredit`

`newCreditApprovedThisPeriod`

`receivablesFinanceAvailable`

`totalAvailableWorkingCapital`

`payrollNeed`

`inputNeed`

`workingCapitalGap`

If the current runtime cannot provide a component, it must be `null`/unavailable rather than assumed zero unless zero is truly represented.

The first M3 experiment may leave external finance behavior unchanged and report the resulting gap. A separate credit-working-capital WP will decide whether financing institutions need structural repair.

## 12. Input-constrained production compatibility

A labor shortage and an input shortage are independent constraints.

Experimental realized production must never exceed what current intermediate inputs can support.

The production-side effective bound is conceptually:

`realizableOutput <= min(planOutput, laborSupportedOutput, inputSupportedOutput, capacitySupportedOutput)`.

M3's purpose is labor ontology. It must not simultaneously relax input procurement.

## 13. A/B control architecture

Every M3 run must instantiate two worlds from the same seed:

### Control

- `laborMode = legacy_household_slots`
- shadow diagnostics may be enabled;
- current canonical labor/payroll behavior remains unchanged.

### Treatment

- `laborMode = person_labor_units_experimental`
- identical seed and non-labor configuration;
- person-level contract path enabled.

### Required comparison

The report must compare monthly and terminal:

- unemployment under each definition;
- employment persons / labor units;
- output by sector;
- wages accrued / paid / arrears;
- household labor income;
- consumption;
- firm exits/entries;
- input shortages;
- working-capital gaps;
- new credit;
- accounting identities;
- ledger money invariants.

M3 treatment is not expected to reproduce control outcomes; exact replay applies to repeated runs **within the same mode**.

## 14. Determinism gates

For every test seed:

1. control run A == control run B exact canonical digest;
2. treatment run A == treatment run B exact treatment digest;
3. treatment's person/contract assignment is deterministic;
4. no iteration-order dependence from Map/Set traversal changes economic results;
5. A/B worlds do not share mutable objects.

## 15. Accounting hard gates

Every M3 month and terminal state must pass:

- settlement ledger country verification;
- General Ledger entity equations;
- accounting cash reconciliation;
- deposit reconciliation;
- loan reconciliation;
- GDP arithmetic identity currently enforced by Economic Lab diagnostics;
- firm wages payable reconciliation against unpaid person claims;
- household wage receivable reconciliation against unpaid member claims;
- total wage accrual = household wage-income accrual = firm labor-cost accrual;
- total wage cash settlement = household wage cash receipts = firm payroll cash outflow.

A macro improvement with any failed accounting gate is **FAIL**, not partial success.

## 16. Migration handling for month 0

The current opening state already contains household employment assignments.

M3 cannot randomly discard them without contaminating the experiment with a one-time mass-layoff shock.

The first treatment initialization must explicitly choose and report one of two strategies:

### Strategy A — compatible projection

Project each canonical employed household to one eligible person when available, preserving employer mapping. Households with no eligible participant are recorded as contradictions requiring controlled resolution.

### Strategy B — clean labor re-clear

Initialize all participating persons unemployed and re-clear the labor market before production.

This strategy creates an intentional transition shock and must not be compared to legacy control as if initialization were identical.

**R4-CE authorizes Strategy A for the first M3 experiment**, because it minimizes initialization discontinuity and directly extends the M1 compatibility projection.

Contradictory employed households with no eligible person may not be silently fabricated. They must either:

- receive a deterministic compatibility participant under an explicitly tagged test-only projection rule; or
- be released from employment and reported as migration contradictions.

The preferred first experiment is the latter unless a separate empirical demographic calibration justifies the former.

## 17. Calibration boundary

The current shadow demographic profile is a diagnostic fixture.

M3 may use it to validate software and causal direction, but not to claim realistic unemployment or participation levels.

External calibration remains required for:

- household-size distribution;
- age distribution;
- working-age boundaries;
- participation by demographic group;
- hours worked;
- wage distribution;
- sector establishment-size distribution.

These must enter through inspectable config/profile objects.

## 18. Code-change surface authorized after design closure

The first M3 experimental implementation may modify or add only the following conceptual surfaces:

- new person-employment contract module;
- alternate labor-market clearing path;
- wage accrual/settlement adapter capable of person attribution;
- household income aggregation adapter;
- production labor-unit adapter;
- person-labor macro statistics;
- explicit `laborMode` configuration;
- experiment-only diagnostics and workflows.

The legacy path must remain intact and selectable.

Unrelated changes to banking, goods-market demand, fiscal policy, firm entry/exit thresholds, wages, productivity, firm counts or input procurement are prohibited in M3.

## 19. M3 experiment stop gates

Immediately stop and classify as BLOCKED/FAIL if any of the following occurs:

- person contracts cannot reconcile to household/firm wage accounting;
- money or GL identity fails;
- treatment is nondeterministic for a fixed seed;
- legacy mode changes relative to the pre-M3 baseline;
- labor-unit adapter changes production in legacy mode;
- M3 requires arbitrary wage/productivity/firm-count tuning to remain numerically stable;
- employment claims survive contract termination without traceable arrears ownership;
- demographic fixture is accidentally treated as canonical calibration.

## 20. Design acceptance gates

R4-CE design passes when all are explicit:

1. person employment-contract schema;
2. household pooling semantics;
3. person-attributed but household-entity wage accounting;
4. hours/labor-unit wage identity;
5. employer demand and matching contract;
6. production labor-unit adapter;
7. unemployment denominator migration;
8. working-capital separation;
9. input constraint preservation;
10. A/B control architecture;
11. deterministic replay requirements;
12. accounting reconciliation requirements;
13. opening-employment migration rule;
14. empirical calibration boundary;
15. legacy path preservation and default lock.

All fifteen are specified in v0.1.

## Verdict v0.1

**R4-CE DESIGN PASS.**

This closes the semantic precondition design gate and authorizes implementation of an **experimental, flag-gated M3 person-labor path**.

It does **not** authorize making M3 the production/default path, and it does not authorize any simultaneous credit, wage, productivity, population or firm-density repair.

## Next dependency-safe action

Implement in this order:

1. `R4-CE-A` — person employment-contract registry + deterministic legacy-employment projection;
2. `R4-CE-B` — person-attributed wage accrual/settlement adapter with accounting reconciliation tests;
3. `R4-CE-C` — alternate person labor-market clearing + labor-unit production adapter;
4. `R4-CE-D` — four-seed short-horizon A/B gate;
5. only if D passes, extend to 24/48-month causal evaluation.

## Checkpoint

`CHECKPOINT = R4-CE-DESIGN-PASS / M3-EXPERIMENTAL-IMPLEMENTATION-AUTHORIZED / LEGACY-DEFAULT-LOCKED / R4-CE-A-NEXT`
