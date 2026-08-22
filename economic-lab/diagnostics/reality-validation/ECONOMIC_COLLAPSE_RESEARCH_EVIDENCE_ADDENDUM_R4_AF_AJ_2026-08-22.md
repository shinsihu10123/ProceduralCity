# Economic Collapse Research Evidence Addendum — R4-AF through R4-AJ

Date: 2026-08-22

This addendum preserves the current causal frontier independently of expiring GitHub Actions artifacts.

## A. VERIFIED — R4-AF target formation dominates matching

R4-AF/AG run `32537717312` completed 12/12 diagnostic shards successfully.

For plan-economically viable CONSUMER firm-months:

- canonical `desiredWorkers` is only about 19.5–31.3% of the physical workforce implied by the demand/inventory production plan;
- actual labor-market employment fills approximately 99.88–100% of that already-low target;
- roughly 99.85–99.99% of the measured workforce deficit is present before labor-market matching.

Therefore generic search/matching friction is not the primary source of the CONSUMER production-labor gap.

## B. VERIFIED — R4-AG staffing transition clock is incompatible with distress clock

Even under hypothetical continuous +12% monthly workforce growth, the physical staffing gap typically requires far longer than the canonical four-month distress window to close.

The actual AI hiring signal is much weaker than the upper bound; the +12% cap itself is rarely the binding choice.

The structural issue is therefore not simply a low numerical cap. Canonical labor planning is weakly coupled to the physical production plan and cannot converge before liquidity/payroll distress propagates.

## C. VERIFIED — R4-AH maximum canonical ramp is only a modest complement

R4-AH/AI run `32543067618` completed all six shards, all 30 primary regimes, and final beacon successfully.

Relative to paired controls, `max-ramp`:

- lowers mean unemployment by only about 2.1–6.0 percentage points;
- improves GDP/output modestly;
- raises linked/current-worker arrears in every paired case;
- does not consistently reduce exits.

Thus forcing the labor target to use the full canonical +12% upward ramp is not a sufficient repair.

## D. VERIFIED — R4-AI distress/exit timing is a major propagation channel but grace is inadmissible

Extending the diagnostic distress threshold from 4 to 24 months across the 18-month horizon:

- reduces unemployment by about 16.0–23.3 percentage points;
- eliminates exits inside the test horizon;
- raises GDP/output substantially;
- but raises linked/current-worker wage arrears by roughly 249k–337k on average relative to paired controls, with terminal linked-arrears increases of roughly 502k–738k.

Therefore the four-month exit clock strongly accelerates collapse, but delaying liquidation without restoring payroll feasibility merely warehouses insolvency and unpaid labor claims.

## E. VERIFIED — preserved activity and payroll feasibility remain separable

The combined `max-ramp-grace` regime produces the best employment/output state in R4-AH/AI, but also the highest average linked/current-worker arrears.

This directly reinforces the causal frontier:

`labor/production preservation`
→ does not imply
`financially sustainable payroll`.

A valid repair must connect production demand, labor demand, realized revenue, working capital and wage settlement rather than optimizing any one margin independently.

## F. SOURCE-VERIFIED TIMING LEAD — payroll precedes household consumer revenue

Canonical source order in `economic-lab/src/core/world.js` is:

`labor -> production -> wage accrual -> payroll -> income taxes/transfers -> investment -> household consumption planning -> goods market -> consumption tax/government demand -> corporate tax -> exit evaluation`.

CONSUMER firms therefore pay wages before receiving the same month's household goods-market revenue.

This is a verified ordering fact but remains only a diagnostic lead until measured.

## G. ACTIVE FRONTIER — R4-AJ

R4-AJ asks whether current-payroll underpayment is materially a working-capital/settlement-timing gap.

For each plan-viable CONSUMER firm-month it records cash immediately before payroll, base payroll due, actual payroll paid, later same-month consumer revenue and other post-payroll revenue.

Primary distinction:

- `timing candidate`: payroll is underpaid at the canonical settlement point but cash plus later same-month revenue would have covered current base wages;
- `operating gap after revenue`: payroll remains unaffordable even after later same-month revenue is included.

R4-AJ is observational and does not reorder settlement, create bridge credit, change wages, alter taxes, or merge any canonical repair.

Workflow definition commit: `8201daf26b133b89a337aa93418aa2984466b674`.

## H. REPAIR GATE

No canonical repair is authorized yet.

A working-capital or settlement-order mechanism may be tested only if R4-AJ demonstrates that later same-month revenue covers a material share of the observed current-payroll gap. If most payroll remains unaffordable after including later revenue, the frontier stays with operating-margin/revenue sufficiency instead.
