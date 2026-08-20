# WP-RV08 R3 — Institutional Evidence for Entrant Regeneration Finance

Date: 2026-08-20
Status: **EVIDENCE REVIEW COMPLETE — DESIGN CONSTRAINTS ONLY**

## Purpose

This note does not calibrate the simulation and does not authorize a production repair. It records external institutional evidence relevant to the replacement-entrant regeneration failure established in WP-RV07 P48/P49/P75/P76 and currently isolated by WP-RV08 R2.

## Evidence reviewed

### OECD — Financing SMEs and Entrepreneurs 2026

The OECD 2026 Scoreboard explicitly treats SME and entrepreneurship finance as a multi-instrument system rather than a single generic commercial-bank loan channel. Its framework tracks debt, equity, asset-based finance, government-guaranteed loans, direct government loans, collateral conditions, rejection rates, venture/growth capital, leasing, factoring and invoice discounting. The reader's guide specifically identifies external equity as relevant to start-up, early-development and expansion stages.

Design implication: a zero-history replacement entrant should not be assumed to have only one economically meaningful financing path. A production candidate may represent distinct funding institutions, but each must preserve explicit balance-sheet and settlement accounting.

Source:
- OECD, *Financing SMEs and Entrepreneurs 2026: An OECD Scoreboard*.
- https://www.oecd.org/en/publications/financing-smes-and-entrepreneurs-2026_075d8058-en/full-report.html
- https://www.oecd.org/en/publications/financing-smes-and-entrepreneurs-2026_075d8058-en/full-report/reader-s-guide_155c0c43.html

### BIS — small-firm credit and information/collateral constraints

BIS Bulletin No. 99 (2025) notes that SMEs can struggle to access credit because of short financial histories and lack of collateral. BIS work on mutual guarantee institutions similarly emphasizes that young firms often have little collateral and short credit histories, making bank funding difficult; guarantee structures can mitigate information/collateral constraints without pretending that the underlying risk is absent.

Design implication: WP-RV07 P76's result — entrant estimated default probability around 0.64–0.67 against risk limits near 0.25, with concurrent capital/affordability failures — is qualitatively consistent with a model that treats zero-history, zero-resource entrants as extremely weak ordinary borrowers. A repair should not simply delete risk. It should distinguish the institution absorbing or sharing startup risk.

Sources:
- BIS Bulletin No. 99, *How far can digital innovation improve credit to small firms in emerging market economies?*, 27 Feb 2025. https://www.bis.org/publ/bisbull99.htm
- BIS Working Papers No. 290, *Mutual guarantee institutions and small business finance*. https://www.bis.org/publ/work290.htm

### World Bank / IFC — working capital and alternative risk-bearing channels

World Bank material describes working capital as funding used to purchase production inputs, finance inventory and bridge the period before customer payment. World Bank and IFC SME-finance frameworks also describe lines of credit, partial credit guarantees, early-stage equity/debt/quasi-debt, supply-chain finance and alternative data/risk assessment as distinct channels for firms that may lack collateral or credit history.

Design implication: current-plan input need is economically meaningful, but WP-RV08 R1 already showed that measuring the need correctly is not sufficient when underwriting still blocks entrants. R3 therefore must distinguish **measurement of financing need** from **risk-bearing institution**.

Sources:
- World Bank, *Supply chain financing: An effective way for development banks to support small entrepreneurs*. https://blogs.worldbank.org/en/psd/supply-chain-financing-effective-way-development-banks-support-small-entrepreneurs
- World Bank, *World Bank and Private Sector — SMEs*. https://www.worldbank.org/en/about/partners/the-world-bank-group-and-private-sector/smes
- IFC, *MSME Finance*. https://www.ifc.org/en/what-we-do/sector-expertise/financial-institutions/msme-finance

## Constraints admitted for R3 design

1. **No free money.** Any entrant funding must have an explicit funding source and corresponding liability/equity/guarantee accounting.
2. **No arbitrary risk deletion.** If risk is transferred or shared, the recipient institution must bear a recorded contingent or realized exposure.
3. **Current-plan need basis.** Working-capital need should be derived from explicit planned payroll/input requirements rather than a stale `supplyShortage` value reset earlier in the month.
4. **Lifecycle distinction is allowed.** A startup/entry-stage financing contract may differ from an incumbent operating loan if the contract records why and how risk is priced/shared.
5. **Multiple channels are legitimate candidates.** Commercial bank credit, guaranteed credit, equity/owner capital and asset/supply-chain-backed finance may be tested separately.
6. **No empirical calibration claim.** External sources establish institutional plausibility, not numeric target coefficients for this simulation.
7. **Canonical promotion requires accounting conservation and held-out validation.** A candidate that lowers unemployment by creating unaccounted resources is automatically rejected.

## R3 candidate families after R2

R2 determines which family is admitted first:

- If one hard commercial-bank constraint dominates and bounded relief restores viable entrant production without destabilizing bank accounting, test a **targeted commercial-bank startup underwriting contract**.
- If bank-capital constraint is decisive, test **risk-sharing / guarantee accounting** rather than pretending the bank has capital it does not have.
- If all hard constraints plus bank preference must be bypassed, treat ordinary commercial-bank credit as structurally unsuitable for zero-resource replacement entry and test an **explicit early-stage capital institution**.
- If entrant credit succeeds but production still fails, prioritize **input/capital bootstrap contract design** rather than further underwriting relaxation.

## Non-authorization statement

This evidence note authorizes **zero** canonical mechanism changes and **zero** fitted parameter tuning. It exists to constrain R3 architecture after the R2 matrix resolves the remaining commercial-bank admission question.
