import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACTION_LABELS, type Action } from "@/domain/cliff-walking";
import type { EpisodeRecord } from "@/hooks/use-lab";
import { cn, formatMetric } from "@/lib/utils";

interface DataWorkbenchProps {
  selectedState: number;
  qMatrix: number[][];
  history: EpisodeRecord[];
  greedyActions: (state: number) => Action[];
}

export function DataWorkbench({ selectedState, qMatrix, history, greedyActions }: DataWorkbenchProps) {
  return (
    <section className="rounded-panel border bg-card p-4">
      <Tabs defaultValue="q-table">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">学习数据</h2>
          <TabsList>
            <TabsTrigger value="q-table">Q 表</TabsTrigger>
            <TabsTrigger value="curve">学习曲线</TabsTrigger>
            <TabsTrigger value="episodes">回合记录</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="q-table">
          <p className="mb-3 text-xs text-muted-foreground">选中状态 {selectedState}，当前贪心动作：{greedyActions(selectedState).map((action) => ACTION_LABELS[action]).join(" / ")}</p>
          <div className="overflow-auto rounded-control border">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead className="sticky top-0 bg-[#f0f2f0] text-muted-foreground"><tr><th className="p-2 text-left">状态</th>{Object.values(ACTION_LABELS).map((label) => <th key={label} className="p-2 text-right">{label}</th>)}</tr></thead>
              <tbody>{qMatrix.map((values, state) => <tr key={state} className={cn("border-t", state === selectedState && "bg-accent")}><th className="p-2 text-left font-mono font-medium">{state}</th>{values.map((value, action) => <td key={action} className={cn("p-2 text-right font-mono", greedyActions(state).includes(action as Action) && "font-semibold text-primary")}>{formatMetric(value)}</td>)}</tr>)}</tbody>
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
      </Tabs>
    </section>
  );
}

function EmptyData({ text }: { text: string }) {
  return <p className="rounded-control border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</p>;
}

