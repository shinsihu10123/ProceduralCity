# WP-015 / S1.09.01–S1.09.10 — Closure Evidence

Status: PASS / CLOSED, effective when the exact Evidence-bearing head containing this record passes repository-standard CI.

Frozen Stage / Subsystem: Stage 1 / S1.09
Frozen scope: S1.09.01…S1.09.10 only
Hard predecessors: WP-004, WP-010
Architecture mapping: PA-007, PA-055, PA-056
Domain mapping: D26,D27
Implementation: `production/crates/multi-rate-coupling-core`
Strict implementation-validation head: `047d4ac51ac31ac8cfbc913b86ac6ea9e9269537`
World-core CI: `32198785892` — SUCCESS
City-engine CI: `32198785912` — SUCCESS
Dedicated WP-015 tests in bounded validation: 16 / 16 PASS
Correction cycles: 2 / 2

## Frozen boundary

WP-015 owns the multi-rate coupling contract and exchanged integrated quantities, not source-domain canonical state. All write-like outputs produced by this crate remain `CandidateOnly`; `canonical_commit_performed` remains false. No PA-009 canonical commit is implemented by WP-015. Observer, Renderer, Analytics, UI, AI, Worker and source-domain callers cannot acquire coupling-writer authority.

The implementation consumes only the two Frozen Hard Predecessors, WP-004 and WP-010, and fail-closes if their closure/evidence/versioned acceptance material is absent or invalid.

## Member L3 implementation / validation mapping

### S1.09.01 — Multi-Rate Coupling Window Contract

Defines a versioned coupling window over one absolute WorldTime epoch with explicit CC0–CC4 class, start/end, validity horizon, owner and causal parent. Invalid time frames, reversed windows, out-of-window validity horizons, stale versions and unauthorized writers fail closed. The contract does not impose a semantic fixed global tick.

### S1.09.02 — Fast / Slow Process Classification Interface

Carries explicit Fast/Slow classification between distinct source and receiver domain owners while preserving process/window ID, version and causal parent. The interface is explicitly non-authoritative over either domain state and cannot reverse-write domain reality.

### S1.09.03 — Typed Flux Packet

Represents exchanged integrated quantity with stable ID, version, source/target domain owner, quantity, unit, frame, integrated amount, coupling-window identity and causal parent. Window/classification mismatch, wrong owner, stale version and interface-boundary mismatch are rejected.

### S1.09.04 — Boundary State Snapshot

Creates a durable committed-causal-cut boundary with commit marker, recovery position, replay reference, committed pre-state digest, deterministic event order and sorted recomputation references. Uncommitted speculative results are not promoted to durable authority; only their identity/source references needed for deterministic recomputation are retained. Corrupt, stale, incomplete or evidence-free boundary material is rejected before restore.

### S1.09.05 — Substep Flux Accumulation

Accumulates only compatible typed packets for the same window/source/target/quantity/unit/frame. Stable packet IDs are unique, packet order does not change the accumulated result/evidence digest, and checked i128 arithmetic rejects overflow rather than wrapping.

### S1.09.06 — Conservative Flux Exchange

Builds a pre-commit exchange candidate from validated accumulated flux. Source delta and target delta are exact opposites and residual must be zero. The result keeps accumulator evidence, owner/frame/unit/causal linkage and remains `CandidateOnly`; it never mutates either domain state.

### S1.09.07 — Event Localization across Coupling Window

Tracks Requested/InProgress/Partial/Complete/Failed semantics. Complete localization requires an explicit localized event time inside the supplied bracket and coupling window; a request or partial result cannot be promoted to completion, and an out-of-window crossing is rejected.

### S1.09.08 — Synchronization Point

Requires a complete causal frontier across all participants, exact WorldTime tick/microstep equality and completed localization evidence before a synchronization point becomes eligible for pre-commit use. Partial/in-progress/failed states remain non-eligible and canonical commit remains false.

### S1.09.09 — Bounded Pre-Commit Rollback

Implements the four Frozen rollback classes RB0 Solver Reject, RB1 Window, RB2 Closure and RB3 Transaction Abort. Rollback is allowed only inside the speculative interval bounded by the committed frontier and synchronized point. Any post-commit rollback request is explicitly prohibited and cannot alter canonical state.

### S1.09.10 — Rollback Horizon Contract

Validates version, coupling owner, lower/upper rollback bounds, accepted target and caller authority. Wrong-owner, stale/out-of-horizon and read-only reverse-write requests fail closed. Successful output remains a versioned `CandidateOnly` validation receipt.

## Persistence / replay / authority

`BoundaryStateSnapshot` and `CouplingStateSnapshot` preserve the committed causal cut, identity/source references required for recomputation, event order and evidence digests. Restore validates schema/evidence before returning state. WP acceptance requires the replay digest to equal the validated snapshot digest exactly and requires the event order to equal the Frozen S1.09.01…S1.09.10 member order.

Authority tests verify that Derived, Observer, Renderer, Analytics, UI, AI, Worker and source DomainOwner paths cannot issue coupling-window writes or rollback-horizon reverse writes. Coupling interfaces never claim source-domain ownership.

## Validation coverage

Target: `production/crates/multi-rate-coupling-core/tests/wp015.rs`

Dedicated bounded validation: 16 passed; 0 failed. Coverage includes admission, absolute-time window bounds, read-only authority, Fast/Slow ownership boundary, typed flux linkage, committed-cut snapshot/restore, exact order-independent substep accumulation, overflow rejection, conservative CandidateOnly exchange, event localization phase semantics, exact synchronization frontier, all four rollback classes, post-commit rollback prohibition, rollback-horizon owner/authority checks, deterministic snapshot/replay, exact acceptance evidence, and end-to-end S1.09.01→S1.09.10 integration with no canonical-commit shortcut.

Repository-standard strict validation at `047d4ac51ac31ac8cfbc913b86ac6ea9e9269537` passed:

- `cargo fmt --manifest-path production/Cargo.toml --all -- --check` — PASS
- `cargo clippy --manifest-path production/Cargo.toml --workspace --all-targets -- -D warnings` — PASS
- `cargo test --manifest-path production/Cargo.toml --workspace` — PASS
- Validate production world core run `32198785892` — SUCCESS
- Validate city engine run `32198785912` — SUCCESS

## Bounded correction record

Correction cycle 1: initial repository validation rejected non-canonical rustfmt. Canonical formatting was applied in a bounded runner validation. The same cycle exposed two strict Clippy `too_many_arguments` findings while the full workspace tests and dedicated WP-015 tests were already passing. Diagnostic evidence is retained in `docs/evidence/week1/wp015-cycle1-run.txt`.

Correction cycle 2: the two interfaces were refactored to typed request/input records (`BoundarySnapshotInput`, `RollbackRequest`) instead of suppressing Clippy. Canonical rustfmt, strict Clippy, full workspace tests and dedicated WP-015 tests then all passed; `docs/evidence/week1/wp015-cycle2-run.txt` records `CLIPPY_EXIT=0`, `WORKSPACE_TEST_EXIT=0`, `DEDICATED_TEST_EXIT=0` and 16/16 dedicated tests PASS.

Temporary repair workflows were deleted before strict closure validation. Normal repository workflows are restored unchanged.

## Acceptance / closure

Closure requires the exact ten-member Frozen set S1.09.01…S1.09.10, all ten Member PASS/evidence entries, traceable WP-004/WP-010 admission, deterministic save/restore/replay evidence, single-writer/coupling authority preservation, read-only observation boundary, pre-commit-only rollback, no canonical-commit shortcut, and zero Frozen semantic deltas.

The implemented `accept_wp015` gate requires all ten PASS flags, all ten non-zero evidence digests, valid predecessor admission, valid snapshot, exact Frozen member event order and exact snapshot/replay digest equality. The closure judgment is therefore:

- S1.09.01…S1.09.10: PASS
- WP-015: PASS / CLOSED after this Evidence-bearing commit passes repository-standard CI
- Architecture Change: 0
- WBS Scope Delta: 0
- Dependency Semantic Change: 0
- Frozen Week Change: 0
- BCR Trigger: none
- Successor WP started: NO

This record is itself part of the Evidence-bearing commit and must pass repository-standard CI before final closure is relied upon.
