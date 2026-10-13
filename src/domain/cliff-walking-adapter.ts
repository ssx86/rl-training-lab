import {
  CliffWalkingEnvironment,
  type Action,
  type Transition,
  type TransitionEvent,
} from "./cliff-walking";
import type {
  EnvironmentAdapter,
  EnvironmentStep,
} from "./environment-adapter";

export interface CliffEnvironmentStep
  extends Transition,
    EnvironmentStep<number, Action, TransitionEvent> {}

export class CliffWalkingAdapter
  implements EnvironmentAdapter<number, Action, TransitionEvent>
{
  readonly id = "canyon-navigation";
  readonly schemaVersion = "cliff-walking-v2";
  private readonly environment = new CliffWalkingEnvironment();
  private stepIndex = 0;

  get state(): number {
    return this.environment.position.state;
  }

  reset(seed?: number): number {
    void seed;
    this.stepIndex = 0;
    return this.environment.reset().state;
  }

  step(action: Action): CliffEnvironmentStep {
    const transition = this.environment.step(action);
    this.stepIndex += 1;
    return {
      ...transition,
      observation: transition.state,
      nextObservation: transition.nextState,
      rewardBreakdown: { step: transition.reward },
      stepIndex: this.stepIndex,
    };
  }
}
