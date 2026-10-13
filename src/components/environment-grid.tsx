import { useMemo, useState } from "react";
import { Flag, PersonSimpleRun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  ACTIONS,
  COLUMNS,
  GOAL_STATE,
  isReachableState,
  ROWS,
  STATE_COUNT,
  terrainForState,
  type Action,
  type Terrain,
} from "@/domain/cliff-walking";
import { cn } from "@/lib/utils";

type MapLayer = "terrain" | "policy" | "value";

const ACTION_SYMBOLS: Record<Action, string> = {
  [ACTIONS.UP]: "↑",
  [ACTIONS.RIGHT]: "→",
  [ACTIONS.DOWN]: "↓",
  [ACTIONS.LEFT]: "←",
};

const TERRAIN_NAMES: Record<Terrain, string> = {
  plain: "普通地面",
  mud: "泥地",
  wall: "墙体",
  cliff: "悬崖",
  start: "起点",
  goal: "目标",
};

export interface QUpdateHighlight { state: number; action: Action; version: number }

interface EnvironmentGridProps {
  currentState: number;
  selectedState: number;
  path: number[];
  qMatrix: number[][];
  visitCounts: number[];
  lastQUpdate?: QUpdateHighlight;
  greedyActions: (state: number) => Action[];
  onSelectState: (state: number) => void;
}

export function EnvironmentGrid({
  currentState,
  selectedState,
  path,
  qMatrix,
  visitCounts,
  lastQUpdate,
  greedyActions,
  onSelectState,
}: EnvironmentGridProps) {
  const [layer, setLayer] = useState<MapLayer>("terrain");
  const valueRange = useMemo(() => {
    const maxima = qMatrix.filter((_, state) => isReachableState(state)).map((values) => Math.max(...values));
    return { min: Math.min(0, ...maxima), max: Math.max(0, ...maxima) };
  }, [qMatrix]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-control border bg-[#f0f2f0] p-1" aria-label="地图观察层">
          {(["terrain", "policy", "value"] as MapLayer[]).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={layer === item ? "secondary" : "ghost"}
              aria-pressed={layer === item}
              onClick={() => setLayer(item)}
            >
              {item === "terrain" ? "地形" : item === "policy" ? "策略" : "价值"}
            </Button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">10 × 16 / {STATE_COUNT} states / selected {selectedState}</p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[720px] gap-1"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
          role="grid"
          aria-label={`${ROWS} 行 ${COLUMNS} 列峡谷导航环境，智能体当前位于状态 ${currentState}`}
        >
          {Array.from({ length: STATE_COUNT }, (_, state) => {
            const terrain = terrainForState(state);
            const reachable = isReachableState(state);
            const active = state === currentState;
            const selected = state === selectedState;
            const visited = path.includes(state);
            const values = qMatrix[state] ?? [0, 0, 0, 0];
            const best = Math.max(...values);
            const actions = reachable && state !== GOAL_STATE ? greedyActions(state) : [];
            const policy = actions.length === 1 ? ACTION_SYMBOLS[actions[0]] : "·";
            const updateAtState = lastQUpdate?.state === state;

            return (
              <button
                key={state}
                type="button"
                data-testid="grid-cell"
                role="gridcell"
                disabled={!reachable}
                aria-label={cellLabel(state, terrain, active)}
                aria-selected={selected}
                onClick={() => onSelectState(state)}
                className={cn(
                  "map-cell relative grid aspect-square min-h-8 place-items-center overflow-hidden rounded-[4px] border bg-[#fafbf9] text-[10px] text-muted-foreground transition-[border-color,background-color,transform] duration-200",
                  terrain === "mud" && "map-cell-mud bg-[#f4efe3]",
                  terrain === "wall" && "map-cell-wall cursor-not-allowed border-[#8b938f] bg-[#dfe4e1]",
                  terrain === "cliff" && "map-cell-cliff cursor-not-allowed border-[#2f3432] bg-[#2f3432] text-white",
                  terrain === "goal" && "border-success bg-[#e9f5ef] text-success",
                  visited && reachable && "shadow-[inset_0_0_0_2px_rgba(217,119,6,0.22)]",
                  selected && reachable && "z-10 border-primary ring-2 ring-primary",
                  active && "z-20 border-primary ring-2 ring-primary",
                  updateAtState && "q-heat-flash",
                )}
                style={layer === "value" && reachable ? valueStyle(best, valueRange.min, valueRange.max) : undefined}
              >
                <span className="absolute left-1 top-1 font-mono text-[7px] leading-none opacity-45">{state}</span>
                {active ? (
                  <span data-testid="agent-marker" className="grid size-5 place-items-center rounded-full bg-white shadow-sm ring-1 ring-primary">
                    <PersonSimpleRun aria-hidden size={13} weight="fill" className="text-primary" />
                  </span>
                ) : terrain === "start" ? (
                  <span className="font-mono text-[10px] font-bold text-foreground">S</span>
                ) : terrain === "goal" ? (
                  <Flag size={15} weight="fill" aria-label="目标" />
                ) : terrain === "wall" ? (
                  <span className="text-[8px] font-semibold text-[#59625d]">墙</span>
                ) : terrain === "cliff" ? (
                  <span className="text-[8px] font-semibold">崖</span>
                ) : layer === "policy" ? (
                  <span className="font-mono text-base font-semibold text-foreground">{policy}</span>
                ) : layer === "value" ? (
                  <span className="rounded-[3px] bg-white/75 px-1 font-mono text-[8px] font-semibold text-foreground">{formatValue(best)}</span>
                ) : terrain === "mud" ? (
                  <span className="text-[8px] font-semibold text-[#725834]">泥</span>
                ) : visitCounts[state] > 0 ? (
                  <span className="font-mono text-[8px] text-primary">{visitCounts[state]}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        <Legend swatch="bg-white ring-1 ring-primary" label="智能体 / 选中" />
        <Legend swatch="map-cell-wall bg-[#dfe4e1]" label="墙，撞击 -4" />
        <Legend swatch="bg-[#f4efe3]" label="泥地 -3" />
        <Legend swatch="bg-[#2f3432]" label="悬崖 -60" />
        <Legend swatch="bg-[#e9f5ef]" label="目标 +30" />
        <span>普通移动 -1 · 边界碰撞 -4</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-[3px] border", swatch)} />{label}</span>;
}

function valueStyle(value: number, minimum: number, maximum: number) {
  const spread = Math.max(1, maximum - minimum);
  const ratio = (value - minimum) / spread;
  return { backgroundColor: `rgba(217, 119, 6, ${0.08 + ratio * 0.48})` };
}

function formatValue(value: number) {
  const safeValue = Object.is(value, -0) ? 0 : value;
  return Math.abs(safeValue) >= 100 ? safeValue.toFixed(0) : safeValue.toFixed(1);
}

function cellLabel(state: number, terrain: Terrain, active: boolean) {
  return [`状态 ${state}`, TERRAIN_NAMES[terrain], active ? "智能体当前位置" : ""].filter(Boolean).join("，");
}
