# WP-RV08 R4-AS Closure — Household / Person Labor-Unit Ontology Audit

Date: 2026-08-22
Run: `32556514224`
Source SHA: `f0bfd9b9d5a8407648225fef4d184e6cb5ea88b5`
Verdict: **PASS — CRITICAL structural ontology defect verified**

## Execution

- 8/8 shards SUCCESS; final beacon SUCCESS.
- Original A/C + held-out E/F; CONSUMER + MATERIALS+CONSUMER; 24 months.
- Health, coverage, normalization, ledger, general accounting, GDP arithmetic, fixed household count and fixed household IDs: PASS.
- Schema gate: all audited household-agents had **zero** canonical fields for age, birth/death, household size/member list, child/dependent, student, retirement, working age, labor eligibility or labor-force participation.
- Hybrid-unit gate: PASS. The same object has person-level labor fields (`employed`, scalar `employerId`, wage, reservation wage, skill) and household-level balance-sheet/consumption fields.

## Worker-slot result

Current implementation permits one employment relation per household-agent. Across all 8 seed/base cases:

| Assumed worker slots per household-agent | Mean viable labor need / slot capacity | Months viable need > capacity | Mean full physical need / slot capacity | Months full physical need > capacity |
|---:|---:|---:|---:|---:|
| 0.50 | 1.543 | 74.1% | 3.991 | 100.0% |
| 0.75 | 1.029 | 56.1% | 2.661 | 100.0% |
| **1.00 (current ontology)** | **0.771** | **28.4%** | **1.996** | **97.9%** |
| 1.25 | 0.617 | 8.5% | 1.597 | 94.8% |
| 1.50 | 0.514 | 0.1% | 1.330 | 86.5% |
| 2.00 | 0.386 | 0.0% | 0.998 | 51.7% |

Canonical desired jobs at the current one-slot ontology average only ~0.564 slots per household-agent and never exceed the full household count, while the full physical production plan requires ~1.996 slots. This confirms that the posted labor target and the production labor requirement are structurally disconnected.

## Ontology verdict

The current population unit is internally ambiguous:

- If `household` means **person**, household wealth/consumption/accounting are being carried on a person object and the model has no children, retirees or nonparticipants.
- If `household` means **real household**, one scalar employment relation limits the household to one worker even though a household may contain multiple working members; age/member composition is absent.

Therefore the current `2110 households` must **not** be interpreted as 2110 realistic people or 2110 realistic households without an explicit architectural choice.

## Consequence for collapse diagnosis

This is not a cosmetic unemployment-statistic issue. At the present one-worker-slot ontology, the full production plan is population-infeasible in almost every month. Even two theoretical worker slots per household only bring the mean full physical requirement close to capacity and still leave roughly half of months above capacity.

Economically viable production need is less extreme: it averages below one slot per household, but exceeds one-slot capacity in ~28% of observations. Thus demographic realism can materially constrain the economy even after excluding clearly unprofitable production plans.

## Next gate

Proceed to **R4-AT — Transfer-Neutral Labor-Eligibility Causal Counterfactual**. This will not calibrate ages. It will causally exclude a deterministic subset of household-agents from job search while leaving current transfer mechanics unchanged, so that the effect of reduced labor eligibility can be separated from an immediate fiscal-support redesign.

No canonical demographic architecture is authorized yet.