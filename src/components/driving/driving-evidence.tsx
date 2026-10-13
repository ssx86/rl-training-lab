import { DRIVING_ACTIONS, DRIVING_OBSERVATION_FIELDS } from "@/driving/types";
import type { TrainingStepEvidence } from "@/driving/training-runtime";

interface DrivingEvidenceProps {
  evidence: TrainingStepEvidence | null;
}

const OBSERVATION_LABELS: Record<string, string> = {
  lidarFarLeft: "左 60°",
  lidarLeft: "左 30°",
  lidarFront: "正前方",
  lidarRight: "右 30°",
  lidarFarRight: "右 60°",
  speed: "速度",
  headingSin: "航向 sin",
  headingCos: "航向 cos",
  lateralOffset: "横向偏差",
  routeProgress: "路线进度",
  previousSteer: "上次转向",
  previousAcceleration: "上次加速度",
};

const REWARD_LABELS: Record<string, string> = {
  progress: "进度奖励",
  checkpoint: "检查点",
  goal: "抵达终点",
  step: "步进成本",
  laneOffset: "车道偏差",
  danger: "危险距离",
  steeringJerk: "转向突变",
  reverse: "倒退",
  offRoad: "驶离道路",
  offRoadTerminal: "越界终止",
  collision: "碰撞",
};

export function DrivingEvidence({ evidence }: DrivingEvidenceProps) {
  if (!evidence) {
    return (
      <div className="rounded-panel border border-dashed bg-card px-4 py-10 text-center">
        <h3 className="text-sm font-semibold">等待第一条真实 transition</h3>
        <p className="mx-auto mt-2 max-w-[30ch] text-xs leading-5 text-muted-foreground">
          单步或开始训练后，这里会按观察、动作价值、选择、奖励、下一状态的顺序显示证据。
        </p>
      </div>
    );
  }

  const observation = evidence.transition.observation;
  return (
    <div className="space-y-4" aria-live="polite">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">观察 s</h3>
          <span className="font-mono text-[10px] text-muted-foreground">12 values</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 text-[11px]">
          {DRIVING_OBSERVATION_FIELDS.map((field) => (
            <div key={field} className="flex items-center justify-between border-b py-1.5">
              <dt className="text-muted-foreground">{OBSERVATION_LABELS[field]}</dt>
              <dd className="font-mono">{observation[field].toFixed(3)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">动作价值 Q(s, a)</h3>
          <span className="text-[10px] text-muted-foreground">
            {evidence.source === "exploit" ? "利用" : "探索"} · ε {evidence.epsilon.toFixed(3)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DRIVING_ACTIONS.map((action, index) => {
            const selected = evidence.transition.action === action.id;
            return (
              <div
                key={action.id}
                data-testid="action-q-value"
                className={`rounded-[6px] border px-2 py-1.5 ${selected ? "border-2 border-primary bg-accent" : "bg-card"}`}
                title={action.label}
              >
                <div className="truncate text-[10px] text-muted-foreground">{action.label}</div>
                <div className="mt-0.5 font-mono text-xs">{evidence.qValues[index].toFixed(3)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">奖励 r</h3>
          <span className="font-mono text-xs font-semibold">Σ {evidence.transition.reward.toFixed(3)}</span>
        </div>
        <dl className="text-[11px]">
          {Object.entries(evidence.transition.rewardBreakdown).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between border-b py-1.5">
              <dt className="text-muted-foreground">{REWARD_LABELS[key] ?? key}</dt>
              <dd className="font-mono">{value >= 0 ? "+" : ""}{value.toFixed(3)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="rounded-control bg-[#eef1ef] px-3 py-2 text-[11px]">
        <span className="font-semibold">s′ / done</span>
        <span className="ml-2 text-muted-foreground">
          {evidence.transition.done ? `结束：${evidence.transition.event}` : `继续 · ${evidence.transition.event}`}
        </span>
      </div>
    </div>
  );
}
