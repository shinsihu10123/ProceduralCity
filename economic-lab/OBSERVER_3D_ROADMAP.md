# Economic Lab 3D Observer → Full Autonomous World Visualization Roadmap

## Decision

Development proceeds in this fixed order:

1. **Option 1 — Economic Lab 3D Observer**
2. **Option 2 — Full autonomous-world 3D visualization**

Option 2 does not begin until Option 1 passes its exit gate. This document prevents the two scopes from being mixed.

---

# Phase A — Economic Lab 3D Observer

## Goal

Add a real-time 3D observation layer to the existing four-country Economic Lab without changing the underlying economic semantics.

The 3D layer is an observer. It does not directly set GDP, CPI, unemployment, exchange rates, trade, policy, or agent beliefs. It only visualizes state produced by the simulation engine.

## A1. Data bridge

Create a read-only visualization snapshot derived from the current EconomicWorld snapshot.

Minimum visual state:

- simulation month
- four country identities
- GDP / population-scale proxy / active firms
- unemployment
- CPI / inflation state
- policy rate
- FX rate
- fiscal / credit / external stress
- trade and external financial flows
- industry output by sector
- crisis/regime probabilities

## A2. 3D scene

Create a WebGL/Three.js scene containing:

- one persistent spatial node/territory for AST, BRN, CYR, DRN
- ground/territory geometry
- procedural city/industry massing for each country
- lights and camera
- orbit / pan / zoom controls
- country selection through 3D picking

The initial geography is an observer layout, not a claim that these countries occupy real Earth locations.

## A3. Economic state mapping

Visual properties must be derived from simulation state rather than arbitrary scripted history.

Examples:

- economic scale → settlement/city massing scale
- active firms / industry output → industrial structures
- unemployment / distress → activity density / warning overlays
- trade → animated inter-country flow lines
- external finance → separate financial flow lines
- regime/crisis probabilities → observer overlays

Visual mappings are display encodings only. They must never feed values back into EconomicWorld.

## A4. Time controls

Required controls:

- reset to month 0
- +1 month
- +12 months
- continuous play
- pause
- selectable playback speed
- current month indicator

The observer must update after every simulation step.

## A5. 3D + analytical UI integration

Keep the existing analytical panels. The target layout is:

- primary 3D world viewport
- compact global timeline/control bar
- selected-country inspector
- expandable detailed economic/cognitive/accounting panels

Selecting a country in 3D and selecting it in the analytical UI must stay synchronized.

## A6. Validation

Required gates:

- existing Economic Lab tests remain PASS
- production build remains PASS
- 3D scene initializes without runtime error
- month 0 is visible immediately after load/reset
- step/reset/play controls update both engine and scene
- country picking works
- no observer code mutates canonical economic state except through the existing simulation step/reset interface
- mobile/tablet viewport remains usable

## Phase A Exit Gate

Option 1 is complete only when the user can open the application and observe the Economic Lab from month 0 in an interactive 3D view while the existing analytical observer remains available.

---

# Phase B — Full Autonomous World 3D Visualization

## Start condition

Phase B begins only after the Phase A exit gate passes.

## Goal

Move beyond the four-country observer layout into the full autonomous-world program:

- planetary-scale spatial world
- terrain / climate / resource geography
- humans and settlements emerging over time
- cities and infrastructure developing from simulation state
- political/economic/social structures becoming spatially visible
- long-run history observable from the beginning

## Boundary from Phase A

Phase A visualizes an already-defined four-country economic laboratory.

Phase B must not simply enlarge those four country nodes. It must connect to the frozen full-world architecture and its canonical spatial, natural, human, institutional, and historical state.

## Initial Phase B work after handoff

1. recover the authoritative full-world rendering/spatial WBS from the frozen project records
2. define the canonical Simulation → RenderSnapshot contract
3. establish planetary camera / terrain / streaming / LOD baseline
4. visualize Humanity-Zero / initial world state
5. connect settlement and structure emergence to actual canonical state
6. add time playback and historical observation without introducing scripted history

---

# Development rule

**Do not start Phase B feature coding while Phase A is incomplete.**

The Economic Lab engine remains a research/economic subsystem and validation environment. The 3D observer developed in Phase A may provide reusable camera, interaction, timeline, selection, rendering, and telemetry patterns, but the full-world simulation remains governed by its own frozen architecture and implementation order.
