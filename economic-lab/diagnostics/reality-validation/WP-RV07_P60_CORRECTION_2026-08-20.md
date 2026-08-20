# WP-RV07-P60 Instrumentation Corrections — 2026-08-20

## Scope

P60 is a read-only operating-feasibility waterfall observer. During execution, three instrumentation issues/attempts were distinguished from economic-model evidence.

## Attempt 1 — Run `32329982509`

**BLOCKED — INSTRUMENTATION DEFECT**

The base diagnostic wrapped `SupplyChainSystem.produce` as if the method accepted only `country`. The canonical call is `produce(country, month, industryMetrics)`. The observer therefore caused `metrics.sectorOutputs` to receive `undefined` and raised a TypeError before evidence generation.

No economic conclusion is admissible from this run.

## Attempt 2 — Run `32332569561`

**BLOCKED — INSTRUMENTATION DEFECT**

The first correction forwarded two arguments, but the canonical method requires three. The second positional argument (`month`) was incorrectly passed as the metrics argument. The same TypeError remained.

No economic conclusion is admissible from this run.

## Attempt 3 — Run `32332637796`

The corrected three-argument forwarding allowed the diagnostic to complete and all coded hard gates passed. However, review of the output table exposed a second semantic observer defect: `salesCoverage` was exactly zero for every sector and variant.

The base observer read legacy field `firm.salesThisMonth`, while the canonical goods-market/month-close path uses `firm.sales`. Therefore the production/capacity/plan portions are informative, but the **sales stage is not admissible for closure** from this attempt.

Artifact from this attempt is retained as debugging evidence only; it is not the final P60 evidence package.

## Final correction

Commit `a2afa7b03237d2d50f4bfeab15da57d2866ffa15` changes only the diagnostic wrapper to:

1. forward `(country, month, industryMetrics)` to the canonical `produce` method;
2. observe canonical `firm.sales` instead of legacy `firm.salesThisMonth`.

No canonical economic mechanism, parameter, ordering or settlement rule is changed.

## Gate rule

P60 may close only after the corrected run:

- passes existing non-interference/determinism/health/bounds gates;
- produces non-degenerate sales-stage observations where canonical sales are positive;
- yields internally interpretable capacity → plan → output → sales coverage.

Canonical mechanism changes: **0**. Parameter tuning: **0**. Repair merge: **0**.
