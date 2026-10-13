import { useCallback, useEffect, useRef, useState } from "react";
import type { Subject2Mode, Subject2Snapshot } from "@/subject2/subject2-runtime";
import { loadSubject2Checkpoint, saveSubject2Checkpoint, type StoredSubject2Checkpoint } from "@/subject2/subject2-checkpoint-store";
import { interpolateSubject2Vehicle } from "@/subject2/subject2-display";
import type { Subject2VehicleState } from "@/subject2/subject2-vehicle";
import type { Subject2Command, Subject2Envelope, Subject2RuntimeMetrics, Subject2TrainingSpeed } from "@/workers/subject2-trainer-protocol";

export interface Subject2HistoryPoint {
  readonly step: number;
  readonly total: number;
  readonly progress: number;
  readonly task: number;
  readonly penalties: number;
  readonly throttle: number;
  readonly brake: number;
  readonly stopped: boolean;
}

export interface Subject2CheckpointInfo {
  readonly available: boolean;
  readonly savedAt: string | null;
  readonly step: number;
  readonly updates: number;
  readonly reason: "auto" | "manual" | "pause" | "existing" | null;
}

export function useSubject2Lab() {
  const workerRef = useRef<Worker | null>(null);
  const latestRef = useRef<Subject2Snapshot | null>(null);
  const renderedVehicleRef = useRef<Subject2VehicleState | null>(null);
  const transitionRef = useRef<{ from: Subject2VehicleState; to: Subject2VehicleState; startedAt: number; duration: number } | null>(null);
  const speedRef = useRef<Subject2TrainingSpeed>(1);
  const historyRef = useRef<Subject2HistoryPoint[]>([]);
  const lastHistoryStepRef = useRef(-1);
  const [initialCheckpoint] = useState<StoredSubject2Checkpoint | null>(() => loadSubject2Checkpoint());
  const storedCheckpointRef = useRef<StoredSubject2Checkpoint | null>(initialCheckpoint);
  const [snapshot, setSnapshot] = useState<Subject2Snapshot | null>(null);
  const [mode, setModeState] = useState<Subject2Mode>("training");
  const [speed, setSpeedState] = useState<Subject2TrainingSpeed>(1);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Subject2RuntimeMetrics>({ backend: "-", stepsPerSecond: 0 });
  const [rewardHistory, setRewardHistory] = useState<Subject2HistoryPoint[]>([]);
  const [checkpointInfo, setCheckpointInfo] = useState<Subject2CheckpointInfo>(() => initialCheckpoint
    ? { available: true, savedAt: initialCheckpoint.savedAt, step: initialCheckpoint.checkpoint.stepCount, updates: initialCheckpoint.checkpoint.updates, reason: "existing" }
    : { available: false, savedAt: null, step: 0, updates: 0, reason: null });
  const [restorePromptOpen, setRestorePromptOpen] = useState(Boolean(initialCheckpoint));
  const [checkpointError, setCheckpointError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../workers/subject2-trainer.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.addEventListener("message", (event: MessageEvent<Subject2Envelope>) => {
      const envelope = event.data;
      if (envelope.schemaVersion !== "subject2-v1") { setError("科目二 Worker 数据版本不兼容"); setStatus("error"); return; }
      if (envelope.payload.type === "snapshot") {
        const next = envelope.payload.snapshot;
        setModeState(next.mode);
        const previous = latestRef.current;
        const shouldSnap = !previous || previous.episode !== next.episode || previous.scenario.id !== next.scenario.id;
        const duration = speedRef.current === 1 ? 100 : speedRef.current === 4 ? 25 : 0;
        const from = shouldSnap ? next.vehicle : renderedVehicleRef.current ?? previous?.vehicle ?? next.vehicle;
        transitionRef.current = { from, to: next.vehicle, startedAt: performance.now(), duration };
        latestRef.current = next;
        if (next.step !== lastHistoryStepRef.current) {
          const reward = next.rewardBreakdown;
          const penalties = reward.timeCost + reward.inactivity + reward.wrongDirection + reward.unsafeSpeed
            + reward.controlSmoothness + reward.clearance + reward.collision + reward.outOfBounds
            + reward.rollback + reward.startTimeout + reward.stalled + reward.timeout;
          historyRef.current = [...historyRef.current, {
            step: next.step, total: next.reward, progress: reward.poseProgress + reward.stableHold,
            task: reward.checkpoint + reward.passBonus, penalties,
            throttle: next.vehicle.throttle, brake: next.vehicle.brake, stopped: Math.abs(next.vehicle.speed) < .08,
          }].slice(-180);
          lastHistoryStepRef.current = next.step;
        }
        setMetrics(envelope.payload.metrics);
      }
      else if (envelope.payload.type === "checkpoint") {
        const stored = { savedAt: envelope.payload.savedAt, checkpoint: envelope.payload.checkpoint } satisfies StoredSubject2Checkpoint;
        try {
          saveSubject2Checkpoint(stored);
          storedCheckpointRef.current = stored;
          setCheckpointInfo({ available: true, savedAt: stored.savedAt, step: stored.checkpoint.stepCount, updates: stored.checkpoint.updates, reason: envelope.payload.reason });
          setCheckpointError(null);
        } catch {
          setCheckpointError("浏览器本地空间不足，模型自动保存失败。请保留当前页面并清理本站存储空间。");
        }
      }
      else if (envelope.payload.type === "status") setStatus(envelope.payload.status);
      else { setError(envelope.payload.message); setStatus("error"); }
    });
    return () => { worker.postMessage({ type: "dispose" } satisfies Subject2Command); worker.terminate(); };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const render = (time: number) => {
      if (time - last >= 1000 / 30 && latestRef.current) {
        const transition = transitionRef.current;
        const progress = !transition || transition.duration === 0 ? 1 : (time - transition.startedAt) / transition.duration;
        const vehicle = transition ? interpolateSubject2Vehicle(transition.from, transition.to, progress) : latestRef.current.vehicle;
        renderedVehicleRef.current = vehicle;
        setSnapshot({ ...latestRef.current, vehicle });
        setRewardHistory(historyRef.current);
        last = time;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const start = useCallback(() => {
    setError(null);
    if (!snapshot || status === "error") {
      historyRef.current = []; lastHistoryStepRef.current = -1; setRewardHistory([]);
      workerRef.current?.postMessage({ type: "start", mode, speed, seed: 17 } satisfies Subject2Command);
    }
    else workerRef.current?.postMessage({ type: "resume" } satisfies Subject2Command);
    setStatus("running");
  }, [mode, snapshot, speed, status]);
  const pause = useCallback(() => { workerRef.current?.postMessage({ type: "pause" } satisfies Subject2Command); setStatus("paused"); }, []);
  const setMode = useCallback((next: Subject2Mode) => { setModeState(next); workerRef.current?.postMessage({ type: "set-mode", mode: next } satisfies Subject2Command); }, []);
  const setSpeed = useCallback((next: Subject2TrainingSpeed) => { speedRef.current = next; setSpeedState(next); workerRef.current?.postMessage({ type: "set-speed", speed: next } satisfies Subject2Command); }, []);

  const saveCheckpoint = useCallback(() => {
    if (!snapshot) return;
    workerRef.current?.postMessage({ type: "request-checkpoint" } satisfies Subject2Command);
  }, [snapshot]);

  const restoreCheckpoint = useCallback(() => {
    const stored = storedCheckpointRef.current;
    if (!stored) return;
    historyRef.current = []; lastHistoryStepRef.current = -1; setRewardHistory([]);
    setModeState(stored.checkpoint.mode);
    workerRef.current?.postMessage({ type: "start", mode: stored.checkpoint.mode, speed, seed: 17, checkpoint: stored.checkpoint, run: false } satisfies Subject2Command);
    setStatus("paused");
    setRestorePromptOpen(false);
  }, [speed]);

  const dismissRestorePrompt = useCallback(() => setRestorePromptOpen(false), []);

  return {
    snapshot, rewardHistory, mode, speed, status, error, metrics, checkpointInfo, checkpointError, restorePromptOpen,
    setMode, setSpeed, start, pause, saveCheckpoint, restoreCheckpoint, dismissRestorePrompt,
  };
}
