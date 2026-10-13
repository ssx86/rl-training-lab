import { useRef } from "react";
import { Brain, DownloadSimple, Pause, Play, SkipForward, UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DRIVING_CURRICULUM } from "@/driving/curriculum";
import { useDrivingLab } from "@/hooks/use-driving-lab";
import { DrivingCanvas } from "./driving-canvas";
import { DrivingEvidence } from "./driving-evidence";

export function DqnDrivingLab() {
  const lab = useDrivingLab();
  const fileRef = useRef<HTMLInputElement>(null);

  const running = lab.status === "running";
  const evaluation = lab.evaluationReport;

  return (
    <div className="mx-auto max-w-[1680px] p-4 sm:p-6">
      <section className="mb-4 grid gap-3 border-b pb-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <Tabs value={lab.mode === "evaluation" ? "evaluation" : "training"} onValueChange={(value) => lab.setMode(value as "training" | "evaluation")}>
          <TabsList><TabsTrigger value="training"><Brain size={15} />训练</TabsTrigger><TabsTrigger value="evaluation">推理评估</TabsTrigger></TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground lg:text-center">{lab.mode === "evaluation" ? "冻结模型，在固定种子与未见种子上检验泛化" : "单车通过 epsilon-greedy 收集经历，使用 Replay 与 Target Network 更新 DQN"}</p>
        <div className="font-mono text-xs text-muted-foreground">{running ? "● RUNNING" : "○ PAUSED"}</div>
      </section>

      {lab.error ? <div role="alert" className="mb-4 border-l-4 border-danger bg-[#fff4f2] px-4 py-3 text-sm text-danger">{lab.error}</div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="space-y-4">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold">课程与运行</h2><p className="mt-1 text-xs text-muted-foreground">先在简单环境学会，再增加障碍与随机性</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {DRIVING_CURRICULUM.map((item) => <button key={item.id} type="button" onClick={() => lab.setLevel(item.id)} className={`w-full rounded-control border p-3 text-left ${lab.level === item.id ? "border-primary bg-accent" : "bg-card hover:bg-muted"}`}><div className="text-xs font-semibold">{item.label}</div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.description}</p></button>)}
              </div>
              <label className="block text-xs font-medium">随机种子<input className="mt-2 h-9 w-full rounded-control border bg-card px-3 font-mono" type="number" min={1} value={lab.seed} onChange={(event) => lab.setSeed(Number(event.target.value))} /></label>
              <Button className="w-full" onClick={lab.toggleRunning}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停并保留模型" : lab.mode === "evaluation" ? "开始评估" : "浏览器最快训练"}</Button>
              {lab.mode === "training" ? <Button className="w-full" variant="secondary" disabled={running || lab.status === "idle"} onClick={lab.stepOnce}><SkipForward size={16} />单步观察一次更新</Button> : null}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" onClick={lab.exportModel}><DownloadSimple size={15} />保存模型</Button>
                <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><UploadSimple size={15} />加载模型</Button>
              </div>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-label="加载 DQN 模型文件" onChange={(event) => { const file = event.target.files?.[0]; if (file) void lab.importModel(file); }} />
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          <Card className="shadow-[0_12px_34px_rgba(28,39,34,0.07)]">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">DQN 单车驾驶训练</h2><p className="mt-1 text-xs text-muted-foreground">真实环境 transition 驱动网络，不使用手动或规则驾驶作为训练替代</p></div><span className="font-mono text-[10px] text-muted-foreground">12 inputs / 128 / 128 / 9 Q values</span></CardHeader>
            <CardContent><DrivingCanvas map={lab.map} vehicle={lab.vehicle} observation={lab.observation} /></CardContent>
          </Card>

          {evaluation ? <section className="grid gap-px overflow-hidden rounded-panel border bg-border sm:grid-cols-4">
            <Metric label="固定地图成功率" value={`${Math.round(evaluation.fixed.successRate * 100)}%`} />
            <Metric label="未见地图成功率" value={`${Math.round(evaluation.unseen.successRate * 100)}%`} />
            <Metric label="未见地图碰撞率" value={`${Math.round(evaluation.unseen.collisionRate * 100)}%`} />
            <Metric label="未见地图停滞率" value={`${Math.round(evaluation.unseen.stagnantRate * 100)}%`} />
          </section> : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold">网络训练状态</h2></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-control border bg-border">
                <Metric label="环境步" value={lab.evidence?.environmentStep.toLocaleString() ?? "0"} />
                <Metric label="网络更新" value={lab.evidence?.trainingUpdates.toLocaleString() ?? "0"} />
                <Metric label="Replay" value={lab.evidence?.bufferSize.toLocaleString() ?? "0"} />
                <Metric label="epsilon" value={lab.evidence?.epsilon.toFixed(3) ?? "1.000"} />
                <Metric label="loss" value={lab.evidence?.loss?.toFixed(4) ?? "等待 batch"} />
                <Metric label="Target age" value={lab.evidence?.targetSyncAge.toLocaleString() ?? "0"} />
              </div>
            </CardContent>
          </Card>
          <DrivingEvidence evidence={lab.evidence} />
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-card p-3"><div className="font-mono text-sm font-semibold">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{label}</div></div>;
}
