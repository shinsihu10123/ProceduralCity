# WP-RV07-P75 — Replacement Entrant Credit-Path & Regeneration Audit

## Objective

Run in parallel with P74 and determine why replacement entrants that restore firm count after exits fail to restore durable productive capacity and employment.

P48 established that canonical replacement entrants are born with zero workers, zero ledger cash, zero capital stock and zero finished-goods inventory; MATERIALS/CAPITAL replacements often hire but do not produce. P52 showed that physical input bootstrap restores the ability to produce but does not repair macro hysteresis. P49 showed that workers displaced by exits are reabsorbed only slowly.

P75 therefore audits the **existing canonical financing path** available to new entrants without changing it.

## Scenarios

1. P2 unit-basis control.
2. CONSUMER static productivity normalization.
3. MATERIALS + CONSUMER static productivity normalization.

The productivity interventions are the same algebraic diagnostic normalization used in P61-P74. They are not canonical changes.

## Exact observations

For every replacement entrant, record:

- birth month and industry;
- birth workers, desired workers, cash, capital and inventory;
- first and subsequent canonical credit-cycle observations;
- whether the entrant is mechanically eligible for a firm credit application under the existing `buildApplications` arithmetic before queue truncation;
- whether it survives the actual sorted/truncated application queue;
- whether a `bank_loan_origination` is actually booked for the entrant and the amount;
- decision-time cash, desired workers, payroll need and the existing working-capital target;
- the input-need term seen by the credit system at application time;
- same-month realized input spend, supply shortage, workers, output, revenue and ending cash;
- whether and when the entrant first hires, first produces, first earns revenue, receives credit, or re-exits.

## Critical pipeline test

Canonical order resets `supplyShortage = 0` in `supply.beginMonth()` before firm decision and credit origination. `BankSystem.buildApplications()` then computes `inputNeed` from the current `f.supplyShortage` even though current-month production planning and procurement have not yet occurred.

P75 must quantify whether replacement entrants therefore enter the credit decision with `inputNeed = 0` while later in the same month experiencing positive procurement need/shortage and nonproduction.

This is an observation-only pipeline audit. Do not infer that a larger loan is automatically the correct repair.

## Hard gates

- exact observer non-interference on a compact bounded run;
- exact deterministic replay for each scenario/scale;
- all runs healthy;
- complete scenario × scale × seed coverage;
- entrant births observed;
- application-capture path exercised;
- ledger verification;
- finite lifecycle rows.

## Decision rule

- If downstream entrants are usually application-eligible but omitted from the truncated queue, investigate credit prioritization/queueing.
- If they enter the queue but rarely receive approved credit, investigate bank underwriting/capital constraints specifically for entrants.
- If they receive credit but the application systematically excludes current-month input need and they later fail procurement/production, promote **credit-stage input-need blindness** to a structural entrant-regeneration candidate.
- If credit access is adequate and downstream entrants still fail, move to revenue/market-access or entrant production sequencing rather than financing.

## Authority

Canonical economic changes: 0. Parameter tuning: 0. Repair merge: NO. Held-out seeds: NO. Empirical realism claim: NO.
