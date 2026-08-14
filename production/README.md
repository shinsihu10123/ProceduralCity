# Production Autonomous World Simulation

This directory is the production implementation tree governed by:

1. **World System Baseline v1.0** (WHAT)
2. **Production Architecture Baseline v1.0** (HOW)
3. **Implementation WBS / FINAL Schedule v2.1.3a** (ORDER)

The pre-existing JavaScript/WebGL city and civilization implementations in the repository are legacy/reference assets. They are not authoritative for this production tree.

## Week 1 execution

Execution begins at the frozen global root:

- `WP-001`
- `S1.01`
- `S1.01.01 Canonical State 의미 계약`

The initial Rust workspace is intentionally dependency-light. Implementation-deferred choices are introduced only when needed by the admitted Work Package and must remain subordinate to the frozen WHAT/HOW/ORDER contracts.

## Commands

```bash
cargo fmt --manifest-path production/Cargo.toml --all -- --check
cargo clippy --manifest-path production/Cargo.toml --workspace --all-targets -- -D warnings
cargo test --manifest-path production/Cargo.toml --workspace
```
