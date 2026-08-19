# WP-RV05 — GDP / National-Income-Accounting Composition Diagnosis

Status: **PASS — GDP / NIA COMPOSITION DIAGNOSIS**
Date: 2026-08-19

## 1. Frozen economic semantics

Economic Model Frozen Baseline: `698d10749e2897d711e5bcee61913ac34e0650a0`.

Economic mechanism changes in WP-RV05: **0**.
Parameter tuning in WP-RV05: **0**.
Structural repair authorized: **NO**.

## 2. Admission and promoted experiment

- WP-RV02: PASS — bounded 12-month baseline reproduction across seeds A/B/C.
- WP-RV03: PASS — labor/goods causal decomposition.
- WP-RV04: PASS — firm distress & exit attribution.

Promoted panel:

- scale: `baseline`
- seeds: `ECON-RV02-A`, `ECON-RV02-B`, `ECON-RV02-C`
- horizon: 12 months
- country-month observations: `144`
- composition runner: `economic-lab/scripts/nia-composition-diagnosis-v10.mjs`
- book/physical cross-check: `economic-lab/scripts/nia-orphan-inventory-probe-v10.mjs`

Final GitHub Actions evidence:

- commit: `0ebc88f4158849551654b7d07cbdcba04b53be1a`
- run: `32218010812`
- result: **SUCCESS**
- artifact: `9352995831` / `economic-lab-wp-rv05`
- artifact digest: `sha256:fb9fbfa74e45ac1df7eeb8e8cfeaebc12d193602f2173a711b339940d89d38f3`

Both JSON evidence files were uploaded:

- `reality-diagnostics-rv05-nia-composition.json`
- `reality-diagnostics-rv05-book-physical.json`

## 3. Integrity gates

All gates PASS:

- v0.10 health for all seeds
- complete 3 × 4 × 12 country-month coverage
- accounting inventory book ↔ diagnostic stock snapshot
- inventory investment ↔ inventory-book stock change
- exact GL inventory debit/credit flow ↔ raw inventory-book stock change
- expenditure-side GDP identity
- payroll accrual ↔ production-labor inventory capitalization
- `input_to_production` aggregate inventory-book neutrality
- book/physical probe finite and complete

Therefore the observed GDP pathology is **not an arithmetic identity mismatch**. The coded accounting entries reconcile exactly to the coded GDP measure.

## 4. A — VERIFIED EXISTING FACTS

### 4.1 The explicit GDP implementation is expenditure-side only

The current implementation explicitly constructs GDP from:

`C + gross private investment + public investment + government consumption + inventory investment + net exports`.

The repository does not contain an independent production-approach GDP or income-approach GDP implementation that can presently serve as a cross-method NIA check.

Disposition: exact expenditure-side reconciliation is an integrity result, **not** empirical or NIA-validity proof.

### 4.2 Inventory investment dominates the coded GDP measure

Across all 144 promoted country-months:

- total coded GDP: `1,367,591.62`
- total household consumption: `11,826.30`
- total gross private investment: `13,732.71`
- total public investment: `7,868.02`
- total government consumption: `7,090.18`
- total net exports: `263.85`
- total inventory investment: `1,326,810.55`
- GDP excluding inventory investment: `40,781.06`

Thus pooled inventory investment is **97.02% of coded GDP**.

Across individual country-months:

- mean `|inventory investment| / |GDP|`: `96.40%`
- median: `97.87%`
- p90: `99.25%`
- maximum: `206.38%`
- inventory investment exceeds GDP magnitude in `5 / 144` country-months.

The same pattern already exists before mass firm exit. In months 1–6, inventory investment is `1,003,443.04` against GDP of `1,037,315.90`.

### 4.3 Exact GL flow decomposition explains the inventory-book increase

Across the full promoted panel, the exact aggregate inventory-account movements are:

Positive inventory-book movements:

- production-labor accrual: `+4,617,692.57`
- international input imports: `+9,604.63`
- interfirm input purchases: `+3,839.76`

Major negative inventory-book movements:

- international export COGS: `-1,095,973.07`
- government-sale COGS: `-776,060.25`
- household cost of goods sold: `-663,242.24`
- capital-goods COGS: `-530,990.29`
- interfirm COGS: `-238,060.57`

`input_to_production` is exactly inventory-book neutral as designed.

The net of all inventory-account journal movements is `1,326,810.55`, matching total reported inventory investment to numerical tolerance.

The largest gross positive source is therefore **production-labor capitalization into finished-goods inventory**.

### 4.4 Book cost of sold goods is extremely large relative to realized sale values

Using exact accounting flows over the same panel:

- household COGS / household consumption ≈ `56.08×`
- government-sale COGS / (government consumption + public investment) ≈ `51.88×`
- capital-goods COGS / gross private investment ≈ `38.67×`
- interfirm COGS / interfirm input-purchase book inflow ≈ `62.00×`

These are accounting-flow ratios, not markups inferred from prices. They show that the finished-goods book values being relieved on sale are often orders of magnitude larger than the corresponding realized transaction values.

### 4.5 Book value and physical finished-goods quantities diverge

In `53 / 144` country-months, aggregate inventory book value rises while physical finished-goods units fall.

The focused book/physical probe finds:

- positive finished-goods book balance with no corresponding physical finished units in `76 / 144` country-months;
- the same condition specifically for consumer-facing firms in `51 / 144` country-months.

At month 12:

- all `12 / 12` country-runs contain some finished-goods book value without corresponding physical finished units;
- `10 / 12` contain consumer-firm book value without corresponding physical consumer units;
- total month-12 book-without-physical-units balance: `172,979.07`;
- consumer portion: `56,341.27`;
- aggregate terminal physical consumer finished-goods inventory is effectively zero (`~7.9e-15` units across all 12 country-runs).

Thus a material part of the finished-goods accounting stock no longer has a corresponding positive quantity in the operational physical-inventory state.

### 4.6 Payroll is capitalized even when current physical output is zero

The accounting system capitalizes accrued production wages into finished-goods inventory.

Across the full panel:

- production-labor capitalization: `4,617,692.57`
- capitalization on journals whose recorded current output is zero: `323,703.38`
- zero-output share: `7.01%`
- consumer-facing zero-output capitalization: `57,492.08`

The distortion intensifies late in the collapse:

- months 7–9 zero-output share: `15.06%`
- months 10–12 zero-output share: `16.08%`
- month-12 cross-section zero-output share: `16.82%`

This is a direct coded mechanism that can create finished-goods book value without current physical production.

### 4.7 Inactive firms retain most terminal inventory book value

Mean inventory-book share attached to inactive firms:

- full 144-country-month panel: `36.40%`
- months 7–9: `53.63%`
- months 10–12: `88.58%`
- month-12 cross-section: `92.94%`
- terminal range across the 12 country-runs: `71.95%`–`99.39%`

The frozen exit mechanism marks firms inactive and removes workers, but does not perform an accounting inventory write-off or bankruptcy/liquidation transfer. Therefore inventory book stocks can remain attached to firms that no longer participate in production or markets.

This fact affects stock interpretation. It does not by itself establish what the economically correct bankruptcy treatment should be.

## 5. B — DIAGNOSTIC LEADS

1. **Inventory-dominated GDP is a measurement/composition problem, not an identity-arithmetic problem.** The identity and all stock-flow reconciliations pass exactly.
2. **Production-labor capitalization is the dominant gross source of inventory-book growth.** Its scale is orders of magnitude larger than final household spending in the promoted panel.
3. **Finished-goods book cost is becoming detached from transaction values and physical quantities.** Very high COGS/sales ratios and book-without-physical-unit balances are direct evidence.
4. **Zero-output labor capitalization is a concrete mechanism producing nominal inventory assets without current physical output.** It is not large enough by itself to explain the entire inventory-investment stock increase, but it is a verified accounting-representation defect candidate.
5. **Firm exit leaves large accounting stocks stranded on inactive firms.** By month 12, roughly 93% of aggregate inventory book is attached to inactive firms.
6. **The household goods shortage and the inventory-GDP boom are not contradictory once state layers are separated.** Consumer physical inventory is effectively exhausted while most inventory book value resides in other book components and/or inactive firms.

## 6. C — STRUCTURAL DIAGNOSIS CANDIDATES

### SD-RV05-01 — book/physical inventory decoupling

**Production-labor accrual can add finished-goods book value independently of current physical output, allowing positive accounting inventory with zero corresponding operational finished-goods quantity.**

Status: **STRONGLY SUPPORTED**.

This is consistent with the observed escalation of unit book cost and very large COGS relative to transaction value. It is not yet a repair authorization.

### SD-RV05-02 — stale inventory on exited firms

**Firm exit does not resolve or transfer the firm's inventory accounting stock, leaving large book balances attached to inactive firms and preserving stocks that are no longer market-accessible.**

Status: **VERIFIED REPRESENTATION GAP / repair semantics unresolved**.

The correct treatment could involve liquidation, transfer, write-down, bankruptcy estate handling or another explicit mechanism; WP-RV05 does not choose among them.

### SD-RV05-03 — GDP interpretability

**Because inventory investment is mechanically derived from these book stocks, the current GDP series is dominated by inventory-account dynamics whose physical/economic interpretation is compromised.**

Status: **STRONGLY SUPPORTED**.

## 7. Hypothesis disposition

| Hypothesis | WP-RV05 disposition |
|---|---|
| H-G1 inventory/accounting dynamics amplify or obscure GDP | **SUPPORTED strongly** |
| GDP identity itself is numerically broken | **FALSIFIED** |
| Inventory-dominated GDP reflects abundant consumer goods | **FALSIFIED**; terminal consumer physical inventory is essentially zero |
| Zero-output capitalization alone explains all inventory growth | **FALSIFIED**; it is material but only part of gross capitalization |
| Firm-exit inventory stocks are explicitly liquidated/written off | **FALSIFIED** in current implementation |

## 8. What is not claimed

WP-RV05 does not claim:

- a calibrated real-world GDP target;
- that all inventory investment is illegitimate;
- that labor costs should never be capitalized into inventory;
- that a specific bankruptcy write-off rule is correct;
- that the correct repair is simply to cap inventory investment or GDP;
- that the financial accelerator has already been diagnosed;
- that production- or income-approach GDP can be inferred without implementing those accounting views explicitly.

No coefficient or economic mechanism is changed in this WP.

## 9. Final WP result

**WP-RV05: PASS — GDP / NIA COMPOSITION DIAGNOSIS**

Economic semantics changed: **0**
Parameter tuning performed: **0**
Structural repair authorized: **NO**

Next dependency-safe work package: **WP-RV06 — Finance / Credit Transmission Diagnosis**.
