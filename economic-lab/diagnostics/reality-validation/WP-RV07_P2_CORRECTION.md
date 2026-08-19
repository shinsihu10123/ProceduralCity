# WP-RV07-P2 — Diagnostic Gate Correction

Date: 2026-08-19

Run `32223740276` completed the paired control/candidate simulation and produced an artifact, but the workflow ended FAIL because the P2 diagnostic runner reconstructed expenditure GDP without `macro.netExports`.

That was a **diagnostic-runner defect**, not evidence of a model accounting failure:

- frozen control health: PASS;
- candidate health: PASS;
- deterministic replay: PASS;
- coverage: PASS;
- both control and candidate failed only the locally reconstructed GDP gate;
- WP-RV05's validated identity is `C + I + G + NX + ΔInventories`.

Corrected runner: `economic-lab/scripts/structural-unit-basis-ablation-v10b.mjs`.

The correction restores `netExports` to the P2 identity and does not alter the frozen model, the candidate rule, any dynamic coefficient, or any simulation state transition.

The failed attempt remains evidence and is not deleted.
