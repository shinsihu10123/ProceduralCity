# WP-RV08 R4-O/P/Q — Restructure vs Liquidate Execution

Date: 2026-08-21
Status: **EXECUTION OPEN**
Frozen implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Canonical mechanism changes authorized: **0**
Parameter fitting authorized: **0**

## Admission basis

R4-L/M/N closed the accounting-tax branch:

- zero-output labor capitalization is a severe book/NIA representation defect;
- correcting it does not repair employment, operating cash generation or exits;
- the proposed same-month corporate-tax liquidity root is falsified;
- estate recycling remains materially helpful but insufficient;
- objective operating deficits and payroll arrears remain the controlling pre-exit state.

The next diagnostic question is therefore whether the current binary `active -> exited` transition destroys recoverable productive organizations that could instead downsize to an objectively supportable workforce, while genuinely nonrecoverable firms are liquidated and their physical productive stock is recycled.

## Non-canonical state-machine intervention

At the canonical exit boundary (`distressMonths >= 4`), the diagnostic computes support using only existing model quantities.

For a firm with positive workers and wage:

- realized contribution = `max(0, revenue - inputSpend)`;
- recent-demand contribution = positive current unit margin × previous-month realized sales;
- capacity contribution = positive current unit margin × current production capacity;
- cash-stock support = settlement cash + finished physical inventory × current price.

No external coefficient is fitted.

### Restructure action

If severe credit stress is absent and the selected support rule can finance at least one current worker, the diagnostic:

1. downsizes current employment to the integer supportable-worker count, capped at the current workforce;
2. preserves all existing wage arrears, loans and book liabilities;
3. creates no cash and forgives no debt;
4. resets only the distress-state counter as an explicit non-canonical restructuring transition;
5. leaves prices, wages, production technology, tax rates and bank thresholds unchanged.

### Liquidate action

If no worker is supportable, or severe credit stress is present, the firm is liquidated under the existing binary exit semantics. Estate-enabled variants additionally recycle physical capital, finished inventory and physical input inventories to the same-industry replacement entrant. Physical transfer conservation is hard-gated. Book claims are not erased or transferred by this diagnostic.

## R4-O — Core restructure × estate factorial

24 months, compact + baseline, three diagnostic seeds.

Per production-base axis:

1. control;
2. estate recycling only;
3. operating-potential restructuring only;
4. operating-potential restructuring + estate recycling for nonrecoverable firms.

Primary questions:

- does restructuring preserve employment/production while reducing binary exits?
- does it avoid the wage-arrears explosion of blanket no-exit?
- is estate disposition still complementary once recoverable firms are not liquidated?

## R4-P — Recoverability-rule sensitivity

24 months, compact + baseline, three diagnostic seeds.

Per production-base axis:

1. control;
2. realized-contribution restructuring + estate;
3. operating-potential restructuring + estate, using the max of realized/recent/capacity contribution;
4. multi-resource restructuring + estate, additionally admitting cash plus finished physical stock as temporary support.

This track tests whether the result depends on an excessively permissive recoverability definition.

## R4-Q — Restructure/estate × supply, longer horizon

36 months, compact + baseline, three diagnostic seeds.

Per production-base axis:

1. canonical control;
2. topological same-month + full-cash procurement upper bound;
3. operating-potential restructuring + estate under canonical supply;
4. operating-potential restructuring + estate + topological/full-cash supply.

This directly retests the non-additive R4-J supply interaction after replacing the looser exit guard with an explicit downsizing/liquidation state transition.

## Hard gates

Every job must pass:

- exact observer non-interference for control;
- deterministic replay;
- simulation health;
- complete scale × seed × horizon coverage;
- unit/productive normalization activation;
- restructuring/liquidation intervention activation where applicable;
- estate-transfer activation where applicable;
- supply-intervention activation where applicable;
- physical estate conservation;
- settlement-ledger verification;
- general-accounting verification;
- GDP arithmetic identity;
- finite macro evidence.

Economic sufficiency is **not** a workflow-success gate. A successful job may still conclude FAIL-CONTINUE if unemployment, arrears or collapse persists.

## Claim boundaries

This batch is diagnostic only.

- No production repair is merged.
- No empirical target is fitted.
- No debt or wage claim is forgiven.
- No external money or credit is injected.
- No accounting/NIA repair is admitted by this batch.
- Held-out validation remains reserved.
