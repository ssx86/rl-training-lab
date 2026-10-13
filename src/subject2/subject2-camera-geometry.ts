import type { Subject2Scenario } from "./subject2-course";
import { SUBJECT2_STANDARD } from "./subject2-standard";

export function subject2CameraElevation(scenario: Subject2Scenario, y: number): number {
  return scenario.project === "ramp" ? Math.max(0, (65 - y) * SUBJECT2_STANDARD.ramp.grade) : 0;
}
