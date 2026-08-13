# Economic Lab 3D Observer → Full Autonomous World Visualization Roadmap

## Decision

Development proceeds in this fixed order:

1. **Option 1 — Economic Lab 3D Observer**
2. **Option 2 — Full autonomous-world 3D visualization**

Option 2 does not begin until Option 1 passes its exit gate. This document prevents the two scopes from being mixed.

## Current status

- Phase A — Economic Lab 3D Observer: **CLOSED / PASS**
- Phase A focused validation: `Economic Lab 3D Observer CI` run `31682312172` — SUCCESS
- Phase A validated observer head: `6787181d5c5f4f629b1473396ed3521c10889e43`
- Previous full Economic Lab regression/performance/build validation: run `31681140392` — SUCCESS
- Phase B — Full Autonomous World 3D Visualization: **ENTRY APPROVED**

The Phase A focused browser gate validated the production build in system Chrome with a real WebGL canvas. The run confirmed month 0 at startup, four country labels and selectors, AST initial selection, READY engine state, country selection, +1 month stepping, continuous play/pause, reset to month 0, and a 390×844 mobile viewport with zero horizontal overflow and visible controls.

---

# Phase A — Economic Lab 3D Observer

## Goal

Add a real-time 3D observation layer to the existing four-country Economic Lab without changing the underlying economic semantics.

The 3D layer is an observer. It does not directly set GDP, CPI, unemployment, exchange rates, trade, policy, or agent beliefs. It only visualizes state produced by the simulation engine.

## A1. Data bridge — PASS

A read-only visualization snapshot is derived from the current EconomicWorld snapshot.

Minimum visual state implemented:

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

Observer snapshot output is frozen so the rendering layer does not become a second canonical-authority path.

## A2. 3D scene — PASS

The WebGL/Three.js scene contains:

- one persistent spatial node/territory for AST, BRN, CYR, DRN
- ground/territory geometry
- procedural city/industry massing for each country
- lights and camera
- orbit / pan / zoom controls
- country selection through 3D picking

The geography is an observer layout, not a claim that these countries occupy real Earth locations.

## A3. Economic state mapping — PASS

Visual properties are derived from simulation state rather than arbitrary scripted history.

Implemented mappings include:

- economic scale → settlement/city massing scale
- active firms / industry output → industrial structures
- unemployment / distress → activity/warning representation
- trade → inter-country flow lines
- external finance → financial flow lines
- regime/crisis state → observer overlays

Visual mappings are display encodings only. They do not feed values back into EconomicWorld.

## A4. Time controls — PASS

Implemented controls:

- reset to month 0
- +1 month
- +12 months
- continuous play
- pause
- selectable playback speed
- current month indicator

The observer updates after simulation steps.

## A5. 3D + analytical UI integration — PASS

The current application provides:

- primary 3D world viewport
- compact global timeline/control bar
- selected-country inspector
- analytical economic/cognitive/accounting access
- synchronized country selection between the 3D observer and analytical UI
- preservation of the prior analytical observer as `legacy.html`

## A6. Validation — PASS

Required gates and evidence:

- existing Economic Lab tests: PASS in full Economic Lab CI
- production build: PASS
- 3D scene initialization without runtime error: PASS in real headless Chrome
- month 0 visible immediately after load/reset: PASS
- step/reset/play controls update engine and scene: PASS
- country selection: PASS
- read-only observer bridge: PASS
- mobile/tablet usability baseline: PASS

Focused browser evidence from run `31682312172`:

- desktop 3D canvas: approximately `984.875 × 610`
- country labels: `4`
- country selectors: `4`
- initial month: `0개월`
- initial selected country: `AST`
- initial engine state: `READY`
- mobile test viewport: `390 × 844`
- mobile world shell: approximately `390 × 481.08`
- mobile canvas: approximately `390 × 479.08`
- horizontal overflow: `0`
- required controls visible: `true`

## Phase A Exit Gate — CLOSED

The Economic Lab can now be opened at month 0 in an interactive Three.js/WebGL 3D observer, stepped or played forward, reset, inspected by country, and used in a mobile-width viewport while the analytical observer remains available.

**Option 1 is complete. Phase B entry is approved.**

---

# Phase B — Full Autonomous World 3D Visualization

## Start condition — SATISFIED

Phase A exit gate passed. Phase B may now begin.

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

Phase B feature coding is now permitted because Phase A is closed.

The Economic Lab engine remains a research/economic subsystem and validation environment. The 3D observer developed in Phase A may provide reusable camera, interaction, timeline, selection, rendering, and telemetry patterns, but the full-world simulation remains governed by its own frozen architecture and implementation order.
