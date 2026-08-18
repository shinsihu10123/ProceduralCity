# WP-014 / S1.07.01–S1.07.08 — Closure Evidence

Status: PASS / CLOSED, effective when the exact Evidence-bearing head containing this record passes repository-standard CI.

Frozen Stage / Subsystem: Stage 1 / S1.07
Frozen scope: S1.07.01…S1.07.08 only
Hard predecessors: WP-001, WP-002, WP-004, WP-010
Architecture mapping: PA-009, PA-042
Implementation: `production/crates/transaction-precommit-core`
Implementation validated head: `9cafa16b54e5fe2596d1849f6f4dc8080968dee3`
Implementation world-core CI: `32131658963` — SUCCESS
Implementation city-engine CI: `32131658966` — SUCCESS
Dedicated WP-014 tests: 17 / 17 PASS
Correction cycles: 2 / 2

## Frozen boundary

WP-014 implements only the pre-commit half of S1.07. It does not implement S1.07.09 Atomic Canonical Commit or any successor. All WP-014 generated write material remains `CandidateOnly`; `canonical_commit_performed` remains false. This preserves Candidate != Reality and leaves actual canonical mutation to the later Frozen commit boundary.

The implementation consumes the four Frozen Hard Predecessors and fail-closes when their required identity/version/closure/evidence material is absent, stale, failed or inconsistent. Observation, Renderer, Analytics, UI, AI and worker-origin paths do not obtain canonical write authority.

## Member L3 implementation and validation mapping

### S1.07.01 — Canonical Transaction Identity

A versioned transaction identity contains Stable ID, Namespace, WorldTime, causal episode, causal parent, owner, lifecycle and lineage. Create/update/retire paths reject duplicate or retired-ID reuse, dangling references, stale versions, wrong owner and unauthorized origins. Retirement cannot be used as an identity-reuse shortcut.

### S1.07.02 — Transaction Read-Set Contract

The read-set records exact state key, version, owner and immutable source-state digest. Required fields, unique keys, transaction ID/version/owner/causal-parent continuity and non-zero source evidence are enforced. Invalid read material is rejected before it can become downstream transaction evidence.

### S1.07.03 — Transaction Write-Intent Set

Each write intent is bound to an exact read-set basis by state key, base version and target owner, with semantic key and proposed-state digest. Missing read basis, duplicate write keys, stale versions and owner mismatches fail closed.

### S1.07.04 — Precondition / Guard Evaluation

Guard evidence is explicit and phase-aware. Requested, in-progress and partial phases remain BLOCKED; complete-and-valid is PASS; explicit failed conditions are FAIL. Starting evaluation is never treated as completion.

### S1.07.05 — Speculative Result Buffer

Only the transaction coordinator can create the speculative buffer. It retains immutable pre-state evidence, guarded write deltas, owner/version/causal linkage and `CandidateOnly` disposition. It explicitly records that canonical commit has not occurred.

### S1.07.06 — Write Conflict Detection

Conflict detection is read-only. Conflicting claims over the same state key and base version are reported deterministically; the pre/post inspected-buffer digest remains equal. Non-overlapping claims do not create false positives.

### S1.07.07 — Deterministic Resolution Ordering

Ordering uses absolute WorldTime tick, microstep, semantic key and stable transaction ID. Worker hint and input/completion order are excluded from the ordering key, preserving worker/scheduling independence.

### S1.07.08 — Pre-Commit Invariant / Conservation Hook

Only source-provided invariant conditions and conservation equations are evaluated. Conservation arithmetic is checked and overflow-safe. A failed invariant or conservation relation produces no eligible handoff and cannot mutate the source candidate buffer. A successful output is only a versioned pre-commit handoff eligible for a future Atomic Canonical Commit; it is not itself a commit.

## Persistence / replay / authority

`TransactionSnapshot` preserves schema version, snapshot marker, causal cut, transaction registry, speculative buffers, event order and evidence hash. Corruption is rejected before restore. Restore retains transaction identity/version/lineage, pending CandidateOnly state and event order. Re-running the same deterministic ordering material produces the same result independent of worker hint and input order.

Authority tests verify Worker, Derived, Observer, Renderer, Analytics, UI and AI paths cannot create transaction registry state or speculative canonical write paths. Failure cases preserve the pre-state.

## Dedicated validation coverage

Target: `production/crates/transaction-precommit-core/tests/wp014.rs`

Repository-standard workspace execution reported 17 passed; 0 failed. Coverage includes:

1. all four Hard Predecessor admission checks;
2. S1.07.01 create/update/retire/reuse prohibition;
3. S1.07.01 wrong-origin/read-only authority boundary;
4. S1.07.02 complete, unique and versioned read-set contract;
5. S1.07.03 immutable read-basis enforcement;
6. S1.07.04 requested/in-progress/partial not promoted to completion;
7. S1.07.04 explicit failed guard propagation;
8. S1.07.05 CandidateOnly speculative buffer and no canonical commit;
9. S1.07.05 Observer/Renderer/Worker speculative-write prohibition;
10. S1.07.06 precise read-only write-conflict detection;
11. S1.07.07 worker/input-order-independent deterministic resolution;
12. S1.07.08 valid source-defined invariant/conservation handoff;
13. S1.07.08 failed invariant/conservation leaves source candidate unchanged;
14. snapshot restore/replay identity, pending-state and event-order continuity;
15. corrupt snapshot rejection;
16. WP acceptance requires all eight member PASS results plus non-zero Evidence, snapshot and pre-commit handoff;
17. S1.07.01 → S1.07.08 integration path with no Atomic Canonical Commit shortcut.

## Repository-standard implementation validation

Validated head `9cafa16b54e5fe2596d1849f6f4dc8080968dee3` passed:

- `cargo fmt --manifest-path production/Cargo.toml --all -- --check` — PASS
- `cargo clippy --manifest-path production/Cargo.toml --workspace --all-targets -- -D warnings` — PASS
- `cargo test --manifest-path production/Cargo.toml --workspace` — PASS
- WP-014 dedicated tests — 17 / 17 PASS
- Validate production world core run `32131658963` — SUCCESS
- Validate city engine run `32131658966` — SUCCESS

## Bounded correction record

Correction cycle 1: the initial implementation was rejected by repository-standard `rustfmt --check`; canonical rustfmt was applied without changing Frozen semantics.

Correction cycle 2: strict Clippy rejected a literal-boolean assertion in the WP-014 test suite. The assertion was expressed idiomatically and the restored event-order comparison was made type-explicit. A self-diagnosing validation run then recorded `CLIPPY_EXIT=0`, `WORKSPACE_TEST_EXIT=0`, `DEDICATED_TEST_EXIT=0` and 17/17 dedicated tests PASS in `docs/evidence/week1/wp014-cycle2-run.txt`.

Correction budget: 2 / 2 consumed. No warning suppression, ignored tests or third production correction was used.

## Acceptance / closure

Closure requires:

- exact Frozen member set S1.07.01…S1.07.08;
- all eight Member results PASS and non-zero Evidence;
- traceable WP-001/WP-002/WP-004/WP-010 admission;
- deterministic snapshot/restore and event-order evidence;
- read-only observation/render/analytics boundary;
- CandidateOnly speculative output with no canonical commit;
- valid S1.07.08 pre-commit handoff evidence;
- Architecture Change 0;
- WBS Scope Delta 0;
- Dependency Semantic Change 0;
- Frozen Week Change 0.

The implemented `accept_wp014` gate enforces all eight Member PASS/Evidence entries plus a valid snapshot and S1.07.08 CandidateOnly handoff. With the implementation validation above passing, the closure judgment is:

- S1.07.01…S1.07.08: PASS
- WP-014: PASS / CLOSED after Evidence-bearing CI succeeds
- Architecture Change: 0
- WBS Scope Delta: 0
- Dependency Semantic Change: 0
- Frozen Week Change: 0
- BCR Trigger: none
- S1.07.09 / successor WP started: NO

This record is part of the Evidence-bearing commit and must itself pass repository-standard CI before final closure is relied upon.
