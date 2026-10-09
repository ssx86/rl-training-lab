import { Flag, PersonSimpleRun } from "@phosphor-icons/react";
import {
  ACTIONS,
  COLUMNS,
  GOAL_STATE,
  isCliffState,
  ROWS,
  START_STATE,
  type Action,
} from "@/domain/cliff-walking";
import { cn } from "@/lib/utils";

type HeatLevel = "neutral" | "best" | "good" | "weak" | "worst";

const ACTION_META: Record<Action, { symbol: string; position: string; heatPosition: string }> = {
  [ACTIONS.UP]: {
    symbol: "↑",
    position: "left-1/2 top-0.5 -translate-x-1/2",
    heatPosition: "left-0 right-0 top-0 h-1/4 md:left-[22%] md:right-[22%] md:h-[30%] md:rounded-b-[4px]",
  },
  [ACTIONS.RIGHT]: {
    symbol: "→",
    position: "left-1/2 top-[26%] -translate-x-1/2 md:left-auto md:right-0.5 md:top-[26%] md:translate-x-0 md:-translate-y-1/2",
    heatPosition: "left-0 right-0 top-1/4 h-1/4 md:bottom-[22%] md:left-auto md:right-0 md:top-[22%] md:h-auto md:w-[30%] md:rounded-l-[4px]",
  },
  [ACTIONS.DOWN]: {
    symbol: "↓",
    position: "left-1/2 top-[51%] -translate-x-1/2 md:bottom-0.5 md:top-auto",
    heatPosition: "left-0 right-0 top-1/2 h-1/4 md:bottom-0 md:left-[22%] md:right-[22%] md:top-auto md:h-[30%] md:rounded-t-[4px]",
  },
  [ACTIONS.LEFT]: {
    symbol: "←",
    position: "bottom-0.5 left-1/2 -translate-x-1/2 md:bottom-auto md:left-0.5 md:top-[74%] md:translate-x-0 md:-translate-y-1/2",
    heatPosition: "bottom-0 left-0 right-0 h-1/4 md:bottom-[22%] md:right-auto md:top-[22%] md:h-auto md:w-[30%] md:rounded-r-[4px]",
  },
};

const HEAT_COLORS: Record<HeatLevel, string> = {
  neutral: "rgba(226, 232, 240, 0.72)",
  best: "rgba(220, 38, 38, 0.62)",
  good: "rgba(251, 146, 60, 0.56)",
  weak: "rgba(147, 197, 253, 0.58)",
  worst: "rgba(37, 99, 235, 0.62)",
};

export interface QUpdateHighlight {
  state: number;
  action: Action;
  version: number;
}

interface EnvironmentGridProps {
  currentState: number;
  selectedState: number;
  path: number[];
  qMatrix: number[][];
  lastQUpdate?: QUpdateHighlight;
  greedyActions: (state: number) => Action[];
  onSelectState: (state: number) => void;
}

export function EnvironmentGrid({
  currentState,
  selectedState,
  path,
  qMatrix,
  lastQUpdate,
  greedyActions,
  onSelectState,
}: EnvironmentGridProps) {
  return (
    <div>
      <div
        className="grid aspect-[3/1] w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        role="grid"
        aria-label={`${ROWS} 行 ${COLUMNS} 列悬崖行走环境，智能体当前位于状态 ${currentState}`}
      >
        {Array.from({ length: ROWS * COLUMNS }, (_, state) => {
          const cliff = isCliffState(state);
          const start = state === START_STATE;
          const goal = state === GOAL_STATE;
          const active = state === currentState;
          const selected = state === selectedState;
          const visited = path.includes(state);
          const actions = cliff || goal ? [] : greedyActions(state);
          const qValues = qMatrix[state] ?? [0, 0, 0, 0];

          return (
            <button
              key={state}
              type="button"
              data-testid="grid-cell"
              role="gridcell"
              disabled={cliff}
              aria-label={cellLabel(state, { cliff, start, goal, active })}
              aria-selected={selected}
              onClick={() => onSelectState(state)}
              className={cn(
                "relative grid min-h-11 place-items-center overflow-hidden rounded-[6px] border bg-[#f8faf8] text-muted-foreground transition-colors sm:min-h-14",
                visited && "shadow-[inset_0_0_0_1px_rgba(217,119,6,0.28)]",
                active && "border-primary ring-2 ring-primary",
                selected && "border-primary ring-1 ring-primary",
                cliff && "cursor-not-allowed border-[#2f3432] bg-[#2f3432] text-white",
                goal && "border-success bg-[#e9f5ef] text-success",
              )}
            >
              {!cliff && !goal && qValues.map((value, actionIndex) => {
                const action = actionIndex as Action;
                const meta = ACTION_META[action];
                const greedy = actions.includes(action);
                const heatLevel = qHeatLevel(value, qValues);
                const highlighted = lastQUpdate?.state === state && lastQUpdate.action === action;
                return (
                  <span key={`${action}-${highlighted ? lastQUpdate.version : "stable"}`}>
                    <span
                      aria-hidden
                      data-testid={`q-heat-${action}`}
                      data-heat={heatLevel}
                      data-highlight={highlighted ? "true" : undefined}
                      data-update-version={highlighted ? lastQUpdate.version : undefined}
                      className={cn(
                        "absolute transition-colors duration-200",
                        meta.heatPosition,
                        highlighted && "q-heat-flash",
                      )}
                      style={{ backgroundColor: HEAT_COLORS[heatLevel] }}
                    />
                    <span
                      className={cn(
                        "absolute z-10 whitespace-nowrap rounded-[2px] bg-white/80 px-px py-[1px] font-mono text-[7px] leading-none tracking-[-0.06em] text-[#37413c] shadow-[0_0_0_1px_rgba(255,255,255,0.45)] sm:text-[8px] 2xl:text-[9px]",
                        meta.position,
                        greedy && "font-bold text-foreground",
                      )}
                      title={`${meta.symbol} ${value}`}
                    >
                      {meta.symbol}{formatCompactQ(value)}
                    </span>
                  </span>
                );
              })}

              <span className={cn(
                "absolute left-0.5 top-0.5 z-10 font-mono text-[7px] leading-none opacity-55 sm:text-[8px]",
                !cliff && !goal && "sr-only",
              )}>{state}</span>

              {active && !cliff && !goal ? (
                <span
                  data-testid="agent-marker"
                  className="absolute left-1/2 top-1/2 z-20 hidden size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white ring-1 ring-primary md:grid"
                >
                  <PersonSimpleRun aria-hidden size={11} weight="fill" className="text-primary" />
                </span>
              ) : start ? (
                <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-[8px] font-bold text-foreground">S</span>
              ) : goal ? (
                <span className="relative z-10 flex items-center gap-1 font-medium" title="终点">
                  <Flag size={13} weight="fill" />
                  <span className="sr-only">终点</span>
                </span>
              ) : cliff ? (
                <span className="hidden font-medium sm:inline">悬崖</span>
              ) : (
                <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] font-semibold text-foreground/55 sm:text-[8px]">
                  {state}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>琥珀色图标：智能体</span>
        <span>深色区域：悬崖，奖励 -100</span>
        <span>普通移动：奖励 -1</span>
        <span className="inline-flex items-center gap-1.5">
          格内相对：低
          <span className="size-2 rounded-[2px] bg-[rgba(37,99,235,0.62)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(147,197,253,0.58)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(251,146,60,0.56)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(220,38,38,0.62)]" />
          优
          <span className="ml-1 size-2 rounded-[2px] bg-[rgba(226,232,240,0.72)]" />
          等值
        </span>
      </div>
    </div>
  );
}

function qHeatLevel(value: number, values: number[]): HeatLevel {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return "neutral";

  const ratio = (value - minimum) / (maximum - minimum);
  if (ratio >= 0.75) return "best";
  if (ratio >= 0.5) return "good";
  if (ratio >= 0.25) return "weak";
  return "worst";
}

function formatCompactQ(value: number) {
  return (Object.is(value, -0) ? 0 : value).toFixed(1);
}

function cellLabel(
  state: number,
  flags: { cliff: boolean; start: boolean; goal: boolean; active: boolean },
) {
  const labels = [`状态 ${state}`];
  if (flags.start) labels.push("起点");
  if (flags.goal) labels.push("终点");
  if (flags.cliff) labels.push("悬崖");
  if (flags.active) labels.push("智能体当前位置");
  return labels.join("，");
}

