import { useCallback, useEffect, useRef, useState } from "react";
import type { FleetMode, SharedFleetSnapshot } from "@/driving/shared-fleet-runtime";
import type { FleetCommand, FleetEnvelope, FleetRuntimeMetrics, PlaybackRate, TrainingSpeed } from "@/workers/fleet-trainer-protocol";

export function useSharedFleet() {
  const workerRef = useRef<Worker | null>(null);
  const latestRef = useRef<SharedFleetSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<SharedFleetSnapshot | null>(null);
  const [mode, setModeState] = useState<FleetMode>("training");
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "error">("idle");
  const [trainingSpeed, setTrainingSpeedState] = useState<TrainingSpeed>("max");
  const [playbackRate, setPlaybackRateState] = useState<PlaybackRate>(1);
  const [renderFps, setRenderFps] = useState<15 | 30 | 60>(30);
  const [cityId, setCityId] = useState("osm-vathorst");
  const [vehicleCount, setVehicleCountState] = useState<4 | 10 | 20 | 50>(10);
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [driverViewCount, setDriverViewCountState] = useState<1 | 2 | 4>(2);
  const [driverVehicleIndices, setDriverVehicleIndices] = useState([0, 1]);
  const [error, setError] = useState<string | null>(null);
  const [runtimeMetrics, setRuntimeMetrics] = useState<FleetRuntimeMetrics>({ backend: "—", stepsPerSecond: 0 });

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../workers/fleet-trainer.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.addEventListener("message", (event: MessageEvent<FleetEnvelope>) => {
      const envelope = event.data;
      if (envelope.schemaVersion !== "fleet-v2") {
        setError("车队 Worker 数据版本不兼容。");
        setStatus("error");
      } else if (envelope.payload.type === "snapshot") {
        latestRef.current = envelope.payload.snapshot;
        setRuntimeMetrics(envelope.payload.metrics);
      } else if (envelope.payload.type === "status") {
        setStatus(envelope.payload.status);
      } else {
        setError(envelope.payload.message);
        setStatus("error");
      }
    });
    return () => {
      worker.postMessage({ type: "dispose" } satisfies FleetCommand);
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const draw = (time: number) => {
      if (time - last >= 1000 / renderFps && latestRef.current) {
        setSnapshot(latestRef.current);
        last = time;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [renderFps]);

  const start = useCallback(() => {
    setError(null);
    if (!snapshot || status === "error") {
      workerRef.current?.postMessage({
        type: "start",
        mode,
        cityId,
        seed: 1,
        vehicleCount,
        rotationEvery: 1_000,
        trainingSpeed,
        playbackRate,
      } satisfies FleetCommand);
    } else {
      workerRef.current?.postMessage({ type: "resume" } satisfies FleetCommand);
    }
    setStatus("running");
  }, [cityId, mode, playbackRate, snapshot, status, trainingSpeed, vehicleCount]);

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: "pause" } satisfies FleetCommand);
    setStatus("paused");
  }, []);

  const setMode = useCallback((next: FleetMode) => {
    setModeState(next);
    workerRef.current?.postMessage({ type: "set-mode", mode: next } satisfies FleetCommand);
  }, []);

  const setTrainingSpeed = useCallback((speed: TrainingSpeed) => {
    setTrainingSpeedState(speed);
    workerRef.current?.postMessage({ type: "set-training-speed", speed } satisfies FleetCommand);
  }, []);

  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    setPlaybackRateState(rate);
    workerRef.current?.postMessage({ type: "set-playback-rate", rate } satisfies FleetCommand);
  }, []);

  const setVehicleCount = useCallback((count: 4 | 10 | 20 | 50) => {
    setVehicleCountState(count);
    setSelectedVehicle((current) => Math.min(current, count - 1));
    setDriverVehicleIndices((current) => current.map((value) => Math.min(value, count - 1)));
    if (latestRef.current) workerRef.current?.postMessage({ type: "resize-fleet", vehicleCount: count } satisfies FleetCommand);
  }, []);

  const setDriverViewCount = useCallback((count: 1 | 2 | 4) => {
    setDriverViewCountState(count);
    setDriverVehicleIndices((current) => Array.from({ length: count }, (_, index) => current[index] ?? index % vehicleCount));
  }, [vehicleCount]);

  const setDriverVehicle = useCallback((slot: number, vehicleIndex: number) => {
    setDriverVehicleIndices((current) => current.map((value, index) => index === slot ? vehicleIndex : value));
  }, []);

  return {
    snapshot, mode, status, trainingSpeed, playbackRate, renderFps, cityId,
    vehicleCount, selectedVehicle, driverViewCount, driverVehicleIndices, runtimeMetrics, error,
    setMode, setTrainingSpeed, setPlaybackRate, setRenderFps, setCityId,
    setVehicleCount, setSelectedVehicle, setDriverViewCount, setDriverVehicle, start, pause,
  };
}
