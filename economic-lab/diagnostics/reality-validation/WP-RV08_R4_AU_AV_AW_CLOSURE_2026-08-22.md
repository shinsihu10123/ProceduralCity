# WP-RV08 R4-AU / R4-AV / R4-AW Closure — Economic Ecosystem Structural Audit

Date: 2026-08-22
Run: `32557580100`
Source run SHA: `a0787d2d1a3334846d4d24d915784b023230a1b0`
Coverage: **16/16 shards SUCCESS + final beacon SUCCESS**
Verdict: **PASS — structural widening / FAIL-CONTINUE — cold start is a material lead/amplifier, not yet a sufficient root explanation**

## 1. What was tested

Four independent seeds (original A/C, held-out E/F) were run for 24 months under four bases:

- `raw`: repository-native wage/price/productivity structure;
- `unit`: initial price moved onto the wage nominal scale only;
- `consumer`: unit normalization + prior CONSUMER productive-normalization diagnostic;
- `materials-consumer`: unit normalization + prior MATERIALS+CONSUMER productive-normalization diagnostic.

R4-AU audited opening stocks/flows/ontologies. R4-AV measured the timing of the collapse. R4-AW measured the propagation pattern.

All shards passed ledger, general-accounting, GDP arithmetic and runtime health checks.

## 2. R4-AU — the opening world is not a historically co-evolved state

Across all 64 country/base opening observations:

- 100% of firms begin with positive finished-goods inventory;
- 100% of those firms simultaneously have zero current output, zero sales and zero revenue;
- 100% of input-using firms begin with zero input inventory;
- 100% of firms begin with positive installed capital;
- 100% of firms and households begin with zero loan balance, and each country begins with an empty private loan list;
- 100% of firms begin with the placeholder `previousSales = 1` and `currentPlan = null`;
- 100% of initially employed household-agents have zero current income at the opening snapshot;
- each country has only one distinct household baseline belief state before learning starts;
- opening household/firm cognition has zero accumulated episodes;
- household portfolios are empty at opening while firms already have positive opening equity/net worth;
- the government begins with a positive inherited public-debt stock, while public capital is zero;
- international foreign asset/debt positions begin at zero;
- each country has exactly one commercial bank, one government and one central bank.

Source-level review also confirms that supplier choice is a repeated sampled spot-market search rather than an inherited supplier relationship, while the asset market initializes all firms with an equity structure but `publicShares = 0`, and the international system starts trade/funding histories from month 0 with zero external positions.

This is enough to reject the proposition that month 0 is a fully historically consistent mature economy. It is a synthetic initial condition containing mature stocks/institutions plus zero or placeholder operating histories.

## 3. R4-AV — collapse is not an instantaneous startup failure; it is a delayed stress pipeline

A pure “everything dies immediately because month 0 is artificial” explanation is **not supported**.

Across bases, only about **1.6–2.6% of all 24-month firm exits occur in the first six months**. The first three months contain essentially no exits.

However, the upstream stress begins immediately:

- wage arrears become positive at mean month **1.88–2.13**;
- at repository-native units, about **97.2% of all 24-month new credit is originated in the first six months**;
- even after nominal/productive normalizations, **72.6–78.4%** of total new credit is still front-loaded into the first six months;
- unemployment first crosses 20% around month **6.8–7.9**;
- unemployment first crosses 40% around month **7.7–12.3**;
- active firms fall below 75% of their opening count around month **9.6 raw**, but only around **16–18 months** after nominal/productive normalization.

This timing is consistent with a latent pipeline:

`opening mismatch / operating stress`
→ `arrears and emergency credit in months 1–6`
→ `distress clock accumulation`
→ `exit wave in months 7–12 and later`
→ `unemployment/demand/supply-network deterioration`.

The known four-month distress rule helps explain why opening stress does not appear as immediate exits.

## 4. Raw-unit pathology is huge but not the deep root

The repository-native `raw` economy has mean unmet household demand of about **99.3% in months 1–3**. Merely putting initial prices onto the wage nominal scale reduces that early unmet-demand ratio to about **1.8%**.

With the CONSUMER or MATERIALS+CONSUMER diagnostic normalization, months 1–3 household unmet demand is almost zero (~0.04%). GDP and output are also much healthier at the start.

Nevertheless all four bases eventually collapse.

Terminal 24-month aggregate means:

| Base | Terminal unemployment | Active firms | GDP | Output | Wage arrears |
|---|---:|---:|---:|---:|---:|
| raw | 96.7% | 16.9 / 170 | 1.73k | 0.0 | 211k |
| unit | 88.9% | 21.1 / 170 | 4.18k | 0.44 | 203k |
| consumer | 88.3% | 21.3 / 170 | 5.13k | 0.52 | 191k |
| materials+consumer | **81.5%** | **24.4 / 170** | **7.01k** | **14.7** | **189k** |

Thus the nominal-scale defect and productive feasibility defects are major early-pathology components, but they do not explain the common long-run collapse attractor.

## 5. The healthier-looking normalized world still deteriorates endogenously

The MATERIALS+CONSUMER diagnostic base is particularly informative.

Months 1–3:
- unemployment 5.6%;
- GDP 60.8k;
- output 181.2;
- unmet demand ~0.04%;
- zero exits.

Months 4–6:
- unemployment 9.9%;
- GDP 44.3k;
- arrears already 38.4k;
- input shortage grows sharply.

Months 7–12:
- unemployment 33.5%;
- GDP 31.2k;
- output 199.5 but arrears 83.4k;
- exit wave begins.

Months 13–24:
- unemployment 64.2%;
- GDP 14.5k;
- output 47.9;
- arrears 150.5k;
- unmet demand 79.0%.

The world can therefore begin with apparently acceptable demand clearing after known normalization and still evolve into collapse. The persistent problem is systemic dynamics, not only a bad first-month price scale.

## 6. R4-AW — propagation is consistent with the established arrears → exit → unemployment loop

After normalization, mean lag/association signals strengthen rather than disappear:

- prior-month arrears vs next-month exits: correlation about **0.566 unit**, **0.584 consumer**, **0.601 M+C**;
- same-month exits vs unemployment: about **0.606**, **0.621**, **0.645** respectively.

Correlation is not treated as causal proof. But it is consistent with the intervention evidence already obtained in no-exit/restructure/grace/staffing experiments, which independently established exit propagation and persistent payroll insolvency.

## 7. Hypothesis verdicts

- **H-AU-1: month 0 is a coherent mature economy with internally compatible histories and stocks** — **FALSIFIED as a structural description**.
- **H-AV-1: collapse is merely an instantaneous initialization shock** — **FALSIFIED**. Exit concentration is low in months 1–6 and collapse continues far later.
- **H-AV-2: synthetic cold start creates a latent stress pipeline that amplifies later collapse** — **SUPPORTED AS A STRONG LEAD**, not yet causally closed.
- **H-AW-1: the nominal price/wage scale defect is the sole deep root** — **FALSIFIED**.
- **H-AW-2: productive normalization alone creates a stable ecosystem** — **FALSIFIED**.
- **H-AW-3: arrears/distress/exit/unemployment form a major propagation loop** — **SUPPORTED**, together with prior causal ablations.
- **H-AW-4: adding more isolated patches is now the right repair strategy** — **REJECTED AS A METHOD**. The remaining defect is multi-system coherence.

## 8. Architectural implication

The next work must distinguish two questions:

1. Does a small set of opening stock-flow mismatches materially amplify the collapse?
2. Even if those opening mismatches are neutralized, does the endogenous labor–production–revenue–payroll–exit feedback still collapse?

The first is tested next with bounded, diagnostic-only opening-state/prehistory probes. The second remains the overarching structural problem.

A future production architecture may need a deliberate economic bootstrap/prehistory mechanism rather than instantiating every mature institution and stock at the same instant. That is a **D — proposed architectural direction only**, not an approved repair.

## Evidence

Permanent compact:
`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_AU_AV_AW_ECOSYSTEM_COMPACT_2026-08-22.csv`

Systemic register:
`economic-lab/diagnostics/reality-validation/ECONOMIC_ECOSYSTEM_STRUCTURAL_REALISM_AUDIT_REGISTER_2026-08-22.md`
