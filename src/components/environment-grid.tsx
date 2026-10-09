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

const ACTION_META: Record<Action, { symbol: string; position: string; clipPath: string }> = {
  [ACTIONS.UP]: {
    symbol: "↑",
    position: "left-1/2 top-0.5 -translate-x-1/2",
    clipPath: "polygon(0 0, 100% 0, 50% 50%)",
  },
  [ACTIONS.RIGHT]: {
    symbol: "→",
    position: "right-0.5 top-1/2 -translate-y-1/2",
    clipPath: "polygon(100% 0, 100% 100%, 50% 50%)",
  },
  [ACTIONS.DOWN]: {
    symbol: "↓",
    position: "bottom-0.5 left-1/2 -translate-x-1/2",
    clipPath: "polygon(0 100%, 100% 100%, 50% 50%)",
  },
  [ACTIONS.LEFT]: {
    symbol: "←",
    position: "left-0.5 top-1/2 -translate-y-1/2",
    clipPath: "polygon(0 0, 0 100%, 50% 50%)",
  },
};

interface EnvironmentGridProps {
  currentState: number;
  selectedState: number;
  path: number[];
  qMatrix: number[][];
  greedyActions: (state: number) => Action[];
  onSelectState: (state: number) => void;
}

export function EnvironmentGrid({
  currentState,
  selectedState,
  path,
  qMatrix,
  greedyActions,
  onSelectState,
}: EnvironmentGridProps) {
  const { minimumQ, maximumQ } = qRange(qMatrix);

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
                selected && "border-primary ring-1 ring-primary",
                cliff && "cursor-not-allowed border-[#2f3432] bg-[#2f3432] text-white",
                goal && "border-success bg-[#e9f5ef] text-success",
              )}
            >
              {!cliff && !goal && qValues.map((value, actionIndex) => {
                const action = actionIndex as Action;
                const meta = ACTION_META[action];
                const greedy = actions.includes(action);
                return (
                  <span key={action}>
                    <span
                      aria-hidden
                      className="absolute inset-0 transition-colors duration-200"
                      style={{
                        backgroundColor: qHeatColor(value, minimumQ, maximumQ),
                        clipPath: meta.clipPath,
                      }}
                    />
                    <span
                      className={cn(
                        "absolute z-10 whitespace-nowrap font-mono text-[7px] leading-none tracking-[-0.06em] text-[#4f5a55] sm:text-[8px] 2xl:text-[9px]",
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
                <span className="relative z-10 grid size-4 place-items-center rounded-full bg-white/90 ring-1 ring-primary sm:size-5">
                  <PersonSimpleRun aria-hidden size={13} weight="fill" className="text-primary sm:size-[15px]" />
                </span>
              ) : start ? (
                <span className="relative z-10 font-mono text-[8px] font-bold text-foreground">S</span>
              ) : goal ? (
                <span className="relative z-10 flex items-center gap-1 font-medium" title="终点">
                  <Flag size={13} weight="fill" />
                  <span className="sr-only">终点</span>
                </span>
              ) : cliff ? (
                <span className="hidden font-medium sm:inline">悬崖</span>
              ) : (
                <span className="relative z-10 font-mono text-[7px] font-semibold text-foreground/55 sm:text-[8px]">
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
        <span className="inline-flex items-center gap-1.5 font-mono">
          低 {formatCompactQ(minimumQ)}
          <span className="size-2 rounded-[2px] bg-[rgba(182,70,58,0.36)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(182,70,58,0.18)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(102,112,107,0.12)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(217,119,6,0.18)]" />
          <span className="size-2 rounded-[2px] bg-[rgba(217,119,6,0.36)]" />
          {formatCompactQ(maximumQ)} 高
        </span>
      </div>
    </div>
  );
}

function qRange(qMatrix: number[][]) {
  const reachableValues = qMatrix.flatMap((values, state) =>
    isCliffState(state) || state === GOAL_STATE ? [] : values,
  );
  return {
    minimumQ: Math.min(...reachableValues, 0),
    maximumQ: Math.max(...reachableValues, 0),
  };
}

function qHeatColor(value: number, minimumQ: number, maximumQ: number) {
  if (minimumQ === maximumQ) return "rgba(102, 112, 107, 0.12)";

  const ratio = (value - minimumQ) / (maximumQ - minimumQ);
  if (ratio <= 0.2) return "rgba(182, 70, 58, 0.36)";
  if (ratio <= 0.4) return "rgba(182, 70, 58, 0.18)";
  if (ratio <= 0.6) return "rgba(102, 112, 107, 0.12)";
  if (ratio <= 0.8) return "rgba(217, 119, 6, 0.18)";
  return "rgba(217, 119, 6, 0.36)";
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

