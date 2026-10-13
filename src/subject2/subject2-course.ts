export type Subject2Project = "reverse-parking" | "side-parking" | "ramp" | "s-curve" | "right-angle";
export type RequiredMotion = "any" | "forward" | "reverse" | "stop";

export interface Subject2PoseCheckpoint {
  readonly id: string;
  readonly project: Subject2Project;
  readonly label: string;
  readonly instruction: string;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly positionTolerance: number;
  readonly headingTolerance: number;
  readonly speedMax: number;
  readonly motion: RequiredMotion;
  readonly reward: number;
  readonly containmentBayId?: string;
}

export interface Subject2Segment {
  readonly id: string;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly kind: "boundary" | "curb" | "parking-line" | "exam-line";
}

export interface Subject2Point {
  readonly x: number;
  readonly y: number;
}

export interface Subject2RoadSurface {
  readonly id: string;
  readonly points: readonly Subject2Point[];
  readonly kind: "asphalt" | "parking";
}

export interface Subject2RoadMarking {
  readonly id: string;
  readonly points: readonly Subject2Point[];
  readonly kind: "road-edge" | "parking-line" | "exam-line";
  readonly smooth?: boolean;
  readonly closed?: boolean;
}

export interface Subject2ParkingBay {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly length: number;
  readonly heading: number;
}

export interface Subject2Scenario {
  readonly id: string;
  readonly seed: number;
  readonly project: Subject2Project;
  readonly label: string;
  readonly mirrored: boolean;
  readonly rotationQuarterTurns: number;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
  readonly start: { readonly x: number; readonly y: number; readonly heading: number };
  readonly parkingBays: readonly Subject2ParkingBay[];
  readonly checkpoints: readonly Subject2PoseCheckpoint[];
  readonly segments: readonly Subject2Segment[];
  readonly roadSurfaces: readonly Subject2RoadSurface[];
  readonly roadMarkings: readonly Subject2RoadMarking[];
}

// This is a catalogue, not a training sequence. Runtime sampling is randomized.
export const SUBJECT2_PROJECT_ORDER: readonly Subject2Project[] = [
  "reverse-parking", "side-parking", "ramp", "s-curve", "right-angle",
] as const;

export const SUBJECT2_PROJECT_LABELS: Record<Subject2Project, string> = {
  "reverse-parking": "倒车入库",
  "side-parking": "侧方停车",
  ramp: "坡道定点停车与起步",
  "s-curve": "曲线行驶",
  "right-angle": "直角转弯",
};
