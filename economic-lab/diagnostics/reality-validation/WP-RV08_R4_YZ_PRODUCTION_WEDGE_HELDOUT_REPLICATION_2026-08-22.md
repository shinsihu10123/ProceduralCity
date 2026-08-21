# WP-RV08 R4-Y/Z — Production–Payroll Wedge Held-out Replication

Date: 2026-08-22
Status: PASS — HELD-OUT REPLICATION OF THE PRODUCTION–PAYROLL WEDGE
Run: `32481366521`
Mode: R4-Z restructuring, 36 months
Base: CONSUMER

## 1. Question

Does the production-linked staffing result seen in original seeds A/B generalize to held-out seeds, or is the combination of low unemployment and severe payroll insolvency seed-specific?

## 2. Held-out E

### Control
- mean unemployment: `44.13%`
- terminal-6m unemployment: `74.66%`
- mean arrears: `233,526`
- terminal arrears: `442,329`
- linked/current-worker arrears: `124,308`
- GDP: `24,507`
- output: `758.5`
- exits: `163`
- restructures: `447`
- requested workers: `7.69`
- physical workers: `30.91`
- settlement-supportable: `3.98`
- realized-supportable: `3.24`

### Production-linked
- mean unemployment: `9.73%`
- terminal-6m unemployment: `15.81%`
- mean arrears: `602,122`
- terminal arrears: `1,474,220`
- linked/current-worker arrears: `503,142`
- GDP: `50,255`
- output: `1,027.7`
- exits: `40`
- restructures: `700`
- chosen workers: `32.22`
- settlement-supportable: `4.08`
- realized-supportable: `3.58`

Effect relative to control:
- unemployment: `-34.40 pp`
- terminal unemployment: `-58.85 pp`
- GDP: approximately `+105%`
- output: approximately `+35%`
- exits: `163 → 40`
- mean arrears: approximately `2.58×`
- terminal arrears: approximately `3.33×`
- linked/current-worker arrears: approximately `4.05×`
- restructures: `447 → 700`

## 3. Held-out F

### Control
- mean unemployment: `42.99%`
- terminal-6m unemployment: `71.11%`
- mean arrears: `234,011`
- terminal arrears: `453,392`
- linked/current-worker arrears: `128,078`
- GDP: `25,033`
- output: `753.3`
- exits: `172`
- restructures: `452`
- requested workers: `7.67`
- physical workers: `31.12`
- settlement-supportable: `3.94`
- realized-supportable: `3.15`

### Production-linked
- mean unemployment: `9.56%`
- terminal-6m unemployment: `16.14%`
- mean arrears: `620,498`
- terminal arrears: `1,516,833`
- linked/current-worker arrears: `522,650`
- GDP: `50,879`
- output: `946.1`
- exits: `50`
- restructures: `710`
- chosen workers: `31.84`
- settlement-supportable: `3.90`
- realized-supportable: `3.22`

Effect relative to control:
- unemployment: `-33.43 pp`
- terminal unemployment: `-54.96 pp`
- GDP: approximately `+103%`
- output: approximately `+25.6%`
- exits: `172 → 50`
- mean arrears: approximately `2.65×`
- terminal arrears: approximately `3.35×`
- linked/current-worker arrears: approximately `4.08×`
- restructures: `452 → 710`

## 4. Cross-seed interpretation

Original A, original B, held-out E and held-out F now reproduce the same qualitative result:

`production-linked staffing`
→ much higher employment
→ higher output and GDP
→ fewer exits
→ but very large current-worker wage arrears
→ more repeated restructuring.

This is no longer a seed-local signal.

The numerical gap is also stable. In the held-out controls, physical production requirements are around `31 workers` while realized/settlement support remains around only `3–4 workers`. Production-linked staffing raises chosen labor to roughly the physical requirement without creating a corresponding revenue/payroll support channel.

## 5. Verdict

### A — VERIFIED EXISTING FACT

The model contains a reproducible production–revenue–payroll wedge across original and held-out seeds.

### D — PRODUCTION-LINKED STAFFING AS STANDALONE REPAIR

**REJECTED.**

It repairs physical under-employment and throughput but finances the improvement through unpaid labor obligations.

### Current repair frontier

A viable labor architecture must reconcile both constraints simultaneously:

1. enough labor to execute feasible physical production plans;
2. a bounded payroll / operating-finance transition that does not create current-worker arrears or immediately force mass unemployment.

No canonical repair is authorized by this document.
