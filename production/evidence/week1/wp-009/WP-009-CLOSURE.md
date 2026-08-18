# WP-009 / S1.03 — Authority–Placement Boundary — Closure Evidence

Status: PASS candidate; final closure requires repository-standard CI on the evidence-bearing head.
Frozen scope: Stage 1 / S1.03 / S1.03.01…S1.03.10 only
Hard predecessors: WP-001, WP-002, WP-013
Architecture authority: PA-002 + PA-042
Implementation: `production/crates/authority-placement-core`
Implementation validated head: `0d7c805bfcf57f236f2291c9b837e25bcea1ad30`
Implementation world-core CI: `32127353850` — SUCCESS
Implementation city-engine CI: `32127353753` — SUCCESS
WP-009 dedicated tests: 21 / 21 PASS
Correction cycles: 0 / 2

## Frozen contract preserved

WP-009 keeps semantic authority and physical placement as orthogonal axes. Semantic ownership never moves merely because a partition, residency location, or writer lease moves. The PA-042 placement manager owns only partition identity, placement metadata, availability, writer lease and authority epoch. It does not become the semantic owner of world facts.

Every invalid or unauthorized operation is fail-closed. Failure records preserve the same pre/post digest, and Derived, Observer, Renderer and Analytics origins cannot acquire canonical write authority. Candidate contract validations remain `CandidateOnly` until the registered owner path performs the allowed state transition.

## Admission

`admit_wp009` requires all Frozen Hard Predecessors. WP-001 and WP-002 must be closed, version-compatible and carry non-zero Evidence. The actual `gaonn_identity_acceptance_core::Wp013Closure` type is consumed for WP-013; it must identify WP-013 / S1.02.10, be closed, and retain non-zero acceptance and Evidence digests. Missing or stale predecessor material blocks S1.03 before Member implementation state can be accepted.

## Member L3 implementation and validation mapping

### S1.03.01 — Authority Axis / Placement Axis separation contract

A versioned contract records semantic owner, allowed writer, authority epoch, semantic axis, placement axis and causal parent. Equal semantic/placement axes are rejected. Read-only projection origins cannot validate a write path. The output remains Candidate-only.

### S1.03.02 — Single-Writer Partition Identity

Stable partition ID, namespace, version and lifecycle lineage are explicit. Create/update/retire paths reject duplicate IDs, duplicate identity/version references, stale updates, dangling references, wrong owner writes and retired-ID reuse. Authority segments structurally contain one writer lease and one authority epoch.

### S1.03.03 — Physical Placement Descriptor

Placement identity is versioned and independently life-cycled from semantic state. Create/update/retire preserve stable identity and lineage; dangling partition references, stale writes and retired-ID reuse fail without mutation. `StateSnapshot` verifies schema and state digest on restore.

### S1.03.04 — Authority Routing Contract

Routing validation is versioned, source-owner checked and Candidate-only. Missing required owner/version/partition/causal fields and Observer/Renderer/Analytics reverse paths are blocked before any state change.

### S1.03.05 — Cross-Partition Reference Contract

Cross-partition reference validation remains a contract boundary and never becomes either side’s canonical writer. The contract preserves semantic owner, partition, epoch, version and causal reference and rejects unauthorized projection paths.

### S1.03.06 — Atomic Cross-Partition Handoff

The interface verifies source/target partition, writer, schema, semantic owner, semantic digest, causal parent, original reference, transformation basis and consecutive authority epoch. A partial payload is rejected before commit. The registered placement manager then performs one atomic writer-lease replacement only after all checks pass. Stale source epoch, wrong source writer, mismatched semantic digest, unavailable target or partial handoff leaves the complete pre-state unchanged. Repartitioning does not alter the semantic digest.

### S1.03.07 — Live Placement Migration

A committed handoff can be materialized as a durable `MigrationArtifact` carrying commit marker, causal cut, recovery position, parent cut, replay reference, state digest and handoff digest. A missing commit marker, corrupt digest, stale schema or incomplete recovery boundary is not accepted as a recovery point. Restore reproduces the exact authority-placement state.

### S1.03.08 — Partition Unavailability Semantics

Unavailability is a versioned contract state, not an automatic semantic-owner failover trigger. Marking a target unavailable prevents handoff to it while retaining the existing writer lease. No source-less timeout or threshold was invented. Reassignment requires the explicit fenced handoff path.

### S1.03.09 — Duplicate Authority Prohibition Audit

The audit is read-only and compares in-scope authority claims by segment and authority epoch. Two different writers/partitions at the same segment+epoch produce explicit FAIL Evidence with first-failure location, violating input, pre/post digest and deterministic reproduction procedure. Similarly named out-of-scope claims do not create false positives.

### S1.03.10 — S1.03 Acceptance Review

The review requires the exact ordered S1.03.01…S1.03.09 pre-review set, identical run ID and source version, non-zero source-state/Evidence digests, causal references, PASS verdicts, and Behavior/Contract/Integration flags. Missing members are BLOCKED, explicit failures are FAIL, mixed-run material is BLOCKED, and an out-of-scope PASS cannot substitute for a missing member. `close_wp009` additionally requires non-zero S1.03.10 Evidence and records the exact 10-member WP set.

## Persistence / replay / determinism

Repository tests cover state snapshot/restore, corrupt snapshot rejection, durable migration restore, pre-commit artifact rejection, deterministic replay of the same snapshot + handoff, and semantic-digest equality before/after repartition. The same input produces the same event/commit record and state digest. Authority epoch is advanced exactly once on a successful handoff.

## Authority and negative-path coverage

The test suite explicitly verifies wrong-owner and Observation/Renderer paths cannot mutate partition or routing state; duplicate/stale/dangling IDs fail without changing the registry; unavailable targets do not auto-failover; partial/stale handoffs are all-or-none; duplicate authority audit is read-only; and Acceptance never promotes missing, mixed-run or failed evidence.

## Repository-standard validation

Implementation head `0d7c805bfcf57f236f2291c9b837e25bcea1ad30` passed:

- `cargo fmt --manifest-path production/Cargo.toml --all -- --check` — PASS
- `cargo clippy --manifest-path production/Cargo.toml --workspace --all-targets -- -D warnings` — PASS
- `cargo test --manifest-path production/Cargo.toml --workspace` — PASS
- `production/crates/authority-placement-core/tests/wp009.rs` — 21 passed; 0 failed
- `Validate production world core` run `32127353850` — SUCCESS
- `Validate city engine` run `32127353753` — SUCCESS

No warning suppression, ignored test, semantic fallback, duplicate canonical writer, automatic unavailability failover, Observer/Renderer reverse write, source-less threshold, Architecture change, WBS scope change or dependency semantic change was introduced.

## Bounded correction record

The initial materialized implementation was canonically formatted and locally gated by strict Clippy plus the full workspace test command before its implementation commit was created. The first repository-standard PR validation then passed without a failed validation cycle.

Correction budget consumed: 0 / 2.

## Closure gate

The WP-level closure contract requires:

- all Frozen predecessors admitted;
- exact Member IDs S1.03.01…S1.03.10;
- exact same-run pre-review Evidence for S1.03.01…S1.03.09;
- S1.03.10 PASS acceptance record plus non-zero S1.03.10 Evidence;
- single writer / authority epoch preserved;
- deterministic persistence and replay;
- read-only Observation/Renderer/Analytics boundary preserved;
- Architecture Change 0;
- WBS Scope Delta 0;
- Dependency Semantic Change 0;
- Frozen Week Change 0.

The dedicated closure test passes all of these conditions and proves zero S1.03.10 Evidence blocks closure. Final WP-009 status is therefore `PASS / CLOSED` only after the exact Evidence-bearing commit containing this record passes repository-standard CI. No successor WP is executed by this closure record.
