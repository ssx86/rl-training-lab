import { useCallback, useEffect, useMemo, useState } from "react";
import { START_STATE, STATE_COUNT, type Action } from "@/domain/cliff-walking";
import { TrainingSession, type StepResult } from "@/domain/training-session";

export type LabMode = "training" | "exploitation";
type RunKind = "continuous" | "episode";

export interface LabParameters {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonMin: number;
  epsilonDecay: number;
  maxSteps: number;
  targetEpisodes: number;
  speedMs: number;
}

export interface EpisodeRecord {
  episode: number;
  reward: number;
  steps: number;
  epsilon: number;
  falls: number;
  success: boolean;
}

const DEFAULT_PARAMETERS: LabParameters = {
  alpha: 0.1,
  gamma: 0.9,
  epsilon: 0.2,
  epsilonMin: 0.01,
  epsilonDecay: 0.995,
  maxSteps: 200,
  targetEpisodes: 500,
  speedMs: 240,
};

export function useLab() {
  const [session] = useState(() => new TrainingSession());

  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [mode, setModeState] = useState<LabMode>("training");
  const [running, setRunning] = useState(false);
  const [runKind, setRunKind] = useState<RunKind>("continuous");
  const [currentState, setCurrentState] = useState(START_STATE);
  const [selectedState, setSelectedState] = useState(START_STATE);
  const [lastStep, setLastStep] = useState<StepResult | null>(null);
  const [path, setPath] = useState<number[]>([START_STATE]);
  const [history, setHistory] = useState<EpisodeRecord[]>([]);
  const [totalSteps, setTotalSteps] = useState(0);
  const [totalFalls, setTotalFalls] = useState(0);
  const [totalCollisions, setTotalCollisions] = useState(0);
  const [episodeFalls, setEpisodeFalls] = useState(0);
  const [visitCounts, setVisitCounts] = useState(() => {
    const initial = Array<number>(STATE_COUNT).fill(0);
    initial[START_STATE] = 1;
    return initial;
  });
  const [qVersion, setQVersion] = useState(0);

  const finishEpisode = useCallback(
    (step: StepResult, success: boolean) => {
      setHistory((records) => [
        ...records,
        {
          episode: step.episode,
          reward: step.cumulativeReward,
          steps: step.episodeStep,
          epsilon: parameters.epsilon,
          falls: episodeFalls + (step.fell ? 1 : 0),
          success,
        },
      ]);
      session.nextEpisode();
      setCurrentState(START_STATE);
      setSelectedState(START_STATE);
      setPath([START_STATE]);
      setEpisodeFalls(0);

      if (mode === "training") {
        setParameters((current) => ({
          ...current,
          epsilon: Math.max(current.epsilonMin, current.epsilon * current.epsilonDecay),
        }));
      }

      if (
        runKind === "episode" ||
        mode === "exploitation" ||
        step.episode >= parameters.targetEpisodes
      ) {
        setRunning(false);
      }
    },
    [episodeFalls, mode, parameters.epsilon, parameters.targetEpisodes, runKind, session],
  );

  const advance = useCallback(() => {
    const step = session.step(parameters, { learn: mode === "training" });
    setLastStep(step);
    setCurrentState(step.nextState);
    setSelectedState(step.nextState);
    setTotalSteps((value) => value + 1);
    setQVersion((value) => value + 1);
    setPath((states) => (step.fell ? [START_STATE] : [...states, step.nextState]));
    setVisitCounts((counts) => {
      const next = [...counts];
      next[step.nextState] += 1;
      return next;
    });

    if (step.fell) {
      setTotalFalls((value) => value + 1);
      setEpisodeFalls((value) => value + 1);
    }

    if (step.collision) setTotalCollisions((value) => value + 1);

    if (step.done || step.episodeStep >= parameters.maxSteps) {
      finishEpisode(step, step.done);
    }
  }, [finishEpisode, mode, parameters, session]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(advance, Math.max(16, parameters.speedMs));
    return () => window.clearInterval(timer);
  }, [advance, parameters.speedMs, running]);

  const setMode = useCallback(
    (nextMode: LabMode) => {
      setRunning(false);
      setModeState(nextMode);
      session.resetEpisode();
      setCurrentState(START_STATE);
      setSelectedState(START_STATE);
      setLastStep(null);
      setPath([START_STATE]);
      setEpisodeFalls(0);
    },
    [session],
  );

  const reset = useCallback(() => {
    setRunning(false);
    session.resetAll();
    setParameters(DEFAULT_PARAMETERS);
    setCurrentState(START_STATE);
    setSelectedState(START_STATE);
    setLastStep(null);
    setPath([START_STATE]);
    setHistory([]);
    setTotalSteps(0);
    setTotalFalls(0);
    setTotalCollisions(0);
    setEpisodeFalls(0);
    setVisitCounts(() => {
      const initial = Array<number>(STATE_COUNT).fill(0);
      initial[START_STATE] = 1;
      return initial;
    });
    setQVersion((value) => value + 1);
  }, [session]);

  const runEpisode = useCallback(() => {
    setRunKind("episode");
    setRunning(true);
  }, []);

  const toggleContinuous = useCallback(() => {
    setRunKind("continuous");
    setRunning((value) => !value);
  }, []);

  const updateParameter = useCallback(
    <K extends keyof LabParameters>(key: K, value: LabParameters[K]) => {
      setParameters((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const qMatrix = useMemo(() => {
    void qVersion;
    return session.qTable.toMatrix();
  }, [qVersion, session]);
  const successCount = history.filter((record) => record.success).length;

  return {
    mode,
    setMode,
    running,
    parameters,
    updateParameter,
    currentState,
    selectedState,
    setSelectedState,
    lastStep,
    path,
    history,
    totalSteps,
    totalFalls,
    totalCollisions,
    episodeFalls,
    visitCounts,
    successCount,
    episode: session.currentEpisode,
    qMatrix,
    greedyActions: (state: number): Action[] => session.qTable.greedyActions(state),
    advance,
    runEpisode,
    toggleContinuous,
    reset,
  };
}

