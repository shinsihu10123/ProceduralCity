# WP-RV08 R4-AZ / R4-BA / R4-BB Interim Synthesis

Date: 2026-08-22
Run: `32565388891`
Source SHA: `0c274a92c71c3df71a28c5b254f09742ee68a539`
Current coverage at synthesis time: **7/8 shards complete**; only held-out F / raw remained in progress.
Status: **INTERIM — do not treat as final closure until 8/8 coverage is confirmed**

## 1. R4-AZ — behavioral synchronization is sector-specific, not economy-wide

Across the completed MATERIALS+CONSUMER shards, the modal firm action occupies roughly **61.6–66.8%** of active-firm decisions on average, while CONSUMER alone is much more concentrated at **78.2–82.4%**. The normalized firm-action entropy is only about **0.49–0.54** on a 0–1 scale.

The raw shards show the same qualitative feature: CONSUMER modal-action concentration is **79.2–80.6%** even though whole-firm concentration is lower at **55.2–59.3%**.

This is not universal agent lockstep. Household modal-action concentration is much lower and extremely stable around **47.5–47.7%**, with household action runs averaging only **~1.7 months**. Firm action runs are far more persistent: roughly **9.3–10.1 months** under MATERIALS+CONSUMER and **12.4–13.8 months** in raw.

Cross-sectional belief dispersion also becomes narrow in the improved M+C state: firm demand-belief SD is only **~0.031–0.036**, and household unemployment-belief SD **~0.018–0.021**.

### Interim interpretation

- **H-AZ1 is supported specifically for CONSUMER firms:** downstream firms are highly concentrated in the same modal action for long stretches.
- **H-AZ1 is not supported as a universal-agent mechanism:** households remain materially more diverse and switch actions much faster.
- This does **not** yet prove synchronization causes collapse. It may be an endogenous response to common macro stress or common information signals.
- Any future causal test must distinguish `common fundamentals -> similar decisions` from `excessively homogeneous cognition -> self-reinforcing collapse`.

## 2. R4-BA — the historical-age mismatch is real and persists unevenly across subsystems

The opening state confirms the same mismatch in every completed shard. Per country, the model begins with approximately:

- **~1,566–1,576 units of productive capital**;
- **~1,808–1,819 units of finished inventory**;
- **zero inherited input inventory**;
- **~4.5k–4.6k government debt**;
- **~382k–383k bank securities**;

while simultaneously starting with:

- **0 active private loans**;
- **0 public-share ownership**;
- **0 household portfolio owners**;
- **0 cognitive episodes**;
- **0 international trade records**;
- **0 inherited B2B supplier pairs**.

The relationship layer then grows after simulation start. In the completed M+C shards, per-country means are approximately:

- month 1: 2.6 active loans, 37 unique B2B pairs, 1 cognitive episode;
- month 6: 16.3 active loans, 106 B2B pairs, ~6 episodes;
- month 12: 18.4 active loans, 139 B2B pairs, ~11.9 episodes;
- month 24: 16.3 active loans, 166 B2B pairs, ~23.7 episodes;
- month 36: only 7.2 active loans remain, while B2B pairs reach ~174 and cognitive history ~35.5 episodes.

Ownership remains shallow even after three years: M+C household portfolio-owner share is only **~4.5%** at month 36 and public shares remain near **~1.3%** of active-firm shares.

### Interim interpretation

- **H-BA1 is strongly supported as a structural-realism fact:** capital, inventories, public debt and bank securities are inherited at month 0 while private-credit, ownership, supplier and cognitive histories begin essentially from zero.
- The mismatch does not disappear uniformly. Supplier and cognitive histories form relatively quickly, but broad household ownership remains extremely shallow and private-credit relationships rise and later contract with the collapse.
- This strengthens the claim that the system begins with subsystems of different effective `economic ages`.
- R4-AX already showed that adding a small amount of prehistory is not sufficient, so this remains a structural lead rather than a repair instruction.

## 3. R4-BB — the timescale incompatibility is now extremely strong

The completed M+C shards reproduce a large timing conflict among staffing recovery, distress, unemployment and finance.

For plan-economically-viable CONSUMER observations:

- theoretical catch-up at the canonical maximum +12% monthly staffing ramp averages **22.5–24.4 months**;
- **89.7–94.7%** require more than 4 months;
- **80.8–87.9%** require more than 8 months.

Yet canonical firm distress reaches exit on a much shorter clock:

- first arrears to exit: **~4.91–4.98 months** under M+C;
- first positive distress to exit: **~3.13–3.34 months**;
- raw first-distress to exit is essentially **3.0 months**, consistent with the four-month accumulated distress threshold.

The rest of the ecosystem operates on much longer horizons:

- firm cognitive planning horizon centers around **6 months**;
- household planning horizon around **3 months**;
- bank planning around **5–6 months**;
- government / central bank around **~11–13 months**;
- firm loan contractual terms average **~26.5–27.7 months** in M+C;
- household loan terms average **~15.4–18.4 months**;
- realized M+C loan defaults occur after roughly **12.3–14.4 months** on average;
- unemployment spells average **~16.8–17.9 months** under M+C and about **25 months** in raw.

This means a viable downstream firm can need roughly two years to close the physical staffing gap even at the maximum canonical ramp, while the firm can be eliminated after only several months of payroll/credit distress. Credit contracts, worker reallocation, policy planning and cognitive learning mostly operate on longer horizons than the firm-survival clock.

### Interim interpretation

- **H-BB1 is strongly supported.** The economy contains incompatible adjustment clocks.
- This does not mean the correct repair is simply to extend bankruptcy grace. R4-AH/AI and R4-AX already showed that grace alone stores arrears and can worsen terminal outcomes.
- The stronger architecture implication is that **the system lacks a coherent transition path that aligns production scaling, staffing, payroll finance, debt service and distress resolution over compatible horizons**.

## 4. Combined ecosystem picture

The current evidence supports a deeper interpretation than a single labor, finance or initialization bug.

The model can be viewed as several coupled subsystems whose state variables and clocks are not co-developed:

`mature productive/public stocks`
→ coexist with `young private relationships and memories`
→ downstream firms react in relatively synchronized, persistent ways
→ production requires staffing adjustment over ~2 years
→ payroll distress and exit operate over ~4 months
→ worker unemployment and loan resolution operate over ~1–2 years
→ exit destroys demand and relationships before slower adaptation can complete
→ the resulting common stress further synchronizes firm responses.

This is a plausible ecosystem-level positive-feedback architecture. It remains a hypothesis graph until full 8/8 coverage and targeted ablations separate causation from correlation.

## 5. Next dependency-safe frontier after final coverage

If the eighth shard confirms these ranges, the next wide batch should separate three mechanisms rather than tuning parameters:

1. **Common-signal vs cognition-homogeneity test** — preserve identical macro fundamentals while increasing only independent information/history diversity, or replay identical states with de-correlated diagnostic belief seeds, to test whether CONSUMER synchronization is causal.
2. **Transition-path compatibility test** — do not simply lengthen distress; instead test whether staged staffing + payroll/working-capital + restructuring clocks can be made mutually consistent without accumulating arrears.
3. **Historical-state coherence test** — compare the current synthetic mature opening against internally generated or replayed state snapshots that carry matching supplier, credit, ownership and cognitive histories, without hand-tuning terminal macro outcomes.

No canonical repair is authorized from this interim synthesis.

Evidence: `economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AZ_BA_BB_ECOSYSTEM_DYNAMICS_COMPACT_PARTIAL_2026-08-22.csv`
