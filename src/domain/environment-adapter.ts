export type RuntimeMode = "manual" | "scripted" | "training" | "evaluation";

export interface RuntimeEnvelope<Payload> {
  schemaVersion: string;
  mode: RuntimeMode;
  sequence: number;
  payload: Payload;
}

export interface EnvironmentStep<Observation, Action, Event = string> {
  observation: Observation;
  action: Action;
  reward: number;
  nextObservation: Observation;
  done: boolean;
  event: Event;
  rewardBreakdown: Readonly<Record<string, number>>;
  stepIndex: number;
}

export interface EnvironmentAdapter<Observation, Action, Event = string> {
  readonly id: string;
  readonly schemaVersion: string;
  reset(seed?: number): Observation;
  step(action: Action): EnvironmentStep<Observation, Action, Event>;
}
