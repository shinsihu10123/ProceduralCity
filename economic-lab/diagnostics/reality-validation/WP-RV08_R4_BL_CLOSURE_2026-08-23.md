# WP-RV08 R4-BL — Firm Regeneration Capacity Ablation Closure

Date: 2026-08-23
Run: `32583804710`
Coverage: 8/8 simulations, 4 seeds × control/full-replacement, 24 months
Verdict: **PASS — replacement-count cap is a propagation amplifier; replacement quality remains the dominant regeneration defect**

## Intervention

Canonical world logic creates entrants for only the first two exit industries in a month. The `full-replacement` arm retained the normal first two replacements and additionally called the existing canonical `createEntrant` path for every remaining same-month exit.

No change was made to entrant quality: extra entrants still began with canonical zero cash, zero workers, zero inventory and zero capital.

## Replacement quantity

Control actual entrant/exits ratios ranged from **0.649 to 0.693**.

Full replacement achieved **1.000 in all four seeds**.

The mean terminal active-firm count rose from about **24.44 to 42.50**. The latter equals the mean initial firm count across the four countries, so the intervention successfully removed the mechanical population-loss effect of the monthly entry cap.

## Macro effect: full replacement minus control, four-seed mean

- mean unemployment: **-0.14 percentage points**
- late unemployment: **-0.20 points**
- terminal unemployment: **-0.96 points**
- terminal GDP: **+855**, but highly seed-heterogeneous
- terminal output: **-4.26** on average, mixed by seed
- terminal wage arrears: **+8,171**
- terminal active firms: **+18.06**
- entrant worker-months: **+505**
- entrant output: **+61.2**
- entrant revenue: **+1,273**

The intervention caused substantially more churn: extra weak entrants also failed, so actual exits rose by about **134** and births by **207** per seed average. Months with large exit bursts also increased.

## Hypothesis verdict

**BL-1 — the monthly maximum-two replacement cap is the main cause of long-run collapse: FALSIFIED.**

Removing the cap restores firm *counts* but barely changes unemployment and does not restore robust output. It also raises wage arrears and creates a high-churn population of weak startups.

**BL-2 — the cap amplifies firm-population loss: STRONGLY SUPPORTED.**

The cap mechanically converts exit bursts into permanent active-firm count loss. That is a real propagation defect and should eventually be redesigned.

**BL-3 — entrant quality, not just entrant quantity, is the more important regeneration failure: STRONGLY SUPPORTED when integrated with R4-BF.**

R4-BF showed that canonical entrants are born with zero operating resources, none survive to six months, roughly 63% never produce, roughly 74% never earn revenue, and none acquire capital. R4-BL shows that creating *more of those same entrants* does not materially stabilize the macroeconomy.

## Structural interpretation

The canonical ecological loop is effectively:

`exit burst -> at most two replacements -> active-firm population loss`

and, if the cap is removed:

`exit -> zero-resource entrant -> brief hiring/operation attempt -> distress -> re-exit -> another zero-resource entrant`.

Thus both quantity and quality are defective, but quality is the deeper causal frontier.

The next entrant experiment should decompose startup endowments/institutions one at a time rather than simply increasing entry counts.

No canonical entry-rule change is authorized by this closure.
