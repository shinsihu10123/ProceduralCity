# WP-RV08 R4-AJ — Payroll-Before-Revenue Working-Capital Timing Audit Closure

Date: 2026-08-22  
Status: **PASS — SAME-MONTH REVENUE TIMING IS MATERIAL BUT NOT A COMPLETE ROOT; IT BECOMES DOMINANT AFTER EMPLOYMENT/SURVIVAL RELIEF IN SEVERAL SHARDS**  
Run: `32543665458`  
Executed source: `8201daf26b133b89a337aa93418aa2984466b674`  
Scope: canonical + diagnostic max-ramp/grace state; original A/C + held-out E; CONSUMER + MATERIALS+CONSUMER normalization; 18 months; 12/12 shards

## 1. Question

The canonical monthly ordering pays wages before the household goods market clears. R4-AJ asks whether current-worker payroll underpayment is therefore caused by a working-capital timing gap rather than by genuine operating insolvency.

For each plan-economically viable CONSUMER firm-month, the audit observes cash and payroll immediately before payroll, actual payroll settlement, and revenue/cash generated later in the same month. It classifies an underpaid row as:

- **timing candidate** if pre-payroll cash is insufficient for base payroll but pre-payroll cash plus later same-month revenue would have covered base payroll;
- **consumer timing candidate** if same-month consumer revenue alone would have closed that base-payroll gap;
- **operating gap after revenue** if even pre-payroll cash plus all later same-month revenue would still have been insufficient.

No payment order, credit rule, payroll rule, tax rule, price, wage, or canonical exit mechanism is changed by this audit.

## 2. Execution gate

All 12 economic shards and the final beacon completed successfully. Every shard passed health, ledger, general-accounting, GDP-arithmetic, normalization, plan-viable-row and finite-result gates.

Permanent compact evidence:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AJ_PAYROLL_REVENUE_TIMING_COMPACT_2026-08-22.csv`

## 3. Canonical state

Across the six canonical seed/base shards:

- plan-viable CONSUMER firm-month underpayment: **1.62–6.39%** of observations, mean **3.89%**;
- timing-candidate share of all viable observations: **0.39–3.10%**, mean **1.49%**;
- among actually underpaid observations, same-month later revenue would have closed base payroll in **11.5–60.0%**, mean **35.6%**;
- the remaining **40.0–88.5%**, mean **64.4%**, remain operating gaps even after all later same-month revenue is added.

The normalization split is informative:

- CONSUMER-only normalization: timing explains only **11.5–35.7%** of underpaid rows, mean about **21.0%**;
- MATERIALS+CONSUMER normalization: timing explains **44.2–60.0%**, mean about **50.1%**.

Therefore payroll-before-revenue timing is real in the canonical model, but it is not the dominant explanation for baseline CONSUMER payroll failure. A large majority of underpaid canonical CONSUMER rows remain economically underfunded after same-month revenue is included.

## 4. Ramp + grace state

When the previously diagnosed staffing/survival bottleneck is relaxed with max-ramp + 24-month diagnostic grace, the composition changes materially:

- average unemployment falls from about **33.35%** canonical to **8.86%**;
- output rises from about **1,356** to **1,825**;
- linked/current-worker arrears rise from about **112k** to **422k**;
- viable-row underpayment rises to **3.88–6.68%**, mean **5.68%**;
- among underpaid rows, timing candidates rise to **32.6–85.7%**, mean **65.9%**.

By normalization:

- CONSUMER-only: timing explains **32.6–68.0%**, mean about **53.7%**, of underpaid rows;
- MATERIALS+CONSUMER: timing explains **68.0–85.7%**, mean about **78.1%**.

This is a strong interaction result. Once firms are allowed to retain more labor and survive long enough to produce/sell more, the payroll-before-revenue sequence becomes a major source of current-worker underpayment. In the best-normalized ramp/grace state, it is the dominant underpayment classification.

## 5. Aggregate revenue versus firm-level timing

Several ramp/grace shards have aggregate post-payroll revenue far above the aggregate base-payroll cash gap. For example, the aggregate revenue-to-gap measure reaches roughly **11.8×** in original-A MATERIALS+CONSUMER. Yet firm-level underpayment still exists because revenue and payroll gaps are heterogeneous across firms and months.

Therefore aggregate liquidity is not sufficient evidence of firm-level payroll solvency; the timing mechanism must be tested as an explicit firm-level short-term finance/settlement institution.

## 6. Hypothesis verdicts

**H-AJ1 — payroll-before-revenue timing is the primary cause of canonical CONSUMER payroll failure: FALSIFIED AS A GLOBAL PRIMARY ROOT.**

**H-AJ2 — payroll-before-revenue timing is a material independent defect: SUPPORTED.**

**H-AJ3 — after labor/survival relief and upstream normalization, timing becomes the dominant current-underpayment mechanism: STRONGLY SUPPORTED IN THE TESTED RAMP/GRACE MATERIALS+CONSUMER SHARDS.**

**H-AJ4 — simply delaying exits is sufficient once firms can generate later-month revenue: FALSIFIED.** Arrears remain very large because the settlement order supplies no bridge between production/payroll and later goods-market cash realization.

## 7. Causal integration

The current CONSUMER frontier is now conditional rather than single-cause:

`production-informed labor need`
→ canonical labor target under-formation
→ production under-execution
→ weak revenue
→ payroll stress
→ fast distress/exit

and, after staffing/survival relief:

`more labor + more production`
→ larger payroll due before consumer market clearing
→ temporary firm-level cash gap
→ current-worker underpayment
→ later same-month revenue arrives too late
→ arrears accumulate despite economically meaningful sales capacity.

Thus working-capital timing is a **complementary structural defect that becomes more important as earlier bottlenecks are relieved**, not a replacement for the upstream unit-economics and production/labor coherence diagnoses.

## 8. Next dependency-safe diagnostic

R4-AK should test an explicitly bounded, accounting-preserving, diagnostic-only short-term payroll bridge. It must distinguish:

1. a full base-payroll-gap bridge as a causal upper bound;
2. a prior-sales-backed bridge using only information available before payroll;
3. a finished-inventory-backed bridge using only current pre-payroll collateral/value information.

Bridge principal must be booked as bank credit, tracked separately, and swept/repaid from same-month end-of-period cash where possible. The key outcome is not only unemployment/output, but **same-month repayment, remaining bridge debt, current-worker arrears and bank/borrower accounting integrity**.

No canonical bridge or payment-order repair is authorized by R4-AJ alone.

## 9. Final verdict

**PASS — PAYROLL-BEFORE-REVENUE TIMING IS A VERIFIED WORKING-CAPITAL DEFECT. IT EXPLAINS A MINORITY OF BASELINE CANONICAL UNDERPAYMENT, BUT BECOMES THE MAJORITY MECHANISM AFTER STAFFING/SURVIVAL RELIEF, ESPECIALLY WITH MATERIALS+CONSUMER NORMALIZATION. A BOOKED SHORT-TERM BRIDGE ABLATION IS NOW WARRANTED.**
