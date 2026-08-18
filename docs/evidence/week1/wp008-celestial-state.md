# WP-008 — Celestial State / Reference Frame / Solar-Lunar Forcing — Closure Evidence

Status: PASS / CLOSED
Frozen parent: Stage 4 / S4.01
Hard predecessors: WP-003, WP-004
Architecture authority: PA-057 / Domain 1 CelestialWorldState
Implementation: `production/crates/celestial-core`
Frozen scope: S4.01.01…S4.01.08 only. S4.01.09+ remain outside WP-008.

## Admission
- WP-003 and WP-004 must both be `closed=true` and carry non-zero acceptance evidence digests.
- Admission consumes the predecessor acceptance records without redefining their spatial/time semantics.
- Missing, failed or evidence-less predecessor input blocks WP-008 before celestial state construction.

## Frozen Member L3 coverage
1. **S4.01.01 Celestial State 의미 계약** — versioned Celestial/Frame contract validates required ID, version, PA-057 owner, WorldTime, causal parent and source-supplied allowed transition. Validation produces `CandidateOnly`, never a canonical write.
2. **S4.01.02 Reference Celestial Frame** — Stable ID/namespace/version/owner/predecessor lineage; create/read/update/retire boundaries; orthonormal frame geometry; duplicate, stale, retired and dangling references fail closed.
3. **S4.01.03 Planetary Rotation State** — rotation axis, phase, angular velocity and reference WorldTime cut remain tied to the exact versioned frame and Domain 1 owner.
4. **S4.01.04 Orbital State Representation** — versioned frame reference plus explicit position/velocity units and same astronomical read cut; missing units and invalid vectors are rejected.
5. **S4.01.05 Solar Direction / Irradiance Forcing** — deterministic normalized solar direction and source-provided normal irradiance are emitted as the Domain 1 forcing port. Atmospheric/ocean response is deliberately not computed here.
6. **S4.01.06 Lunar State Representation** — versioned lunar state with explicit position/velocity units, frame reference and WorldTime cut; mismatched epoch/reference is rejected.
7. **S4.01.07 Tidal Forcing Interface** — versioned handoff retains lunar source reference, frame, target location, schema, owner, time cut, unit and causal parent. A deterministic quadrupole angular term uses an explicit source-provided potential scale; partial/wrong-version/wrong-owner handoffs fail closed.
8. **S4.01.08 Continuous Astronomical Time Mapping** — exact integer mapping from WP-004 WorldTime through a versioned `AstronomicalEpochAnchor`; no calendar label or wall-clock time is used as canonical astronomical time.

## Authority / architecture boundary
- Canonical celestial owner is `domain01.celestial_world_state`.
- `Observer`, `Renderer`, `Analytics` and `Derived` origins cannot mutate the frame registry; failed attempts preserve the pre-state digest.
- Calendar/season labels are not introduced as canonical authority.
- Solar and tidal results are candidate/forcing outputs; they do not write downstream atmosphere/ocean response.
- Candidate ≠ Reality and reverse observation causality remain intact.

## Persistence / replay
- `CelestialSnapshot` carries schema version, commit marker, causal cut and the complete WP-008 state bundle.
- Snapshot validation verifies tidal source continuity and same-cut solar/lunar/astronomical-time consistency.
- Restore reproduces the same state; repeated snapshot digest is deterministic for the same snapshot/event/input sequence.
- Stable frame identity, versioned references, WorldTime epoch/tick and causal references are retained.

## Test evidence
Dedicated target: `production/crates/celestial-core/tests/wp008.rs`.
It contains 13 tests covering both hard-predecessor Admission, every S4.01.01…S4.01.08 member, wrong-owner/read-only boundaries, persistence/replay, Acceptance, and the WP-003 + WP-004 → S4.01.01 → S4.01.08 integration path.

Strict validation report: `docs/evidence/week1/wp008-ci-probe.txt`.
After bounded repair cycle 1 it records:
- `FMT_EXIT=0`
- `CLIPPY_EXIT=0`
- `WORKSPACE_TEST_EXIT=0`
- `WP008_TEST_EXIT=0`
- dedicated WP-008 tests: 13 / 13 PASS

## Bounded correction record
Initial validation found only canonical `rustfmt` differences. Strict Clippy, full workspace tests and all dedicated WP-008 tests already passed.
Repair cycle 1 applied canonical rustfmt and repeated all strict gates successfully. No semantic/code defect and no second production correction were required.

## Acceptance gate
`accept_wp` requires:
- valid closed WP-003 and WP-004 predecessor evidence,
- PASS for all 8 Frozen Member L3 IDs,
- non-zero evidence digest for every member,
- non-zero snapshot/replay evidence digest.

A missing member is reported at its exact L3 ID and cannot be substituted by a later S4.01 work item.

## Closure deltas
- Architecture Change: 0
- WBS Scope Delta: 0
- Dependency Semantic Change: 0
- Frozen Week Change: 0
- BCR Trigger: none

Final CLOSED status is retained only if the evidence-bearing branch state itself repeats format, strict Clippy, full workspace tests, dedicated WP-008 tests, and evidence-presence/status checks successfully. The temporary WP-specific workflow is removed afterward without changing production code or this evidence record.
