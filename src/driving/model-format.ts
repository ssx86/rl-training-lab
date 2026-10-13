import type { DqnAgent, SerializedWeight } from "./dqn-agent";
import {
  DRIVING_ACTIONS,
  DRIVING_OBSERVATION_FIELDS,
  DRIVING_SCHEMA_VERSION,
} from "./types";

export interface SerializedDqnModel {
  readonly formatVersion: 1;
  readonly schemaVersion: string;
  readonly algorithm: "dqn";
  readonly observationFields: string[];
  readonly actions: Array<{
    id: number;
    steer: number;
    acceleration: number;
  }>;
  readonly network: {
    observationSize: number;
    actionCount: number;
    hiddenUnits: number;
  };
  readonly weights: SerializedWeight[];
}

export function exportDqnModel(agent: DqnAgent): SerializedDqnModel {
  return {
    formatVersion: 1,
    schemaVersion: DRIVING_SCHEMA_VERSION,
    algorithm: "dqn",
    observationFields: [...DRIVING_OBSERVATION_FIELDS],
    actions: DRIVING_ACTIONS.map(({ id, steer, acceleration }) => ({
      id,
      steer,
      acceleration,
    })),
    network: agent.networkConfig(),
    weights: agent.exportWeights(),
  };
}

export function importDqnModel(agent: DqnAgent, artifact: SerializedDqnModel): void {
  if (artifact.schemaVersion !== DRIVING_SCHEMA_VERSION) {
    throw new Error(
      `Incompatible environment schema: expected ${DRIVING_SCHEMA_VERSION}, received ${artifact.schemaVersion}.`,
    );
  }
  if (artifact.algorithm !== "dqn" || artifact.formatVersion !== 1) {
    throw new Error("Unsupported DQN model format.");
  }
  if (
    artifact.observationFields.join("|") !==
    DRIVING_OBSERVATION_FIELDS.join("|")
  ) {
    throw new Error("Incompatible observation field order.");
  }
  const expectedActions = DRIVING_ACTIONS.map(
    ({ id, steer, acceleration }) => `${id}:${steer}:${acceleration}`,
  );
  const receivedActions = artifact.actions.map(
    ({ id, steer, acceleration }) => `${id}:${steer}:${acceleration}`,
  );
  if (receivedActions.join("|") !== expectedActions.join("|")) {
    throw new Error("Incompatible driving action mapping.");
  }
  const expectedNetwork = agent.networkConfig();
  if (
    artifact.network.observationSize !== expectedNetwork.observationSize ||
    artifact.network.actionCount !== expectedNetwork.actionCount ||
    artifact.network.hiddenUnits !== expectedNetwork.hiddenUnits
  ) {
    throw new Error("Incompatible DQN network architecture.");
  }
  agent.importWeights(artifact.weights);
}
