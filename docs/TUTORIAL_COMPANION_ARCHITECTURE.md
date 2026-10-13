# Spec: RL Field Guide Companion Lab Architecture

## Objective

Turn this repository into the runnable companion to the sibling `rl-guide` course. Each experiment must answer one course question through the same evidence-first loop used by the guide:

`predict -> run -> inspect numeric evidence -> explain -> transfer`

The refactor must reduce duplicate sources of truth and shared infrastructure without changing the physics, rewards, trained-model formats, or runtime semantics of an existing experiment.

## Authoritative sources and assumptions

- `D:\workspace\reinforcement-learning\rl-guide\src\content\curriculum.ts` is the authority for chapter slugs, titles, purposes, and prerequisites.
- The guide stays an independent English reading product. This repository stays a Chinese interactive laboratory and links to the exact English chapter it accompanies.
- The guide repository is read-only for this work because it currently contains unrelated user changes.
- `design.md` remains the visual authority: scientific-instrument hierarchy, one amber accent, 12px panels, 8px controls, dense evidence, and one page `h1`.
- The user's prior autonomous-upgrade instruction is the design gate for this refactor; no intermediate approval is required.

## Companion map

| Experiment | Algorithm | Primary guide chapter | What the experiment proves |
| --- | --- | --- | --- |
| Q-learning canyon | Q-learning | `tabular-control` | behavior/target separation and one inspectable TD backup |
| DQN single car | DQN | `dqn` | replay, target networks, terminal masks, and function approximation |
| TD3 city fleet | TD3 | `distributed-rl` | actor/learner separation, shared inference, replay, and policy staleness boundaries |
| TD3 subject 2 | TD3 | `reward-design` | continuous control under process rewards, constraints, and specification-gaming risks |

The continuous-control chapter is a prerequisite for both TD3 experiments.

## Architecture

```text
experiment-catalog.ts (one source of truth)
  ├─ AppShell navigation
  ├─ CompanionLearningPanel
  ├─ route parser and page title
  └─ algorithm roadmap

rl/replay-buffer.ts (one generic implementation)
  ├─ DQN training runtime
  ├─ TD3 fleet runtime
  └─ TD3 subject-2 runtime

experiment runtime evidence
  └─ environment -> policy -> update -> evidence -> teaching UI
```

The catalog owns navigation copy, algorithm identity, course chapter, prediction prompt, evidence checklist, formula explanation, transfer prompt, and experiment-specific boundaries. Components render it; they do not duplicate it.

## Display contract

Every experiment page must expose:

1. A prediction question before symbolic explanation.
2. A clear instruction for what action to run.
3. Named numeric signals to inspect in the live experiment.
4. Formula and mechanism explanations connected to those signals.
5. A transfer question and a boundary/counterexample.
6. A direct link to the matching RL Field Guide chapter.

Runtime-specific panels may add richer diagnostics, but may not redefine the core algorithm or tutorial mapping.

## Project structure

- `src/catalog/` — experiment metadata and companion-course mapping.
- `src/rl/` — reusable algorithm infrastructure independent of a single environment.
- `src/simulation/` — reusable geometry and simulation primitives.
- `src/driving/` — city/single-car domain environments and evidence.
- `src/subject2/` — subject-2 scenarios, rules, physics, and evidence.
- `src/components/learning/` — reusable teaching-loop presentation.
- `src/components/driving/` and `src/components/subject2/` — domain-specific views only.

## Commands

- Focused tests: `npm test -- --run <test files>`
- Full tests: `npm test -- --run`
- Lint: `npm run lint`
- Production build: `npm run build`
- Pages-compatible build: `$env:VITE_BASE_PATH='/rl-training-lab/'; npm run build`

## Testing strategy

- Catalog tests prove every runnable experiment has a valid route, unique ID, five-stage teaching contract, course link, prediction, evidence, formula, transfer, and boundary.
- Component tests prove prediction gates the explanation and every experiment shows the correct guide chapter.
- Generic replay tests cover scalar and object actions, capacity, immutable snapshots, sampling without replacement, and invalid inputs.
- Existing environment, physics, algorithm, worker, model-storage, and navigation tests remain unchanged wherever behavior is only refactored.
- Full lint, test, production build, Pages CI, and public-browser route checks gate publication.

## Boundaries

- Always: preserve learner-owned `src/exercise/update-q-value.ts`; keep physics/reward truth in environments; keep tutorial claims traceable to live runtime evidence.
- Ask first: none for in-repository reversible refactors covered by the autonomous-upgrade instruction.
- Never: edit the dirty `rl-guide` worktree; duplicate guide prose wholesale; label convergence or safety as verified without an evaluation report; couple React rendering cadence to training cadence.

## Success criteria

- One experiment catalog replaces separate active-lab and active-algorithm metadata.
- One generic replay buffer replaces discrete and continuous copies.
- All four runnable experiments implement the companion display contract and link to their exact guide chapters.
- Obsolete duplicate files/imports are removed, with no compatibility wrappers left behind.
- Tests, lint, production build, GitHub Pages pipeline, and public-browser checks pass.
- The resulting source tree communicates reusable platform boundaries more clearly than the current domain-by-domain accumulation.
