import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ACTION_LABELS, EVENT_LABELS, stateToPosition } from "@/domain/cliff-walking";
import type { StepResult } from "@/domain/training-session";
import { formatMetric } from "@/lib/utils";

interface MetricsPanelProps {
  episode: number;
  totalSteps: number;
  totalFalls: number;
  totalCollisions: number;
  successCount: number;
  epsilon: number;
  lastStep: StepResult | null;
}

export function MetricsPanel({ episode, totalSteps, totalFalls, totalCollisions, successCount, epsilon, lastStep }: MetricsPanelProps) {
  const currentPosition = lastStep ? stateToPosition(lastStep.nextState) : null;
  const rows = lastStep
    ? [
        ["状态", `${lastStep.state} → ${lastStep.nextState}`],
        ["坐标", currentPosition ? `r${currentPosition.row + 1} · c${currentPosition.column + 1}` : ""],
        ["动作", `${ACTION_LABELS[lastStep.action]} / ${lastStep.source === "exploration" ? "探索" : "利用"}`],
        ["奖励事件", EVENT_LABELS[lastStep.event]],
        ["奖励", lastStep.reward > 0 ? `+${lastStep.reward}` : lastStep.reward],
        ["旧 Q", formatMetric(lastStep.oldQ)],
        ["下一状态最大 Q", formatMetric(lastStep.nextMaxQ)],
        ["TD target", formatMetric(lastStep.tdTarget)],
        ["TD error", formatMetric(lastStep.tdError)],
        ["新 Q", formatMetric(lastStep.newQ)],
      ]
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="text-sm font-semibold">实时数据</h2>
        <span className="font-mono text-xs text-muted-foreground">epsilon {epsilon.toFixed(4)}</span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-control border bg-border">
          <Metric label="当前回合" value={episode} />
          <Metric label="总步数" value={totalSteps} />
          <Metric label="成功回合" value={successCount} />
          <Metric label="掉落次数" value={totalFalls} />
          <Metric label="边界 / 撞墙" value={totalCollisions} />
          <Metric label="当前 epsilon" value={epsilon.toFixed(3)} />
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">当前步骤</h3>
        {lastStep ? (
          <dl className="space-y-2 text-xs">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono text-right text-foreground">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2">
              <dt className="text-muted-foreground">本回合步数</dt>
              <dd data-testid="episode-step" className="font-mono">{lastStep.episodeStep}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">累计回报</dt>
              <dd className="font-mono">{lastStep.cumulativeReward}</dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-control border border-dashed p-4 text-xs leading-5 text-muted-foreground">点击“单步”观察第一条状态转移。</p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="bg-card p-3"><div className="font-mono text-lg font-semibold">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{label}</div></div>;
}

