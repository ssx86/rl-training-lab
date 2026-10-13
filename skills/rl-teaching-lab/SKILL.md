---
name: rl-teaching-lab
description: Extend this reinforcement-learning teaching lab with a tabular or continuous-control algorithm while preserving observable update evidence, physical-scale coherence, runtime performance, and the project design system.
---

# RL Teaching Lab

Use this skill when adding or revising an RL lesson in this repository. Read `design.md` and `docs/RL_LAB_METHOD.md` before changing code.

## Teaching contract

Start from one question the learner should be able to answer after a single step. Define the algorithm-specific intermediate signals that make the answer observable. Register the lesson and its `requiredSignals` in `src/catalog/experiment-catalog.ts` (the single catalog since the 1.1.0 companion refactor; it replaced the earlier `algorithm-catalog.ts`); do not mark it `active` until the strategy, UI evidence, and tests are connected.

Implement update semantics behind `LearningStrategy` in `src/domain/learning-strategy.ts`. Keep environment transitions, action selection, value updates, and presentation separate. The UI must consume strategy results rather than recompute the formula.

## Environment and rewards

Treat rewards as an ordered teaching signal:

```text
goal > ordinary movement > costly terrain > invalid action > catastrophe
```

After changing a map or reward, prove that the goal is reachable, at least one intended alternative route exists, invalid actions leave the state consistent, and a reasonable shortest safe path has the intended return sign. Explain every exceptional reward with a named environment event.

## Observation design

Preserve three time scales:

- Single step: state, action source, reward reason, target, error, and new value.
- Current episode: path, visits, collisions, falls, steps, and cumulative return.
- Across episodes: return, length, success, exploration, and policy shape.

Keep the spatial overview legible. Put exact values in the selected-state inspector instead of packing all values into every map cell. Follow the amber-only emphasis, typography, spacing, motion, and accessibility rules in `design.md`.

## Continuous-control mode

Use one explicit world-unit system across map import, vehicle physics, sensors, collisions, rewards, and camera projection. Keep overview zoom purely visual. Run accelerated training in a Worker and publish only recent snapshots; use RAF for render cadence so 15/30/60 FPS never changes environment steps.

Do not force a naturally continuous actuator into a small Cartesian product of discrete buttons. For steering and pedals, define bounded continuous outputs such as `steer [-1,1]` and `throttle [-1,1]`, select an algorithm that natively supports them (TD3, SAC, or continuous PPO), and test proportional control plus clamping. DQN may remain only as an explicitly labelled discrete baseline.

Treat radar as a fixed angular grid with independent semantic distance channels. A vehicle, road edge, structure, and destination in the same sector must not overwrite one another. Keep a fixed-length grid for the policy and a separate variable-length detection list for human inspection; display metres and bearing for each visible detection.

For a shared multi-actor policy, designate exactly one learner at a time. Only that actor writes transitions and updates weights; all actors infer from the latest shared actor weights. Rotate learner ownership by environment steps and test the boundary. Continue taxi-style tasks by assigning a new reachable destination after arrival without clearing model, Replay, or global counters.

Keep exactly one learner at a time and rotate it across the complete traffic fleet. Other vehicles are dynamic, detectable, collidable traffic participants using the current shared actor, not a separate observer pool. Allow vehicles to be added or removed without recreating the policy, Replay, optimizer counters, or existing orders, and test that resize preserves step/update/replay evidence.

Generate directional lane-centre routes rather than driving every actor on the road centreline. Separate opposing traffic, respect one-way and roundabout direction, and use oriented vehicle bodies for collision detection so adjacent lanes do not produce false crashes.

Audit the do-nothing baseline over the full episode horizon. Do not reward raw speed merely to prevent parking; penalize lack of new route progress and add a named stalled termination with an early reset when inactivity persists. Test that productive progress beats idling, the idle horizon is materially negative, and stalled episodes end before the generic timeout.

Model collisions as named environment events with a severe reward, a visible temporary blockage, a deterministic recovery duration, and a valid separated respawn. Project the driver view from planned-route geometry; a fixed decorative road is not evidence of following curves or roundabouts.

Prefer several fixed, attributed, connectivity-checked real maps over an unverified random generator. Precompute imported map assets and cache route queries used by both training and rendering.

## Acceptance

Add deterministic tests for the new update semantics and environment boundaries. Run tests, production build, and lint. Verify the actual browser at desktop and 390px mobile widths. For continuous control, also verify bounded proportional actions, actor/critic losses, exploration noise removal in inference, multi-channel radar shape, MAX throughput, RAF speed changes, train-to-inference continuity, frozen Replay during inference, learner rotation, map scale, and route-aware driver perspective. If browser verification is unavailable, report that gap rather than converting component tests into browser evidence.

Preserve honest status labels: implemented, automated-test verified, browser verified, and merely planned are different states.
