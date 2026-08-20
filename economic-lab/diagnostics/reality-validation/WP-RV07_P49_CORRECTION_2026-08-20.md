# WP-RV07-P49 Correction — 2026-08-20

The first technically successful P49 run (`32327400652`) reported zero-month re-employment for exit-displaced workers. That result is logically incompatible with the canonical monthly order: firm exits occur after the labor market, and canonical exit handling explicitly clears affected household employment and employer IDs.

Therefore the first P49 result is **NOT ADMISSIBLE ECONOMIC EVIDENCE** despite its original script gates passing.

Classification: **BLOCKED — INSTRUMENTATION SEMANTICS DEFECT**.

Correction:
- verify immediately inside the exit wrapper that each recorded displaced household is `employed=false` and has `employerId=null` after canonical exit processing;
- forbid re-employment attribution in the displacement month;
- count re-employment only in strictly later months;
- hard-gate both post-exit displacement and `rehireMonth > displacementMonth`.

No economic mechanism, coefficient, seed, scale or horizon is changed.
