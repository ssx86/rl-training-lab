import { describe, expect, it } from "vitest";

import { DrivingEnvironment } from "./driving-environment";
import {
  createSeededObstacleMap,
  createStraightTrainingMap,
} from "./maps";
import { ScriptedDriver } from "./scripted-driver";

function runScriptedEpisode(environment: DrivingEnvironment, driver: ScriptedDriver): string {
  let observation = environment.reset();
  for (let step = 0; step < 600; step += 1) {
    const transition = environment.step(
      driver.chooseAction(observation, environment.snapshot()),
    );
    observation = transition.nextObservation;
    if (transition.done) return transition.event;
  }
  return "incomplete";
}

describe("scripted driving baseline", () => {
  it("finishes the unobstructed teaching route", () => {
    const map = createStraightTrainingMap();
    expect(
      runScriptedEpisode(new DrivingEnvironment(map), new ScriptedDriver(map)),
    ).toBe("goal");
  });

  it("demonstrates that the seeded evaluation layouts are bypassable", () => {
    const evaluationSeeds = Array.from({ length: 40 }, (_, index) => index + 1);
    const outcomes = evaluationSeeds.map((seed) => {
      const map = createSeededObstacleMap(seed);
      return runScriptedEpisode(
        new DrivingEnvironment(map),
        new ScriptedDriver(map),
      );
    });

    expect(outcomes).toEqual(Array.from({ length: 40 }, () => "goal"));
  });
});
