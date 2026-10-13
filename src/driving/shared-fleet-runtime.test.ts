import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";
import { CITY_MAPS } from "./city-map";
import type { CityMap } from "./city-map";
import { ACCIDENT_RECOVERY_STEPS, FLEET_COLLISION_PENALTY, SharedFleetRuntime } from "./shared-fleet-runtime";

const tinyCity: CityMap = {
  id: "tiny-test-city", name: "Tiny", width: 180, height: 40, roadWidth: 20,
  nodes: [
    { id: "a", x: 10, y: 20, label: "A" },
    { id: "b", x: 60, y: 20, label: "B" },
    { id: "c", x: 110, y: 20, label: "C" },
    { id: "d", x: 160, y: 20, label: "D" },
  ],
  edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }],
  objects: [], destinationNodeIds: ["a", "b", "c", "d"],
};

describe("SharedFleetRuntime", () => {
  const runtimes: SharedFleetRuntime[] = [];
  beforeAll(async () => { await tf.setBackend("cpu"); await tf.ready(); });
  afterEach(() => runtimes.splice(0).forEach((runtime) => runtime.dispose()));

  it("shares one replay while rotating the only learner fairly", async () => {
    const runtime = new SharedFleetRuntime({ city: CITY_MAPS[0], vehicleCount: 3, rotationEvery: 2, warmupSteps: 9999, hiddenUnits: 8 });
    runtimes.push(runtime);
    const first = await runtime.step();
    const second = await runtime.step();
    const third = await runtime.step();

    expect(first.vehicles).toHaveLength(3);
    for (let a = 0; a < first.vehicles.length; a += 1) {
      for (let b = a + 1; b < first.vehicles.length; b += 1) {
        expect(Math.hypot(
          first.vehicles[a].vehicle.x - first.vehicles[b].vehicle.x,
          first.vehicles[a].vehicle.y - first.vehicles[b].vehicle.y,
        )).toBeGreaterThan(20);
      }
    }
    expect(runtime.replaySize).toBe(3);
    expect(second.learnerIndex).toBe(0);
    expect(third.learnerIndex).toBe(1);
  });

  it("runs a 20-car fleet while adding only the active learner experience", async () => {
    const runtime = new SharedFleetRuntime({ city: CITY_MAPS[0], vehicleCount: 20, warmupSteps: 9999, hiddenUnits: 8 });
    runtimes.push(runtime);
    const snapshot = await runtime.step();

    expect(snapshot.vehicles).toHaveLength(20);
    expect(new Set(snapshot.vehicles.map((vehicle) => vehicle.color)).size).toBe(20);
    expect(snapshot.replaySize).toBe(1);
  });

  it("resizes the traffic fleet without resetting the shared model context", async () => {
    const runtime = new SharedFleetRuntime({ city: CITY_MAPS[0], vehicleCount: 3, warmupSteps: 9999, hiddenUnits: 8 });
    runtimes.push(runtime);
    const before = await runtime.step();
    runtime.resizeFleet(20);
    const expanded = runtime.snapshot();
    runtime.resizeFleet(50);
    const large = runtime.snapshot();

    expect(before.replaySize).toBe(1);
    expect(expanded.vehicles).toHaveLength(20);
    expect(large.vehicles).toHaveLength(50);
    expect(large.replaySize).toBe(before.replaySize);
    expect(large.step).toBe(before.step);
    expect(large.vehicles[26].label).toBe("出租车 AA");
  });

  it("rotates exactly one learner across the whole traffic fleet", async () => {
    const runtime = new SharedFleetRuntime({ city: CITY_MAPS[0], vehicleCount: 5, rotationEvery: 1, warmupSteps: 9999, hiddenUnits: 8 });
    runtimes.push(runtime);
    const learnerIndices = [];
    for (let index = 0; index < 8; index += 1) learnerIndices.push((await runtime.step()).learnerIndex);

    expect(new Set(learnerIndices)).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(Math.max(...learnerIndices)).toBe(4);
    expect(runtime.replaySize).toBe(8);
  });

  it("spawns opposing traffic on separate directional lanes", () => {
    const runtime = new SharedFleetRuntime({
      city: tinyCity, vehicleCount: 2, warmupSteps: 9999, hiddenUnits: 8,
      initialAssignments: [
        { startNodeId: "a", destinationNodeId: "d" },
        { startNodeId: "d", destinationNodeId: "a" },
      ],
    });
    runtimes.push(runtime);
    const snapshot = runtime.snapshot();
    expect(Math.abs(snapshot.vehicles[0].vehicle.y - snapshot.vehicles[1].vehicle.y)).toBeGreaterThanOrEqual(3.2);
    expect(snapshot.accidents).toHaveLength(0);
  });

  it("freezes replay and exploration in inference mode", async () => {
    const runtime = new SharedFleetRuntime({ city: CITY_MAPS[1], warmupSteps: 9999, hiddenUnits: 8 });
    runtimes.push(runtime);
    await runtime.step();
    const replay = runtime.replaySize;
    runtime.setMode("inference");
    const snapshot = await runtime.step();
    expect(snapshot.explorationNoise).toBe(0);
    expect(runtime.replaySize).toBe(replay);
  });

  it("continues with a new destination after finishing a taxi order", async () => {
    const closeStops: CityMap = {
      ...tinyCity, roadWidth: 80,
      nodes: tinyCity.nodes.map((node, index) => ({ ...node, x: 10 + index * 6 })),
    };
    const runtime = new SharedFleetRuntime({
      city: closeStops, vehicleCount: 1, warmupSteps: 9999, hiddenUnits: 8,
      initialAssignments: [{ startNodeId: "a", destinationNodeId: "d" }],
    });
    runtimes.push(runtime);
    const snapshot = await runtime.step();
    expect(snapshot.vehicles[0].ordersCompleted).toBe(1);
    expect(snapshot.vehicles[0].startNodeId).toBe("d");
    expect(snapshot.vehicles[0].destinationNodeId).not.toBe("d");
  });

  it("penalizes a fleet collision, blocks both cars, then respawns them apart", async () => {
    const runtime = new SharedFleetRuntime({
      city: tinyCity, vehicleCount: 2, warmupSteps: 9999, hiddenUnits: 8,
      initialAssignments: [
        { startNodeId: "a", destinationNodeId: "d" },
        { startNodeId: "a", destinationNodeId: "c" },
      ],
    });
    runtimes.push(runtime);
    const crashed = await runtime.step();
    expect(crashed.accidents).toHaveLength(1);
    expect(crashed.accidents[0].remainingSteps).toBe(ACCIDENT_RECOVERY_STEPS);
    expect(crashed.vehicles.every((vehicle) => vehicle.lastEvent === "collision" && vehicle.vehicle.speed === 0)).toBe(true);
    expect(crashed.vehicles[0].episodeReward).toBeLessThanOrEqual(FLEET_COLLISION_PENALTY);

    let recovered = crashed;
    for (let index = 0; index < ACCIDENT_RECOVERY_STEPS; index += 1) recovered = await runtime.step();
    expect(recovered.accidents).toHaveLength(0);
    expect(Math.hypot(
      recovered.vehicles[0].vehicle.x - recovered.vehicles[1].vehicle.x,
      recovered.vehicles[0].vehicle.y - recovered.vehicles[1].vehicle.y,
    )).toBeGreaterThan(24);
  });
});
