export const DRIVING_SCHEMA_VERSION = "driving-v3" as const;

export const DRIVING_OBSERVATION_FIELDS = [
  "lidarFarLeft",
  "lidarLeft",
  "lidarFront",
  "lidarRight",
  "lidarFarRight",
  "speed",
  "headingSin",
  "headingCos",
  "lateralOffset",
  "routeProgress",
  "previousSteer",
  "previousAcceleration",
] as const;

export type DrivingObservationField =
  (typeof DRIVING_OBSERVATION_FIELDS)[number];

export type DrivingObservation = Readonly<
  Record<DrivingObservationField, number>
>;

type SteeringCommand = -1 | 0 | 1;
type AccelerationCommand = -1 | 0 | 1;

export interface DrivingActionDefinition {
  readonly id: number;
  readonly steer: SteeringCommand;
  readonly acceleration: AccelerationCommand;
  readonly label: string;
}

const STEERING_LABELS: Record<SteeringCommand, string> = {
  [-1]: "左转",
  0: "保持方向",
  1: "右转",
};

const ACCELERATION_LABELS: Record<AccelerationCommand, string> = {
  [-1]: "制动",
  0: "滑行",
  1: "加速",
};

export const DRIVING_ACTIONS: readonly DrivingActionDefinition[] = (
  [-1, 0, 1] as const
).flatMap((steer, steerIndex) =>
  ([-1, 0, 1] as const).map((acceleration, accelerationIndex) => ({
    id: steerIndex * 3 + accelerationIndex,
    steer,
    acceleration,
    label: `${STEERING_LABELS[steer]} · ${ACCELERATION_LABELS[acceleration]}`,
  })),
);

const DEFAULT_OBSERVATION: DrivingObservation = {
  lidarFarLeft: 0,
  lidarLeft: 0,
  lidarFront: 0,
  lidarRight: 0,
  lidarFarRight: 0,
  speed: 0,
  headingSin: 0,
  headingCos: 1,
  lateralOffset: 0,
  routeProgress: 0,
  previousSteer: 0,
  previousAcceleration: 0,
};

const UNIT_INTERVAL_FIELDS = new Set<DrivingObservationField>([
  "lidarFarLeft",
  "lidarLeft",
  "lidarFront",
  "lidarRight",
  "lidarFarRight",
  "routeProgress",
]);

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizeField(field: DrivingObservationField, value: number): number {
  const finite = finiteOrZero(value);
  return UNIT_INTERVAL_FIELDS.has(field)
    ? Math.min(1, Math.max(0, finite))
    : Math.min(1, Math.max(-1, finite));
}

export function createDrivingObservation(
  values: Partial<DrivingObservation> = {},
): DrivingObservation {
  return Object.fromEntries(
    DRIVING_OBSERVATION_FIELDS.map((field) => [
      field,
      normalizeField(field, values[field] ?? DEFAULT_OBSERVATION[field]),
    ]),
  ) as unknown as DrivingObservation;
}

export function drivingObservationToVector(
  observation: DrivingObservation,
): number[] {
  return DRIVING_OBSERVATION_FIELDS.map((field) => observation[field]);
}

export function getDrivingAction(actionId: number): DrivingActionDefinition {
  const action = DRIVING_ACTIONS[actionId];
  if (!action) {
    throw new RangeError(`Unknown driving action: ${actionId}`);
  }
  return action;
}
