import type { Subject2Mode, Subject2RuntimeCheckpoint, Subject2Snapshot, Subject2TrainingScope } from "@/subject2/subject2-runtime";
import type { Subject2Project } from "@/subject2/subject2-course";

export type Subject2TrainingSpeed = 1 | 4 | 16 | "max";
export interface Subject2RuntimeMetrics { readonly backend: string; readonly stepsPerSecond: number }

export function subject2Cadence(speed: Subject2TrainingSpeed): { stepsPerBatch: number; delayMs: number } {
  if (speed === "max") return { stepsPerBatch: 16, delayMs: 0 };
  if (speed === 16) return { stepsPerBatch: 2, delayMs: 12.5 };
  return { stepsPerBatch: 1, delayMs: 100 / speed };
}

export function shouldAutoCheckpoint(lastSavedStep: number, currentStep: number, interval = 1_000): boolean {
  return currentStep - lastSavedStep >= interval;
}

export type Subject2Command =
  | { type: "start"; mode: Subject2Mode; speed: Subject2TrainingSpeed; seed: number; checkpoint?: Subject2RuntimeCheckpoint; run?: boolean }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "set-mode"; mode: Subject2Mode }
  | { type: "set-speed"; speed: Subject2TrainingSpeed }
  | { type: "set-training-selection"; scope: Subject2TrainingScope; project: Subject2Project }
  | { type: "request-checkpoint" }
  | { type: "load-checkpoint"; checkpoint: Subject2RuntimeCheckpoint }
  | { type: "dispose" };

export type Subject2Payload =
  | { type: "status"; status: "idle" | "running" | "paused" | "error" }
  | { type: "snapshot"; snapshot: Subject2Snapshot; metrics: Subject2RuntimeMetrics }
  | { type: "checkpoint"; checkpoint: Subject2RuntimeCheckpoint; savedAt: string; reason: "auto" | "manual" | "pause" }
  | { type: "error"; message: string };

export interface Subject2Envelope {
  readonly schemaVersion: "subject2-v1";
  readonly sequence: number;
  readonly payload: Subject2Payload;
}
