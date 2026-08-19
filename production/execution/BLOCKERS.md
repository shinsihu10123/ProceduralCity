# Execution Blockers

No project-wide blocker is active.

## Admission holds

An unfinished WP is an **admission hold**, not a BLOCKED verdict, when one or more Frozen hard predecessors are not yet PASS/CLOSED. The controller derives these holds from the Frozen graph on every dry-run and does not persist invented blocker states.

## Hard stop conditions

The worker must fail closed when any of the following occurs:

- Frozen authority/version mismatch or malformed graph projection;
- state/schema/ledger inconsistency;
- hard predecessor not PASS/CLOSED;
- a hard predecessor is explicitly BLOCKED;
- another WP is already active under the single-worker controller;
- correction cycle exceeds the configured limit (`2`);
- Architecture/WBS/Dependency/Frozen Week semantic change would be required;
- destructive or authority-changing operation requires approval;
- automation mechanism is unverified while autonomous execution is requested.
