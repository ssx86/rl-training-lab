import type { FleetMode, SharedFleetSnapshot } from "../driving/shared-fleet-runtime";

export type TrainingSpeed = 1 | 4 | 16 | "max";
export type PlaybackRate = 0.5 | 1 | 2 | 4;

export interface FleetRuntimeMetrics {
  readonly backend: string;
  readonly stepsPerSecond: number;
}

export type FleetCommand =
  | { type: "start"; mode: FleetMode; cityId: string; seed: number; vehicleCount: number; rotationEvery: number; trainingSpeed: TrainingSpeed; playbackRate: PlaybackRate }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "set-mode"; mode: FleetMode }
  | { type: "set-training-speed"; speed: TrainingSpeed }
  | { type: "set-playback-rate"; rate: PlaybackRate }
  | { type: "resize-fleet"; vehicleCount: number }
  | { type: "dispose" };

export type FleetPayload =
  | { type: "status"; status: "idle" | "running" | "paused" | "error" }
  | { type: "snapshot"; snapshot: SharedFleetSnapshot; metrics: FleetRuntimeMetrics }
  | { type: "error"; message: string };

export interface FleetEnvelope {
  readonly schemaVersion: "fleet-v2";
  readonly sequence: number;
  readonly payload: FleetPayload;
}
