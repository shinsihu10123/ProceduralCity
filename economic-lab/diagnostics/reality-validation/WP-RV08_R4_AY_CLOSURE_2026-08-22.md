# WP-RV08 R4-AY Closure — Institutional Maturity / Network Topology / Historical-State Census

Date: 2026-08-22
Run: `32558025253`
Source SHA: `c8d07470f5db6b44fa1566477a202b3c658865e9`
Coverage: **8/8 shards, original A/C + held-out E/F × raw/MATERIALS+CONSUMER, final beacon SUCCESS**
Verdict: **PASS — structural maturity census / FAIL-CONTINUE — mature institutions exist without mature relationship histories**

## Question

R4-AU–AX showed that the Economic Lab does not merely contain a few bad scalar parameters. It begins from a synthetic economy that already owns firms, capital, inventories, banks and public debt while many of the relationships and histories that normally make those stocks meaningful are absent or begin at month 0.

R4-AY therefore asks a narrower factual question before any repair is proposed:

> which institutional, financial, ownership, supplier, employment and cognitive histories are inherited at initialization, and which are only generated after the simulation begins?

The census is diagnostic-only. Absence of a relationship is not automatically classified as a causal defect.

## Opening state — the institutional shell is present, but most mature private relationships are not

Across all seeds and both bases, month 0 contains:

- 4 commercial banks, 4 governments and 4 central banks for the four countries;
- exactly one assigned commercial bank per country;
- **0 active private loans**;
- 4 already-existing government bonds;
- **0 central-bank facilities**;
- asset-market history length = **1** and international-history length = **1**;
- public-share ratio = **0**;
- household portfolio-owner share = **0**;
- mean cognitive episodes = **0**.

Thus the world begins with a mature-looking institutional skeleton but without inherited private-credit, portfolio-ownership, supplier-network or cognitive history.

## Month-12 relationship formation

Averaged across original A/C and held-out E/F:

| Metric | Raw | MATERIALS+CONSUMER |
|---|---:|---:|
| Active private loans | 66.5 | 73.75 |
| Unique active borrowers | 43.0 | 52.75 |
| Public-share ratio | 3.73% | 1.38% |
| Household portfolio owners | 3.48% | 4.32% |
| Mean cognitive episodes | 11.86 | 11.87 |
| Unique B2B buyer-supplier pairs | 528.0 | 556.75 |
| B2B transactions | 774.5 | 966.25 |
| Repeat B2B transaction share | 32.53% | 43.57% |
| Job-to-job transitions | 1.0 | 49.0 |
| Employment entries | 134.75 | 345.5 |
| Employment exits | 1,890.5 | 1,029.0 |
| Capital-stock increases | 413.0 | 940.0 |
| Capital-stock decreases | **0** | **0** |
| Global foreign-funding contracts | 19.5 | 8.5 |
| Global trade records | 1,399.5 | 1,640.75 |
| Central-bank facilities | **0** | **0** |
| Recorded central-bank operations | **0** | **0** |

The runtime clearly does form networks after start: private credit, repeated B2B relationships, portfolio ownership, international trades and cognitive histories all emerge from zero. However, this maturation occurs while the economy is already accumulating stress.

## Relationship formation is concurrent with collapse, not prior to it

Under the MATERIALS+CONSUMER diagnostic base, the cross-seed mean path is:

| Month | Unemployment | GDP | Wage arrears |
|---|---:|---:|---:|
| 1 | 5.06% | 72,996 | 44 |
| 3 | 6.40% | 51,321 | 12,614 |
| 6 | 13.97% | 41,662 | 52,182 |
| 12 | 42.01% | 27,708 | 100,598 |

By month 6, repeated supplier relationships, credit relationships and cognitive histories have already begun to form, but arrears and unemployment are simultaneously worsening. The endogenous relationship-formation process therefore does not, by itself, create a stabilizing basin before the distress cascade becomes dominant.

## Labor reallocation topology is highly asymmetric

The labor network is especially revealing.

Under raw dynamics, 12 months produce on average **1,890.5 employment exits but only 1 direct job-to-job transition**. Under MATERIALS+CONSUMER normalization, the system improves to **1,029 exits and 49 job-to-job transitions**, but direct worker reallocation remains tiny relative to separations.

This means the dominant path is not a mature `firm A → firm B` labor reallocation process. It is closer to:

`employment → detachment/unemployment → possible later re-entry`.

R4-AY therefore promotes labor reallocation topology from a broad realism concern to a concrete diagnostic lead.

## Capital stock has accumulation but no observed depreciation channel

Across every seed and both bases, the 12-month census observes many capital-stock increases — **413 raw and 940 M+C on average** — and **zero capital-stock decreases**.

This does not explain the current collapse directly; if anything, preserving productive capital indefinitely is likely to make measured productive capacity more generous than a realistic depreciation process would. But it is a verified structural realism gap and must be handled before long-horizon empirical realism can be claimed.

## Monetary institution topology requires separate interpretation

The central bank exists from month 0 and policy-rate transmission can operate without an explicit lending facility. Therefore `0 facilities / 0 recorded operations` is **not** a finding that monetary policy is absent.

It is instead a narrower result: the current financial ecosystem does not build a rich recorded central-bank liquidity/intervention history during these 12-month runs. That belongs in a later institutional-depth audit rather than the present collapse root claim.

## Hypothesis verdicts

- **H-AY-1: mature private relationship histories are inherited at world initialization** — **FALSIFIED**.
- **H-AY-2: private credit, supplier, ownership, international and cognitive networks begin forming only after month 0** — **VERIFIED**.
- **H-AY-3: those endogenous relationships mature fast enough to stabilize the economy before distress dominates** — **FALSIFIED as a general explanation**.
- **H-AY-4: labor reallocation is dominated by direct job-to-job movement** — **FALSIFIED**.
- **H-AY-5: capital stock contains an active depreciation/destruction process over the observed horizon** — **FALSIFIED for the audited runtime path**.
- **H-AY-6: institutional-history mismatch is itself proven to be the sole collapse root** — **NOT ESTABLISHED**.

## Causal interpretation

R4-AY strengthens the ecosystem diagnosis without overclaiming it.

The simulation begins with **stocks and institutions that imply a past**, but much of the network state that such a past would normally have produced is missing. The economy then tries to construct credit, supplier, ownership, international and cognitive relationships while production, payroll and firm-distress processes are already live.

R4-AX showed that simply supplying an opening input buffer or a six-month grace period does not solve the collapse. R4-AY now shows why the next frontier must be wider than a generic warm-up phase: the missing maturity is multidimensional, and several subsystem clocks are operating simultaneously while those relationships are still being created.

The next diagnostic frontier is therefore:

1. **behavioral synchronization** — whether common macro signals and common candidate policies cause firms/households to move too coherently;
2. **economic-age coherence** — whether stocks, liabilities, ownership and histories imply mutually incompatible entity ages at initialization;
3. **adjustment-clock collision** — whether hiring, firing, distress, credit, production, inventory, expectations and policy react on incompatible timescales;
4. **network/reallocation depth** — whether supplier, labor and finance networks have realistic persistence, substitution and recovery channels.

No production prehistory generator, depreciation rule, labor-reallocation repair or institutional redesign is authorized by this closure.

## Evidence

- `economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AY_INSTITUTIONAL_MATURITY_COMPACT_2026-08-22.csv`
- workflow run `32558025253`
