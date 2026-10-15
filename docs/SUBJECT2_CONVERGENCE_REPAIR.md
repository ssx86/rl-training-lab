# Spec: Subject 2 convergence and termination observability

## Objective

Make Subject 2 training produce useful driving experience instead of rapidly
restarting on two seconds of stationary behavior, and make every restart and
learning outcome visible without an overlay. The same shared TD3 model must
learn all five fixed exam projects with explicit project/process context and
balanced replay.

## Tech stack and commands

- React 19, TypeScript, Tailwind CSS, shadcn/ui, TensorFlow.js TD3, Web Worker.
- Focused tests: `npm test -- --run <test files>`
- Full tests: `npm test -- --run`
- Lint: `npm run lint`
- Pages build: `$env:VITE_BASE_PATH='/rl-training-lab/'; npm run build`

## Design decisions

1. Replace the stationary timer with a 12-second no-progress watchdog. A
   meaningful reduction in the current public process error resets the timer;
   legal ramp holding and launch windows are exempt.
2. Keep the final goal as the only rendered target. Add five project one-hot
   values and four public process-stage one-hot values to the model observation.
3. Warm-up exploration follows the required motion most of the time, uses
   shorter 400ms action holds, and still includes braking and opposite-motion
   samples.
4. Store replay in five project buckets and sample batches as evenly as current
   bucket contents allow.
5. Make collision and out-of-bounds the strongest ordinary terminal penalties;
   no-progress is recoverable and therefore less severe. Reduce the centered
   vehicle's false clearance pressure.
6. Persistently show the latest terminal reason and all reason counts. Add a
   0–100% process-completion line derived from normalized completed conditions
   per attempt.
7. The observation shape changes, so checkpoints move to version 2. A detected
   version-1 browser checkpoint is reported as incompatible instead of silently
   imported.

## Testing strategy

- Environment tests prove stationary behavior no longer terminates at two
  seconds and true lack of progress terminates at twelve seconds.
- Runtime tests prove motion-aware exploration, project/stage observation,
  balanced replay, terminal counts, normalized process completion, and
  checkpoint compatibility.
- Component tests prove persistent non-overlay diagnostics and the completion
  curve are rendered.
- Full unit, lint, production build, and real-browser checks gate release.

## Boundaries

- Always: preserve automatic transmission physics and fixed regulatory maps.
- Always: render only the final target; process stages remain textual evidence.
- Never: add scripted steering, a hidden route, or manual driving controls.
- Never: silently coerce 48-dimensional model weights into the new model.
- No new dependency is required.

## Success criteria

- Two seconds stationary does not end training; twelve seconds without process
  improvement does.
- Every restart has a visible persistent reason and cumulative count.
- Warm-up produces predominantly useful required-direction movement.
- Model input explicitly contains project and public process-stage identity.
- Every non-empty project replay bucket contributes to training batches.
- Terminal rewards have a documented safe ordering and the UI plots normalized
  process completion from 0–100%.
- Tests, lint, Pages build, deployment, and browser verification pass.
