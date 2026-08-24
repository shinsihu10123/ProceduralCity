# WP-RV08 R4-CD — Establishment + Labor Ontology Design Gate v0.1 — 2026-08-25

## Status

**DESIGN GATE OPEN / CANONICAL RUNTIME MUTATION PROHIBITED**

R4-CD converts the accumulated AP/BR/BU/BV/BW/CC evidence into an implementation-ready semantic contract. It is intentionally upstream of any change to `world-v10` or the production economy.

The purpose is to remove the current ambiguity in which a household object is simultaneously used as a consumer/balance-sheet unit and one labor slot, while firms are created at a density and size distribution that is not jointly constrained by labor supply, sector technology and payroll feasibility.

## Evidence constraints inherited from closed fronts

R4-CD must preserve the following established findings:

1. doubling all household and firm objects does not rescue the economy;
2. firm-heavy density materially worsens labor feasibility;
3. canonical desired jobs can be much lower than physical labor need;
4. matching generally fills the jobs the system actually requests;
5. immediate firm exits are dominated by operating-cash / payroll-coverage failure;
6. across R4-CC, about 71.6% of active firm-months have revenue below payroll and about 39.4% carry wage arrears;
7. firm distress differs substantially by sector and worker-size bin;
8. restructuring without payroll solvency can preserve output while accumulating wage liabilities;
9. inventory stranded in inactive estates materially amplifies collapse;
10. the opening state contains cold-start conventions rather than a mature stationary prehistory.

Any future implementation that contradicts these findings must produce new explicit evidence rather than silently overriding them.

## 1. Canonical entity ontology

### 1.1 Person

A `Person` is an individual biological/social agent and is **not** itself a balance-sheet household.

Minimum semantic fields:

- `id`
- `householdId`
- `ageMonths` or equivalent age representation
- `alive`
- `workingAge`
- `laborForceStatus`
- `employmentStatus`
- `employerId`
- `occupationId` or skill vector
- `hoursAvailable`
- `hoursWorked`
- `wageRate`
- `laborIncome`

Future optional extensions may include education, health, migration status, family role and lifecycle transitions, but R4-CD does not require these for the first labor-ontology implementation.

### 1.2 Household

A `Household` is a **consumption, pooling and balance-sheet unit** containing one or more persons.

Minimum semantic fields:

- `id`
- `memberIds[]`
- `accountId`
- `wealth`
- `liquidAssets`
- `debt`
- `disposableIncome`
- `consumptionBudget`
- `savingsTarget`
- `housing/essential-cost state` when later modeled

Derived quantities:

- household size
- number of working-age members
- number of labor-force participants
- number employed
- aggregate labor hours
- aggregate labor income
- dependency ratio

**Hard invariant:** household count is not labor supply.

### 1.3 Labor-force participant

A labor-force participant is a person who is eligible and currently participating in labor supply.

Possible states:

- employed
- unemployed / searching
- temporarily unavailable

Persons outside the labor force are not counted as unemployment.

**Hard invariant:**

`unemployment_rate = unemployed_labor_force_persons / labor_force_persons`

not unemployed households divided by households.

### 1.4 Labor unit

The production system should consume `laborHours` or a normalized `laborUnits` measure instead of one binary household-worker slot.

Minimum definition for the first implementation:

`laborUnits = hoursWorked / standardMonthlyHours × effectiveSkillFactor`

The exact skill factor may initially be 1.0 if necessary. What matters is that one person can supply fractional or full labor units and a household can contain multiple workers.

### 1.5 Firm vs establishment

For the current Economic Lab scope, `Firm` should be interpreted as an operating establishment unless/ until multi-establishment legal firms are explicitly modeled.

Minimum establishment semantics:

- `id`
- `sectorId`
- `active`
- `capitalStock`
- `capacity`
- `productivity`
- `requiredLaborUnits`
- `desiredLaborUnits`
- `employedLaborUnits`
- `workerCount`
- `wageOffer`
- `payrollDue`
- `cash`
- `workingCapitalNeed`
- `inputInventory`
- `finishedInventory`
- `revenue`
- `arrears`
- `entryMonth`
- `exitState`

**Hard invariant:** establishment count must not be calibrated independently from establishment size and labor demand.

## 2. Household formation semantics

The first production implementation does not need a full demographic simulator, but it must stop equating households with persons.

### 2.1 Initialization requirement

At initialization:

- create persons first or create household-member composition as part of household generation;
- assign every person to exactly one household;
- allow household size >= 1;
- derive labor-force capacity from persons, not household count.

### 2.2 Minimum household-size distribution contract

R4-CD does not hard-code empirical values. Instead, the initialization API must accept a household-size distribution target such as:

- share of 1-person households;
- share of 2-person households;
- share of 3-person households;
- share of 4+-person households.

The distribution values are calibration inputs and must later come from empirical target documents, not hidden constants.

## 3. Labor-force semantics

### 3.1 Working-age status

Working-age eligibility must be represented explicitly.

The exact lower/upper age thresholds are calibration/configuration parameters, not hardwired economic truths.

### 3.2 Participation

Labor-force participation is a person-level state or probability conditioned on eligibility.

The first implementation may use a configurable participation profile before richer behavioral participation is introduced.

### 3.3 Employment

Employment allocation matches persons/labor units to establishments.

A person may initially hold at most one primary job for implementation simplicity, while labor hours remain continuous.

Future multiple-job support is permitted but not required for first closure.

## 4. Establishment size and sector structure

### 4.1 Required design principle

Each sector must have its own establishment-size distribution or generation process.

A global common distribution is prohibited because R4-CC shows strong sector heterogeneity.

### 4.2 Size representation

Establishment size should be represented using at least two measures:

- `workerCount`
- `employedLaborUnits`

Capital intensity and productivity determine how output scales with labor.

### 4.3 Sector-specific generation inputs

Each sector configuration must be able to specify:

- target establishment count or density;
- worker-size distribution;
- labor productivity range;
- capital intensity range;
- minimum efficient scale or equivalent viability concept;
- startup working-capital requirement;
- input-inventory requirement;
- demand exposure / market size relationship.

The configuration system must make these values inspectable.

## 5. Labor-demand formation

The current system must migrate away from a desired-worker target that can remain disconnected from physical production requirements.

### 5.1 Production-derived labor requirement

For establishment `f`:

`physicalLaborNeed = plannedOutput / effectiveOutputPerLaborUnit`

where effective output per labor unit can depend on productivity, capital stock, technology and input availability.

### 5.2 Economically viable labor demand

Desired labor must be bounded by financial feasibility as well as production need.

Conceptually:

`desiredLaborUnits = min(physicalLaborNeed, financeableLaborUnits, capacityLaborLimit)`

This does **not** mean the economy should suppress labor demand to zero whenever cash is low. Credit and working-capital mechanisms can finance viable payroll. The key requirement is that labor demand has an explicit derivation and audit trail.

### 5.3 Audit fields

Each establishment should expose diagnostic fields:

- `physicalLaborNeed`
- `desiredLaborUnits`
- `employedLaborUnits`
- `unfilledLaborUnits`
- `payrollRequired`
- `payrollFinanceable`
- `revenueCoverageRatio`
- `workingCapitalGap`

These fields are required to distinguish production shortage, hiring shortage and finance shortage.

## 6. Payroll feasibility identities

At minimum, future implementation diagnostics must calculate:

### 6.1 Current payroll due

`payrollDue = Σ(person hours × wage rate)`

or its labor-unit equivalent.

### 6.2 Operating payroll coverage

`operatingPayrollCoverage = operatingCashInflow / payrollDue`

### 6.3 Revenue payroll coverage

`revenuePayrollCoverage = recognizedRevenue / payrollDue`

### 6.4 Working-capital coverage

`workingCapitalCoverage = availableWorkingCapital / nearTermOperatingCashNeed`

### 6.5 Economy-wide labor feasibility

`laborDemandCoverage = availableLaborUnits / desiredLaborUnits`

and separately:

`physicalLaborCoverage = availableLaborUnits / physicalLaborNeed`

These two ratios must not be conflated.

## 7. Entry capitalization and startup state

R4-BW shows that cold-start conventions are material enough to require an explicit contract.

A new establishment must enter with a traceable startup balance sheet containing:

- owner/equity contribution;
- startup debt if any;
- cash;
- fixed capital;
- initial input inventory;
- initial finished inventory if economically justified;
- startup payroll reserve;
- initial order/sales expectations with provenance.

**Prohibited:** unexplained positive finished inventory with zero supporting production history unless explicitly identified as a warm-start stock.

## 8. Exit, restructuring and liquidation compatibility

The ontology must support later accounting-preserving exit handling.

A firm/establishment exit should transition through explicit states such as:

- active
- distressed
- restructuring
- liquidation
- inactive/closed

Claims and assets must remain attributable during transition:

- wage claims;
- tax claims;
- bank loans;
- cash;
- input inventory;
- finished inventory;
- fixed capital.

No future secondary-market mechanism may create free real assets or extinguish claims without accounting entries.

## 9. Migration path from current runtime

`world-v10` currently inherits the economic world from `world-v09`, applies scale profiles by replacing `COUNTRY_SEEDS`, and reports population using counts of households, firms, banks, governments and central banks. Household count is therefore currently embedded in scale and cognitive-agent accounting.

R4-CD requires a staged migration rather than a direct destructive rewrite.

### Stage M0 — design only

Current stage.

- no canonical runtime changes;
- define semantic contract and validation gates.

### Stage M1 — shadow person layer

Future implementation candidate:

- generate `persons[]` linked to existing households;
- leave current household employment behavior active;
- calculate shadow labor-force and feasibility diagnostics only;
- verify observer/non-interference by exact deterministic replay.

### Stage M2 — shadow labor-demand layer

- compute production-derived physical and desired labor units alongside current `desiredWorkers`;
- do not yet use shadow values for hiring;
- compare gap structure across seeds.

### Stage M3 — controlled labor-market switch

Only after M1/M2 gates pass:

- switch hiring from household slots to person/labor units behind an experiment flag;
- preserve old path as control;
- run accounting, determinism and macro identity gates.

### Stage M4 — establishment-density recalibration

Only after labor semantics are operational:

- vary sector-specific establishment distributions;
- calibrate against empirical size/density targets;
- test feasibility before interpreting macro outcomes.

### Stage M5 — production candidate

Only after causal validation and heldout seed replication.

## 10. Empirical target register requirements

Before M4, the project must source external empirical targets for at least:

- persons per household distribution;
- working-age population share;
- labor-force participation;
- employment/population ratio;
- average and distributional hours worked;
- establishments per capita or per employed person;
- establishment worker-size distribution by sector;
- labor productivity by sector;
- wage share / compensation share;
- inventory-to-sales and working-capital ratios;
- firm entry and exit rates.

R4-CD does not choose the geography/time period for calibration. That belongs to the empirical target register and institutional regime profile.

## 11. Acceptance gates for implementation entry

R4-CD can be marked **DESIGN PASS** only when the following are all true:

1. person and household semantics are non-overlapping and explicit;
2. unemployment denominator is labor force, not households;
3. household size >1 is supported by schema;
4. labor demand has a production-derived physical requirement;
5. desired labor demand has a financeability relation that remains auditable;
6. establishment size is sector-specific and configurable;
7. initialization has explicit startup balance-sheet semantics;
8. exit states preserve assets and claims;
9. migration can begin in shadow mode without changing canonical outcomes;
10. every future scale calibration parameter has an identified empirical target source class;
11. exact-replay non-interference can be tested before behavioral switching;
12. no global scalar firm-count/productivity/wage patch is needed to make the schema internally coherent.

## 12. Design verdict v0.1

**R4-CD v0.1 establishes the required semantic direction but is not yet CLOSED.**

The next dependency-safe action is to convert this document into two repository-native implementation specifications without touching canonical behavior:

1. `R4-CD-A — Shadow Person/Household Schema Specification`
2. `R4-CD-B — Shadow Labor Demand + Establishment Feasibility Specification`

After those two specifications are complete, an exact-replay M1 shadow implementation can be authorized.

## Current checkpoint

`CHECKPOINT = R4-CD-DESIGN-v0.1 / SHADOW-SPECS-NEXT / CANONICAL-MUTATION-LOCKED`
