# WP-RV08 R4-AF / R4-AG — Labor Target Formation, Matching and Transition-Speed Closure

Date: 2026-08-22  
Status: **PASS — TARGET FORMATION DOMINATES THE WORKFORCE DEFICIT; DISTRESS CLOCK IS DYNAMICALLY INCOMPATIBLE WITH THE PHYSICAL STAFFING GAP**  
Run: `32537717312`  
Executed source: `83df7965247a1b23498bb7f2987a2f0ed0788c66`  
Scope: canonical + diagnostic restructure; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER normalization; 18 months

## 1. Question

R4-AD established that plan-economically viable CONSUMER firms usually operate with only a small fraction of the workforce implied by the unconstrained demand/inventory production plan. R4-AF/AG asks two narrower questions:

1. Is that workforce deficit created by canonical target formation or by labor-market matching after a sufficient target has already been formed?
2. Even if a firm could increase staffing at the canonical maximum +12% per month, is that transition fast enough relative to the four-month distress/exit clock?

No canonical wage, hiring, matching, payroll, price, tax, credit or exit parameter is repaired in this audit.

## 2. Execution gate

The workflow completed successfully: **12/12 economic shards SUCCESS and final beacon SUCCESS**. All shards produced artifacts and passed health, complete coverage, productive-normalization activation, exact canonical target-formula verification, ledger integrity, general-accounting integrity, GDP arithmetic, target-row coverage, CONSUMER plan-viable coverage and finite-result gates.

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AF_AG_LABOR_TARGET_TRANSITION_COMPACT_2026-08-22.csv`

## 3. R4-AF — target formation versus matching

Across all 12 cases, for plan-economically viable CONSUMER observations:

- mean canonical target / physical workforce need: **19.5–31.3%**;
- mean actual workers / canonical target: **99.88–100.00%**;
- weighted share of total workforce deficit created before matching, at target formation: **99.85–99.99%**;
- weighted matching-deficit share: only **0.005–0.147%**;
- target-formation-dominant classification: **96.1–99.5%**;
- matching-dominant classification: **0% in every shard**.

Therefore the labor market is generally filling the staffing target that it is given. The target itself is far below the workforce implied by the production need.

**H-AF1 — the majority of the CONSUMER workforce deficit is already present in `desiredWorkers` before labor-market matching: STRONGLY SUPPORTED.**

**H-AF2 — labor-market matching is the primary source of the workforce deficit after an adequate target is formed: FALSIFIED.**

This closes labor matching as the principal explanation for the current CONSUMER production-capacity gap.

## 4. R4-AG — staffing transition versus distress clock

For the same plan-viable CONSUMER observations:

- mean time to reach the physical workforce if employment could compound at the full +12% upper bound every month: **17.8–21.6 months**;
- median required time: **16–28 months**;
- p90 required time: **31–32 months**;
- share requiring more than 4 months: **81.4–93.5%**;
- share requiring more than 8 months: **61.6–81.7%**.

The canonical liquidity/credit distress architecture can trigger liquidation/restructuring after four distress months. Thus the staffing-adjustment horizon is much longer than the distress horizon for the overwhelming majority of viable CONSUMER observations.

A second result is equally important: **the AI hiring decision never hit the +12% upper bound in this 12-shard matrix.** Mean requested CONSUMER workforce growth was only about **0.86–1.87% per month**, while the average one-step gap to the physical workforce was roughly **+1,365% to +1,684% of prior employment**.

This means the defect has two layers:

1. the firm decision/target-formation system usually asks for only a very small staffing increase and does not use production need as its target anchor;
2. even a counterfactual continuous +12% ramp would normally require far longer than the four-month distress clock.

**H-AG1 — a large share of viable CONSUMER observations cannot close the physical staffing gap within four months even under continuous maximum upward adjustment: STRONGLY SUPPORTED.**

**H-AG2 — staffing transition is fast enough that the distress/exit timing is structurally irrelevant: FALSIFIED.**

## 5. Source-level consistency

Canonical `world.js` forms `desiredWorkers` immediately after the firm decision as a bounded percentage of the current workforce, then runs credit and the labor market, and only afterward calls `planProduction()`.

The current target formula is:

`desiredWorkers = round(max(1, workers) × (1 + clamp(hiringChange, -0.10, +0.12)))`

The production system then computes labor capacity from the resulting actual workforce and caps canonical `desiredProduction` by that capacity. Consequently, staffing demand is not solved from the unconstrained demand/inventory production requirement before labor allocation.

R4-AF/AG verifies the behavioral consequence of that ordering: the labor market faithfully fills a target that is itself structurally disconnected from the much larger production-implied labor requirement.

## 6. Causal integration

The strongest current downstream chain is now:

`demand / inventory signals imply a large unconstrained production need`
→ `firm hiring decision asks for only a small percentage change from current headcount`
→ `desiredWorkers remains ~20–31% of physical production need`
→ `labor market fulfills ~100% of that inadequate target`
→ `actual capacity remains far below the unconstrained production plan`
→ `output and realized contribution remain low`
→ `current payroll becomes under-covered`
→ `arrears / liquidity distress`
→ `restructuring or exit occurs on a clock much shorter than physical staffing catch-up`
→ `downstream demand and upstream absorption weaken further`.

This still does **not** authorize direct production-need hiring as a repair: R4-Y/Z already showed that setting labor directly to physical production need improves employment/output while exploding current-worker wage arrears. The remaining architecture problem is to connect production-informed staffing, financially supportable payroll, and a dynamically coherent transition/distress clock.

## 7. Verdict

**R4-AF: PASS — TARGET FORMATION, NOT LABOR-MARKET MATCHING, CREATES ESSENTIALLY ALL OF THE PLAN-VIABLE CONSUMER WORKFORCE DEFICIT.**

**R4-AG: PASS — THE FOUR-MONTH DISTRESS WINDOW IS FAR SHORTER THAN THE STAFFING CATCH-UP TIME IMPLIED BY THE CURRENT HEADCOUNT-ANCHORED TARGET ARCHITECTURE, EVEN AT THE +12% MAXIMUM RAMP.**

Next dependency-safe diagnostic: isolate the causal contribution of (a) the weak production-blind hiring signal and (b) the short distress clock using controlled staffing-ramp and distress-grace ablations, while continuing to reject any rule that merely trades unemployment for wage arrears.
