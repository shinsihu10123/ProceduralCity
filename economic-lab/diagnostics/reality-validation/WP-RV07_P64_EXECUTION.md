# WP-RV07-P64 — Sector Employment Stock-Flow & Reallocation Audit

## Objective

Explain the P62/P63 employment non-monotonicity by exact sector labor-flow accounting under the supported productivity variants.

## Variants

- CONSUMER productivity normalization
- RESOURCE + CONSUMER
- MATERIALS + CONSUMER
- RESOURCE + MATERIALS + CONSUMER

All use the existing P2 unit-basis diagnostic transform and the same algebraically-derived static productivity normalization used by P61-P63.

## Measurements

For every country-month and sector:

- beginning employment
- gross market hires
- gross market layoffs
- employment immediately after labor clearing
- exit-boundary displacement
- ending employment
- beginning/ending active firms
- aggregate unfilled vacancies, firm entries/exits and unemployment

Gross transitions are reconstructed from household employer identities before and immediately after labor clearing, including same-month employer changes.

## Hard gates

- deterministic replay exact
- all runs healthy
- complete country and sector coverage
- intervention activated
- exact aggregate and sector employment stock-flow identities
- reconstructed gross hires/layoffs equal canonical labor-market results
- ledger country verification
- GDP identity reconciliation
- finite rows

## Authority

Read-only diagnosis apart from the already-defined diagnostic productivity interventions. Canonical mechanism changes: 0. Parameter fitting: 0. Repair merge: NO. Empirical realism claim: NO.