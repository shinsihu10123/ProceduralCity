# WP-RV07-P19 Correction — Memory-Safe Determinism Fingerprint

Date: 2026-08-20

## Prior run classification

Prior workflow run `32311852093` is **BLOCKED / INSTRUMENTATION FAILURE**, not economic evidence.

The process reached the Node/V8 heap limit at roughly 4.1 GB while constructing the determinism fingerprint. The stack was in value deserialization / `structuredClone`, and no result artifact was produced. No hypothesis may be accepted or rejected from that failed run.

## Root cause and correction

The original observer cloned and retained a very large composite state containing countries/agents, ledger entries and accounting reports. P19 has four causal variants across two scales and multiple seeds, so that fingerprint implementation was unnecessarily memory intensive.

The economic intervention is unchanged. Only the determinism observer was changed: the giant structured-clone fingerprint was replaced by a streaming SHA-256 digest over the same deterministic state domains, serialized sequentially and compared for exact replay equality.

## Boundary

- canonical mechanism changes: **0**
- experiment intervention changes: **0**
- parameter tuning: **0**
- prior run economic verdict: **NONE**
- retry authorized: **YES — instrumentation-only correction**
