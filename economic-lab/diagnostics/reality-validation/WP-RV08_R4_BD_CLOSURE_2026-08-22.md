# WP-RV08 R4-BD Closure — Endogenous Stabilizer / Destabilizer Feedback Sign-and-Lag Audit

Date: 2026-08-22
Run: `32567505232`
Source SHA: `883a9e62ebab069ed4af99487b2f80f7fa0b15c3`
Coverage: **4/4 seeds, 48 months each, final beacon SUCCESS**
Verdict: **PASS — feedback structure diagnosed / FAIL-CONTINUE — endogenous stabilizers are too weak or procyclical to prevent collapse**

## Scope

R4-BD is observational. It measures signs, lags, and event-window responses around unemployment jumps and output contractions under the established MATERIALS+CONSUMER diagnostic normalization. Correlations are diagnostic leads, not causal effects.

No transfer rule, government demand rule, credit rule, firm-entry rule, accounting rule, bankruptcy rule, wage, price, or canonical production behavior was changed.

## Gates

All four seeds passed:

- health
- ledger reconciliation
- accounting verification
- GDP arithmetic identity
- normalization activation
- complete 48-month coverage

## Aggregate result

Across original A/C and held-out E/F:

- mean unemployment across the horizon: **67.23%**
- terminal unemployment: **96.25%**
- terminal wage arrears: **239.3k**
- mean entry-replacement ratio: **0.788**
- mean qualifying stress events per seed: **76**

The economy therefore remains in the same collapse basin at 48 months even though multiple automatic and institutional responses are active.

## Feedback sign diagnosis

### 1. Automatic transfers respond to unemployment, but weakly relative to the collapse

Correlation of unemployment increases with transfers per household:

- lag 0: **+0.298**
- lag 1: **+0.370**
- lag 3: **+0.305**

This confirms that the fiscal transfer channel is directionally countercyclical.

However, around qualifying unemployment/output stress events, the mean three-month post-event minus pre-event transfer response is only **+0.071 per household**, with cross-seed heterogeneity including a negative held-out-E response.

Thus the stabilizer exists, but its realized scale is not commensurate with the collapse.

### 2. Government demand is not countercyclical around contraction events

Unemployment increases correlate positively with government demand levels, but output contractions correlate negatively with future government demand.

Mean contraction correlations:

- lag 0: **-0.107**
- lag 1: **-0.134**
- lag 3: **-0.148**

Event-window government demand changes average **-1.331 per household** after stress events.

The government-demand channel therefore does not provide a robust contraction-offsetting floor in the tested dynamics.

### 3. Private credit does not expand materially when the economy contracts

Unemployment-to-credit correlations are approximately zero:

- lag 0: **+0.0004**
- lag 1: **+0.0265**
- lag 3: **+0.0353**

Output-contraction-to-credit correlations are negative on average at lag 0 and lag 1.

The event-window response is **-4.80 credit per active firm** after qualifying stress events.

This is consistent with prior evidence that credit is not acting as a broad self-liquidating working-capital stabilizer during the collapse.

### 4. Labor-market feedback is destabilizing during rising unemployment

Unemployment increases are associated with:

- fewer hires: lag 0 **-0.343**, lag 1 **-0.311**, lag 3 **-0.297**
- more layoffs: lag 0 **+0.551**, lag 1 **+0.252**, lag 3 **+0.076**

This is a classic positive-feedback pattern:

`unemployment increase -> hiring falls + layoffs rise -> employment weakens further`

The association persists across all four seeds.

### 5. Firm entry does not replace firm destruction fast enough

Mean entry-replacement ratio is **0.788**.

Thus, even before considering entrant size, productivity, funding, or survival quality, gross entry is below gross exit. Previous work already showed that entrants are financially weak; R4-BD adds that the quantity channel also fails to fully replenish the population of firms.

### 6. Demand and investment fall after stress

Mean event-window changes:

- consumption per household: **-7.22**
- investment per household: **-1.95**
- government demand per household: **-1.33**
- credit per active firm: **-4.80**

These channels move in the same direction as the initial contraction rather than offsetting it.

## Integrated interpretation

The model does contain some negative-feedback institutions, especially unemployment transfers. But they are embedded inside a stronger positive-feedback complex:

`firm stress / output contraction`
`-> unemployment rises`
`-> hires fall and layoffs rise`
`-> consumption falls`
`-> investment falls`
`-> government demand does not compensate`
`-> private credit does not compensate`
`-> exits exceed effective replacement`
`-> productive and employment capacity erodes further`

This supports the ecosystem interpretation: the problem is not that every subsystem is absent. The problem is that stabilizing subsystems are too weak, mistimed, incomplete, or themselves procyclical relative to the destabilizing loops.

## Hypothesis verdicts

- **H-BD-1: the current economy has strong endogenous stabilizers sufficient to reverse ordinary contractions** — **FALSIFIED**.
- **H-BD-2: unemployment transfers are directionally countercyclical** — **SUPPORTED**.
- **H-BD-3: government demand provides a reliable countercyclical floor** — **NOT SUPPORTED; diagnostic evidence is procyclical around contraction events**.
- **H-BD-4: private credit expands materially during stress** — **FALSIFIED**.
- **H-BD-5: firm entry quantitatively replaces firm exit** — **FALSIFIED**.
- **H-BD-6: labor adjustment contains a strong destabilizing feedback during collapse** — **STRONGLY SUPPORTED**.

## Next causal test

Observational signs do not establish causal magnitude. The next step is a removal-ablation panel that separately disables existing stabilizer channels without introducing new policy parameters:

- automatic transfers
- government final demand
- new private credit
- combinations of the above

If removing a channel materially worsens the economy, that channel is genuinely stabilizing but insufficient. If removing it improves the economy or has negligible effect, the institutional mechanism is either weak, mistimed, crowded out, or structurally mis-specified.

No production repair is authorized from R4-BD alone.

## Evidence

`economic-lab/diagnostics/reality-validation/evidence/WP-RV08_R4_BD_ENDOGENOUS_FEEDBACK_COMPACT_2026-08-22.csv`
