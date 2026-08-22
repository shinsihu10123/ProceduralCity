# WP-RV08 R4-AO — Payroll Flow / Legacy Arrears Stock / Claim-Provenance Decomposition

Date: 2026-08-22
Mode: diagnostic-only, non-canonical
Dependency: R4-AL/AM closure + R4-AN complete CONSUMER evidence and 7/8 interim cross-base evidence

## Research question

R4-AN shows that recent-revenue staffing rules do not yet produce an obvious Pareto repair when evaluated using the outstanding `household.wageArrears` stock. R4-AO tests whether that stock masks a different current-period payroll flow.

It also audits a newly identified accounting-semantic risk in canonical payroll settlement: `household.wageArrears` is a scalar carried by the worker, while `settlePayroll()` asks the worker's **current** employer to pay current wage plus up to 50% of one wage of prior arrears. If a worker changes employers while carrying arrears, the current employer can therefore fund a claim that originated at another firm.

R4-AO does not alter this behavior. It observes and reconstructs its claim provenance.

## Verified source basis

Canonical settlement currently computes:

`due = current wage + min(prior household wageArrears, 0.5 × current wage)`

then updates:

`household.wageArrears = max(0, prior arrears + current wage - paid)`.

The settlement entry carries the current `firmId` and `householdId`. General accounting separately accrues household wage receivable and firm wages payable for the current employer/current month.

This means prior arrears have no employer-of-origin field in the runtime household scalar even though the accounting journals are employer-specific.

## Experiment

For each R4-AN regime, R4-AO records every canonical wage transfer and decomposes it into:

- current wage due;
- current wage paid;
- newly created current-wage shortfall;
- prior arrears offered for catch-up service;
- legacy arrears actually repaid;
- conservative lower-bound cross-employer legacy repayment;
- total arrears stock after settlement.

A diagnostic employer-of-origin claim ledger is maintained only in observer memory. It uses same-employer-first legacy repayment, deliberately minimizing the amount classified as cross-employer. Therefore any measured cross-employer legacy payment is a lower bound, not an aggressive attribution.

## Hard invariants

1. Observer/non-observer economic fingerprints must be identical over the check horizon.
2. Ledger verification must pass.
3. General accounting verification must pass.
4. GDP identity arithmetic must pass.
5. Aggregate wage-arrears stock must reconcile each month:

`Δ arrears stock = current-period wage shortfall − legacy arrears repaid`.

6. The reconstructed provenance-claim total must reconcile to the household arrears stock.
7. No wage, staffing, tax, credit, cash, settlement, write-off, exit, or canonical accounting rule is changed by the observer.

## Coverage

- seeds: original A, original C, held-out E, held-out F;
- bases: CONSUMER and MATERIALS+CONSUMER normalization;
- staffing states: `control`, `mean3-immediate`, `mean3-ramp`, `floor3-ramp`, `hysteresis-ramp`;
- horizon: 36 months;
- matrix: 8 independent seed/base shards × 5 regimes = 40 primary simulations, plus observer-noninterference check runs.

## Decision rules

### H-AO-1 — legacy stock masks improved current flow
Supported if a candidate regime materially improves current-wage coverage / reduces newly created wage shortfall while total arrears stock remains approximately flat because legacy claims amortize slowly.

### H-AO-2 — staffing envelope still fails current payroll
Supported if candidate regimes continue creating large current-period shortfalls even after legacy stock is separated.

### H-AO-3 — cross-employer arrears inheritance is material
Supported if a nontrivial share of legacy payroll service is conservatively attributable to claims that originated at other firms. This would identify a separate claim-provenance/settlement architecture defect rather than an ordinary working-capital problem.

## Non-authorization

R4-AO cannot authorize a production repair by itself. A positive cross-employer result would require a later causal ablation that preserves the old employer liability and worker receivable while preventing a new employer from servicing another firm's debt. No claim write-off is authorized here.