import { Brain, CheckCircle, Flask, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataWorkbench } from "@/components/data-workbench";
import { EnvironmentGrid } from "@/components/environment-grid";
import { MetricsPanel } from "@/components/metrics-panel";
import { ParameterPanel } from "@/components/parameter-panel";
import { PlaybackControls } from "@/components/playback-controls";
import { useLab, type LabMode } from "@/hooks/use-lab";
import { useTensorFlowStatus } from "@/hooks/use-tensorflow-status";

export function App() {
  const lab = useLab();
  const tensorflow = useTensorFlowStatus();

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-control bg-accent text-primary"><Flask size={22} weight="fill" /></div>
            <div><h1 className="text-lg font-semibold tracking-tight">Q-learning Lab</h1><p className="text-xs text-muted-foreground">悬崖行走实时实验台</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className="bg-[#eef6f1] text-success"><CheckCircle size={14} />环境已验证</Badge>
            <Badge className="bg-accent text-[#9a5505]"><WarningCircle size={14} />算法待实现</Badge>
            <Badge className="font-mono text-muted-foreground">TensorFlow.js {tensorflow.state === "ready" ? `${tensorflow.version} / ${tensorflow.backend}` : tensorflow.state === "error" ? "加载失败" : "加载中"}</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-panel border bg-card p-3">
          <Tabs value={lab.mode} onValueChange={(value) => lab.setMode(value as LabMode)}>
            <TabsList>
              <TabsTrigger value="training">训练模式</TabsTrigger>
              <TabsTrigger value="exploitation">利用模式</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">{lab.mode === "training" ? "按 epsilon-greedy 选择动作，并调用你的 Q 值更新函数" : "只读取当前 Q 表，不写入数值"}</p>
          <div className="font-mono text-xs" aria-live="polite">{lab.running ? "运行中" : "已暂停"} / episode {lab.episode}</div>
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <aside className="order-2 xl:order-1"><ParameterPanel parameters={lab.parameters} disabled={lab.running} onChange={lab.updateParameter} /></aside>

          <div className="order-1 space-y-4 xl:order-2">
            <Card className="shadow-[0_10px_30px_rgba(28,39,34,0.06)]">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-sm font-semibold">环境画布</h2><p className="mt-1 text-xs text-muted-foreground">点击安全格查看对应 Q 值</p></div>
                <PlaybackControls running={lab.running} onStep={lab.advance} onRunEpisode={lab.runEpisode} onToggleContinuous={lab.toggleContinuous} onReset={lab.reset} />
              </CardHeader>
              <CardContent>
                <EnvironmentGrid currentState={lab.currentState} selectedState={lab.selectedState} path={lab.path} greedyActions={lab.greedyActions} onSelectState={lab.setSelectedState} />
              </CardContent>
            </Card>

            <section className="flex items-start gap-3 rounded-panel border border-[#eed4a9] bg-accent p-4 text-sm">
              <Brain className="mt-0.5 shrink-0 text-primary" size={20} />
              <div><h2 className="font-semibold">算法待实现</h2><p className="mt-1 text-xs leading-5 text-[#725834]">当前会播放环境、探索和利用过程，但 Q 值保持不变。请在 <code className="rounded bg-white/70 px-1 py-0.5 font-mono">src/exercise/update-q-value.ts</code> 中完成更新逻辑。</p></div>
            </section>
          </div>

          <aside className="order-3"><MetricsPanel episode={lab.episode} totalSteps={lab.totalSteps} totalFalls={lab.totalFalls} successCount={lab.successCount} epsilon={lab.parameters.epsilon} lastStep={lab.lastStep} /></aside>
        </div>

        <div className="mt-4"><DataWorkbench selectedState={lab.selectedState} qMatrix={lab.qMatrix} history={lab.history} greedyActions={lab.greedyActions} /></div>
      </div>
    </main>
  );
}

