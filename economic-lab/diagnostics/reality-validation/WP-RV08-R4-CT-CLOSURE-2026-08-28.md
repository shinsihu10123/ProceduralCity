# WP-RV08 R4-CT Closure — Economic Semantic Anchor Register

Date: 2026-08-28
Authoritative branch: `scratch/new-project-2026-08-12`
Authoritative run: `33166341581`
Run head: `0a55679ac405d2c86218e8b55b2d7b75ad7bd79d`

## Verdict

**CLOSED / PASS / SEMANTIC CONTRACT VALIDATED / CANONICAL MUTATION NOT AUTHORIZED**

R4-CT converted the unresolved economic unit problem into an explicit semantic-anchor contract and machine-readable register. The authoritative GitHub Actions gate completed successfully, including the final beacon.

## Gate evidence

`WP_RV08_R4_CT_GATES`:

- schemaPresent: true
- canonicalMutationLocked: true
- allRequiredAnchorsPresent: true
- uniqueAnchorIds: true
- dimensionsExplicit: true
- kindsExplicit: true
- targetStatusesValid: true
- dependenciesResolved: true
- silentRescalingBlocked: true
- sectorBlindNormalizationBlocked: true
- allFourSectorsPresent: true
- prohibitedShortcutsPresent: true
- unresolvedNotFabricated: true
- ok: true

## Register state

19 anchors are registered:

- INTERNAL_INVARIANT: 3
- REPOSITORY_SUPPORTED: 3
- EXTERNAL_EMPIRICAL_REQUIRED: 8
- UNRESOLVED: 4
- DERIVED_AFTER_ANCHORS: 1

Unresolved or external-evidence-dependent anchors are A2, A3, B1, B2, C1, C2, C3, C4, D1, D2, E1, E2.

Repository-supported anchors are F1, F2, F3. Internal invariants are A1, B3, D3.

## Economic interpretation

R4-CS showed that the remaining defect is not sector-blind. R4-CT therefore forbids choosing a repair magnitude merely because it numerically closes an internal gap. A candidate canonical repair must first have a defensible economic meaning and, where required, an empirical target.

In particular, the following remain prohibited without a target contract:

- dividing wages by an arbitrary common factor;
- multiplying all prices by an arbitrary common factor;
- multiplying output/productivity by an arbitrary common factor;
- applying a sector multiplier solely to flatten RULC dispersion;
- reducing consumption budgets solely to match simulated supply;
- interpreting an internal accounting ratio as a real-world calibration target without evidence.

## Next front

Proceed to R4-CU: **Empirical Anchor Target Protocol and Evidence Register**.

R4-CU must define how external targets are admitted before any live calibration occurs. It must separate empirical observations from model mappings, preserve provenance, specify time basis and units, and require ranges/uncertainty rather than false point precision where appropriate.

No canonical economic mutation is authorized by this closure.