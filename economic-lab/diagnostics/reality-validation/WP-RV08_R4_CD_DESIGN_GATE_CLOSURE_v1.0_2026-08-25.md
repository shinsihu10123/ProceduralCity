# WP-RV08 R4-CD — Design Gate Closure v1.0 — 2026-08-25

## Verdict

**DESIGN PASS / R4-CD-A PASS / R4-CD-B PASS / M1 SHADOW IMPLEMENTATION AUTHORIZED / CANONICAL BEHAVIORAL SWITCH NOT AUTHORIZED**

The R4-CD ontology design gate is now closed at the specification level.

Closed inputs:

- `WP-RV08_R4_CD_ESTABLISHMENT_LABOR_ONTOLOGY_DESIGN_GATE_v0.1_2026-08-25.md`
- `WP-RV08_R4_CD_A_SHADOW_PERSON_HOUSEHOLD_SCHEMA_SPEC_v1.0_2026-08-25.md`
- `WP-RV08_R4_CD_B_SHADOW_LABOR_DEMAND_ESTABLISHMENT_FEASIBILITY_SPEC_v1.0_2026-08-25.md`

## What is authorized now

### M1

A shadow person/household layer may be added to `world-v10` behind an explicit option if it:

- consumes no canonical RNG;
- writes to no canonical household, firm, ledger, accounting, banking, fiscal or cognition state;
- uses explicit demographic profile inputs;
- exposes read-only diagnostics;
- passes exact replay against shadow-disabled control.

### M2

Shadow labor-demand/establishment feasibility code may be implemented after or alongside M1 if the same no-write and exact-replay constraints hold.

## What remains prohibited

No authorization is granted to:

- replace household employment with person employment;
- change unemployment accounting in the canonical macro path;
- change firm counts;
- change productivity;
- change wages;
- alter hiring/firing;
- alter payroll settlement;
- relax credit rules;
- inject startup capital;
- alter exit/liquidation behavior;
- recalibrate any empirical parameter.

Those require later M3/M4 gates.

## Implementation order

1. implement `ShadowPersonHouseholdSystem`;
2. wire it behind an explicit `world-v10` option;
3. add exact-replay + schema-validity diagnostic;
4. run four-seed short-horizon gate;
5. only if PASS, close M1;
6. then implement/activate M2 shadow labor-demand diagnostics.

## Required first execution gate

Seed set:

- `ECON-RV02-A`
- `ECON-RV02-C`
- `ECON-RV08-HOLDOUT-E`
- `ECON-RV08-HOLDOUT-F`

Minimum short horizon: 6 months.

For every seed:

- control and shadow runs must produce identical canonical state digest;
- ledger and accounting verification must remain PASS;
- shadow schema gates must PASS;
- compatibility contradictions must be reported, not repaired by mutation.

## Checkpoint

`CHECKPOINT = R4-CD-DESIGN-CLOSED / M1-SHADOW-IMPLEMENTATION-AUTHORIZED / CANONICAL-BEHAVIOR-LOCKED`
