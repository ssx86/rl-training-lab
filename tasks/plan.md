# Implementation Plan: Subject 2 single-goal curriculum

## Dependency order

1. Replace reverse parking's four-stage sparse procedure with one feasible reverse goal and overlap-based dense shaping.
2. Add persistent five-subject rotation and single-subject training scopes without resetting the shared model or replay.
3. Add compact training-scope controls and update the teaching explanation.
4. Run the full quality gates, release, deploy, and verify the real browser runtime.

## Verification checkpoints

- Environment checkpoint: scenario, overlap geometry, dense reward, and termination tests pass.
- Runtime checkpoint: rotation, single-subject persistence, protocol, and storage tests pass.
- UI checkpoint: component tests and browser inspection prove both scopes are understandable and operable.
- Release checkpoint: all tests, lint, build, CI, and public-browser checks pass.
