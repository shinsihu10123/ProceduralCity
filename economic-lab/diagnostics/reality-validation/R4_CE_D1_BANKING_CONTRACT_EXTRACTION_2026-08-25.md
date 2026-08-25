# R4-CE-D1 Banking / Underwriting Contract Extraction

Status: **COMPLETE / D2 IMPLEMENTATION AUTHORIZED**

Date: 2026-08-25

## 1. Canonical call path

The current monthly order in `world.js` calls debt service, fiscal begin-month, supply begin-month, firm decisions, then `banking.originateCredit(...)`, followed by labor clearing and production planning.

Inside `BankSystem.originateCredit` the canonical path is:

1. `buildApplications(country)`
2. for each selected application, read the bank balance sheet
3. `evaluateCreditApplication(...)`
4. if approved, apply `capByBankCapital(...)`
5. create deposit money through `ledger.adjustMoney`
6. construct a loan object
7. append it to `country.loans`
8. increase borrower loan balance
9. book origination through accounting

Therefore only steps 2–4 are admissible for a read-only underwriting envelope, and even step 3 currently has hidden mutations through RNG/cognition.

## 2. Firm application contract

Canonical firm applications derive from:

- current deposit cash
- payroll need = wage × desired workers
- supply shortage proxy
- safe cash
- current expansion decision
- existing loan balance
- wage arrears
- current revenue/income base
- term months drawn from RNG

The canonical requested amount is capped at `safeCash * 0.75`, and the application is emitted only when it exceeds `payrollNeed * 0.12`.

This is not a committed revolving-credit facility. The current model has no explicit undrawn committed credit line. Therefore R4-CE-D must report:

`existingUndrawnCommittedCredit = 0`

with source:

`NOT_MODELED_IN_CANONICAL_BANK_SYSTEM`

rather than fabricating a facility balance.

## 3. Credit decision contract

`evaluateCreditApplication` consumes:

- bank risk parameters;
- borrower kind/id;
- requested amount;
- borrower income base, cash, debt, arrears and term;
- bank balance-sheet assets/equity;
- macro signals;
- RNG state.

The legacy evaluator estimates default probability from borrower fragility, macro stress, borrower kind and stochastic model noise. It then checks capital safety, affordability and risk tolerance.

When bank cognition is enabled, the evaluator additionally uses learned beliefs, analogies, causal forecasts and counterfactual planning.

## 4. Hidden mutations that prohibit direct use on the canonical objects

Calling `evaluateCreditApplication` directly on canonical objects is **not read-only**.

It can mutate:

- RNG state through `rng.normal(...)` and counterfactual simulation;
- bank cognition pending forecasts through `registerForecast(...)`;
- bank decision/memory state through `recordDecision(...)`;
- potentially other cognition-owned collections reached through the cloned bank graph.

Therefore R4-CE-D2 must never call the evaluator with the live `world.rng` or live bank object.

## 5. Safe reproduction strategy

A faithful non-mutating reconstruction can be produced by:

1. `structuredClone(bank)` into an isolated bank snapshot;
2. instantiate `new RNG(world.rng.state)` to clone the current PRNG position;
3. `structuredClone(application)` and `structuredClone(signals)`;
4. call `evaluateCreditApplication` only on those clones;
5. calculate the bank-capital amount ceiling from the observed bank balance sheet without calling ledger/origination methods;
6. discard all mutated clones after extracting the decision/trace.

This preserves the canonical world while retaining the exact evaluator code and stochastic rule from the captured RNG state.

Important limitation: a single isolated counterfactual application reproduces the evaluator conditional on the captured RNG position. It does not claim to reproduce the full ordered application queue after all preceding applications have consumed RNG and cognition. R4-CE-D will label this `ISOLATED_SNAPSHOT_UNDERWRITING`, not `CANONICAL_QUEUE_REPLAY`.

## 6. Capital-cap formula

The canonical bank-capital ceiling is pure given bank state:

- `maxAssets = equity / minCapitalRatio`
- `capacity = max(0, maxAssets - assets)`
- `capitalCappedAmount = min(requestedAmount, capacity)`

R4-CE-D2 may reproduce this directly.

## 7. D2 acceptance gates

The pure evaluator must prove:

- live RNG state unchanged;
- live bank JSON digest unchanged;
- live country loan count unchanged;
- ledger entry count and digest unchanged;
- deposit balances unchanged;
- repeated evaluation from the same snapshot returns exactly identical output;
- decision trace includes approval/rejection reason and capital/affordability/risk fields;
- capital-capped admissible amount never exceeds requested amount.

## 8. Checkpoint

`R4-CE-D1-CLOSED / CANONICAL-UNDERWRITING-MUTATION-SURFACE-MAPPED / D2-PURE-SNAPSHOT-EVALUATOR-NEXT`
