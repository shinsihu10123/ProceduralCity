# WP-RV07-P44 Correction — 2026-08-20

Initial run `32326113185` failed before producing evidence because Node reached the default ~4 GiB V8 heap limit during the expanded four-variant topology × capacity matrix.

Classification: **BLOCKED — EXECUTION RESOURCE LIMIT**, not an economic hard-gate failure.

Observed fatal error: `Ineffective mark-compacts near heap limit / JavaScript heap out of memory`.

No economic result from the failed run is admissible.

Correction scope is execution-only: re-run the identical diagnostic script with `NODE_OPTIONS=--max-old-space-size=6144`. No model code, mechanism, coefficient, seed, horizon, scale, or diagnostic intervention is changed.
