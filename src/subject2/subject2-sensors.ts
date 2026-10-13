import type { Subject2Segment } from "./subject2-course";
import type { Subject2VehicleState } from "./subject2-vehicle";

export const SUBJECT2_SENSOR_BEAMS = 32;
// A 16m near-field envelope keeps parking-scale geometry legible and prevents
// the policy from learning from implausibly distant course edges.
export const SUBJECT2_SENSOR_RANGE = 16;

export interface Subject2SensorBeam {
  readonly relativeAngle: number;
  readonly worldAngle: number;
  readonly distanceMeters: number;
  readonly hit: Subject2Segment["kind"] | null;
}

export interface Subject2Scan { readonly beams: readonly Subject2SensorBeam[] }

function raySegmentDistance(x: number, y: number, dx: number, dy: number, segment: Subject2Segment): number | null {
  const sx = segment.bx - segment.ax;
  const sy = segment.by - segment.ay;
  const denominator = dx * sy - dy * sx;
  if (Math.abs(denominator) < 1e-9) return null;
  const qx = segment.ax - x;
  const qy = segment.ay - y;
  const rayT = (qx * sy - qy * sx) / denominator;
  const segmentT = (qx * dy - qy * dx) / denominator;
  return rayT >= 0 && segmentT >= 0 && segmentT <= 1 ? rayT : null;
}

export function senseSubject2Course(vehicle: Subject2VehicleState, segments: readonly Subject2Segment[]): Subject2Scan {
  const beams = Array.from({ length: SUBJECT2_SENSOR_BEAMS }, (_, index): Subject2SensorBeam => {
    const relativeAngle = -Math.PI + index / SUBJECT2_SENSOR_BEAMS * Math.PI * 2;
    const worldAngle = vehicle.heading + relativeAngle;
    const dx = Math.cos(worldAngle);
    const dy = Math.sin(worldAngle);
    let distanceMeters = SUBJECT2_SENSOR_RANGE;
    let hit: Subject2Segment["kind"] | null = null;
    for (const segment of segments) {
      // Scoring/control lines are semantic gates painted on the road, not
      // solid obstacles. The policy may cross them and must not avoid them.
      if (segment.kind === "exam-line") continue;
      const distance = raySegmentDistance(vehicle.x, vehicle.y, dx, dy, segment);
      if (distance !== null && distance < distanceMeters) {
        distanceMeters = distance;
        hit = segment.kind;
      }
    }
    return { relativeAngle, worldAngle, distanceMeters, hit };
  });
  return { beams };
}
