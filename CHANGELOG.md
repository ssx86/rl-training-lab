# Changelog

## 1.1.0 — 2026-10-13

### Added

- A shared, evidence-first learning panel for every experiment, following the
  `predict → run → inspect → explain → transfer` loop.
- Direct links from each runnable lab to its matching RL Field Guide chapter.
- One typed experiment catalog for navigation, teaching copy, formulas,
  evidence requirements, prerequisites, and transfer prompts.

### Changed

- Consolidated DQN, TD3, and Subject 2 experience storage into one reusable,
  typed replay buffer.
- Split TD3 configuration and explanatory metadata from the TensorFlow agent so
  teaching UI does not eagerly load the learning engine.
- Limited runtime modes to the product's supported training and evaluation
  workflows.

### Removed

- Duplicate replay-buffer implementations and superseded experiment catalogs.
- The unused legacy 2D driver projection, now replaced by the active 3D view.

### Verification

- 209 automated tests across 50 files.
- ESLint, TypeScript, GitHub Pages production build, and unused-file audit.

