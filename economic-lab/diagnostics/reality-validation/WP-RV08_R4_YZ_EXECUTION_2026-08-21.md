# WP-RV08 R4-Y/Z — Labor-demand / production / payroll coherence execution

Date: 2026-08-21
Mode: ACTUAL EXECUTION / DIAGNOSTIC ONLY

## Causal basis

R4-X shows that post-restructure firms remain active while actual payroll coverage and realized operating contribution remain far below required payroll for most of the following six months. The effect reproduces on original and held-out seeds. Source inspection also shows that canonical `desiredWorkers` is updated from the current worker count and a bounded percentage `hiringChange`, while production planning independently derives desired production from previous sales, beliefs and target inventory. Therefore labor demand and the output plan are not solved from one coherent constraint system.

## Claim under test

B — DIAGNOSTIC LEAD:

`worker target independent of physical production requirement and realized payroll capacity -> excessive retained/requested labor relative to realized throughput -> current-worker arrears -> liquidity distress -> repeated restructuring / exit propagation`.

R4-Y/Z do not assume the claim is true. They test four explicit alternative ceilings/targets against canonical control.

## Variants

1. `control`
   - canonical requested workers.
2. `production`
   - derive worker requirement from the same unconstrained demand/inventory production target used by the supply system divided by one-worker physical capacity.
3. `settlement`
   - canonical requested workers capped by the number of current wages that the firm actually settled in the prior month.
4. `realized`
   - canonical requested workers capped by prior realized operating contribution `(revenue - input spend) / wage`.
5. `hybrid`
   - minimum of production-linked labor requirement and realized-contribution affordability.

No wage, tax, credit, debt, arrears, cash or price parameter is tuned to obtain a target result.

## Isolation rule

The staffing intervention is applied **after canonical credit origination** and immediately before the labor market. This keeps the existing credit decision path from being mechanically altered by the experiment and isolates the labor-target channel as far as the current execution architecture permits.

## R4-Y — canonical exit

- horizon: 24 months
- scale: baseline
- original seeds: ECON-RV02-A/B/C
- held-out seeds: ECON-RV08-HOLDOUT-D/E/F
- exit mechanism: canonical
- bases: CONSUMER normalization and MATERIALS+CONSUMER normalization

Purpose: determine whether labor/output/payroll coherence materially changes arrears, unemployment, output and exits before adding restructuring.

## R4-Z — restructuring exit

- horizon: 36 months
- scale: baseline
- same six original + held-out seeds
- exit mechanism: diagnostic operating-potential restructuring state machine used in prior R4 work
- same two normalization bases

Purpose: test whether a coherent worker target removes the repeated-restructuring / current-worker-arrears pathology identified by R4-X.

## Required evidence

Per variant:

- full-window and terminal unemployment
- full-window and terminal wage arrears
- linked/current-worker arrears
- exits
- restructuring count where applicable
- GDP
- nominal sales
- physical output
- active firms
- canonical requested workers
- production-linked workers
- prior-settlement-supported workers
- prior-realized-contribution-supported workers
- chosen workers
- share of canonical requests above physical requirement
- share of canonical requests above realized support

## Hard workflow gates

- deterministic replay exact for control
- health PASS
- complete base × variant × seed coverage
- productive normalization activation
- ledger verification
- general accounting verification
- GDP arithmetic identity
- staffing instrumentation present
- finite outputs

Economic sufficiency is not a workflow hard gate.

## Verdict policy

PASS means the diagnostic executed correctly. It does not authorize canonical merge.

Production repair remains blocked until a candidate simultaneously improves employment/survival and suppresses arrears without hidden transfers, accounting breaks, money creation, debt forgiveness, or empirical parameter fitting.
