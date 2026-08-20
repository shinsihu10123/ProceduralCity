# WP-RV07 — Cross-WP Causal Synthesis & Repair Admission Closure

Date: 2026-08-20

## Final verdict

**PASS — ROOT-CAUSE SEARCH SUFFICIENTLY CLOSED; REPAIR ARCHITECTURE ADMITTED**

This document closes the generic WP-RV07 root-cause search. Further diagnosis is permitted only when a repair candidate exposes a new blocking mechanism or a hard invariant fails.

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

## 1. Causal hierarchy

### ROOT / EARLY STRUCTURAL CAUSES

1. **Non-capital nominal/physical unit infeasibility**
   - Canonical wage obligations and physical output/value units are not mutually coherent in key sectors.
   - P1/P2/P30/P60/P61 establish that RESOURCE/MATERIALS and, through a different channel, CONSUMER operate under structurally distorted unit economics.
   - The P2 price-wage basis ablation and later capacity/productivity decompositions materially change collapse dynamics without fitted unemployment targets.

2. **Production-capacity / labor scale mismatch**
   - P10/P22 show that late production is overwhelmingly capacity-bound while unconstrained desired production remains high.
   - The economy is not primarily choosing low output because demand disappears; productive capacity contracts.

3. **Working-capital stage incoherence**
   - Procurement uses only `42%` of current cash and current-month upstream production is not naturally available to downstream buyers under canonical sequencing.
   - These are verified contributors, but P7/P8/P72 show that removing them does not by itself eliminate high unemployment.

### PROPAGATION MECHANISMS

4. **Cash-stress-driven labor contraction**
   - P24/P25/P51/P53 show that firms respond to objective operating deficits by defensive/cash-preservation labor cuts.
   - This behavior amplifies the physical problem but does not create the initial operating infeasibility from nothing.
   - Blanket labor retention is rejected because it creates arrears and can worsen late output.

5. **Exit amplification**
   - P4 identifies liquidity/payroll distress as the dominant exit path.
   - P23/P43/P47/P73/P74 show that exit suppression has a very large late unemployment effect, but P74 shows that most exit candidates are not healthy firms being removed too early.
   - Exit is therefore a major amplifier, not the initial root.

### PERSISTENCE / REGENERATION FAILURE

6. **Zero-resource replacement entry**
   - P48 establishes that entrants are born with zero workers, zero cash, zero capital stock and zero finished inventory.
   - Downstream entrants frequently hire but cannot produce or earn revenue.

7. **Missing current input-financing signal at credit time**
   - `beginMonth()` resets `supplyShortage=0`; credit origination occurs before labor, production planning and procurement.
   - Bank working-capital applications use current `supplyShortage` to form `inputNeed`.
   - P75 confirms downstream entrant input need is zero at the credit boundary and becomes positive later in the same month.

8. **Entrant underwriting / bank-capital blockade**
   - P75: replacement entrants reach the application queue but receive zero credit.
   - P76: observed entrant applications are rejected by overlapping bank-capital, affordability and risk constraints. Risk acceptability is zero in the observed baseline entrant decisions, while counterfactual bank-cognition rejection is not the blocker.

9. **Post-exit unemployment hysteresis**
   - P49 shows large fractions of exit-displaced workers remain unemployed for multiple months.
   - Weak entrant regeneration prevents productive capacity and labor demand from replacing exited firms.

### SEPARATE ACCOUNTING / MEASUREMENT DEFECTS

10. **GDP/NIA inventory semantics**
    - P5 verifies the arithmetic identity but finds inventory investment dominates measured GDP and can be inflated by payroll capitalization despite zero physical output.
    - Inactive firms can retain large inventory-book values after physical productive capacity has disappeared.
    - This is a separate accounting repair requirement and must not be used as the primary physical-economy health signal until repaired.

## 2. Major hypotheses rejected or downgraded

The following are not supported as primary roots:

- labor-market matching/search friction;
- pure debt-service burden;
- pure bank-capital shock as the initial trigger;
- defaults as the initial trigger;
- procurement `42%` cash reservation alone;
- same-month supply sequencing alone;
- stockout-censored `previousSales` feedback as the dominant residual cause;
- generic supplier-search / round-cap failure;
- firm AI counterfactual planner as the primary physical root;
- healthy-firm premature exit as the main exit defect;
- physical entrant input bootstrap alone as a complete macro repair;
- simple price-floor repair alone;
- blanket no-layoff or no-exit rules as production-ready repairs.

## 3. Selected repair architecture

Repair work is admitted as a **coherent package of separately testable structural changes**, not a fitted macro target.

### RA-1 — Unit-system coherence

Replace the current mixed nominal/physical basis with an explicit sector unit contract linking:

- physical output per worker;
- intermediate input per output;
- product price;
- wage obligation;
- inventory valuation.

The implementation must not use a dynamic `break-even` rule as a permanent economic law. Break-even normalizations used in RV07 were causal diagnostics only.

### RA-2 — Finance after current production-plan formation

Working-capital need must be based on a current production/input plan rather than a `supplyShortage` field reset to zero before credit.

Candidate stage architecture:

`firm decision -> labor market -> production plan -> working-capital credit -> procurement -> production -> payroll -> goods`.

This is a structural timing candidate, not yet canonical.

### RA-3 — Accounting-conserving entrant regeneration

Replacement entry must not be an uncapitalized zero-resource shell. A startup contract must explicitly represent the source and destination of startup funds/assets and preserve bank/ledger/accounting identities.

Do not solve this by silently granting cash or lowering risk thresholds until approval occurs.

### RA-4 — Bounded labor/exit response

Labor and exit logic should respond to objective financial feasibility, but must avoid both:

- recursive defensive collapse from structurally invalid unit economics; and
- blanket retention of insolvent payroll obligations.

P74's support-floor experiment is diagnostic evidence, not a final rule.

### RA-5 — GDP/NIA and inventory-book repair

Physical output, finished inventory additions, work-in-progress and payroll/labor costs must be represented consistently with an explicit production-accounting basis. Inactive inventory books must not create fictitious continuing productive output.

## 4. Repair sequencing

1. **RV08-R0** — freeze external accounting/finance evidence and explicit repair invariants.
2. **RV08-R1** — implement current-plan working-capital timing in an experimental candidate with no fitted coefficients.
3. **RV08-R2** — implement accounting-conserving entrant capitalization / financing contract.
4. **RV08-R3** — implement explicit sector unit contract and migrate physical/nominal initialization.
5. **RV08-R4** — integrate selected structural pieces; run compact/baseline regression.
6. **RV08-R5** — held-out seeds and 120–240 month validation.
7. **RV08-R6** — GDP/NIA accounting repair and independent production/income/expenditure reconciliation.
8. Only after structural closure: empirical calibration against authoritative external evidence.

## 5. Admission rules

- No coefficient may be selected because it produces a desired unemployment, GDP or exit path.
- Every repair candidate must preserve settlement and accounting invariants or explicitly fail.
- Diagnostic upper bounds remain noncanonical until replaced by economically and accounting coherent mechanisms.
- Existing A/B/C seeds remain development/diagnostic seeds; held-out seeds are reserved for candidate validation.
- External evidence must precede empirical realism claims.

## Final control state

Canonical economic mechanism changes during WP-RV07 diagnosis: **0**.  
Fitted parameter tuning: **0**.  
Repair merge: **0**.  
Generic root-cause search: **CLOSED**.  
Repair architecture admission: **APPROVED FOR RV08 EXPERIMENTAL IMPLEMENTATION**.
