import type { RuntimeEnvelope, RuntimeMode } from "../domain/environment-adapter";
import { DRIVING_SCHEMA_VERSION } from "../driving/types";
import type { CurriculumLevel } from "../driving/curriculum";
import type { EvaluationReport } from "../driving/evaluator";
import type { SerializedDqnModel } from "../driving/model-format";

export type TrainerWorkerMode = RuntimeMode;
export type TrainerStatus = "idle" | "running" | "paused" | "complete" | "error";

export type DrivingTrainerCommand =
  | { type: "start"; mode: TrainerWorkerMode; level: CurriculumLevel; seed?: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "step" }
  | { type: "reset"; level: CurriculumLevel; seed?: number }
  | { type: "export-model" }
  | { type: "import-model"; model: SerializedDqnModel; level: CurriculumLevel; seed?: number }
  | { type: "evaluate"; level: CurriculumLevel; seed?: number; fixedSeeds: number[]; unseenSeeds: number[] }
  | { type: "dispose" };

export type TrainerPayload =
  | { type: "status"; status: TrainerStatus }
  | { type: "snapshot"; snapshot: unknown }
  | { type: "model"; model: SerializedDqnModel }
  | { type: "evaluation-report"; report: EvaluationReport }
  | { type: "error"; message: string };

export function createTrainerEnvelope<Payload extends TrainerPayload>(
  mode: TrainerWorkerMode,
  sequence: number,
  payload: Payload,
): RuntimeEnvelope<Payload> {
  return {
    schemaVersion: DRIVING_SCHEMA_VERSION,
    mode,
    sequence,
    payload,
  };
}

export function isDrivingTrainerCommand(value: unknown): value is DrivingTrainerCommand {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const command = value as Record<string, unknown>;
  if (command.type === "start") {
    return (
      (command.mode === "training" || command.mode === "evaluation") &&
      ["L1", "L2", "L3"].includes(String(command.level))
    );
  }
  return ["pause", "resume", "step", "reset", "export-model", "import-model", "evaluate", "dispose"].includes(
    String(command.type),
  );
}

export function commandRequiresRuntime(command: DrivingTrainerCommand): boolean {
  return command.type === "resume" || command.type === "step" || command.type === "export-model";
}
