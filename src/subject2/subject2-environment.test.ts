import { describe, expect, it } from "vitest";
import { generateSubject2Scenario } from "./subject2-scenario";
import { SUBJECT2_PROJECT_ORDER } from "./subject2-course";
import { Subject2Environment, checkpointPoseError } from "./subject2-environment";
import { createSubject2Vehicle, SUBJECT2_VEHICLE } from "./subject2-vehicle";
import { collidesWithCourse, isVehicleWithinRoadSurfaces } from "./subject2-collision";
import { SUBJECT2_STANDARD } from "./subject2-standard";

const heldRampVehicle = (scenario: ReturnType<typeof generateSubject2Scenario>) => createSubject2Vehicle({
  x: scenario.checkpoints[0].x,
  y: scenario.checkpoints[0].y,
  heading: scenario.checkpoints[0].heading,
  brake: .2,
});

const holdAction = { steer: 0, throttle: 0, brake: .2, gear: 1 } as const;

describe("random subject 2 environment", () => {
  it("always exposes the final endpoint as the target instead of the current process gate", () => {
    const scenario = generateSubject2Scenario(10, "reverse-parking");
    const environment = new Subject2Environment(scenario);
    const goal = scenario.checkpoints.at(-1)!;
    const observation = environment.observe();
    expect(observation.targetDistance).toBeCloseTo(Math.hypot(goal.x - scenario.start.x, goal.y - scenario.start.y), 5);
    expect(environment.currentGoal().id).toBe("park-from-left");
    expect(environment.currentCheckpoint().id).toBe("right-control");
  });

  it("rewards complete line crossings and accepts any fully contained reverse parking pose", () => {
    const scenario = generateSubject2Scenario(10, "reverse-parking");
    const environment = new Subject2Environment(scenario);
    const right = scenario.segments.find((item) => item.id === "right-control-line")!;
    environment.setVehicleForTest(createSubject2Vehicle({ x: right.ax + 2.5, y: 36.05, heading: 0, speed: .1 }));
    let result = environment.step({ steer: 0, throttle: 0 });
    expect(result.checkpointReached).toBe(true);
    expect(Number.isFinite(result.rewardBreakdown.poseProgress)).toBe(true);
    expect(result.rewardBreakdown.checkpoint).toBeGreaterThan(0);
    expect(result.done).toBe(false);

    const bay = scenario.parkingBays[0];
    environment.setVehicleForTest(createSubject2Vehicle({ x: bay.x + .1, y: bay.y + .2, heading: bay.heading, speed: -.1 }));
    result = environment.step({ steer: 0, throttle: 0 });
    expect(result.checkpointReached).toBe(true);
    expect(Number.isFinite(result.rewardBreakdown.poseProgress)).toBe(true);
    expect(result.done).toBe(false);

    const left = scenario.segments.find((item) => item.id === "left-control-line")!;
    environment.setVehicleForTest(createSubject2Vehicle({ x: left.ax - 2.5, y: 36.05, heading: Math.PI, speed: .1 }));
    result = environment.step({ steer: 0, throttle: 0 });
    expect(result.checkpointReached).toBe(true);
    expect(result.done).toBe(false);

    environment.setVehicleForTest(createSubject2Vehicle({ x: bay.x - .1, y: bay.y - .2, heading: bay.heading, speed: -.1 }));
    result = environment.step({ steer: 0, throttle: 0 });
    expect(result.checkpointReached).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.done).toBe(true);
  });

  it("scores a reverse-parking control gate when both front wheels cross, without requiring the rear body to cross", () => {
    const scenario = generateSubject2Scenario(10, "reverse-parking");
    const environment = new Subject2Environment(scenario);
    const right = scenario.segments.find((item) => item.id === "right-control-line")!;
    environment.setVehicleForTest(createSubject2Vehicle({
      x: right.ax - SUBJECT2_VEHICLE.wheelBase / 2 + .12,
      y: 36.05,
      heading: 0,
      speed: .1,
    }));
    const result = environment.step({ steer: 0, throttle: 0 });
    expect(result.checkpointReached).toBe(true);
  });
  it("reduces pose error as the complete vehicle approaches the local target", () => {
    const target = generateSubject2Scenario(10, "right-angle").checkpoints[0];
    const far = checkpointPoseError(createSubject2Vehicle({ x: target.x - 20, y: target.y + 10, heading: target.heading + .8 }), target);
    const near = checkpointPoseError(createSubject2Vehicle({ x: target.x - 2, y: target.y + 1, heading: target.heading + .08 }), target);
    expect(near.total).toBeLessThan(far.total);
  });

  it("penalizes waiting so zero action cannot become the solution", () => {
    const environment = new Subject2Environment(generateSubject2Scenario(11, "ramp"));
    const result = environment.step({ steer: 0, throttle: 0 });
    expect(result.rewardBreakdown.inactivity).toBeLessThan(0);
    expect(result.reward).toBeLessThan(0);
  });

  it("does not restart after only two seconds of stationary exploration", () => {
    const environment = new Subject2Environment(generateSubject2Scenario(11, "reverse-parking"));
    let result = environment.step({ steer: 0, throttle: 0, brake: 1, gear: 1 });
    const oldStopLimitSteps = 2 / SUBJECT2_VEHICLE.timeStep;
    for (let index = 1; index < oldStopLimitSteps; index += 1) {
      result = environment.step({ steer: 0, throttle: 0, brake: 1, gear: 1 });
    }
    expect(result.done).toBe(false);
    expect(result.terminalReason).toBe(null);
  });

  it("ends an attempt after twelve seconds without measurable process progress", () => {
    const environment = new Subject2Environment(generateSubject2Scenario(11, "reverse-parking"));
    let result = environment.step({ steer: 0, throttle: 0, brake: 1, gear: 1 });
    const noProgressLimitSteps = SUBJECT2_STANDARD.training.noProgressLimitSeconds / SUBJECT2_VEHICLE.timeStep;
    for (let index = 1; index < noProgressLimitSteps && !result.done; index += 1) {
      result = environment.step({ steer: 0, throttle: 0, brake: 1, gear: 1 });
    }
    expect(result.done).toBe(true);
    expect(result.terminalReason).toBe("stalled");
    expect(result.rewardBreakdown.stalled).toBe(-35);
  });

  it("rewards progress toward the visible current process condition before the final checkpoint", () => {
    const environment = new Subject2Environment(generateSubject2Scenario(11, "reverse-parking"));
    const result = environment.step({ steer: 0, throttle: 1, brake: 0, gear: 1 });
    expect(result.checkpointIndex).toBe(0);
    expect(result.rewardBreakdown.poseProgress).toBeGreaterThan(0);
  });

  it("fails the ramp start once gravity causes more than 30 cm of rollback", () => {
    const scenario = generateSubject2Scenario(11, "ramp");
    const environment = new Subject2Environment(scenario);
    environment.setVehicleForTest(heldRampVehicle(scenario));
    let stopped = environment.step(holdAction);
    for (let index = 1; index < SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep; index += 1) stopped = environment.step(holdAction);
    expect(stopped.checkpointReached).toBe(true);

    let result = stopped;
    for (let index = 0; index < 20 && !result.done; index += 1) result = environment.step({ steer: 0, throttle: 0 });
    expect(result.done).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.terminalReason).toBe("rollback");
    expect(result.rewardBreakdown.rollback).toBe(-100);
  });

  it("uses the front bumper control band and requires one continuous second of brake-held stopping", () => {
    const scenario = generateSubject2Scenario(18, "ramp");
    const environment = new Subject2Environment(scenario);
    const stopLine = scenario.segments.find((segment) => segment.id === "stop-line")!;
    environment.setVehicleForTest(createSubject2Vehicle({ x: scenario.checkpoints[0].x, y: stopLine.ay, heading: -Math.PI / 2, brake: .2 }));
    const centerOnLine = environment.step(holdAction);
    expect(centerOnLine.checkpointReached).toBe(false);
    expect(centerOnLine.observation.holdProgress).toBe(0);
    environment.setVehicleForTest(heldRampVehicle(scenario));
    const requiredSteps = SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep;
    let result = environment.step(holdAction);
    expect(result.checkpointReached).toBe(false);
    expect(result.observation.rampPhase).toBe("holding");
    expect(result.observation.holdProgress).toBeCloseTo(1 / requiredSteps);
    expect(result.rewardBreakdown.inactivity).toBe(0);
    expect(result.rewardBreakdown.stableHold).toBeGreaterThan(0);
    for (let index = 1; index < requiredSteps; index += 1) result = environment.step(holdAction);
    expect(result.checkpointReached).toBe(true);
    expect(result.observation.rampPhase).toBe("launch");
  });

  it("resets the continuous hold when braking is released", () => {
    const scenario = generateSubject2Scenario(19, "ramp");
    const environment = new Subject2Environment(scenario);
    environment.setVehicleForTest(heldRampVehicle(scenario));
    for (let index = 0; index < 5; index += 1) environment.step(holdAction);
    const interrupted = environment.step({ ...holdAction, brake: 0 });
    expect(interrupted.checkpointReached).toBe(false);
    expect(interrupted.observation.holdProgress).toBe(0);
    expect(interrupted.observation.rampPhase).toBe("braking");
  });

  it("ends the ramp attempt when the vehicle has not launched within 30 seconds after stopping", () => {
    const scenario = generateSubject2Scenario(20, "ramp");
    const environment = new Subject2Environment(scenario, 10_000);
    environment.setVehicleForTest(heldRampVehicle(scenario));
    const requiredSteps = SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep;
    let result = environment.step(holdAction);
    for (let index = 1; index < requiredSteps; index += 1) result = environment.step(holdAction);
    expect(result.checkpointReached).toBe(true);
    const deadlineSteps = SUBJECT2_STANDARD.ramp.launchTimeLimitSeconds / SUBJECT2_VEHICLE.timeStep;
    for (let index = 0; index < deadlineSteps && !result.done; index += 1) result = environment.step(holdAction);
    expect(result.done).toBe(true);
    expect(result.terminalReason).toBe("start-timeout");
    expect(result.rewardBreakdown.startTimeout).toBe(-100);
  });

  it("does not apply the generic no-progress failure during the legal hill-start window", () => {
    const scenario = generateSubject2Scenario(23, "ramp");
    const environment = new Subject2Environment(scenario, 10_000);
    environment.setVehicleForTest(heldRampVehicle(scenario));
    const requiredSteps = SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep;
    let result = environment.step(holdAction);
    for (let index = 1; index < requiredSteps; index += 1) result = environment.step(holdAction);
    expect(result.checkpointReached).toBe(true);
    const genericLimitSteps = SUBJECT2_STANDARD.training.noProgressLimitSeconds / SUBJECT2_VEHICLE.timeStep;
    for (let index = 0; index < genericLimitSteps + 2; index += 1) result = environment.step(holdAction);
    expect(result.done).toBe(false);
    expect(result.terminalReason).toBe(null);
  });

  it("ends a problem when the full rotated car body touches a course line", () => {
    const scenario = generateSubject2Scenario(12, "right-angle");
    const environment = new Subject2Environment(scenario);
    const line = scenario.segments.find((item) => item.kind === "curb")!;
    environment.setVehicleForTest(createSubject2Vehicle({ x: (line.ax + line.bx) / 2, y: (line.ay + line.by) / 2, heading: 0, speed: 1 }));
    const result = environment.step({ steer: 0, throttle: 0 });
    expect(result.done).toBe(true);
    expect(result.terminalReason).toBe("collision");
    expect(result.rewardBreakdown.collision).toBe(-100);
  });

  it("never pays a checkpoint or pass reward for a target pose that also touches a line", () => {
    const base = generateSubject2Scenario(21, "right-angle");
    const line = base.segments.find((item) => item.kind === "curb")!;
    const target = { ...base.checkpoints[0], x: (line.ax + line.bx) / 2, y: (line.ay + line.by) / 2, heading: 0, motion: "any" as const, positionTolerance: 1, speedMax: 1 };
    const environment = new Subject2Environment({ ...base, checkpoints: [target] });
    environment.setVehicleForTest(createSubject2Vehicle({ x: target.x, y: target.y, heading: 0 }));
    const result = environment.step({ steer: 0, throttle: 0 });
    expect(result.checkpointReached).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.rewardBreakdown.checkpoint).toBe(0);
    expect(result.terminalReason).toBe("collision");
  });

  it("exposes only local geometry and relative target data, never seed or absolute coordinates", () => {
    const observation = new Subject2Environment(generateSubject2Scenario(13)).observe();
    expect(observation.vector).toHaveLength(48);
    expect(observation.targetDistance).toBeGreaterThan(0);
    expect("seed" in observation).toBe(false);
    expect("project" in observation).toBe(false);
    expect("x" in observation).toBe(false);
  });

  it("ends an attempt on timeout so the runtime can restart the same full scene", () => {
    const environment = new Subject2Environment(generateSubject2Scenario(14), 2);
    environment.step({ steer: 0, throttle: 0 });
    const result = environment.step({ steer: 0, throttle: 0 });
    expect(result.done).toBe(true);
    expect(result.terminalReason).toBe("timeout");
    expect(result.rewardBreakdown.timeout).toBe(-30);
  });

  it("ends immediately with a penalty when the whole car leaves every legal road surface", () => {
    const scenario = generateSubject2Scenario(17, "s-curve");
    const environment = new Subject2Environment(scenario);
    const vehicle = [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 68 }, { x: 10, y: 68 }]
      .map((point) => createSubject2Vehicle({ ...point, heading: .37, speed: 2 }))
      .find((candidate) => !collidesWithCourse(candidate, scenario.segments) && !isVehicleWithinRoadSurfaces(candidate, scenario.roadSurfaces));
    expect(vehicle).toBeDefined();
    environment.setVehicleForTest(vehicle!);
    const result = environment.step({ steer: 0, throttle: .5 });
    expect(result.done).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.terminalReason).toBe("out-of-bounds");
    expect(result.rewardBreakdown.outOfBounds).toBe(-100);
  });

  it("keeps every non-reverse project in one scene and makes its real process conditions completable", () => {
    for (const project of SUBJECT2_PROJECT_ORDER.filter((item) => item !== "reverse-parking" && item !== "ramp")) {
      const scenario = generateSubject2Scenario(37, project);
      const environment = new Subject2Environment(scenario);
      scenario.checkpoints.forEach((target, index) => {
        const speed = target.motion === "reverse" ? -.1 : target.motion === "forward" ? .1 : 0;
        environment.setVehicleForTest(createSubject2Vehicle({ x: target.x, y: target.y, heading: target.heading, speed }));
        const result = environment.step({ steer: 0, throttle: 0 });
        expect(result.checkpointReached, `${project}/${target.id}`).toBe(true);
        expect(result.rewardBreakdown.checkpoint, `${project}/${target.id}`).toBeGreaterThan(0);
        expect(result.done, `${project}/${target.id}`).toBe(index === scenario.checkpoints.length - 1);
        expect(result.passed, `${project}/${target.id}`).toBe(index === scenario.checkpoints.length - 1);
      });
    }
  });

  it("observes the stopping variables needed to distinguish flat-road and hill holding", () => {
    const scenario = generateSubject2Scenario(22, "ramp");
    const environment = new Subject2Environment(scenario);
    environment.setVehicleForTest(heldRampVehicle(scenario));
    const result = environment.step(holdAction);
    expect(result.observation.grade).toBe(SUBJECT2_STANDARD.ramp.grade);
    expect(result.observation.brake).toBeCloseTo(.2);
    expect(result.observation.longitudinalAcceleration).toBeCloseTo(0);
    expect(result.observation.stopLineDistance).toBeGreaterThanOrEqual(-SUBJECT2_STANDARD.ramp.poleLineDistance);
    expect(result.observation.stopLineDistance).toBeLessThanOrEqual(0);
  });

  it.each(["ramp", "s-curve", "right-angle"] as const)("finishes %s when the car crosses its exit at normal driving speed", (project) => {
    const scenario = generateSubject2Scenario(41, project);
    const environment = new Subject2Environment(scenario);
    scenario.checkpoints.forEach((target, index) => {
      if (project === "ramp" && index === 0) {
        environment.setVehicleForTest(heldRampVehicle(scenario));
        const requiredSteps = SUBJECT2_STANDARD.ramp.holdDurationSeconds / SUBJECT2_VEHICLE.timeStep;
        let stopped = environment.step(holdAction);
        for (let step = 1; step < requiredSteps; step += 1) stopped = environment.step(holdAction);
        expect(stopped.checkpointReached).toBe(true);
        return;
      }
      const isExit = index === scenario.checkpoints.length - 1;
      environment.setVehicleForTest(createSubject2Vehicle({
        x: target.x, y: target.y, heading: target.heading, speed: isExit ? 2 : target.motion === "reverse" ? -.1 : .1,
      }));
      const result = environment.step({ steer: 0, throttle: isExit ? .5 : 0 });
      if (isExit) {
        expect(result.checkpointReached, `${project}/${target.id}`).toBe(true);
        expect(result.passed, `${project}/${target.id}`).toBe(true);
        expect(result.terminalReason, `${project}/${target.id}`).toBe("passed");
      }
    });
  });
});
