# Full Autonomous World 3D Visualization — Phase B Entry

## Status

- Phase A Economic Lab 3D Observer: CLOSED / PASS
- Phase B planning / authoritative-order recovery: STARTED
- Phase B production renderer implementation admission: BLOCKED BY FROZEN DEPENDENCY
- Frozen implementation package: `FINAL_v2.1.3a`
- Renderer architecture authority: Production Architecture Baseline v1.0 / PA-046

This document starts Phase B without bypassing the frozen full-world execution order. It is an admission/recovery record, not an authorization to invent an early parallel renderer against synthetic world state.

## Critical finding from the frozen WBS

The authoritative full-world 3D observation/rendering system is **Stage 13**, not an early independent subsystem.

The first Stage 13 work package is:

- `WP-372` / Week 13 / `S13.01`
- Representative task: `S13.01.01 Observation Frame — Authority boundary contract`
- Core: Observation Frame / Canonical Read Cut / Change Stream / Entity Reference / World-Time Cut
- Hard predecessor: **`WP-371`**

`WP-371` is the Stage 12 final architecture-trace/audit boundary. Therefore the production full-world observation contract cannot be admitted before Stage 12 has produced and certified the canonical world state that the observer must read.

Frozen schedule dates currently place `WP-371` and `WP-372` in Week 13 (`2026-11-02`–`2026-11-08`), followed by the main renderer work in Week 14 and final observation integration in Week 15.

## Why this dependency is mandatory

Production Architecture Baseline v1.0 defines `ObservationFrameSnapshot` as a versioned read-only view of **committed canonical source state** with provenance and validity boundaries. Observation/Render State is explicitly non-canonical.

The approved causal direction is:

`canonical committed state → read-only observation snapshot → derived render projection → GPU draw`

There is no reverse causal write.

A renderer built before its canonical sources exist would either depend on fake/synthetic world facts or become a second source of world truth. Both violate the frozen architecture.

## Approved rendering architecture

PA-046 fixes the full-world production renderer as:

- Native Rust / `wgpu`
- GPU-driven faithful projection
- canonical planet-scale coordinates
- camera-local floating origin for render precision
- Render LOD independent from Simulation LOD
- renderer incapable of creating causal entities
- render buffers/caches disposable and reconstructable
- provenance/version carried from observation snapshots

The Phase A Three.js observer is therefore a reusable **interaction and validation reference**, not the final production rendering stack.

Reusable Phase A patterns:

- read-only observer boundary
- timeline / play / pause / reset interaction
- selection and inspector synchronization
- mobile/desktop viewport behavior
- runtime/browser smoke-test methodology

Non-reusable as production authority:

- the four-country spatial layout
- Three.js as the final full-world renderer
- synthetic city massing as a substitute for realized canonical geometry
- any camera-dependent simulation refinement

## Frozen Stage 13 rendering path

### Observation foundation

- `WP-372` — Observation Frame / Canonical Read Cut / Change Stream / Entity Reference / World-Time Cut
- `WP-373` — deterministic ordering, missing/unloaded state, provenance, streaming handoff, LOD independence
- `WP-374` — Derived Observable / Analytics Query / Cache Lineage / Aggregation Window / Uncertainty Metadata

### Planetary renderer foundation

- `WP-375` — Renderer World Frame / Planet Mesh / Camera-Floating Origin / Draw Submission / GPU Resource View
- `WP-381` — renderer determinism, missing-state behavior, provenance, streaming handoff, LOD independence

### Observer safety

- `WP-377` — Observer Capability / Knowledge Boundary / Security Context / Objective Observer / Mutation Barrier
- `WP-380` — observer missing-state, provenance, streaming, LOD-independence and replay checks

### World visual domains

- `WP-383` — Terrain / Water / Atmosphere / Weather / Biosphere
- `WP-384` — Persistent Human / Agent Pose / Body State / Action State / Knowledge-Safe Label
- `WP-385` — Artifact Geometry / Technology Lineage / Fabrication State / Inscription / Material Appearance
- `WP-386` — Settlement Pattern / Building Geometry / Land Use / Infrastructure / Construction State
- `WP-387` — Route Topology / Traffic Traversal / Shipment / Logistics / Capacity-Congestion
- `WP-390` — Social Network / Culture-Norm / Production-Exchange / Market Observable / Organization

### Scale and navigation

- `WP-388` — Render Spatial LOD / Temporal Sampling / Entity Visual LOD / Process Visual Fidelity / LOD Transition
- `WP-389` — Streaming / Frame Budget / GPU-CPU Budget / Backpressure / Large-World Paging
- `WP-392` — Event Lineage / Causal Provenance / Timeline / Branch Lineage / Historical Replay
- `WP-393` — Selection / Time Navigation / Layer Control / Inspection Panel / History Exploration

### Final observation integration

- `WP-408` — Observation Integrity / Render Consistency / Analytics Consistency / Security / Performance
- `WP-409` — deterministic ordering / unloaded-state handling / provenance / streaming / LOD independence
- `WP-410` — security-epistemic separation / performance admission / failure-path inspection / history-provenance linkage / scientific-debug evidence
- `WP-411` — final Stage 13 observation subsystem gate

## Hard visual truth rules

The production renderer must obey all of the following:

1. Every displayed world fact traces to canonical state or an explicitly marked derived observable.
2. Decorative fake activity is forbidden.
3. Planet mesh does not redefine world geometry.
4. Floating origin changes render coordinates only, never planet-fixed canonical coordinates.
5. Camera distance never changes simulation fidelity or history.
6. Render LOD is independent from causal Simulation LOD.
7. Artifact/building meshes project realized geometry/material/damage state; render mesh is not authority.
8. Observer actions cannot mutate simulation state except through separately authorized future intervention interfaces.

## Phase B admission decision

**Phase B has started at the recovery/admission layer.**

Production feature coding of `WP-372+` is intentionally not started yet because the frozen predecessor `WP-371` has not been established as PASS in the current production execution stream.

This is not a scheduling preference. It is a hard dependency and canonical-authority constraint.

## Next executable action

Continue the current full-world production WBS in dependency order. In parallel, Phase B may maintain non-canonical documentation, test specifications, and interface traceability only. When `WP-371` closes PASS, admit `WP-372` immediately and begin the real full-world observation/rendering implementation with the approved Rust/wgpu stack.
