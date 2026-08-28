# WP-RV08-R4-CQ Closure — Real Unit Labor Cost Invariant Gate

Date: 2026-08-28
Authoritative run: `33163264632`
Authoritative head: `152d6742051e6205e7b4720cc61f388c851442af`

## Verdict

**CLOSED / PASS AS DIAGNOSTIC EVIDENCE / REAL CALIBRATION-TECHNOLOGY INCOHERENCE CONFIRMED / PURE UNIT RELABEL HYPOTHESIS REJECTED / CANONICAL MUTATION NOT APPROVED**

## What was tested

R4-CQ measured the dimensionless real unit labor cost invariant

`RULC = wage / (price * capacity_per_worker)`

and verified invariance under:

1. a pure monetary numeraire change (`wage × 10`, `price × 10`), and
2. a consistent physical quantity relabel (`capacity ÷ 10`, `price × 10`).

If the observed mismatch were only a unit-label problem, these invariant tests would expose it as removable by consistent relabeling. They did not.

## Execution status

The 4-seed 24-month matrix completed successfully for Original A, Original C, Heldout E and Heldout F. All hard gates passed, including exact diagnostic replay, exact canonical replay, accounting health, monetary invariance, quantity-relabel invariance, and full country/industry coverage.

Artifacts:

- Original A: `9682518616`, `sha256:12d33be7dc9efcd3064f1e055bdd01b0db71582f832c6b959038f27efa76245e`
- Original C: `9682521783`, `sha256:b68a7d5b57c2400e0ba3aaa642cfb1de96f41d301a0946c6cdf9fc14756ba2e3`
- Heldout E: `9682518904`, `sha256:46cbd200e7c086fa6d20fb8134596109b86e2ed7c1977bf71b471c84e632332e`
- Heldout F: `9682524104`, `sha256:adda34886296017ff2412fbbd31ebdad24bc815f96adc0c87c282517c92901b0`

## Cross-seed headline evidence

Median RULC:

- Original A: `98.5646`
- Original C: `98.9628`
- Heldout E: `99.3360`
- Heldout F: `98.6271`

Every observed firm-month had `RULC > 30` in every seed. Roughly 48–49% of firm-months had `RULC > 100`.

Median consumer-side RULC anchor remained about `85.6–87.5`, while consumer capacity per worker remained about `1.08–1.14` physical units per month and median employed wage remained about `93–96` monetary units per month.

Industry structure was also stable. CAPITAL was least extreme but still had median RULC around `51–53`; CONSUMER around `87–91`; MATERIALS around `120–133`; RESOURCE around `187–208`.

## Interpretation

The key result is not merely that wages are numerically larger than prices. The mismatch survives both monetary numeraire changes and consistent quantity-unit relabeling. Therefore the defect is not fixable by changing labels, decimal places, or a common money/quantity unit.

The model currently embeds a real economic relationship in which one worker-month produces roughly one unit of physical capacity while that worker's wage buys roughly one hundred units of the firm's own good. That is a real calibration/technology inconsistency, not a bookkeeping-unit artifact.

This does **not** identify which single canonical variable is wrong. Wage, price formation, physical productivity/capacity, household budget semantics, or more than one of these may require redesign. Changing any one of them alone would be an economic intervention, not a unit normalization.

## Lock state

No canonical wage, price, productivity, output, household-budget, procurement, banking, accounting, or settlement behavior is authorized for mutation by R4-CQ.

## Next front

Proceed to R4-CR: **Two-Axis Calibration Requirement Gate**. The purpose is to test whether repairing the labor-cost/productive-value axis alone would still leave a separate household-demand/consumer-capacity mismatch. If a substantial residual remains across original and heldout seeds, the evidence requires at least two independent calibration dimensions before any canonical repair can be proposed.
