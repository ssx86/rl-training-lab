import { useEffect, type ComponentType } from "react";
import { CheckCircle, Function, Path, WarningCircle } from "@phosphor-icons/react";
import { getExperiment, experimentHref, type LabId } from "@/catalog/experiment-catalog";
import { AppShell } from "@/components/app-shell";
import { DataWorkbench } from "@/components/data-workbench";
import { DqnDrivingLab } from "@/components/driving/dqn-driving-lab";
import { DrivingLab } from "@/components/driving/driving-lab";
import { EnvironmentGrid } from "@/components/environment-grid";
import { CompanionLearningPanel } from "@/components/learning/companion-learning-panel";
import { MetricsPanel } from "@/components/metrics-panel";
import { ParameterPanel } from "@/components/parameter-panel";
import { PlaybackControls } from "@/components/playback-controls";
import { Subject2Lab } from "@/components/subject2/subject2-lab";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLabRoute } from "@/hooks/use-lab-route";
import { useLab, type LabMode } from "@/hooks/use-lab";

export function App() {
  const labId = useLabRoute();
  useEffect(() => {
    document.title = labId ? getExperiment(labId).pageTitle : "实验不存在 · RL 训练实验室";
  }, [labId]);
  return <AppShell activeLab={labId}>{labId ? <LabPage key={labId} labId={labId} /> : <UnknownLab />}</AppShell>;
}

function LabPage({ labId }: { labId: LabId }) {
  const ActiveLab = LAB_COMPONENTS[labId];
  return <><CompanionLearningPanel labId={labId} /><ActiveLab /></>;
}

const LAB_COMPONENTS: Record<LabId, ComponentType> = {
  "subject-2": Subject2Lab,
  "dqn-driving": DqnDrivingLab,
  "td3-fleet": DrivingLab,
  "q-learning": QLearningLab,
};

function UnknownLab() {
  return <section className="mx-auto max-w-[760px] px-4 py-20 text-center sm:px-6"><p className="font-mono text-xs text-primary">404 · UNKNOWN LAB</p><h2 className="mt-3 text-2xl font-semibold">找不到这个训练实验</h2><p className="mt-3 text-sm text-muted-foreground">链接可能已过期。你可以从上方主菜单选择实验，或回到默认的科目二训练。</p><a href={experimentHref("subject-2")} className="mt-6 inline-flex rounded-control bg-primary px-4 py-2 text-sm font-medium text-white">返回科目二</a></section>;
}

function QLearningLab() {
  const lab = useLab();
  const algorithmReady = lab.lastStep?.implemented === true;
  return <>
    <div className="mx-auto max-w-[1680px] p-4 sm:p-6">
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><h2 className="text-base font-semibold">Q-learning 峡谷导航</h2><p className="mt-1 text-xs text-muted-foreground">160 状态 · 四方向动作 · 从真实 transition 观察每次 TD 更新</p></div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-[#eef6f1] text-success"><CheckCircle size={14} />10 × 16 环境已验证</Badge><Badge className={algorithmReady ? "bg-[#eef6f1] text-success" : "bg-accent text-[#9a5505]"}>{algorithmReady ? <CheckCircle size={14} /> : <Function size={14} />}{algorithmReady ? "更新函数正在生效" : "运行一步核验更新函数"}</Badge></div></section>
      <section className="mb-4 grid gap-3 rounded-panel border bg-card p-3 lg:grid-cols-[auto_1fr_auto] lg:items-center"><Tabs value={lab.mode} onValueChange={(value) => lab.setMode(value as LabMode)}><TabsList><TabsTrigger value="training">训练模式</TabsTrigger><TabsTrigger value="exploitation">利用模式</TabsTrigger></TabsList></Tabs><p className="text-xs text-muted-foreground lg:text-center">{lab.mode === "training" ? "epsilon-greedy 选择动作，并把每次 TD 更新映射回地图" : "冻结学习，只检验当前策略形成的路径"}</p><div className="flex items-center gap-3 font-mono text-xs"><span className={lab.running ? "text-success" : "text-muted-foreground"}>{lab.running ? "● 运行中" : "○ 已暂停"}</span><span>episode {lab.episode}</span></div></section>
      <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="order-2 xl:order-1"><ParameterPanel parameters={lab.parameters} disabled={lab.running} onChange={lab.updateParameter} /></aside>
        <div className="order-1 min-w-0 space-y-4 xl:order-2">
          <Card className="shadow-[0_12px_34px_rgba(28,39,34,0.07)]"><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b"><div><h2 className="text-sm font-semibold">峡谷导航环境</h2><p className="mt-1 text-xs text-muted-foreground">点击任一可达状态，查看精确 Q 值与策略</p></div><PlaybackControls running={lab.running} onStep={lab.advance} onRunEpisode={lab.runEpisode} onToggleContinuous={lab.toggleContinuous} onReset={lab.reset} /></CardHeader><CardContent className="pt-4"><EnvironmentGrid currentState={lab.currentState} selectedState={lab.selectedState} path={lab.path} qMatrix={lab.qMatrix} visitCounts={lab.visitCounts} lastQUpdate={lab.lastStep && lab.lastStep.newQ !== lab.lastStep.oldQ ? { state: lab.lastStep.state, action: lab.lastStep.action, version: lab.totalSteps } : undefined} greedyActions={lab.greedyActions} onSelectState={lab.setSelectedState} /></CardContent></Card>
          <section className="grid gap-3 rounded-panel border border-[#eed4a9] bg-accent p-4 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">{algorithmReady ? <CheckCircle className="text-success" size={21} weight="fill" /> : <WarningCircle className="text-primary" size={21} weight="fill" />}<div><h2 className="font-semibold">{algorithmReady ? "Q-learning 更新链路已接通" : "先运行一步，核验你的更新函数"}</h2><p className="mt-1 text-xs leading-5 text-[#725834]">{algorithmReady ? "地图价值、策略箭头、TD 分解和学习曲线使用同一条真实事件流。" : "系统会读取练习文件返回的 implemented、TD target、TD error 与新 Q 值，不再写死算法状态。"}</p></div><div className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#725834]"><Path size={15} /> environment → policy → update → evidence</div></section>
        </div>
        <aside className="order-3"><MetricsPanel episode={lab.episode} totalSteps={lab.totalSteps} totalFalls={lab.totalFalls} totalCollisions={lab.totalCollisions} successCount={lab.successCount} epsilon={lab.parameters.epsilon} lastStep={lab.lastStep} /></aside>
      </div>
      <div className="mt-4"><DataWorkbench selectedState={lab.selectedState} qMatrix={lab.qMatrix} history={lab.history} greedyActions={lab.greedyActions} /></div>
    </div>
  </>;
}
