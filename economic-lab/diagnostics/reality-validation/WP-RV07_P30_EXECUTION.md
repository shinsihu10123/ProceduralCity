# WP-RV07-P30 — Sector Optimistic Variable-Cost Feasibility Audit

## Purpose

Test whether the unit-basis candidate still embeds sector prices that cannot cover labor plus required input cost even under an optimistic full-capacity assumption.

## Exact diagnostic construction

For every active firm/month after canonical `planProduction`:

- payroll due = `wage * workers`;
- labor cost per capacity unit = `payroll due / capacity`;
- upstream input reference price = mean current active supplier price for the required product;
- required input cash cost per output = `inputPerOutput * upstream price`;
- optimistic variable-cost floor = labor cost per capacity unit + required input cash cost;
- optimistic price coverage = own price / optimistic variable-cost floor.

This is deliberately optimistic: it assumes full use of measured capacity and excludes taxes, finance cost, depreciation, fixed cost, unsold output and working-capital cost. Therefore a coverage ratio below 1 is a strong structural warning, not a calibrated profitability estimate.

A second ex-post proxy uses actual physical output rather than capacity.

## Questions

- Which sectors are below break-even even under the optimistic capacity basis?
- Does this occur from M1-3 before mass exits?
- Are RESOURCE/MATERIALS/CONSUMER structurally loss-making while CAPITAL differs?
- Can this explain the objective cash deficit that later feeds cash-stress cognition and labor contraction?

## Hard gates

Exact observer non-interference, health, plan/production snapshot matching, ledger integrity, GDP identity and finite cost rows.

## Boundary

Read-only diagnosis. No price change, no parameter tuning, no repair authorization, no empirical-realism claim.