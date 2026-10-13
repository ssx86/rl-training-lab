export const CONTINUOUS_DRIVING_SCHEMA_VERSION = "continuous-driving-v1" as const;

export interface ContinuousDrivingAction {
  readonly steer: number;
  readonly throttle: number;
}

export const CONTINUOUS_ACTION_SIZE = 2;
export const RADAR_BEAM_COUNT = 21;
export const RADAR_CHANNELS = ["road-edge", "vehicle", "structure", "destination"] as const;
export type RadarChannel = (typeof RADAR_CHANNELS)[number];
export const CONTINUOUS_EGO_FEATURES = 9;
export const CONTINUOUS_OBSERVATION_SIZE = RADAR_BEAM_COUNT * RADAR_CHANNELS.length + CONTINUOUS_EGO_FEATURES;

export function clampContinuousAction(action: ContinuousDrivingAction): ContinuousDrivingAction {
  return {
    steer: Math.max(-1, Math.min(1, Number.isFinite(action.steer) ? action.steer : 0)),
    throttle: Math.max(-1, Math.min(1, Number.isFinite(action.throttle) ? action.throttle : 0)),
  };
}

export function continuousActionLabel(action: ContinuousDrivingAction): string {
  const steering = Math.abs(action.steer) < .05
    ? "方向盘居中"
    : `方向盘${action.steer < 0 ? "左" : "右"} ${Math.round(Math.abs(action.steer) * 100)}%`;
  const pedal = Math.abs(action.throttle) < .05
    ? "滑行"
    : action.throttle > 0
      ? `油门 ${Math.round(action.throttle * 100)}%`
      : `制动 ${Math.round(Math.abs(action.throttle) * 100)}%`;
  return `${steering} · ${pedal}`;
}
