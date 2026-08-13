# Full-World 3D — Architecture / WBS Traceability

## Purpose

This is a non-canonical preparation artifact for Phase B. It maps the frozen Production Architecture rendering decisions to the Stage 13 work packages so implementation can begin without redesign when the hard predecessor gate opens.

It does not create a new work package, move a frozen week, or authorize implementation before predecessor PASS.

## Architecture anchors

### PA-046 — Native planetary renderer

Authority rule:

- Observation/Render State is NON-CANONICAL.
- Objective geometry/state remains owned by its source domain.
- Renderer cannot create causal entities.
- Render LOD/FPS/camera are display-only.

Required state family:

- `ObservationFrameSnapshot`
- render instance/mesh buffers
- camera-local transforms / floating origin
- render LOD metadata
- material / atmosphere / ocean projections

Required causal direction:

`canonical committed state → read-only observation snapshot → derived render projection → GPU draw`

Forbidden direction:

`renderer/camera/UI → canonical simulation state`

Validation anchors:

- camera movement causes no canonical digest change
- no fake entity/world fact
- floating-origin precision
- projection fidelity

### PA-015 — Derived observable / cache boundary

Renderer-visible derived data may be transformed, aggregated, meshed and labeled, but it is never canonical.

Validation anchors:

- deleting/rebuilding derived cache produces equivalent observation output
- stale-cache prevention
- observer feedback isolation

### PA-005 — Planetary spatial authority

Canonical planet-fixed continuous coordinates/geometry are authoritative. Cubed-sphere tiles and render meshes are computational representations.

Validation anchors:

- cubed-sphere face seam continuity
- coordinate round-trip
- boundary consistency/conservation where applicable

### PA-037 — Simulation fidelity vs Render LOD

Render LOD is independent from causal spatial refinement. Camera distance cannot be a simulation-refinement cause.

Validation anchors:

- camera-independence
- hidden-feature retention through render LOD
- LOD transition does not alter canonical digest

### PA-034 — Realized geometry fidelity

Artifacts/buildings displayed by the renderer must project realized geometry/material/damage state. A design specification or render mesh is not the physical authority.

Validation anchors:

- realized-vs-render projection fidelity
- damage/repair changes appear from canonical state
- no decorative building/artifact substituted for absent canonical realized geometry

## Frozen WBS mapping

| Concern | Frozen WP | Admission prerequisite |
|---|---|---|
| Observation frame / canonical read cut | WP-372 | WP-371 PASS |
| Observation determinism / missing state / provenance | WP-373 | WP-372 PASS |
| Derived observables / analytics cache | WP-374 → WP-378 → WP-382 | predecessor chain PASS |
| Renderer world frame / planet mesh / floating origin | WP-375 → WP-381 | WP-373 then WP-375 PASS |
| Observer capability / mutation barrier | WP-377 → WP-380 | WP-373 then WP-377 PASS |
| Terrain/water/atmosphere/weather/biosphere | WP-383 → WP-397 | WP-373 + WP-381 PASS |
| Persistent human projection | WP-384 → WP-395 | WP-231 + WP-373 + WP-381 PASS |
| Artifact/building material projection | WP-385 → WP-398 | WP-231 + WP-373 + WP-381 PASS |
| Settlement/building/land-use/infrastructure | WP-386 → WP-396 | WP-352 + WP-373 + WP-381 PASS |
| Route/traffic/shipment/logistics | WP-387 → WP-399 | WP-352 + WP-373 + WP-381 PASS |
| Render spatial/temporal/entity/process LOD | WP-388 → WP-394 | WP-381 PASS |
| Streaming / frame / GPU-CPU budget / paging | WP-389 → WP-400 | WP-373 + WP-381 PASS |
| Social/cultural/economic observables | WP-390 → WP-402 | WP-352 + WP-373 + WP-382 PASS |
| Historical timeline / replay / provenance | WP-392 → WP-401 → WP-405 | predecessor chain PASS |
| Selection / time nav / layer control / inspection | WP-393 → WP-403 → WP-407 | WP-380 + WP-381 + WP-382 PASS |
| Integrated observation/render gate | WP-408 → WP-409 → WP-410 → WP-411 | all listed Stage 13 predecessors PASS |

## WP-372 admission checklist — prepared, not executed

When `WP-371` closes PASS, Phase B implementation begins with these checks before writing renderer code:

1. Confirm WP-371 Acceptance record and evidence reference.
2. Freeze the exact committed canonical source cut exposed to observation.
3. Define version/provenance fields for `ObservationFrameSnapshot` without adding new canonical ownership.
4. Define stable Entity Reference and World-Time Cut representation using already-approved identity/time authorities.
5. Define Change Stream semantics as a read-side handoff, not a write channel.
6. Write negative tests proving observer mutation attempts cannot change canonical state.
7. Write deterministic ordering tests for identical committed source state.
8. Only after WP-372 PASS admit WP-373 and downstream renderer work.

## Renderer implementation admission checklist — WP-375

This checklist becomes executable only after WP-373 PASS:

1. Native Rust / `wgpu` renderer target.
2. Planet-fixed canonical coordinate input only.
3. Camera-local floating-origin projection.
4. Planet mesh derived from canonical spatial source; mesh is disposable.
5. GPU resource view is non-canonical and rebuildable.
6. Moving/rotating/zooming the camera cannot change simulation digest.
7. No renderer-spawned human, settlement, building, route, artifact or activity.
8. Render LOD must not request causal simulation refinement based solely on camera distance.

## Phase A handoff evidence

The completed Economic Lab Three.js observer provides tested interaction patterns for:

- read-only bridge separation
- country/entity selection
- timeline play/pause/reset
- analytical inspector synchronization
- desktop/mobile viewport validation
- production-browser smoke testing

These patterns may inform ergonomics and test design only. They do not override PA-046's final Rust/wgpu decision.
