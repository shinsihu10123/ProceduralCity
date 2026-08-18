# WP-011 — S1.10 Causal Random Address / Versioned World Seed — Closure Evidence

Status: PASS / CLOSED
Frozen parent: Stage 1 / S1.10
Hard predecessors: WP-002, WP-004
Architecture authority: PA-056 / Domains 26–27
Implementation: `production/crates/causal-random-core`
Frozen scope: S1.10.01…S1.10.08 only. S1.10.09+ remain outside WP-011.

## Admission
- WP-002 proof carries all nine member Evidence digests plus the S1.02.09 Identity Reuse Prohibition audit; missing evidence, failed reuse audit, stale version or missing causal parent blocks admission.
- WP-004 input must be the closed nine-member WorldTime acceptance with non-zero Evidence digest.
- Admission preserves separate identity/time predecessor digests and does not redefine either predecessor subsystem.

## Frozen Member L3 coverage
1. **S1.10.01 Causal Random Address 의미 계약** — validates schema/version/PA-056 owner/causal parent, source-supplied allowed transition, versioned seed reference and the semantic random address. The receipt preserves operands `Causal / Random / Address / Versioned / World` and is `CandidateOnly`.
2. **S1.10.02 Versioned World Seed** — `WorldRandomRoot256` is represented as a non-zero 256-bit root with Stable ID, namespace, version, PA-056 owner, causal parent, deterministic creation token and explicit predecessor continuity for revisions.
3. **S1.10.03 Entity Identity Address Component** — random subject identity uses Stable Entity ID, identity namespace/version and lifecycle lineage; display names or transient object addresses are not canonical random identity.
4. **S1.10.04 Process / Episode Address Component** — semantic process key and episode key are required address components and fail closed when absent.
5. **S1.10.05 WorldTime / Counter Address Component** — uses validated WP-004 absolute WorldTime epoch/tick plus an explicit semantic counter; wall-clock/frame time is not accepted as the address time source.
6. **S1.10.06 Domain Random Namespace** — versioned PA-056-owned domain namespace registers explicit Purpose IDs. Sampling with an unregistered purpose fails before sample generation.
7. **S1.10.07 Stateless Sample Generation** — sampling is a pure function of the versioned world seed/lineage and the complete semantic causal address. Repeating the exact address reproduces the exact sample and does not mutate a stream position or registry state.
8. **S1.10.08 Deterministic Distribution Primitives** — deterministic raw-u64, integer-threshold Bernoulli and bounded-u64 transforms operate on the stateless sample; invalid parameters fail closed.

## PA-056 architecture boundary
- Canonical random identity is semantic causal addressing, not mutable RNG stream consumption.
- The implemented address explicitly contains Random Lineage ID, Purpose ID, Subject/Entity key, Episode key, WorldTime/counter, Domain namespace, Sample Role ID and Sample Index.
- Worker, thread, GPU, partition, retry and camera identity are absent from the canonical address and are tested as non-causal inputs.
- Random lineage/profile registry mutation is restricted to `RegistryAuthority`; DomainProcess owns sample meaning/use but cannot mutate registry identity, while Observer/Renderer/Analytics/worker-related origins are read-only.
- The local deterministic mixing function is an implementation detail for this WP testable boundary. It is **not** declared the Frozen global random algorithm/version; `S1.10.14 Random Algorithm Version Tag` remains outside WP-011.
- `S1.10.09 Stable Stochastic Event Identity`, resolution invariance, schedule/worker independence, branch namespace hooks and global mutable-RNG audit remain for later Frozen members/WPs and are not claimed complete here.

## Persistence / replay
- `RandomSnapshot` carries schema version, commit marker, causal cut and the complete seed/lineage/domain-namespace registry.
- Restore validates seed and versioned references and reproduces the same registry digest.
- The same semantic address after restore produces the same stateless sample.
- No mutable RNG cursor/stream position is persisted because no canonical mutable stream exists at this WP boundary.

## Tests
Dedicated target: `production/crates/causal-random-core/tests/wp011.rs`.
It contains 14 tests covering both Hard Predecessor admission, all eight Frozen Member L3s, PA-056 authority boundaries, forbidden execution-environment address inputs, persistence/replay, failure propagation and complete WP integration/acceptance.

Strict bounded validation report: `docs/evidence/week1/wp011-ci-probe.txt`.
Repair cycle 1 result:
- `FMT_EXIT=0`
- `CLIPPY_EXIT=0`
- `WORKSPACE_TEST_EXIT=0`
- `WP011_TEST_EXIT=0`
- dedicated WP-011 tests: 14 / 14 PASS

## Bounded correction record
Initial probe found canonical rustfmt differences and one Rust test name-shadowing compile error in the S1.10.07 fixture. No Frozen semantic or architecture change was required.

Repair cycle 1 renamed the local test binding, applied canonical rustfmt, then reran format check, strict Clippy, full workspace tests and the dedicated WP-011 target. All gates passed. No second production correction was required.

## Acceptance gate
`accept_wp` requires:
- valid WP-002 and WP-004 Admission evidence,
- PASS for all eight Frozen Member L3 IDs,
- non-zero Evidence digest for every member,
- non-zero snapshot/replay digest.

A missing member blocks closure at the exact L3 ID. Later S1.10 members cannot substitute for S1.10.01…08 and are not pulled into this WP.

## Closure deltas
- Architecture Change: 0
- WBS Scope Delta: 0
- Dependency Semantic Change: 0
- Frozen Week Change: 0
- BCR Trigger: none

Final CLOSED status is retained only if the Evidence-bearing branch state itself repeats repository-standard format, strict Clippy, full-workspace tests, dedicated WP-011 tests, and Evidence presence/status validation. The temporary WP-specific workflow is removed afterward without changing production code or this Evidence record.
