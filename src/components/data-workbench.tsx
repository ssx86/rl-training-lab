import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ALGORITHM_ROADMAP } from "@/catalog/experiment-catalog";
import { ACTION_LABELS, isReachableState, stateToPosition, terrainForState, type Action } from "@/domain/cliff-walking";
import type { EpisodeRecord } from "@/hooks/use-lab";
import { cn, formatMetric } from "@/lib/utils";

interface DataWorkbenchProps {
  selectedState: number;
  qMatrix: number[][];
  history: EpisodeRecord[];
  greedyActions: (state: number) => Action[];
}

export function DataWorkbench({ selectedState, qMatrix, history, greedyActions }: DataWorkbenchProps) {
  const selectedValues = qMatrix[selectedState] ?? [0, 0, 0, 0];
  const position = stateToPosition(selectedState);
  return (
    <section className="rounded-panel border bg-card p-4">
      <Tabs defaultValue="q-table">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">状态观察与学习证据</h2><p className="mt-1 text-xs text-muted-foreground">状态 {selectedState} · r{position.row + 1} c{position.column + 1} · {terrainForState(selectedState)}</p></div>
          <TabsList>
            <TabsTrigger value="q-table">Q 值</TabsTrigger>
            <TabsTrigger value="curve">学习曲线</TabsTrigger>
            <TabsTrigger value="episodes">回合记录</TabsTrigger>
            <TabsTrigger value="roadmap">算法路径</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="q-table">
          <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border bg-border md:grid-cols-4">
            {selectedValues.map((value, action) => {
              const greedy = greedyActions(selectedState).includes(action as Action);
              return <div key={action} className={cn("bg-card p-3", greedy && "bg-accent")}><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{ACTION_LABELS[action as Action]}</span><span>{greedy ? "贪心" : ""}</span></div><div className={cn("mt-2 font-mono text-xl font-semibold", greedy && "text-primary")}>{formatMetric(value)}</div></div>;
            })}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">完整 Q 表仅列出可达状态；琥珀色表示当前并列最大动作。</p>
          <div className="overflow-auto rounded-control border">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead className="sticky top-0 bg-[#f0f2f0] text-muted-foreground"><tr><th className="p-2 text-left">状态</th>{Object.values(ACTION_LABELS).map((label) => <th key={label} className="p-2 text-right">{label}</th>)}</tr></thead>
              <tbody>{qMatrix.map((values, state) => isReachableState(state) ? <tr key={state} className={cn("border-t", state === selectedState && "bg-accent")}><th className="p-2 text-left font-mono font-medium">{state}</th>{values.map((value, action) => <td key={action} className={cn("p-2 text-right font-mono", greedyActions(state).includes(action as Action) && "font-semibold text-primary")}>{formatMetric(value)}</td>)}</tr> : null)}</tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="curve">
          {history.length ? (
            <div className="h-64" aria-label="每回合累计回报折线图">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><XAxis dataKey="episode" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={44} /><Tooltip /><Line type="monotone" dataKey="reward" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
            </div>
          ) : <EmptyData text="完成一个回合后显示回报曲线。" />}
        </TabsContent>

        <TabsContent value="episodes">
          {history.length ? <div className="overflow-auto"><table className="w-full min-w-[620px] text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-2">回合</th><th>回报</th><th>步数</th><th>epsilon</th><th>掉落</th><th>结果</th></tr></thead><tbody>{history.slice().reverse().map((record) => <tr key={record.episode} className="border-t"><td className="py-2 font-mono">{record.episode}</td><td className="font-mono">{record.reward}</td><td className="font-mono">{record.steps}</td><td className="font-mono">{record.epsilon.toFixed(4)}</td><td className="font-mono">{record.falls}</td><td>{record.success ? "到达终点" : "超过步数"}</td></tr>)}</tbody></table></div> : <EmptyData text="暂无已完成回合。" />}
        </TabsContent>

        <TabsContent value="roadmap">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{ALGORITHM_ROADMAP.map((lesson) => <AlgorithmStage key={lesson.id} name={lesson.name} status={lesson.statusLabel} question={lesson.learningQuestion} evidence={lesson.evidence} signals={lesson.requiredSignals} active={lesson.status === "active"} />)}</div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">所有算法沿用同一方法：环境事件可解释、单步公式可展开、全局策略可观察、回合结果可比较、边界行为有确定性测试。未标为“当前实验”的算法尚未实现。</p>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function AlgorithmStage({ name, status, question, evidence, signals, active = false }: { name: string; status: string; question: string; evidence: string; signals: readonly string[]; active?: boolean }) {
  return <article className={cn("rounded-control border p-4", active && "border-[#e7ba72] bg-accent")}><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{name}</h3><span className={cn("text-[10px] text-muted-foreground", active && "text-primary")}>{status}</span></div><p className="mt-3 text-xs leading-5 text-foreground">{question}</p><p className="mt-3 font-mono text-[10px] text-muted-foreground">{evidence}</p><p className="mt-2 border-t pt-2 font-mono text-[9px] text-muted-foreground">signals: {signals.join(" · ")}</p></article>;
}

function EmptyData({ text }: { text: string }) {
  return <p className="rounded-control border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</p>;
}

