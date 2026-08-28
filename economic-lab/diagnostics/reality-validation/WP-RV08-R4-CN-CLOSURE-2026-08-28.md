# WP-RV08 R4-CN Closure — Unit Contract Identifiability

Date: 2026-08-28
Branch: `scratch/new-project-2026-08-12`
Authoritative run: `33148318406`
Run head: `67665da3a9447c42a4ecadea57e156a5f5b43910`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / INTERNAL NORMALIZATION REMAINS UNDERIDENTIFIED / CANONICAL MUTATION NOT APPROVED**

R4-CN passed all hard gates in Original A, Original C, Heldout E, and Heldout F. Exact canonical replay, exact diagnostic replay, accounting health, finite anchors, candidate algebra, country coverage, and industry coverage all passed.

The central finding is that the model cannot identify a unique normalization from internal headline ratios alone. Productive-quantity scaling (`Q`) and price scaling (`P`) are algebraically equivalent for firm break-even and aggregate demand residuals, while wage scaling (`W`) can also normalize firm break-even but materially distorts firm-cash/payroll stock-flow relations. Joint `Q+C`, `W+C`, and `P+C` families can all force headline firm and demand residuals to one, but they imply materially different stock and purchasing-power semantics.

## Seed results

| Seed | Firm required factor median | Demand required factor median | Residual demand after firm productive scale | Internal identification |
|---|---:|---:|---:|---|
| Original A | 87.9506 | 601.4314 | 6.8383 | UNDERIDENTIFIED |
| Original C | 87.4958 | 802.2455 | 9.1690 | UNDERIDENTIFIED |
| Heldout E | 85.0856 | 646.5216 | 7.5985 | UNDERIDENTIFIED |
| Heldout F | 86.1004 | 1003.6626 | 11.6569 | UNDERIDENTIFIED |

Cross-seed firm break-even normalization is therefore very stable at roughly 85–88x, while aggregate household-demand normalization remains much larger and much more variable.

## Stock-flow anchors

The diagnostic also showed that nominal stock-flow consequences differ sharply by normalization family.

- `Q` preserves firm cash/payroll months and household purchasing power while changing productive quantity/bundle scale.
- `W` increases firm cash/payroll months by roughly the same 85–88x normalization factor.
- `P` reduces household product purchasing power to roughly 1/85–1/88 of canonical.
- `Q+C` normalizes the two headline ratios without directly distorting those two stock anchors, but the semantic legitimacy of independently scaling household consumption budgets is not established.
- `W+C` and `P+C` normalize headline ratios but retain their stock/purchasing-power distortions.

Therefore **headline fit is insufficient to choose a canonical repair**.

## New structural evidence from canonical accounting inspection

Canonical accounting accrues each employed household's firm wage into the employer firm's finished-goods inventory as `production_labor_accrual`, then recomputes `f.bookUnitCost = inventoryBook / inventory`. This means labor compensation is explicitly capitalized into inventory cost.

However canonical product prices are initialized near country `initialPrice` times industry multipliers and thereafter move through independent behavioral `priceChange`; the pricing rule is not explicitly tied to `bookUnitCost` or a target cost-recovery markup.

This creates a concrete next causal question: **is the observed 85–88x firm productive-value gap substantially the result of labor cost being embedded in inventory book cost while selling prices remain on a disconnected nominal scale?**

That question is narrower and more causal than continuing generic normalization search.

## Closure decision

R4-CN is accepted as diagnostic evidence and closed. It does **not** authorize any canonical change to wages, prices, household budgets, production coefficients, accounting, or inventory valuation.

Next dependency-safe front:

**R4-CO — Labor-Cost Embedding / Price Adequacy / Cost-Recovery Audit**

R4-CO must quantify price-to-book-unit-cost, price-to-labor-cost-per-produced-unit, realized revenue-to-cost recovery, and the share of firm-months where even full sell-through at canonical price cannot recover current production labor accrual and carried inventory cost. It must remain observational and mutation-free.

## Artifact register

- Original A: artifact `9676659946`, digest `sha256:5f59b33f688ed008f578c3c34d1fb8c8e84bfdccfa58b26f3676ea589de81023`
- Original C: artifact `9676662251`, digest `sha256:b153ba360b902cb66061558510ff95ade9f19be9a18ff83f0eeefd6865524fa2`
- Heldout E: artifact `9676663010`, digest `sha256:e659abf38323bf2b6b356afbf66481fa6c2d63f03c9b5a2956db626737eb46ad`
- Heldout F: artifact `9676668202`, digest `sha256:13cacd955f2b6ab553fa6c3e1da320f18d953a92e660f42d38ea5e818f042c8c`

## Canonical mutation status

**LOCKED.**
