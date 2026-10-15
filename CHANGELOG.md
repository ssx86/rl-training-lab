# Changelog

## 1.2.0 — 2026-10-15

### Fixed

- Replaced the two-second stationary failure with a twelve-second measurable-
  progress watchdog, while preserving immediate collision and out-of-bounds
  termination.
- Rebalanced progress, clearance, inactivity, pass, timeout, and no-progress
  rewards so stationary avoidance cannot dominate the driving objective.

### Changed

- Expanded Subject 2 observations from 48 to 57 values with explicit project
  and public process-stage encodings. Version 1 checkpoints are detected but
  intentionally not loaded into the incompatible network shape.
- Added motion-aware, shorter-hold warm-up exploration for every project and
  project-stratified replay sampling for the shared TD3 model.
- Added persistent terminal-reason counters and a normalized 0–100% process-
  completion curve to the training page.

### Verification

- 217 automated tests across 52 files, plus focused convergence sampling.
- ESLint, TypeScript, and the GitHub Pages production build.

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

