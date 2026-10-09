import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, PersonSimpleRun } from "@phosphor-icons/react";
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

const POLICY_ICONS: Record<Action, typeof ArrowUp> = {
  [ACTIONS.UP]: ArrowUp,
  [ACTIONS.RIGHT]: ArrowRight,
  [ACTIONS.DOWN]: ArrowDown,
  [ACTIONS.LEFT]: ArrowLeft,
};

interface EnvironmentGridProps {
  currentState: number;
  selectedState: number;
  path: number[];
  greedyActions: (state: number) => Action[];
  onSelectState: (state: number) => void;
}

export function EnvironmentGrid({
  currentState,
  selectedState,
  path,
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
                "relative grid min-h-10 place-items-center overflow-hidden rounded-[6px] border bg-[#f8faf8] text-[10px] text-muted-foreground transition-colors sm:min-h-12",
                visited && "bg-accent",
                selected && "border-primary ring-1 ring-primary",
                cliff && "cursor-not-allowed border-[#2f3432] bg-[#2f3432] text-white",
                goal && "border-success bg-[#e9f5ef] text-success",
              )}
            >
              <span className="absolute left-1 top-0.5 font-mono opacity-55">{state}</span>
              {active ? (
                <PersonSimpleRun aria-hidden size={22} weight="fill" className="text-primary" />
              ) : start ? (
                <span className="font-medium text-foreground">起点</span>
              ) : goal ? (
                <span className="flex items-center gap-1 font-medium"><Flag size={14} />终点</span>
              ) : cliff ? (
                <span className="hidden font-medium sm:inline">悬崖</span>
              ) : (
                <span className="flex gap-0.5 text-[#8a948f]">
                  {actions.slice(0, 2).map((action) => {
                    const Icon = POLICY_ICONS[action];
                    return <Icon key={action} size={13} aria-hidden />;
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>琥珀色图标：智能体</span>
        <span>深色区域：悬崖，奖励 -100</span>
        <span>普通移动：奖励 -1</span>
      </div>
    </div>
  );
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

