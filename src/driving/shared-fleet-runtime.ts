import { type DrivingEvent } from "./driving-environment";
import { distanceBetween } from "@/simulation/geometry";
import { type CityMap } from "./city-map";
import { createLaneRoute } from "./lane-route";
import type { DrivingMap } from "./maps";
import { ContinuousDrivingEnvironment, type ContinuousDrivingState } from "./continuous-driving-environment";
import { ContinuousReplayBuffer } from "@/rl/continuous/replay-buffer";
import { continuousActionLabel, type ContinuousDrivingAction } from "./continuous-control";
import { RADAR_MAX_DISTANCE, type RadarScan } from "./radar";
import { Td3Agent } from "@/rl/continuous/td3-agent";
import type { VehicleState } from "./vehicle-model";
import { vehiclesCollide } from "./vehicle-collision";

export const FLEET_SCHEMA_VERSION = "fleet-v2" as const;
export const FLEET_COLLISION_PENALTY = -50;
export const ACCIDENT_RECOVERY_STEPS = 120;
export type FleetMode = "training" | "inference";

export interface FleetVehicleSnapshot {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly vehicle: VehicleState;
  readonly startNodeId: string;
  readonly destinationNodeId: string;
  readonly destinationLabel: string;
  readonly ordersCompleted: number;
  readonly episodeReward: number;
  readonly lastEvent: DrivingEvent;
  readonly action: ContinuousDrivingAction;
  readonly actionLabel: string;
  readonly radar: RadarScan;
  readonly observation: readonly number[];
}

export interface SharedFleetSnapshot {
  readonly schemaVersion: typeof FLEET_SCHEMA_VERSION;
  readonly mode: FleetMode;
  readonly city: CityMap;
  readonly step: number;
  readonly learnerIndex: number;
  readonly learnerStepsRemaining: number;
  readonly explorationNoise: number;
  readonly replaySize: number;
  readonly updates: number;
  readonly criticLoss: number | null;
  readonly actorLoss: number | null;
  readonly vehicles: readonly FleetVehicleSnapshot[];
  readonly accidents: readonly FleetAccident[];
}

export interface FleetAccident {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly vehicleIds: readonly [string, string];
  readonly remainingSteps: number;
}

interface FleetActor {
  id: string;
  label: string;
  color: string;
  environment: ContinuousDrivingEnvironment;
  observation: ContinuousDrivingState;
  vehicle: VehicleState;
  startNodeId: string;
  destinationNodeId: string;
  ordersCompleted: number;
  episodeReward: number;
  lastEvent: DrivingEvent;
  action: ContinuousDrivingAction;
  blockedUntil: number;
}

export interface SharedFleetConfig {
  readonly city: CityMap;
  readonly seed?: number;
  readonly vehicleCount?: number;
  readonly rotationEvery?: number;
  readonly warmupSteps?: number;
  readonly batchSize?: number;
  readonly trainEvery?: number;
  readonly hiddenUnits?: number;
  readonly initialAssignments?: readonly {
    readonly startNodeId: string;
    readonly destinationNodeId: string;
  }[];
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function fleetColor(index: number): string {
  const palette = [
    "#d97706", "#174f43", "#40627a", "#8a5a44", "#5c557a",
    "#586b32", "#a33f4e", "#26706c", "#865d9a", "#4f6f9b",
    "#9a672f", "#447a4a", "#8c476f", "#326b82", "#73652d",
    "#6f5145", "#437169", "#6b5791", "#92603f", "#3f6670",
  ];
  return palette[index % palette.length];
}

function alphabeticLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + value % 26) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function explorationNoiseAt(step: number): number {
  const progress = Math.min(1, Math.max(0, step / 30_000));
  return 0.35 + (0.05 - 0.35) * progress;
}

function routeMap(city: CityMap, from: string, to: string): DrivingMap {
  const route = createLaneRoute(city, from, to);
  const heading = Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x);
  return {
    id: `${city.id}:${from}->${to}`,
    width: city.width,
    height: city.height,
    roadHalfWidth: Math.max(2.4, city.roadWidth / 2 - 0.5),
    route,
    obstacles: city.objects
      .filter((object) => object.kind === "barrier")
      .map((object) => ({ id: object.id, x: object.x, y: object.y, radius: object.size })),
    start: { x: route[0].x, y: route[0].y, heading },
    goalRadius: Math.max(6, city.roadWidth),
    checkpointFractions: [0.25, 0.5, 0.75],
    sensorMaxDistance: RADAR_MAX_DISTANCE,
    speedToDistanceScale: 1 / 3.6,
    wheelBase: 2.75,
    collisionRadius: 1.55,
  };
}

function nearestNode(city: CityMap, vehicle: VehicleState): string {
  return city.nodes.reduce((best, node) =>
    Math.hypot(node.x - vehicle.x, node.y - vehicle.y) < Math.hypot(best.x - vehicle.x, best.y - vehicle.y)
      ? node
      : best,
  ).id;
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distantStop(from: { x: number; y: number; id: string }, stops: readonly { x: number; y: number; id: string }[], offset = 0) {
  const ranked = stops.filter((stop) => stop.id !== from.id).sort((a, b) => pointDistance(from, b) - pointDistance(from, a));
  const distantPool = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3)));
  return distantPool[offset % distantPool.length];
}

export class SharedFleetRuntime {
  private readonly city: CityMap;
  private readonly random: () => number;
  private readonly actors: FleetActor[];
  private readonly agent: Td3Agent;
  private readonly replay = new ContinuousReplayBuffer(50_000);
  private readonly rotationEvery: number;
  private readonly warmupSteps: number;
  private readonly batchSize: number;
  private readonly trainEvery: number;
  private mode: FleetMode = "training";
  private stepCount = 0;
  private learnerIndex = 0;
  private updates = 0;
  private criticLoss: number | null = null;
  private actorLoss: number | null = null;
  private accidents: Array<Omit<FleetAccident, "remainingSteps"> & { clearsAt: number }> = [];

  constructor(config: SharedFleetConfig) {
    this.city = config.city;
    this.random = seededRandom(config.seed ?? 1);
    this.rotationEvery = config.rotationEvery ?? 1_000;
    this.warmupSteps = config.warmupSteps ?? 500;
    this.batchSize = config.batchSize ?? 64;
    this.trainEvery = config.trainEvery ?? 4;
    this.agent = new Td3Agent({ hiddenUnits: config.hiddenUnits });
    const vehicleCount = config.vehicleCount ?? 4;
    this.actors = [];
    for (let index = 0; index < vehicleCount; index += 1) {
      this.actors.push(this.createActor(index, config.initialAssignments?.[index]));
    }
  }

  setMode(mode: FleetMode): void {
    this.mode = mode;
  }

  resizeFleet(vehicleCount: number): void {
    const nextCount = Math.max(1, Math.min(50, Math.floor(vehicleCount)));
    while (this.actors.length < nextCount) this.actors.push(this.createActor(this.actors.length));
    if (this.actors.length > nextCount) this.actors.splice(nextCount);
    this.learnerIndex %= this.actors.length;
    const activeIds = new Set(this.actors.map((actor) => actor.id));
    this.accidents = this.accidents.filter((accident) => accident.vehicleIds.every((id) => activeIds.has(id)));
  }

  async step(): Promise<SharedFleetSnapshot> {
    this.stepCount += 1;
    if (this.stepCount > 1 && (this.stepCount - 1) % this.rotationEvery === 0) {
      this.learnerIndex = (this.learnerIndex + 1) % this.actors.length;
    }
    const explorationNoise = this.mode === "training" ? explorationNoiseAt(this.stepCount) : 0;

    for (const actor of this.actors) {
      if (actor.blockedUntil > 0 && actor.blockedUntil <= this.stepCount) {
        actor.blockedUntil = 0;
        this.continueActor(actor, "collision");
      }
    }
    const selectedActions = this.agent.selectActions(
      this.actors.map((actor) => actor.observation.vector),
      this.actors.map((_, index) => this.mode === "training" && index === this.learnerIndex ? explorationNoise : 0),
      this.random,
    );

    for (let index = 0; index < this.actors.length; index += 1) {
      const actor = this.actors[index];
      if (actor.blockedUntil > this.stepCount) {
        actor.lastEvent = "collision";
        continue;
      }
      const peers = this.actors.filter((other) => other !== actor).map((other) => ({ id: other.id, label: other.label, vehicle: other.vehicle }));
      const vector = actor.observation.vector;
      const action = selectedActions[index];
      const transition = actor.environment.step(action, peers);
      actor.observation = transition.nextObservation;
      actor.vehicle = actor.environment.snapshot();
      actor.action = action;
      actor.lastEvent = transition.event;
      actor.episodeReward += transition.reward;

      if (this.mode === "training" && index === this.learnerIndex) {
        this.replay.add({
          observation: vector,
          action,
          reward: transition.reward,
          nextObservation: transition.nextObservation.vector,
          done: transition.done,
        });
      }
      if (transition.done) this.continueActor(actor, transition.event);
    }

    this.detectFleetCollisions();
    this.accidents = this.accidents.filter((accident) => accident.clearsAt > this.stepCount);

    if (
      this.mode === "training" &&
      this.replay.size >= Math.max(this.warmupSteps, this.batchSize) &&
      this.stepCount % this.trainEvery === 0
    ) {
      const result = await this.agent.trainBatch(this.replay.sample(this.batchSize, this.random));
      this.criticLoss = result.criticLoss;
      this.actorLoss = result.actorLoss ?? this.actorLoss;
      this.updates += 1;
    }
    return this.snapshot(explorationNoise);
  }

  snapshot(explorationNoise = this.mode === "training" ? explorationNoiseAt(this.stepCount) : 0): SharedFleetSnapshot {
    return {
      schemaVersion: FLEET_SCHEMA_VERSION,
      mode: this.mode,
      city: this.city,
      step: this.stepCount,
      learnerIndex: this.learnerIndex,
      learnerStepsRemaining: this.rotationEvery - (this.stepCount % this.rotationEvery),
      explorationNoise,
      replaySize: this.replay.size,
      updates: this.updates,
      criticLoss: this.criticLoss,
      actorLoss: this.actorLoss,
      vehicles: this.actors.map((actor) => ({
        id: actor.id,
        label: actor.label,
        color: actor.color,
        vehicle: { ...actor.vehicle },
        startNodeId: actor.startNodeId,
        destinationNodeId: actor.destinationNodeId,
        destinationLabel: this.city.nodes.find((node) => node.id === actor.destinationNodeId)!.label,
        ordersCompleted: actor.ordersCompleted,
        episodeReward: actor.episodeReward,
        lastEvent: actor.lastEvent,
        action: { ...actor.action },
        actionLabel: continuousActionLabel(actor.action),
        radar: actor.observation.radar,
        observation: [...actor.observation.vector],
      })),
      accidents: this.accidents.map((accident) => ({
        id: accident.id,
        x: accident.x,
        y: accident.y,
        vehicleIds: accident.vehicleIds,
        remainingSteps: accident.clearsAt - this.stepCount,
      })),
    };
  }

  get replaySize(): number {
    return this.replay.size;
  }

  dispose(): void {
    this.agent.dispose();
  }

  private createActor(index: number, requested?: { readonly startNodeId: string; readonly destinationNodeId: string }): FleetActor {
    const stops = (this.city.destinationNodeIds ?? this.city.nodes.map((node) => node.id))
      .map((id) => this.city.nodes.find((node) => node.id === id)!)
      .filter(Boolean);
    const from = requested
      ? this.city.nodes.find((node) => node.id === requested.startNodeId)
      : this.bestSpawnNode(index);
    if (!from) throw new Error(`Unknown fleet start node: ${requested?.startNodeId}`);
    const to = requested
      ? this.city.nodes.find((node) => node.id === requested.destinationNodeId)
      : distantStop(from, stops, index * 3 + 1);
    if (!to || to.id === from.id) throw new Error(`Invalid fleet destination: ${requested?.destinationNodeId}`);
    const environment = new ContinuousDrivingEnvironment(routeMap(this.city, from.id, to.id), this.city, to.id);
    const observation = environment.reset(this.actors.map((actor) => ({ id: actor.id, label: actor.label, vehicle: actor.vehicle })));
    return {
      id: `taxi-${index + 1}`,
      label: `出租车 ${alphabeticLabel(index)}`,
      color: fleetColor(index),
      environment,
      observation,
      vehicle: environment.snapshot(),
      startNodeId: from.id,
      destinationNodeId: to.id,
      ordersCompleted: 0,
      episodeReward: 0,
      lastEvent: "step",
      action: { steer: 0, throttle: 0 },
      blockedUntil: 0,
    };
  }

  private bestSpawnNode(index: number) {
    if (this.actors.length === 0) return this.city.nodes[index % this.city.nodes.length];
    return [...this.city.nodes].sort((a, b) => {
      const clearanceA = Math.min(...this.actors.map((actor) => pointDistance(a, actor.vehicle)));
      const clearanceB = Math.min(...this.actors.map((actor) => pointDistance(b, actor.vehicle)));
      return clearanceB - clearanceA || a.id.localeCompare(b.id);
    })[0];
  }

  private continueActor(actor: FleetActor, event: DrivingEvent): void {
    const arrived = event === "goal";
    const stops = (this.city.destinationNodeIds ?? this.city.nodes.map((node) => node.id))
      .map((id) => this.city.nodes.find((node) => node.id === id)!)
      .filter(Boolean);
    let currentNodeId = arrived ? actor.destinationNodeId : nearestNode(this.city, actor.vehicle);
    if (arrived) actor.ordersCompleted += 1;
    if (!arrived) {
      const otherVehicles = this.actors.filter((other) => other !== actor).map((other) => other.vehicle);
      const validSpawns = stops.filter((stop) =>
        stop.id !== currentNodeId && otherVehicles.every((vehicle) => pointDistance(stop, vehicle) >= 24),
      );
      const spawnPool = validSpawns.length ? validSpawns : stops;
      currentNodeId = spawnPool[Math.floor(this.random() * spawnPool.length)].id;
    }
    const currentStop = this.city.nodes.find((node) => node.id === currentNodeId)!;
    const destination = arrived
      ? distantStop(currentStop, stops, Math.floor(this.random() * stops.length)).id
      : actor.destinationNodeId === currentNodeId
        ? distantStop(currentStop, stops, Math.floor(this.random() * stops.length)).id
        : actor.destinationNodeId;
    const environment = new ContinuousDrivingEnvironment(routeMap(this.city, currentNodeId, destination), this.city, destination);
    actor.environment = environment;
    actor.observation = environment.reset(this.actors.filter((other) => other !== actor).map((other) => ({ id: other.id, label: other.label, vehicle: other.vehicle })));
    actor.vehicle = environment.snapshot();
    actor.startNodeId = currentNodeId;
    actor.destinationNodeId = destination;
    actor.episodeReward = 0;
  }

  private detectFleetCollisions(): void {
    for (let first = 0; first < this.actors.length; first += 1) {
      for (let second = first + 1; second < this.actors.length; second += 1) {
        const a = this.actors[first]; const b = this.actors[second];
        if (a.blockedUntil > this.stepCount || b.blockedUntil > this.stepCount) continue;
        if (distanceBetween(a.vehicle, b.vehicle) > 5.5 || !vehiclesCollide(a.vehicle, b.vehicle)) continue;
        const clearsAt = this.stepCount + ACCIDENT_RECOVERY_STEPS;
        a.blockedUntil = clearsAt; b.blockedUntil = clearsAt;
        a.vehicle = { ...a.vehicle, speed: 0, acceleration: 0 };
        b.vehicle = { ...b.vehicle, speed: 0, acceleration: 0 };
        a.lastEvent = "collision"; b.lastEvent = "collision";
        this.accidents.push({
          id: `accident-${this.stepCount}-${a.id}-${b.id}`,
          x: (a.vehicle.x + b.vehicle.x) / 2,
          y: (a.vehicle.y + b.vehicle.y) / 2,
          vehicleIds: [a.id, b.id],
          clearsAt,
        });
        const learner = this.actors[this.learnerIndex];
        if (learner === a || learner === b) {
          const vector = learner.observation.vector;
          this.replay.add({ observation: vector, action: learner.action, reward: FLEET_COLLISION_PENALTY, nextObservation: vector, done: true });
          learner.episodeReward += FLEET_COLLISION_PENALTY;
        }
      }
    }
  }
}
