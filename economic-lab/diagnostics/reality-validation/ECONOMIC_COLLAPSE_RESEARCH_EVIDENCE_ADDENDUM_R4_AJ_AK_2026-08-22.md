# Economic Collapse Research Evidence Addendum — R4-AJ / R4-AK

Date: 2026-08-22

## R4-AJ — verified working-capital timing defect

Run `32543665458` completed 12/12 economic shards plus final beacon successfully.

R4-AJ directly observed plan-viable CONSUMER firm-month cash before payroll and later same-month revenue. The canonical state shows that only a minority of payroll underpayment is purely a timing problem overall: among underpaid observations, later same-month revenue would have closed base payroll in 11.5–60.0% across shards, mean 35.6%. The remaining mean 64.4% is still underfunded after later revenue is included.

The composition changes after earlier bottlenecks are relaxed. Under max-ramp + diagnostic 24-month grace, timing explains 32.6–85.7% of underpaid observations, mean 65.9%; under MATERIALS+CONSUMER normalization the mean is about 78.1%.

Research interpretation: payroll-before-revenue timing is not the global baseline root, but it becomes a dominant complementary defect when employment, survival, and upstream productive feasibility are improved.

Permanent evidence:
- `WP-RV08_R4_AJ_CLOSURE_2026-08-22.md`
- `evidence/WP-RV08_R4_AJ_PAYROLL_REVENUE_TIMING_COMPACT_2026-08-22.csv`

## R4-AK — accounting-preserving bridge sufficiency test CLOSED

Run `32544064114` completed **6/6 economic shards plus final beacon successfully**, covering 48 primary simulations. Executed source SHA: `c733f9ec14120e9fd31a4a8f1182961ef3d5515d`.

R4-AK tested four regimes in both canonical and ramp-grace states: control, exact base-payroll-gap bridge, prior-sales-backed bridge, and finished-inventory-backed bridge. Non-control draws were real booked bank loans; same-month repayment was capped by actual consumer revenue and available post-tax cash; residual principal remained exposed to normal debt service and default.

### Canonical state

No bridge repairs the collapsed economy.

- exact gap bridge: unemployment worsens by about 0.57 pp, total wage arrears fall only 0.58%, same-month repayment averages 14.47%, and 42.72% of originated principal remains outstanding at the horizon with about 9.17 defaults per seed/base cell;
- inventory-backed bridge: same-month repayment is very clean (96.09%; outstanding/originated 0.34%) but total arrears and unemployment worsen slightly;
- sales-backed bridge: repayment is cleaner than the exact gap bridge, but total arrears, unemployment, GDP, and output show no sufficient repair.

### Ramp-grace state

Bridge relevance increases after labor/survival constraints are relaxed, but the effect remains small and seed-sensitive.

- exact gap bridge: mean total arrears -2.32%, linked/current-worker arrears -2.50%, unemployment -0.14 pp; however same-month repayment is only 57.17%, residual outstanding/originated is 19.33%, and defaults average 5.67;
- inventory-backed: total arrears -1.32%, linked arrears -1.44%, with clean repayment but negligible macro effect;
- sales-backed: total arrears -1.49%, linked arrears -1.57%, same-month repayment 92.57%, residual outstanding/originated 4.41%, but negligible macro effect.

No bridge reduces arrears robustly across every seed/base combination. Several cells worsen even under the financially cleaner backed variants.

### R4-AK verdict

**PASS — causal narrowing / FAIL-CONTINUE — repair sufficiency.**

Verified interpretation:

`production/labor coherence defect`
→ `persistent or recurrent payroll shortfall`
→ `intramonth timing worsens a subset`
→ `short-term credit can finance some timing gaps`
→ `broad bridge rules either have little effect or shift the shortfall into debt/default`

Thus “short-term credit alone closes the payroll wedge” is falsified. The next question is firm-level persistence/recoverability, not credit-volume tuning.

Permanent evidence:
- `WP-RV08_R4_AK_CLOSURE_2026-08-22.md`
- `WP-RV08_R4_AK_WORKING_CAPITAL_BRIDGE_COMPACT_2026-08-22.csv`

## Next frontier — R4-AL / R4-AM

R4-AL follows actual underpaid CONSUMER firm-month cohorts through age 0–6 to distinguish transitory self-liquidating gaps from recurrent bridge dependence and cumulative operating deficits.

R4-AM observes, without applying, a rolling three-month realized-contribution-supported staffing envelope and asks whether a financially supportable interior zone exists between current employment and physical production need.

Both audits preserve the existing diagnostic separation. No canonical repair has been authorized or merged from R4-AJ/R4-AK.
