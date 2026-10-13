import type { Point } from "@/simulation/geometry";
import { OSM_VATHORST_CITY } from "./osm-vathorst.generated";
import { OSM_MILTON_KEYNES_CITY } from "./osm-milton-keynes.generated";
import { OSM_HOUTEN_CITY } from "./osm-houten.generated";

export type CityObjectKind = "building" | "tree" | "barrier" | "station";

export interface CityNode extends Point {
  readonly id: string;
  readonly label: string;
}

export interface CityEdge {
  readonly from: string;
  readonly to: string;
  readonly roadClass?: string;
  readonly roundabout?: boolean;
  readonly oneWay?: boolean;
}

export interface CityObject extends Point {
  readonly id: string;
  readonly kind: CityObjectKind;
  readonly size: number;
}

export interface CityRoad {
  readonly id: string;
  readonly points: readonly Point[];
  readonly roadClass: string;
  readonly roundabout: boolean;
}

export interface CityMap {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly roadWidth: number;
  readonly nodes: readonly CityNode[];
  readonly edges: readonly CityEdge[];
  readonly objects: readonly CityObject[];
  readonly roads?: readonly CityRoad[];
  readonly renderRoadWidth?: number;
  readonly destinationNodeIds?: readonly string[];
  readonly attribution?: string;
  readonly sourceUrl?: string;
}

const GRID_NODES: CityNode[] = [
  ["nw", 100, 100, "北湾"], ["n", 480, 100, "中央站"], ["ne", 860, 100, "科技园"],
  ["w", 100, 320, "西市集"], ["c", 480, 320, "市政厅"], ["e", 860, 320, "东码头"],
  ["sw", 100, 540, "河畔"], ["s", 480, 540, "南广场"], ["se", 860, 540, "机场"],
].map(([id, x, y, label]) => ({ id: String(id), x: Number(x), y: Number(y), label: String(label) }));

const GRID_EDGES: CityEdge[] = [
  ["nw", "n"], ["n", "ne"], ["w", "c"], ["c", "e"], ["sw", "s"], ["s", "se"],
  ["nw", "w"], ["w", "sw"], ["n", "c"], ["c", "s"], ["ne", "e"], ["e", "se"],
  ["nw", "c"], ["c", "se"],
].map(([from, to]) => ({ from, to }));

function cityObjects(variant: number): CityObject[] {
  const blocks = [
    [290, 205], [670, 205], [290, 430], [670, 430],
  ];
  const buildings = blocks.flatMap(([x, y], index) => [
    { id: `b-${variant}-${index}`, kind: "building" as const, x, y, size: 54 + (index % 2) * 10 },
    { id: `t-${variant}-${index}`, kind: "tree" as const, x: x + 72, y: y + (variant - 1) * 8, size: 12 },
  ]);
  return [
    ...buildings,
    { id: `barrier-${variant}-a`, kind: "barrier", x: 315 + variant * 10, y: 320, size: 15 },
    { id: `barrier-${variant}-b`, kind: "barrier", x: 650 - variant * 12, y: 100, size: 14 },
    { id: `station-${variant}`, kind: "station", x: 480, y: 278, size: 16 },
  ];
}

export const CITY_MAPS: readonly CityMap[] = [
  OSM_VATHORST_CITY,
  { id: "river-bend", name: "河湾城区", width: 960, height: 640, roadWidth: 76, nodes: GRID_NODES, edges: GRID_EDGES, objects: cityObjects(0) },
  { id: "grid-central", name: "中央棋盘城", width: 960, height: 640, roadWidth: 72, nodes: GRID_NODES, edges: [...GRID_EDGES, { from: "ne", to: "c" }, { from: "c", to: "sw" }], objects: cityObjects(1) },
  { id: "harbor-loop", name: "环岛港区", width: 960, height: 640, roadWidth: 80, nodes: GRID_NODES, edges: [...GRID_EDGES, { from: "n", to: "e" }, { from: "e", to: "s" }, { from: "s", to: "w" }, { from: "w", to: "n" }], objects: cityObjects(2) },
] as const;

export const FLEET_CITY_MAPS: readonly CityMap[] = [
  OSM_VATHORST_CITY,
  OSM_MILTON_KEYNES_CITY,
  OSM_HOUTEN_CITY,
] as const;

const routeCache = new WeakMap<CityMap, Map<string, CityNode[]>>();

export function cityIsConnected(city: CityMap): boolean {
  if (!city.nodes.length) return false;
  const visited = new Set<string>([city.nodes[0].id]);
  const queue = [city.nodes[0].id];
  while (queue.length) {
    const current = queue.shift()!;
    city.edges.forEach((edge) => {
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }
  return visited.size === city.nodes.length;
}

export function shortestCityRoute(city: CityMap, from: string, to: string): CityNode[] {
  let cityCache = routeCache.get(city);
  if (!cityCache) {
    cityCache = new Map();
    routeCache.set(city, cityCache);
  }
  const cacheKey = `${from}->${to}`;
  const cached = cityCache.get(cacheKey);
  if (cached) return cached;
  const nodes = new Map(city.nodes.map((node) => [node.id, node]));
  const distances = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = new Set<string>([from]);
  while (queue.size) {
    const current = [...queue].reduce((best, id) =>
      (distances.get(id) ?? Infinity) < (distances.get(best) ?? Infinity) ? id : best,
    );
    queue.delete(current);
    if (current === to) break;
    city.edges.forEach((edge) => {
      const next = edge.from === current
        ? edge.to
        : edge.to === current && !edge.oneWay
          ? edge.from
          : null;
      if (!next) return;
      const a = nodes.get(current)!;
      const b = nodes.get(next)!;
      const candidate = (distances.get(current) ?? Infinity) + Math.hypot(a.x - b.x, a.y - b.y);
      if (candidate < (distances.get(next) ?? Infinity)) {
        distances.set(next, candidate);
        previous.set(next, current);
        queue.add(next);
      }
    });
  }
  if (!previous.has(to)) throw new Error(`No route from ${from} to ${to} in ${city.id}.`);
  const ids: string[] = [];
  for (let cursor: string | null = to; cursor; cursor = previous.get(cursor) ?? null) ids.unshift(cursor);
  const route = ids.map((id) => nodes.get(id)!);
  cityCache.set(cacheKey, route);
  return route;
}
