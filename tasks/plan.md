# Implementation Plan: RL Field Guide Companion Refactor

## Dependency order

1. Freeze the guide-to-lab contract in `docs/TUTORIAL_COMPANION_ARCHITECTURE.md`.
2. Add failing catalog and generic replay tests.
3. Replace the active lab/algorithm registries with one experiment catalog.
4. Replace both replay implementations with one generic RL primitive.
5. Build one reusable companion learning panel and attach it to all four experiments.
6. Audit remaining hooks, worker protocols, evidence panels, and obsolete files for the next consolidation slice.
7. Run full regression, publish, and verify every public route.

## Risks and controls

- Tutorial drift: store exact chapter slugs and titles in one tested catalog.
- Hidden behavior change: preserve existing runtime tests and separate metadata/refactor commits from later behavioral work.
- Over-generalization: share algorithms and transport primitives, not domain-specific physics or reward rules.
- Dirty sibling repository: read only; never import generated files or modify its working tree.
- Large refactor ambiguity: require deletion of replaced files and import searches that prove no legacy path remains.

## Verification checkpoints

- Catalog checkpoint: focused tests prove all four companion contracts.
- Infrastructure checkpoint: replay tests and DQN/TD3 runtime tests pass.
- UI checkpoint: navigation plus learning-panel component tests pass.
- Release checkpoint: all tests, lint, build, CI, and real public-browser checks pass.
