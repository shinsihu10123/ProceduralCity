# WP-RV08 R4-AR Closure — Working-Age / Labor-Force Feasibility Sensitivity

Date: 2026-08-22
Run: `32556157025`
Source SHA: `b5f9217aade32eb36b67fad46373e6cfe57fd452`
Verdict: **PASS — causal/structural narrowing; demographic calibration remains OPEN**

## Execution gate

- 8/8 economic shards: SUCCESS
- final beacon: SUCCESS
- original A/C + held-out E/F
- CONSUMER and MATERIALS+CONSUMER diagnostic bases
- 24 months each
- ledger/accounting/GDP arithmetic/health/coverage/normalization gates: PASS
- labor-force shares 0.40–1.00 are sensitivity assumptions only; they are **not** empirical demographic calibration.

## Main result

Across all 8 seed/base cases, the current model's full physical production plan requires approximately **1.996 worker slots per household-agent even when 100% of household-agents are treated as labor supply**. Physical labor need exceeds the full household count in about **97.9% of observed country-months**.

At more restrictive labor-force shares the feasibility gap becomes much larger:

| Assumed labor-force share of household-agents | Mean economically viable labor need / labor force | Months viable need > labor force | Mean full physical need / labor force | Months full physical need > labor force | Mean canonical desired jobs / labor force | Months desired jobs > labor force |
|---:|---:|---:|---:|---:|---:|---:|
| 60% | 1.286 | 68.1% | 3.326 | 100.0% | 0.939 | 46.0% |
| 70% | 1.102 | 62.2% | 2.851 | 100.0% | 0.805 | 35.4% |
| 80% | 0.964 | 51.2% | 2.495 | 100.0% | 0.704 | 29.2% |
| 100% | 0.771 | 28.4% | 1.996 | 97.9% | 0.564 | 0.0% |

The M+C diagnostic base is more labor demanding than CONSUMER-only for economically viable plans. At a 70% labor-force share, mean viable need / labor force is about **1.206** in M+C and **0.998** in CONSUMER-only.

## Causal interpretation

R4-AR rejects the simple interpretation that the economy merely has a normal labor force but poor matching. The canonical posted job target is usually below aggregate labor supply, while the production system's physical labor requirement is far above it. This reproduces the earlier AF/AG finding from a population-feasibility angle: **the labor market can fill what firms ask for, but firms ask for far less labor than the production plan physically implies.**

The result also raises a deeper ontology problem. The object called `household` simultaneously carries one employment flag, one employer, one wage, one skill and one reservation wage, while also carrying household wealth/consumption/accounting. There is no age, household size, member list, student/retired state, labor-force-participation state, birth, death or retirement process. Therefore the current household count cannot safely be interpreted as either a realistic person population or a realistic household population.

## Hypothesis verdicts

- **H-AR1 — current collapse is mainly caused by a finite number of household-agents:** DOWNGRADED. R4-AP already showed balanced ×2 scaling does not remove the defect.
- **H-AR2 — a realistic labor-force denominator is structurally relevant:** STRONGLY SUPPORTED. At 60–70% eligibility, even economically viable labor need exceeds the available labor force in most months.
- **H-AR3 — canonical desired jobs represent physical production labor demand:** FALSIFIED. Desired jobs average only ~56% of the full-household labor capacity at 100% eligibility while full physical need is ~200%.
- **H-AR4 — unemployment measurement can be repaired by denominator relabeling alone:** FALSIFIED. Measurement is defective, but underlying production/labor feasibility is also defective.

## Next gate

Proceed to **R4-AS — Household/Person Labor-Unit Ontology Audit** before introducing age parameters or empirical demographic shares. The next audit must determine whether the simulation's basic population unit is internally coherent and quantify how many worker slots per household-agent would be required to reconcile viable and physical production plans.

No canonical demographic or labor repair is authorized by R4-AR.