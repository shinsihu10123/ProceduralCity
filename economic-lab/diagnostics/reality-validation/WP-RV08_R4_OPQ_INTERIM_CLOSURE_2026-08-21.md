# WP-RV08 R4-O/P/Q Interim Closure

Date: 2026-08-21
Status: **PARTIAL — R4-O/P PASS; R4-Q INCOMPLETE DUE TO WALL-CLOCK CANCELLATION**
Frozen economic implementation baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`
Executed source commit: `e63c0ccc3988adb1077d31f11709460de3252567`
Canonical mechanism changes: **0**
Parameter tuning: **0**
Empirical realism claim: **NO**

## Execution evidence

Workflow run: `32437453575`.

- R4-O job `96641431937`: **SUCCESS**; artifact `economic-lab-wp-rv08-r4-o`, ID `9431353062`, SHA-256 `bdbde969adfabd698b3c5327b792832a564ffb7e11c6df3ba34a29b0cbb30b6a`.
- R4-P job `96641431840`: **SUCCESS**; artifact `economic-lab-wp-rv08-r4-p`, ID `9431326082`, SHA-256 `17eb700d6ae98c39cda7ad477e9dd83d4e64df6222b0b5c3c80c053a04b83385`.
- R4-Q job `96641431947`: **CANCELLED** at approximately 30 minutes by workflow wall-clock limit. No economic verdict is drawn from this cancellation. The artifact contains only the partial log.

R4-O and R4-P passed observer non-interference, deterministic replay, health, coverage, normalization activation, restructure activation, estate activation where applicable, physical-estate conservation, ledger/accounting, GDP arithmetic and finite-value gates.

## R4-O — Restructure × estate

Baseline FULL, 24 months:

| Variant | Unemployment | Exits | Mean arrears | Mean firm cash | Consumer output | Sales | GDP |
|---|---:|---:|---:|---:|---:|---:|---:|
| consumer-control | 0.475321 | 666 | 108,454 | 105,170 | 92.44 | 22,736 | 25,098 |
| consumer-estate | 0.463048 | 539 | 106,322 | 114,852 | 107.67 | 25,597 | 26,770 |
| consumer-restructure | 0.323293 | 147 | 146,889 | 113,635 | 115.30 | 27,109 | 29,753 |
| consumer-restructure-estate | 0.328128 | 137 | 148,174 | 113,951 | 114.85 | 27,041 | 29,922 |
| materials-consumer-control | 0.439944 | 644 | 101,604 | 112,821 | 118.26 | 27,138 | 27,798 |
| materials-consumer-estate | 0.432027 | 499 | 97,086 | 127,449 | 143.98 | 31,552 | 29,897 |
| materials-consumer-restructure | 0.243566 | 56 | 145,193 | 126,263 | 174.10 | 36,923 | 34,071 |
| materials-consumer-restructure-estate | 0.245020 | 43 | 145,627 | 126,348 | 173.42 | 36,763 | 34,543 |

Terminal unemployment also improves strongly under restructuring, but remains high: consumer control `0.8806` versus restructure `0.6335`; materials-consumer control `0.8061` versus restructure `0.4137`.

### A — VERIFIED EXISTING FACT

1. A bounded restructure transition is a much stronger employment/survival intervention than estate recycling alone.
2. The effect is not merely preservation of legal shells: output, sales and active-firm counts also improve substantially.
3. Estate recycling by itself remains helpful, but adding estate recycling to restructuring provides only a small and inconsistent incremental unemployment benefit at 24 months.
4. The strong employment benefit is accompanied by a large arrears penalty. Mean arrears rise from roughly `108k -> 147k–148k` in the consumer base and `102k -> 145k–146k` in the materials-consumer base.

### Verdict

**PASS / FAIL-CONTINUE — RESTRUCTURE-VS-LIQUIDATE IS A MATERIAL CAUSAL ARCHITECTURE, BUT THE TESTED RULE IS NOT FINANCIALLY ADMISSIBLE BECAUSE THE EMPLOYMENT GAIN IS PURCHASED WITH LARGE PAYROLL-ARREARS ACCUMULATION.**

## R4-P — Recoverability rule sensitivity

Baseline FULL, 24 months:

- Consumer base: control unemployment `0.4753`; realized-only+estate `0.4600`; operating+estate `0.3281`; multi+estate `0.2551`.
- Materials-consumer base: control `0.4399`; realized-only+estate `0.4269`; operating+estate `0.2450`; multi+estate `0.2009`.
- The more permissive recoverability definitions sharply reduce exits and unemployment, but arrears rise monotonically toward the permissive rules. Consumer multi+estate mean arrears reach about `164,258`; materials-consumer multi+estate about `157,063`.

### A — VERIFIED EXISTING FACT

1. The result is highly sensitive to the recoverability definition.
2. Realized contribution alone is conservative and produces only modest employment gains.
3. Forward-looking operating-capacity support produces large gains, but those gains are associated with much larger wage-arrears stocks.
4. Adding cash/stock support as a permissive `multi` rule produces the lowest unemployment and fewest exits, but also the worst arrears accumulation; it is therefore an upper bound, not a candidate production rule.

### Verdict

**PASS — RECOVERABILITY IS REAL BUT NOT YET COHERENTLY DEFINED. THE CURRENT OPERATING/MULTI SHADOWS OVER-PRESERVE FIRMS RELATIVE TO THEIR REALIZED PAYROLL CAPACITY.**

## R4-Q infrastructure result

The 36-month Q matrix ran until the 30-minute workflow limit and was cancelled before completion. The failure is computational scheduling, not a model result. The current script executes all scales × all seeds × all Q variants serially inside one job, so the correct repair is to shard the diagnostic across independent Actions jobs rather than reduce causal coverage.

## Causal frontier after O/P

The dominant unresolved question is no longer whether binary exit propagation matters. It does. The frontier is now:

`recoverability estimate -> workforce resize rule -> post-restructure payroll/arrears dynamics -> recurrence or stabilization -> liquidation only when operationally nonrecoverable`.

The next batch must therefore test persistence, held-out seed robustness, estate complementarity and supply complementarity while preserving an explicit arrears-discipline gate.

## Execution policy change

To increase throughput, subsequent diagnostics are widened from 2–3 serial families to a sharded superbatch. Long-horizon jobs are split by scale/seed so wall-clock cancellation does not force reduced causal coverage.
