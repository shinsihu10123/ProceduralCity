# WP-005 — Validation Evidence / VT0–VT6 Registry — Closure Evidence

Status: PASS / CLOSED
Frozen parent: Stage 3 / S3.06
Hard predecessor: WP-001
Architecture authority: PA-045 / Domain 27 Validation Registry and Certificate authority
Implementation: `production/crates/validation-core`
Frozen scope: S3.06.01…S3.06.13 only. S3.06.14…S3.06.16 remain outside this WP.

## Admission
- WP-001 Canonical State contract is the hard predecessor and is consumed through `ValidationReceipt`.
- Admission rejects a mismatched predecessor work ID/version.
- The validation layer never becomes scientific-truth owner: source-domain state is retained as a reference only.

## Frozen Member L3 implementation and test evidence
1. **S3.06.01 Validation Evidence Schema** — versioned Stable ID/namespace/owner/causal-parent identity, source hash, build/run identity, test-log and adjudication references; create/read/update/retire plus save/load replay and duplicate/stale/dangling/wrong-owner failure boundaries.
2. **S3.06.02 VT0 Semantic Integrity Registry** — exact semantic tier registry with versioned reference lineage. VT0 tolerance is hard zero-tolerance (`TolerancePolicy::Exact`).
3. **S3.06.03 VT1 Deterministic Integrity Registry** — deterministic/replay integrity tier using the same owner/version/reference contract.
4. **S3.06.04 VT2 Conservation Integrity Registry** — conservation integrity tier with exact evidence-schema reference validation.
5. **S3.06.05 VT3 Numerical Integrity Registry** — numerical integrity tier; contextual tolerances must name quantity/model/fidelity/unit/uncertainty provenance rather than using a universal epsilon.
6. **S3.06.06 VT4 Cross-LOD Integrity Registry** — cross-LOD integrity tier with versioned source/evidence linkage.
7. **S3.06.07 VT5 Empirical / Statistical Integrity Registry** — empirical/statistical integrity tier without converting statistical appearance into canonical truth.
8. **S3.06.08 VT6 Observation Integrity Registry** — observation/projection integrity tier; Observer/Renderer/Derived/Analytics origins remain read-only and cannot mutate the registry.
9. **S3.06.09 Validation Outcome — PASS** — PASS requires all declared required tiers to be covered and rejects any explicit coverage gap.
10. **S3.06.10 Validation Outcome — FAIL** — FAIL is an explicit outcome and requires failure evidence/basis; it is not inferred from missing data.
11. **S3.06.11 Validation Outcome — COVERAGE_INSUFFICIENT** — separate outcome requiring an actual missing required tier or explicit coverage gap; it is never silently promoted to PASS.
12. **S3.06.12 Evidence Provenance** — records source hash, build/run identity, test/adjudication references, source event, actor, artifact and ordered transform steps; deterministic evidence digest is replay-stable.
13. **S3.06.13 Tolerance / Acceptance Record** — binds target reference, validation tier, context-specific tolerance policy, decision reference and provenance reference without changing source-domain truth.

Dedicated test module: `production/crates/validation-core/tests/wp005.rs`.
It contains 17 explicit tests covering Admission, every S3.06.01…S3.06.13 member, authority/reference failure propagation, WP integration/closure membership, persistence/replay, and deterministic decision replay.

## Authority and boundary evidence
- Canonical validation owner is `domain27.validation_registry`.
- Only `WriteOrigin::OwningResolver` can mutate registry/provenance/acceptance records.
- Derived, Observer, Renderer and Analytics writes are rejected before mutation.
- Scientific truth remains in the source domain; this crate stores `target_state_ref` and validation evidence only.
- Duplicate namespace/Stable ID, dangling evidence reference, stale revision, retired record and wrong-owner attempts fail closed.
- Failed operations are checked against the pre-state digest so partial canonical mutation is not accepted.
- S3.06.16 is deliberately excluded from `MEMBER_IDS`; it belongs to the later WP-017 acceptance-review package.

## Persistence / replay evidence
- Registry snapshot uses a stable, escaped, versioned representation.
- Snapshot reload validates tier/reference integrity and reproduces the same stable encoding/digest.
- Evidence and validation decisions use deterministic FNV-1a evidence digests for local replay fixtures; this does not claim to define a future global persistence digest algorithm.
- Version predecessor references preserve create/update/retire lineage at this WP boundary.

## Acceptance gate
`accept_wp` requires:
- valid WP-001 predecessor receipt,
- PASS for all 13 Frozen member IDs,
- non-zero evidence digest for all 13 members,
- non-zero registry digest.

Any missing member/evidence blocks closure at the exact member ID. It does not pull S3.06.14, S3.06.15 or S3.06.16 into WP-005.

## Bounded correction record
Initial bounded probe at head `32a7e0703eecad9a6a60ab4af6e4f68fa1a7804a` found:
- format check: FAIL (canonical rustfmt differences),
- strict Clippy: PASS,
- workspace tests: FAIL due to the first snapshot decoder field-count/reference parsing implementation.

Repair cycle 1 corrected the schema/tier snapshot decoder to match its stable encoder and applied canonical rustfmt. The resulting strict probe report `docs/evidence/week1/wp005-ci-probe.txt` records:
- `FMT_EXIT=0`
- `CLIPPY_EXIT=0`
- `TEST_EXIT=0`

No second production correction was required.

## Final validation
Evidence-bearing validation report: `docs/evidence/week1/wp005-final-validation.txt`.
The validation performed the repository-standard strict gates plus the dedicated WP-005 test target:
- `cargo fmt --manifest-path production/Cargo.toml --all -- --check`: PASS
- `cargo clippy --manifest-path production/Cargo.toml --workspace --all-targets -- -D warnings`: PASS
- `cargo test --manifest-path production/Cargo.toml --workspace`: PASS
- `cargo test --manifest-path production/Cargo.toml -p gaonn-validation-core --test wp005`: PASS, 17/17
- Evidence presence: PASS

The final closure-state validation is repeated after this CLOSED evidence record is written; the temporary WP-specific validation workflow is removed afterward without changing production code or this evidence record.

## Closure deltas
- Architecture Change: 0
- WBS Scope Delta: 0
- Dependency Semantic Change: 0
- Frozen Week Change: 0
- BCR Trigger: none
