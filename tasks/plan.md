# Implementation Plan: Subject 2 convergence and termination repair

## Dependency order

1. Replace the two-second stationary failure with measured no-progress protection; rebalance terminal rewards and verify environment semantics.
2. Add project/stage model context, motion-aware warm-up exploration, project-balanced replay, normalized process completion, and checkpoint v2.
3. Add persistent termination telemetry and process-completion visualization without overlays.
4. Run the full quality gates, release, deploy, and verify the real browser runtime.

## Verification checkpoints

- Environment checkpoint: focused physics, termination, and reward tests pass.
- Runtime checkpoint: observation, exploration, replay, telemetry, and storage tests pass.
- UI checkpoint: component tests and browser inspection prove persistent evidence without an overlay.
- Release checkpoint: all tests, lint, build, CI, and public-browser checks pass.

