# Changelog

## 1.3.0 — 2026-10-15

### Added

- Added five-subject rotation and single-subject training scopes. Both use the
  same TD3 model and replay memory, and can be switched without recording a
  failed attempt or clearing learned state.
- Added exact oriented vehicle/bay intersection measurement and an incremental
  body-overlap reward that cannot be farmed by standing still.

### Changed

- Simplified reverse parking to one visible final bay goal and a stationary,
  path-verified ready-to-reverse start. Distance, heading, and body overlap now
  provide continuous feedback before legal full containment ends the attempt.
- Updated the training controls, reward chart, live reward ledger, and theory
  explanation to expose the active curriculum and its actual scoring terms.

### Verification

- 225 automated tests across 52 files, including geometry, reward, runtime,
  worker protocol, checkpoint compatibility, and React interaction coverage.
- ESLint, TypeScript, GitHub Pages production build, dependency audit, and a
  real-browser smoke test of pre-start selection and focused training.

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

