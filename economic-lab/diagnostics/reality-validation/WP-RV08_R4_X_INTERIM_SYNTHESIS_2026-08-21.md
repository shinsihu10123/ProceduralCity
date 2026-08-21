# WP-RV08 R4-X — Interim payroll-cohort synthesis

Date: 2026-08-21
Status: PARTIAL — enough evidence to narrow the next frontier; final closure waits for all six shards.

## Completed evidence used here

Run `32452192028`.

Completed and PASS at time of this synthesis:
- original A
- original C
- held-out E
- held-out F

Still running at the time the next dependency-safe batch was launched:
- original B
- held-out D

All completed shards passed deterministic/health/accounting/GDP arithmetic/finite-row workflow gates.

## A — VERIFIED EXISTING FACT

Post-restructure firms are not merely carrying legacy arrears. They are failing to cover the **current payroll obligation** from both actual payroll settlement and realized operating contribution for most of the six-month follow-up window.

### Original A — CONSUMER base

At restructure month (age 0):
- mean actual payroll coverage: `0.0716`
- mean realized operating-contribution coverage: `0.0452`
- share with realized contribution below payroll: `96.9%`
- share with actual payroll below required payroll: `96.0%`
- zero-output share: `69.6%`

At age 6:
- actual payroll coverage: `0.0943`
- realized coverage: `0.2481`
- realized-below-payroll share: `96.8%`
- paid-below-payroll share: `95.1%`
- zero-output share: `73.5%`

### Original A — MATERIALS+CONSUMER base

Age 0:
- paid coverage: `0.1208`
- realized coverage: `0.1088`
- realized-below-payroll share: `93.0%`
- paid-below-payroll share: `91.5%`
- zero-output share: `74.2%`

Age 6:
- paid coverage: `0.2400`
- realized coverage: `0.4226`
- realized-below-payroll share: `89.1%`
- paid-below-payroll share: `86.3%`
- zero-output share: `69.7%`

### Held-out E reproduction

CONSUMER age 0:
- paid coverage: `0.0517`
- realized coverage: `0.0286`
- realized-below-payroll share: `98.4%`
- paid-below-payroll share: `96.9%`
- zero-output share: `75.6%`

CONSUMER age 6:
- paid coverage: `0.0609`
- realized coverage: `0.1053`
- realized-below-payroll share: `98.4%`
- paid-below-payroll share: `96.8%`
- zero-output share: `79.6%`

MATERIALS+CONSUMER age 0:
- paid coverage: `0.0729`
- realized coverage: `0.0746`
- realized-below-payroll share: `95.2%`
- paid-below-payroll share: `95.0%`
- zero-output share: `78.7%`

MATERIALS+CONSUMER age 6:
- paid coverage: `0.1770`
- realized coverage: `0.3678`
- realized-below-payroll share: `92.7%`
- paid-below-payroll share: `89.8%`
- zero-output share: `76.1%`

## A — VERIFIED recurrence

Original A:
- CONSUMER: 421 restructure events across 114 unique firms; 105 recurrent firms; maximum 8 restructures; recurrent share `92.1%`.
- MATERIALS+CONSUMER: 414 events across 94 unique firms; 87 recurrent; maximum 8; recurrent share `92.6%`.

Held-out E:
- CONSUMER: 447 events / 121 firms / 111 recurrent / max 8 / recurrent share `91.7%`.
- MATERIALS+CONSUMER: 461 / 108 / 100 / max 8 / recurrent share `92.6%`.

The repeated-restructuring pathology is therefore not a single-seed anomaly.

## Source-level structural observation

Canonical world execution computes `desiredWorkers` directly from current workers multiplied by a bounded percentage `hiringChange`. Production planning is separate: it computes demand/inventory-based desired production and then caps it by labor-derived capacity. The two are not solved from a shared production/payroll feasibility constraint.

This source fact plus R4-X cohort evidence makes labor-demand / production / payroll coherence the next dependency-safe causal frontier.

## Causal verdict

B — DIAGNOSTIC LEAD STRENGTHENED:

`independent worker target -> payroll obligation materially above realized operating support -> current-worker arrears -> recurrent distress -> repeated restructuring / eventual exit`.

This is not yet a production-repair verdict. It justifies R4-Y/Z, which directly ablate the labor-target rule under canonical exit and restructuring exit while preserving credit origination, wage, tax, debt and settlement rules.
