/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- Worker snapshots are coordinated through refs. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createCurriculumMap, type CurriculumLevel } from "@/driving/curriculum";
import { DrivingEnvironment } from "@/driving/driving-environment";
import type {
  TrainingStepEvidence,
} from "@/driving/training-runtime";
import type { DrivingObservation } from "@/driving/types";
import type { VehicleState } from "@/driving/vehicle-model";
import type {
  DrivingTrainerCommand,
  TrainerPayload,
  TrainerStatus,
} from "@/workers/driving-trainer-protocol";
import { DRIVING_SCHEMA_VERSION } from "@/driving/types";
import type { EvaluationReport } from "@/driving/evaluator";
import type { SerializedDqnModel } from "@/driving/model-format";

export type DrivingLabMode = "training" | "evaluation";

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../workers/driving-trainer.ts", import.meta.url), {
    type: "module",
  });
}

export function useDrivingLab() {
  const [mode, setModeState] = useState<DrivingLabMode>("training");
  const [level, setLevelState] = useState<CurriculumLevel>("L1");
  const [seed, setSeedState] = useState(1);
  const selectedMap = useMemo(() => createCurriculumMap(level, seed), [level, seed]);
  const [map, setMap] = useState(selectedMap);
  const environmentRef = useRef(new DrivingEnvironment(selectedMap));
  const workerRef = useRef<Worker | null>(null);
  const [observation, setObservation] = useState<DrivingObservation>(() =>
    environmentRef.current.reset(seed),
  );
  const [vehicle, setVehicle] = useState<VehicleState>(() =>
    environmentRef.current.snapshot(),
  );
  const [evidence, setEvidence] = useState<TrainingStepEvidence | null>(null);
  const [status, setStatus] = useState<TrainerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [evaluationReport, setEvaluationReport] = useState<EvaluationReport | null>(null);

  const resetLocal = useCallback(() => {
    const nextEnvironment = new DrivingEnvironment(selectedMap);
    environmentRef.current = nextEnvironment;
    setMap(selectedMap);
    setObservation(nextEnvironment.reset(seed));
    setVehicle(nextEnvironment.snapshot());
    setEvidence(null);
    setStatus("idle");
    setError(null);
  }, [selectedMap, seed]);

  useEffect(() => {
    resetLocal();
    workerRef.current?.postMessage({
      type: "reset",
      level,
      seed,
    } satisfies DrivingTrainerCommand);
  }, [level, resetLocal, seed]);

  useEffect(() => {
    const worker = createWorker();
    workerRef.current = worker;
    if (!worker) return;
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const envelope = event.data as {
        schemaVersion?: string;
        payload?: TrainerPayload;
      };
      if (envelope.schemaVersion !== DRIVING_SCHEMA_VERSION || !envelope.payload) {
        setError("训练 Worker 返回了不兼容的数据版本。");
        setStatus("error");
        return;
      }
      if (envelope.payload.type === "status") {
        setStatus(envelope.payload.status);
      } else if (envelope.payload.type === "error") {
        setError(envelope.payload.message);
        setStatus("error");
      } else if (envelope.payload.type === "snapshot") {
        const snapshot = envelope.payload.snapshot as TrainingStepEvidence;
        setEvidence(snapshot);
        setObservation(snapshot.transition.nextObservation);
        setVehicle(snapshot.vehicle);
        setMap(snapshot.map);
        setStatus(snapshot.status);
      } else if (envelope.payload.type === "evaluation-report") {
        setEvaluationReport(envelope.payload.report);
      } else if (envelope.payload.type === "model") {
        const blob = new Blob([JSON.stringify(envelope.payload.model, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `driving-dqn-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    });
    return () => {
      worker.postMessage({ type: "dispose" } satisfies DrivingTrainerCommand);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const stepOnce = useCallback(() => {
    workerRef.current?.postMessage({ type: "step" } satisfies DrivingTrainerCommand);
  }, []);

  const toggleRunning = useCallback(() => {
    if (status === "running") {
      workerRef.current?.postMessage({ type: "pause" } satisfies DrivingTrainerCommand);
      setStatus("paused");
      return;
    }
    if (status === "complete" || status === "error") resetLocal();
    if (mode === "evaluation") {
      setEvaluationReport(null);
      workerRef.current?.postMessage({ type: "evaluate", level, seed, fixedSeeds: Array.from({ length: 20 }, (_, index) => index + 1), unseenSeeds: Array.from({ length: 20 }, (_, index) => index + 1001) } satisfies DrivingTrainerCommand);
      setStatus("running");
      return;
    }
    const command: DrivingTrainerCommand = status === "paused" ? { type: "resume" } : { type: "start", mode, level, seed };
    workerRef.current?.postMessage(command);
    setStatus("running");
  }, [level, mode, resetLocal, seed, status]);

  const setMode = useCallback((nextMode: DrivingLabMode) => {
    workerRef.current?.postMessage({ type: "pause" } satisfies DrivingTrainerCommand);
    setModeState(nextMode);
    setStatus("idle");
    setEvidence(null);
    setEvaluationReport(null);
  }, []);

  const exportModel = useCallback(() => {
    workerRef.current?.postMessage({ type: "export-model" } satisfies DrivingTrainerCommand);
  }, []);

  const importModel = useCallback(async (file: File) => {
    try {
      const model = JSON.parse(await file.text()) as SerializedDqnModel;
      workerRef.current?.postMessage({
        type: "import-model",
        model,
        level,
        seed,
      } satisfies DrivingTrainerCommand);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模型文件无法读取。");
      setStatus("error");
    }
  }, [level, seed]);

  const setLevel = useCallback((nextLevel: CurriculumLevel) => {
    setLevelState(nextLevel);
  }, []);

  const setSeed = useCallback((nextSeed: number) => {
    setSeedState(Math.max(1, Math.floor(nextSeed)));
  }, []);

  return {
    mode,
    level,
    seed,
    map,
    observation,
    vehicle,
    evidence,
    status,
    error,
    evaluationReport,
    setMode,
    setLevel,
    setSeed,
    stepOnce,
    toggleRunning,
    exportModel,
    importModel,
    reset: () => {
      resetLocal();
      workerRef.current?.postMessage({
        type: "reset",
        level,
        seed,
      } satisfies DrivingTrainerCommand);
    },
  };
}
