# WP-015 / S1.09.01–S1.09.10 — Implementation Scope

Status: IMPLEMENTED / VALIDATION PENDING

Frozen scope is exactly S1.09.01 through S1.09.10. Hard predecessors are WP-004 and WP-010. Architecture mapping is PA-007, PA-055 and PA-056; Domain mapping is D26,D27.

Implementation crate: `production/crates/multi-rate-coupling-core`.

The implementation provides the Multi-Rate Coupling Window contract, Fast/Slow classification interface, typed integrated-flux packet, committed-boundary snapshot/recompute manifest, exact checked substep accumulation, conservative exchange candidate, event localization, synchronization, bounded pre-commit rollback, and rollback-horizon contract. Coupling owns exchanged integrated quantities only; source-domain state remains domain-owned. Every write-like output remains `CandidateOnly`, and WP-015 performs no canonical commit.

Persistence records only the committed causal cut as durable authority. Uncommitted speculative work is represented only by recomputation references and may be discarded/recomputed. Replay acceptance binds deterministic snapshot digest and exact member event order.

Final closure evidence will be written only after repository-standard rustfmt, strict Clippy, full workspace tests, dedicated WP-015 tests, and Evidence-bearing CI pass.
