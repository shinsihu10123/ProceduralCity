# WP-010 — S1.06 Hierarchical Causal Scheduler — Closure Evidence

Status: PASS / CLOSED
Frozen parent: Stage 1 / S1.06
Hard predecessor: WP-002
Architecture authority: PA-008 / PA-041 / Domain 26
Implementation: `production/crates/scheduler-core`
Frozen scope: S1.06.01…S1.06.10 only. S1.06.11 remains outside WP-010 and belongs to WP-018.

## Admission
- WP-002 closure evidence is represented by a versioned `Wp002ClosureProof` carrying all nine member evidence digests and the S1.02.09 Identity Reuse Prohibition audit.
- Admission rejects missing member evidence, failed/reused identity audit state, stale proof version or missing causal parent before scheduler work is accepted.
- The scheduler consumes identity continuity but does not redefine Stable Entity identity semantics.

## Frozen Member L3 coverage
1. **S1.06.01 Schedulable Event / Process Contract** — validates Stable ID, namespace, version, owner, WorldTime, deterministic key consistency, source-supplied allowed transition and runtime write authority. Output is `CandidateOnly`; Observer/Renderer/Analytics/Derived/UI/AI origins cannot write scheduler state.
2. **S1.06.02 Causal Deadline Representation** — versioned causal deadline representation preserves Stable ID/version/owner/causal parent and separates changed deadline/microstep fields from preserved identity fields.
3. **S1.06.03 Deterministic Scheduling Key** — semantic key is `(deadline tick, causal microstep, source-defined semantic priority, Stable ID, version)`. It contains no worker/thread/frame/camera identity and is stable under input container order.
4. **S1.06.04 Same-Time Bucket Collection** — accepts only the same absolute WorldTime epoch/tick, sorts by the deterministic semantic key and rejects duplicate IDs or keys.
5. **S1.06.05 Same-Time Dependency Resolution** — source-defined dependency tokens and declared shared resources determine candidate rejection; deterministic key order selects compatible work and records each rejection reason and used-resource set.
6. **S1.06.06 Future Event Queue** — versioned/owner-validated queue tracks Ready/Waiting/Blocked state, next execution time and ordering key; duplicate ID/key, stale plan, wrong writer and dangling reference fail before partial application.
7. **S1.06.07 Inactive Process Wake/Sleep Scheduling** — distinguishes Ready, Sleeping and Blocked/expired work; unmet dependency and expired deadline never become completed work.
8. **S1.06.08 Scheduler Admission Interface** — carries predecessor PASS, input version, explicit block reason and deterministic key; stale input version fails closed.
9. **S1.06.09 Scheduler Budget Handoff** — passes source Stable ID/version/deadline/key, owner/schema/causal parent, source-provided budget profile reference and available slot count without inventing budget policy or changing domain priority semantics.
10. **S1.06.10 Render / Frame-Time Coupling Prohibition Audit** — read-only audit detects render frame-time deadline control, visibility-based wake/pause, observer-controlled ordering and renderer writes. It records first failure and reproduction while preserving identical pre/post scheduler digest.

## PA-008 / PA-041 invariants
- Runtime scheduler manages execution order; domain semantics supplies priority/dependency meaning.
- Same-time work is resolved by causal microstep, semantic priority, dependency and explicit resource conflict, not worker completion order.
- Render/frame-time, visibility, Observer and camera state are non-causal scheduler inputs.
- Resource pressure can produce Waiting/Blocked/budget-handoff state but does not delete causal work or fabricate completion.
- Candidate scheduling output does not itself become Canonical Reality; later PA-009 transaction/commit remains outside this WP.

## Persistence / replay
- `SchedulerSnapshot` retains schema version, commit marker, causal cut and complete pending/sleeping/ready queue state.
- Restore validates every record and reproduces the same Stable ID, version, WorldTime, pending status, dependency tokens, causal reference and deterministic queue digest.
- BTree-ordered semantic keys make replay independent from source container insertion order for this WP boundary.
- No thread/worker/frame/camera identity is persisted as causal scheduler state.

## Tests
Dedicated target: `production/crates/scheduler-core/tests/wp010.rs`.
It contains 14 tests covering WP-002 Admission, each S1.06.01…S1.06.10 member, wrong-origin no-mutation authority, persistence/replay and complete WP integration/acceptance.

Strict bounded validation report: `docs/evidence/week1/wp010-ci-probe.txt`.
The final bounded repair-2 result records:
- `FMT_EXIT=0`
- `CLIPPY_EXIT=0`
- `WORKSPACE_TEST_EXIT=0`
- `WP010_TEST_EXIT=0`
- dedicated WP-010 tests: 14 / 14 PASS

## Bounded correction record
Initial validation at the first probe found:
- canonical rustfmt differences,
- one strict Clippy `manual_contains` finding in predecessor evidence validation,
- full workspace tests PASS,
- dedicated WP-010 tests PASS 14/14.

Repair cycle 1 applied canonical rustfmt. It removed the formatting failure but strict Clippy correctly retained the `manual_contains` failure; all tests still passed.

Repair cycle 2 replaced the manual linear predicate with the direct fixed-array `contains(&0)` check, reapplied canonical formatting and reran all strict gates. Format, strict Clippy, full workspace tests and dedicated WP-010 tests all passed. Exactly two bounded correction cycles were used; no further production correction is permitted or required.

## Acceptance gate
`accept_wp` requires:
- valid WP-002 closure proof,
- PASS for all ten Frozen Member L3 IDs,
- non-zero Evidence digest for every member,
- non-zero scheduler snapshot/replay digest.

A missing member blocks closure at its exact L3 ID. S1.06.11 is deliberately excluded from `MEMBER_IDS` and is not pre-implemented here.

## Closure deltas
- Architecture Change: 0
- WBS Scope Delta: 0
- Dependency Semantic Change: 0
- Frozen Week Change: 0
- BCR Trigger: none

Final CLOSED status is retained only if this evidence-bearing branch state itself passes repository-standard format, strict Clippy, full-workspace tests, dedicated WP-010 tests, and evidence presence/status validation. The temporary WP-specific workflow is removed afterward without changing production code or this evidence record.
