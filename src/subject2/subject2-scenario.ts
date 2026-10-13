import { collidesWithCourse, isVehicleFullyInsideBay, isVehicleWithinRoadSurfaces } from "./subject2-collision";
import {
  SUBJECT2_PROJECT_LABELS,
  SUBJECT2_PROJECT_ORDER,
  type Subject2ParkingBay,
  type Subject2Point,
  type Subject2PoseCheckpoint,
  type Subject2Project,
  type Subject2RoadMarking,
  type Subject2RoadSurface,
  type Subject2Scenario,
  type Subject2Segment,
} from "./subject2-course";
import { createSubject2Vehicle } from "./subject2-vehicle";
import { SUBJECT2_VEHICLE } from "./subject2-vehicle";
import { SUBJECT2_STANDARD } from "./subject2-standard";

type Point = { x: number; y: number };
type Draft = {
  start: Point & { heading: number };
  checkpoints: Subject2PoseCheckpoint[];
  segments: Subject2Segment[];
  roadSurfaces: Subject2RoadSurface[];
  roadMarkings: Subject2RoadMarking[];
  parkingBays?: Subject2ParkingBay[];
};

const WIDTH = 100;
const HEIGHT = 76;

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const cp = (
  id: string, project: Subject2Project, label: string, x: number, y: number, heading: number,
  motion: Subject2PoseCheckpoint["motion"], instruction: string,
  options: Partial<Subject2PoseCheckpoint> = {},
): Subject2PoseCheckpoint => ({
  id, project, label, x, y, heading, motion, instruction,
  positionTolerance: options.positionTolerance ?? 1.7,
  headingTolerance: options.headingTolerance ?? .16,
  speedMax: options.speedMax ?? 2,
  reward: options.reward ?? 22,
  containmentBayId: options.containmentBayId,
});

const seg = (id: string, ax: number, ay: number, bx: number, by: number, kind: Subject2Segment["kind"] = "curb"): Subject2Segment => ({ id, ax, ay, bx, by, kind });
const rectangle = (x1: number, y1: number, x2: number, y2: number): Subject2Point[] => [
  { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
];
const marking = (id: string, points: readonly Subject2Point[], kind: Subject2RoadMarking["kind"], options: Pick<Subject2RoadMarking, "smooth" | "closed"> = {}): Subject2RoadMarking => ({ id, points, kind, ...options });
const segmentsFromPoints = (id: string, points: readonly Point[], kind: Subject2Segment["kind"] = "curb"): Subject2Segment[] => points.slice(0, -1).map((point, index) => seg(`${id}-${index}`, point.x, point.y, points[index + 1].x, points[index + 1].y, kind));

function reverseParking(): Draft {
  const standard = SUBJECT2_STANDARD.reverseParking;
  const bayCenterX = 51;
  const bayFrontY = 32.7;
  const bayBackY = bayFrontY - standard.bayLength;
  const bayLeftX = bayCenterX - standard.bayWidth / 2;
  const bayRightX = bayCenterX + standard.bayWidth / 2;
  const laneBottomY = bayFrontY + standard.laneWidth;
  // The staging centreline is path-validated below the lane centre; this is
  // part of the course geometry, not a hidden goal or reward waypoint.
  const stagingY = bayFrontY + 3.5;
  const leftControlX = bayLeftX - standard.controlDistance;
  const rightControlX = bayRightX + standard.controlDistance;
  const lines = [
    seg("bay-left", bayLeftX, bayBackY, bayLeftX, bayFrontY, "parking-line"), seg("bay-right", bayRightX, bayBackY, bayRightX, bayFrontY, "parking-line"),
    seg("bay-back", bayLeftX, bayBackY, bayRightX, bayBackY, "parking-line"),
    seg("lane-top-left", 34, bayFrontY, bayLeftX, bayFrontY, "parking-line"), seg("lane-top-right", bayRightX, bayFrontY, 66, bayFrontY, "parking-line"),
    seg("lane-bottom", 34, laneBottomY, 66, laneBottomY, "parking-line"),
    seg("left-control-line", leftControlX, bayFrontY, leftControlX, laneBottomY, "exam-line"), seg("right-control-line", rightControlX, bayFrontY, rightControlX, laneBottomY, "exam-line"),
  ];
  return {
    start: { x: 37, y: stagingY, heading: 0 },
    parkingBays: [{ id: "bay", label: "倒车库", x: bayCenterX, y: (bayFrontY + bayBackY) / 2, width: standard.bayWidth, length: standard.bayLength, heading: Math.PI / 2 }],
    checkpoints: [
      cp("right-control", "reverse-parking", "右侧起倒位置", rightControlX, stagingY, 0, "forward", "驶过车库，在距库边 6.7m 的右控制线内摆正车身", { positionTolerance: .65 }),
      cp("park-from-right", "reverse-parking", "右侧倒入车库", bayCenterX, (bayFrontY + bayBackY) / 2, Math.PI / 2, "reverse", "从右侧倒入车库，四个车角必须全部在线内", { positionTolerance: .38, headingTolerance: .06, speedMax: .35, reward: 48, containmentBayId: "bay" }),
      cp("left-control", "reverse-parking", "左侧起倒位置", leftControlX, stagingY, Math.PI, "forward", "向左驶出车库，在距库边 6.7m 的左控制线内摆正车身", { positionTolerance: .65, reward: 28 }),
      cp("park-from-left", "reverse-parking", "左侧倒入车库", bayCenterX, (bayFrontY + bayBackY) / 2, Math.PI / 2, "reverse", "从左侧再次倒入车库，四个车角必须全部在线内", { positionTolerance: .38, headingTolerance: .06, speedMax: .35, reward: 48, containmentBayId: "bay" }),
    ],
    segments: lines,
    roadSurfaces: [{ id: "approach-road", kind: "asphalt", points: rectangle(34, bayFrontY, 66, laneBottomY) }, { id: "bay-surface", kind: "parking", points: rectangle(bayLeftX, bayBackY, bayRightX, bayFrontY) }],
    roadMarkings: lines.map((line) => marking(line.id, [{ x: line.ax, y: line.ay }, { x: line.bx, y: line.by }], line.kind === "exam-line" ? "exam-line" : "parking-line")),
  };
}

function sideParking(): Draft {
  const standard = SUBJECT2_STANDARD.sideParking;
  const lines = [seg("curb", 45, 32.75, 63, 32.75), seg("bay-front", 49.975, 32.75, 49.975, 35.25, "parking-line"), seg("bay-rear", 58.025, 32.75, 58.025, 35.25, "parking-line"), seg("road-edge-before", 44, 35.25, 49.975, 35.25, "parking-line"), seg("road-edge-after", 58.025, 35.25, 67, 35.25, "parking-line")];
  return {
    start: { x: 25, y: 36.95, heading: 0 },
    parkingBays: [{ id: "bay", label: "侧方车位", x: 54, y: 34, width: standard.bayWidth, length: standard.bayLength, heading: 0 }],
    checkpoints: [
      cp("parked", "side-parking", "整车入位", 54, 34, 0, "reverse", "完整停入道路右侧车位，任何车角不得出线", { positionTolerance: .75, headingTolerance: .08, speedMax: .3, reward: 58, containmentBayId: "bay" }),
    ],
    segments: lines,
    roadSurfaces: [{ id: "approach-road", kind: "asphalt", points: rectangle(15, 35.25, 72, 35.25 + standard.laneWidth) }, { id: "bay-surface", kind: "parking", points: rectangle(49.975, 32.75, 58.025, 35.25) }],
    roadMarkings: lines.map((line) => marking(line.id, [{ x: line.ax, y: line.ay }, { x: line.bx, y: line.by }], line.kind === "curb" ? "road-edge" : "parking-line")),
  };
}

function ramp(): Draft {
  const standard = SUBJECT2_STANDARD.ramp;
  const centerX = 31;
  const leftX = centerX - standard.roadWidth / 2;
  const rightX = centerX + standard.roadWidth / 2;
  const stopY = 38;
  const poleY = stopY - standard.poleLineDistance;
  const legalBumperY = (stopY + poleY) / 2;
  const stoppedVehicleCenterY = legalBumperY + SUBJECT2_VEHICLE.length / 2;
  const lines = [seg("left", leftX, 14, leftX, 61), seg("right", rightX, 14, rightX, 61), seg("stop-line", leftX, stopY, rightX, stopY, "exam-line"), seg("pole-line", leftX, poleY, rightX, poleY, "exam-line")];
  return {
    start: { x: 31, y: 55, heading: -Math.PI / 2 },
    checkpoints: [
      cp("stop", "ramp", "坡道定点停车", centerX, stoppedVehicleCenterY, -Math.PI / 2, "stop", "前保险杠进入桩杆线与停车线之间，踩住制动并连续停稳 1 秒", { positionTolerance: .85, speedMax: standard.stopSpeedMax, reward: 45 }),
      cp("start", "ramp", "坡道起步", 31, 20, -Math.PI / 2, "forward", "平稳起步，不后溜并驶出坡道", { speedMax: 4, reward: 42 }),
    ],
    segments: lines,
    roadSurfaces: [{ id: "ramp-road", kind: "asphalt", points: rectangle(leftX, 10, rightX, 65) }],
    roadMarkings: lines.map((line) => marking(line.id, [{ x: line.ax, y: line.ay }, { x: line.bx, y: line.by }], line.kind === "exam-line" ? "exam-line" : "road-edge")),
  };
}

function sCurve(): Draft {
  const roadWidth = SUBJECT2_STANDARD.sCurve.roadWidth;
  const outerRadius = SUBJECT2_STANDARD.sCurve.outerRadius;
  const centerRadius = outerRadius - roadWidth / 2;
  const sweep = Math.PI * .75;
  const firstCenter = { x: 35, y: 35 + centerRadius };
  const evaluateFirst = (t: number) => {
    const angle = -Math.PI / 2 + sweep * t;
    return { point: { x: firstCenter.x + Math.cos(angle) * centerRadius, y: firstCenter.y + Math.sin(angle) * centerRadius }, heading: sweep * t, tangent: { x: Math.cos(sweep * t), y: Math.sin(sweep * t) } };
  };
  const join = evaluateFirst(1);
  const secondCenter = { x: join.point.x + Math.sin(join.heading) * centerRadius, y: join.point.y - Math.cos(join.heading) * centerRadius };
  const evaluateSecond = (t: number) => {
    const heading = sweep * (1 - t);
    const angle = -Math.PI * .75 - sweep * t;
    return { point: { x: secondCenter.x + Math.cos(angle) * centerRadius, y: secondCenter.y + Math.sin(angle) * centerRadius }, heading, tangent: { x: Math.cos(heading), y: Math.sin(heading) } };
  };
  const curveSamples = [
    ...Array.from({ length: 49 }, (_, index) => evaluateFirst(index / 48)),
    ...Array.from({ length: 48 }, (_, index) => evaluateSecond((index + 1) / 48)),
  ];
  const curveExit = evaluateSecond(1);
  const samples = [
    ...Array.from({ length: 30 }, (_, index) => ({ point: { x: 20 + index * .5, y: 35 }, heading: 0, tangent: { x: 1, y: 0 } })),
    ...curveSamples,
    ...Array.from({ length: 33 }, (_, index) => ({ point: { x: curveExit.point.x + (index + 1) * .5, y: curveExit.point.y }, heading: 0, tangent: { x: 1, y: 0 } })),
  ];
  const offset = (sign: number) => samples.map(({ point, tangent }) => {
    const length = Math.hypot(tangent.x, tangent.y);
    return { x: point.x - tangent.y / length * roadWidth / 2 * sign, y: point.y + tangent.x / length * roadWidth / 2 * sign };
  });
  const left = offset(1);
  const right = offset(-1);
  const exit = { point: { x: curveExit.point.x + 13, y: curveExit.point.y }, heading: 0 };
  return {
    start: { x: 24, y: 35, heading: 0 },
    checkpoints: [
      cp("exit", "s-curve", "曲线出口", exit.point.x, exit.point.y, exit.heading, "forward", "车身摆正后驶出曲线", { positionTolerance: 1.05, speedMax: 4, reward: 46 }),
    ],
    segments: [...segmentsFromPoints("left", left), ...segmentsFromPoints("right", right)],
    roadSurfaces: [{ id: "s-road", kind: "asphalt", points: [...left, ...[...right].reverse()] }],
    roadMarkings: [marking("left-edge", left, "road-edge", { smooth: true }), marking("right-edge", right, "road-edge", { smooth: true })],
  };
}

function rightAngle(): Draft {
  const roadWidth = SUBJECT2_STANDARD.rightAngle.roadWidth;
  const lines = [seg("outer-a", 15, 45 + roadWidth, 55, 45 + roadWidth), seg("outer-b", 55, 45 + roadWidth, 55, 15), seg("inner-a", 15, 45, 55 - roadWidth, 45), seg("inner-b", 55 - roadWidth, 45, 55 - roadWidth, 15)];
  return {
    start: { x: 25, y: 46.8, heading: 0 },
    checkpoints: [
      cp("exit", "right-angle", "直角弯出口", 53.2, 27, -Math.PI / 2, "forward", "车身摆正驶出直角弯", { speedMax: 4, reward: 48 }),
    ],
    segments: lines,
    roadSurfaces: [{ id: "right-angle-road", kind: "asphalt", points: [{ x: 15, y: 45 + roadWidth }, { x: 55, y: 45 + roadWidth }, { x: 55, y: 15 }, { x: 55 - roadWidth, y: 15 }, { x: 55 - roadWidth, y: 45 }, { x: 15, y: 45 }] }],
    roadMarkings: lines.map((line) => marking(line.id, [{ x: line.ax, y: line.ay }, { x: line.bx, y: line.by }], "road-edge")),
  };
}

const BUILDERS: Record<Subject2Project, () => Draft> = {
  "reverse-parking": reverseParking,
  "side-parking": sideParking,
  ramp,
  "s-curve": sCurve,
  "right-angle": rightAngle,
};

export function validateSubject2Scenario(scenario: Subject2Scenario): readonly string[] {
  const errors: string[] = [];
  const poses = [{ id: "start", ...scenario.start }, ...scenario.checkpoints];
  for (const pose of poses) {
    const vehicle = createSubject2Vehicle(pose);
    if (collidesWithCourse(vehicle, scenario.segments)) errors.push(`${pose.id}: full vehicle touches a scored line`);
    if (!isVehicleWithinRoadSurfaces(vehicle, scenario.roadSurfaces)) errors.push(`${pose.id}: full vehicle leaves every legal road surface`);
    if (pose.x < 0 || pose.x > scenario.width || pose.y < 0 || pose.y > scenario.height) errors.push(`${pose.id}: pose is outside scene bounds`);
  }
  for (const checkpoint of scenario.checkpoints.filter((item) => item.containmentBayId)) {
    const bay = scenario.parkingBays.find((item) => item.id === checkpoint.containmentBayId);
    if (!bay) errors.push(`${checkpoint.id}: containment bay is missing`);
    else if (!isVehicleFullyInsideBay(createSubject2Vehicle(checkpoint), bay)) errors.push(`${checkpoint.id}: full vehicle is not inside its bay`);
  }
  return errors;
}

export function generateSubject2Scenario(seed: number, forcedProject?: Subject2Project): Subject2Scenario {
  const random = createSeededRandom(seed);
  const project = forcedProject ?? SUBJECT2_PROJECT_ORDER[Math.floor(random() * SUBJECT2_PROJECT_ORDER.length)];
  const mirrored = false;
  const rotationQuarterTurns = 0;
  // Dimensions are regulatory data, not domain randomization. Variation is limited
  // to project choice so every project keeps one fixed, inspectable map.
  const scale = 1;
  const draft = BUILDERS[project]();
  const transformPoint = ({ x, y }: Point): Point => ({ x, y });
  const transformHeading = (heading: number) => heading;
  // Sensor-only scene limits sit outside every scored course. They are not painted as exam lines.
  const boundaries = [seg("north", .5, .5, 99.5, .5, "boundary"), seg("east", 99.5, .5, 99.5, 75.5, "boundary"), seg("south", 99.5, 75.5, .5, 75.5, "boundary"), seg("west", .5, 75.5, .5, .5, "boundary")];
  const startPoint = transformPoint(draft.start);
  const scenario: Subject2Scenario = {
    id: `${project}-${seed}`,
    seed, project, label: SUBJECT2_PROJECT_LABELS[project], mirrored, rotationQuarterTurns, scale,
    width: WIDTH, height: HEIGHT,
    start: { ...startPoint, heading: transformHeading(draft.start.heading) },
    checkpoints: draft.checkpoints.map((item) => ({ ...item, ...transformPoint(item), heading: transformHeading(item.heading) })),
    segments: [...boundaries, ...draft.segments.map((item) => {
      const a = transformPoint({ x: item.ax, y: item.ay });
      const b = transformPoint({ x: item.bx, y: item.by });
      return { ...item, ax: a.x, ay: a.y, bx: b.x, by: b.y };
    })],
    roadSurfaces: draft.roadSurfaces.map((surface) => ({ ...surface, points: surface.points.map(transformPoint) })),
    roadMarkings: draft.roadMarkings.map((line) => ({ ...line, points: line.points.map(transformPoint) })),
    parkingBays: (draft.parkingBays ?? []).map((bay) => ({ ...bay, ...transformPoint(bay), width: bay.width * scale, length: bay.length * scale, heading: transformHeading(bay.heading) })),
  };
  const errors = validateSubject2Scenario(scenario);
  if (errors.length > 0) throw new Error(`Invalid Subject 2 scenario ${scenario.id}: ${errors.join("; ")}`);
  return scenario;
}

export function trainingScenarioSeed(baseSeed: number, generation: number): number { return baseSeed + generation * 104_729; }
export function evaluationScenarioSeed(baseSeed: number, generation: number): number { return 1_000_003 + baseSeed + generation * 130_363; }
