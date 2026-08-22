# WP-RV08 R4-AQ — Demographic / Labor-Force Semantics and Population Invariance Audit — CLOSURE

Date: 2026-08-22
Run: 32556017878
Source SHA: bff1c71bcb2e2342818800c6038d457195d9162f
Verdict: PASS — STRUCTURAL REALISM GAP CONFIRMED

## 1. Execution

All four shards succeeded:

- original A
- original C
- held-out E
- held-out F

Final custom status `economic-lab/wp-rv08-r4-aq` = SUCCESS.

All health and diagnostic gates passed.

## 2. Population is currently static

Across every seed:

- initial household agents: 2,110
- final household agents after 24 months: 2,110
- household ID set: exactly unchanged

This runtime result agrees with source inspection: current Economic Lab has firm entry, but no household birth/death/aging/retirement/population-entry lifecycle.

## 3. No demographic or labor-force state exists

Runtime inspection confirmed no household fields for:

- age / date of birth
- alive/death state
- child/student/retirement state
- labor-force eligibility / participation status

This is a model-structure fact, not an empirical calibration issue.

## 4. Current unemployment is exactly an all-household nonemployment rate

For all months/seeds:

`macro.unemployment = 1 - employed households / all household agents`

The identity matched to hard-gate tolerance.

Therefore the current metric is not a conventional unemployment rate unless `household` is explicitly defined as a labor-force-capable economic unit rather than a population/household unit.

## 5. Denominator sensitivity

The shadow calculation changed only the denominator; it did not modify the simulation.

Mean current-model unemployment across 24 months was approximately:

- original A: 67.93%
- original C: 67.41%
- held-out E: 67.87%
- held-out F: 67.60%

If, purely as a sensitivity calculation, the labor-force denominator were 50% of the total household count, the corresponding mean rates would be approximately:

- original A: 57.93%
- original C: 56.75%
- held-out E: 57.53%
- held-out F: 56.36%

At a 70% denominator the values remain roughly 61–62%.

This shows that denominator definition materially changes the reported rate, but **does not explain away the collapse**. Even an aggressive denominator sensitivity still leaves very high nonemployment.

## 6. Important causal nuance

There are two distinct effects that must not be conflated:

1. **Measurement effect:** excluding children/retirees/nonparticipants from the unemployment denominator lowers the measured unemployment rate.
2. **Economic feasibility effect:** if those same agents are genuinely unavailable for work, the actual labor supply is smaller than the current model assumes.

The second effect can make production-labor feasibility *worse*, not better.

Therefore a realistic demographic layer may reduce the reported unemployment percentage while simultaneously increasing labor-supply pressure.

## 7. Structural conclusion

The current Economic Lab population model is too coarse for empirical claims about:

- unemployment,
- labor-force participation,
- working-age population,
- dependency ratios,
- aging,
- retirement,
- population growth/decline.

This is now a **verified structural realism defect**.

However it is not yet evidence that demographics are the primary cause of the existing collapse. The existing model already treats essentially all household agents as potential workers, and earlier R4-AP/AF/AG evidence shows posted labor targets are almost fully filled while the targets themselves remain far below physical production need.

## 8. Next step

R4-AR will quantify working-age/labor-force feasibility as a sensitivity envelope: for a range of possible eligible labor-force shares, how often would economically viable physical labor demand exceed the available labor force?

This remains diagnostic only. No arbitrary age distribution or demographic repair will be inserted into canonical code before the population-unit semantics are specified.
