import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as tf from "@tensorflow/tfjs";

import { DqnAgent } from "./dqn-agent";
import { exportDqnModel, importDqnModel } from "./model-format";

describe("DQN model format", () => {
  const agents: DqnAgent[] = [];

  beforeAll(async () => {
    await tf.setBackend("cpu");
    await tf.ready();
  });

  afterEach(() => {
    agents.splice(0).forEach((agent) => agent.dispose());
    tf.disposeVariables();
  });

  it("round-trips predictions with environment and action metadata", () => {
    const source = new DqnAgent({ seed: 4, hiddenUnits: 8 });
    const destination = new DqnAgent({ seed: 9, hiddenUnits: 8 });
    agents.push(source, destination);
    const observation = Array.from({ length: 12 }, (_, index) => index / 12);

    const artifact = exportDqnModel(source);
    importDqnModel(destination, artifact);

    expect(destination.predict(observation)).toEqual(source.predict(observation));
    expect(artifact.observationFields).toHaveLength(12);
    expect(artifact.actions).toHaveLength(9);
  });

  it("rejects incompatible schema and observation order with an explanation", () => {
    const agent = new DqnAgent({ hiddenUnits: 8 });
    agents.push(agent);
    const artifact = exportDqnModel(agent);

    expect(() =>
      importDqnModel(agent, { ...artifact, schemaVersion: "driving-v0" }),
    ).toThrow(/schema/i);
    expect(() =>
      importDqnModel(agent, {
        ...artifact,
        observationFields: [...artifact.observationFields].reverse(),
      }),
    ).toThrow(/observation/i);
  });
});
