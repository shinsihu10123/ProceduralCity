# WP-RV08-R2 — Instrumentation Incident

Date: 2026-08-20

## Classification

**BLOCKED — ARTIFACT SERIALIZATION ONLY; ECONOMIC MATRIX COMPLETED**

This incident is not an economic failure and does not authorize any mechanism change.

## Run

- workflow run: `32367734236`
- job: `96420917275`
- matrix: 12 variants × compact/baseline × 3 seeds × 12 months

The runner completed the full economic matrix, printed the baseline macro/entrant tables, and printed every hard gate as `true` before failing during final full-evidence JSON serialization.

Observed hard gates before the process exhausted the Node heap:

- control observer non-interference: PASS
- deterministic replay: PASS
- health: PASS
- complete run coverage: PASS
- settlement ledger: PASS
- general accounting: PASS
- GDP arithmetic identity: PASS
- post-plan intervention activation: PASS
- entrant birth/trace coverage: PASS
- underwriting relief activation: PASS
- no special lending to non-entrants: PASS
- positive supplemental credit: PASS
- finite macro/lifecycle rows: PASS

The terminal failure was `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` while serializing the very large `{supplements, traceRows, rows, lifecycle}` evidence object.

## Economic result available before the incident

The matrix materially sharpened the repair decision:

1. risk-only, affordability-only, capital-only and two-way hard-constraint relief did not restore replacement-entrant lending;
2. even `postplan-all-hard` still produced zero entrant credit;
3. entrant lending activated only when all hard constraints **and** the mature-bank counterfactual preference were bypassed (`*-all-hard-cf`);
4. under those upper-bound variants, entrant credit became common and entrant re-exit nearly disappeared;
5. therefore current-plan timing is a correctness issue, but not the decisive regeneration gate once financing is available;
6. a production repair should not simply delete commercial-bank risk constraints. A separate, accounting-explicit startup/entry financing institution is admitted for testing.

## Recovery action

A bounded recovery workflow reruns the exact same economy matrix with `OUTPUT_JSON=''` and archives the console evidence instead of serializing the full giant object.

Recovery workflow: `.github/workflows/economic-lab-rv08-r2-recovery.yml`.

No economic mechanism, coefficient, seed, scale, or horizon is changed by the recovery.
