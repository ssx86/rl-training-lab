# Subject 2 single-goal curriculum

## Problem

The reverse-parking lesson currently asks an untrained continuous-control policy to discover a four-stage procedure. The least likely transition is also mandatory: after driving through a control area, the policy must brake, select reverse, and turn toward a new target. Sparse checkpoint rewards make that transition hard to discover and slow convergence without teaching the intended parking skill more clearly.

## Confirmed interaction design

- A reverse-parking attempt starts stationary in a legal, inspectable ready-to-reverse pose.
- The parking bay is the only goal. There are no route waypoints or hidden steering hints.
- Every step can earn or lose shaped reward from changes in distance, heading alignment, and actual vehicle-body overlap with the bay.
- Only complete containment, legal heading, low speed, and reverse arrival count as success.
- The shared TD3 model and replay memory are never reset by changing the training scope.
- `五项轮换` keeps the existing curriculum: switch subject after 100 completed attempts.
- `单项专训` repeatedly trains the selected subject with no automatic switch.

## Reward contract

The dense terms reward improvement, not state occupancy. This prevents a stationary vehicle from farming reward near the bay.

```text
r_t = pose_progress + overlap_progress + event_rewards - safety_costs

pose_progress    = k_pose * (Phi_pose(s_{t+1}) - Phi_pose(s_t))
overlap_progress = k_overlap * (overlap(s_{t+1}) - overlap(s_t))
```

`overlap` is the exact intersection area between the oriented vehicle rectangle and parking-bay rectangle, divided by vehicle body area. It ranges from 0 to 1. The terminal pass remains a much larger event reward than dense shaping.

## Compatibility

The observation vector and network shapes remain unchanged. Existing checkpoint version 2 weights and replay samples therefore remain loadable. New training-scope metadata is optional on restore and defaults to five-subject rotation.

## Acceptance criteria

1. Reverse parking exposes one reverse-motion containment checkpoint and starts from a feasible ready-to-reverse pose.
2. Partial bay entry produces reward only when overlap improves; unchanged overlap produces no overlap reward.
3. Full containment with legal pose ends the attempt as passed.
4. Rotation still changes subject after 100 attempts.
5. Single-subject mode remains on the selected subject past 100 attempts.
6. Switching scope or subject preserves model/replay state and does not record a failed attempt.
7. The page explains the active scope and dense reward terms without an overlay.
