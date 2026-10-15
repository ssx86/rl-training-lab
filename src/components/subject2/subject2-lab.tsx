import { useMemo } from "react";
import { Brain, Eye, Gauge, Pause, Play, Target, VideoCamera } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubject2Lab } from "@/hooks/use-subject2-lab";
import { SUBJECT2_PROJECT_LABELS, SUBJECT2_PROJECT_ORDER } from "@/subject2/subject2-course";
import { Subject2Environment } from "@/subject2/subject2-environment";
import { generateSubject2Scenario } from "@/subject2/subject2-scenario";
import { SUBJECT2_STANDARD } from "@/subject2/subject2-standard";
import { minimumServiceBrakeForStaticHold, SUBJECT2_VEHICLE } from "@/subject2/subject2-vehicle";
import type { Subject2TrainingSpeed } from "@/workers/subject2-trainer-protocol";
import type { Subject2CompletedTerminalReason, Subject2TrainingScope } from "@/subject2/subject2-runtime";
import type { Subject2Project } from "@/subject2/subject2-course";
import { Subject2CourseCanvas } from "./subject2-course-canvas";
import { Subject2CheckpointPanel } from "./subject2-checkpoint-panel";
import { Subject2DriverView3D } from "./subject2-driver-view-3d";
import { Subject2LearningPanel } from "./subject2-learning-panel";

export function Subject2Lab() {
  const lab = useSubject2Lab();
  const preview = useMemo(() => new Subject2Environment(generateSubject2Scenario(17, SUBJECT2_PROJECT_ORDER[0])), []);
  const snapshot = lab.snapshot;
  const scenario = snapshot?.scenario ?? preview.currentScenario();
  const vehicle = snapshot?.vehicle ?? preview.snapshot();
  const observation = snapshot?.observation ?? preview.observe();
  const checkpoint = snapshot?.checkpoint ?? preview.currentGoal();
  const running = lab.status === "running";
  const targetDegrees = observation.targetBearing * 180 / Math.PI;
  const attemptedStats = snapshot ? SUBJECT2_PROJECT_ORDER.filter((project) => snapshot.projectStats[project].attempts > 0) : [];
  const weakest = attemptedStats.length > 0
    ? attemptedStats.reduce((worst, project) => snapshot!.projectStats[project].passRate < snapshot!.projectStats[worst].passRate ? project : worst)
    : null;
  const turningRadius = SUBJECT2_VEHICLE.wheelBase / Math.tan(SUBJECT2_VEHICLE.maxSteerRadians);
  const steeringDegrees = SUBJECT2_VEHICLE.maxSteerRadians * 180 / Math.PI;
  const lateralClearanceCm = (SUBJECT2_STANDARD.reverseParking.bayWidth - SUBJECT2_VEHICLE.width) * 50;
  const longitudinalClearanceCm = (SUBJECT2_STANDARD.reverseParking.bayLength - SUBJECT2_VEHICLE.length) * 50;
  const trainingScope = lab.trainingScope;
  const selectedProject = lab.selectedProject;

  return (
    <div>
      <section className="border-b bg-card">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div><h2 className="text-base font-semibold tracking-tight">中国科目二 · 固定标准训练场</h2><p className="mt-1 text-xs text-muted-foreground">一辆训练车 · 五项共用同一模型与 Replay · 可轮换或单项专训 · 连续控制</p></div>
          <div className="flex flex-wrap items-center gap-2"><Badge className="bg-accent text-[#9a5505]"><Target size={14} />只显示最终目标</Badge><Badge className="font-mono text-muted-foreground">自动挡 · Actor 57→128→128→3</Badge></div>
        </div>
      </section>

      <div className="mx-auto max-w-[1680px] p-4 sm:p-6">
        <section className="mb-4 grid gap-3 border-b pb-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <Tabs value={lab.mode} onValueChange={(value) => lab.setMode(value as "training" | "evaluation")}><TabsList><TabsTrigger value="training"><Brain size={15} />训练</TabsTrigger><TabsTrigger value="evaluation"><Eye size={15} />固定场地评估</TabsTrigger></TabsList></Tabs>
          <p className="text-xs text-muted-foreground lg:text-center">{lab.mode === "training" ? trainingScope === "rotation" ? "五项依次训练；每项 100 次后切换，TD3 权重与 Replay 始终共享" : `持续专训${SUBJECT2_PROJECT_LABELS[selectedProject]}；不自动切换，TD3 权重与 Replay 仍与五项共享` : "冻结经验回放与探索噪声，在相同固定场地检验当前模型"}</p>
          <div className="font-mono text-xs text-muted-foreground">{running ? "● RUNNING" : "○ PAUSED"} · step {snapshot?.step.toLocaleString() ?? 0}</div>
        </section>

        {lab.error ? <div role="alert" className="mb-4 border-l-4 border-danger bg-[#fff4f2] px-4 py-3 text-sm text-danger">{lab.error}</div> : null}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,.82fr)]">
            <Card className="relative overflow-hidden shadow-[0_16px_44px_rgba(28,39,34,.1)]">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">车辆局部训练视图</h2><p className="mt-1 text-xs text-muted-foreground">{SUBJECT2_VEHICLE.length.toFixed(3)}m × {SUBJECT2_VEHICLE.width.toFixed(3)}m · {SUBJECT2_VEHICLE.wheelBase.toFixed(3)}m 轴距 · {turningRadius.toFixed(2)}m 轴心转弯半径 · 前进/倒车 14.4/9 km/h</p></div><div className="text-right font-mono text-[10px] text-muted-foreground"><div>{lab.metrics.backend} · {Math.round(lab.metrics.stepsPerSecond).toLocaleString()} step/s</div><div className="mt-1">attempt #{snapshot?.sceneGeneration ?? 0} · fixed course</div></div></CardHeader>
              <CardContent className="p-0"><Subject2CourseCanvas scenario={scenario} vehicle={vehicle} observation={observation} checkpoint={checkpoint} /><div className="grid gap-px border-t bg-border text-[10px] text-muted-foreground sm:grid-cols-4"><Legend mark="bg-[#626c67]" label="沥青路面" /><Legend mark="bg-[#f1f0e9] ring-1 ring-[#aeb8b2]" label="0.14m 道路边线" /><Legend mark="border border-dashed border-primary bg-accent" label="目标车身姿态" /><Legend mark="bg-[#e6a84a]" label="32 束 · 16m 近场感知" /></div></CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><VideoCamera size={17} />驾驶员立体主视角</h2><p className="mt-1 text-xs text-muted-foreground">Three.js 透视相机 · 跟随当前训练车辆 · 坡道按真实 10% 高差渲染</p></CardHeader>
              <CardContent className="p-2"><Subject2DriverView3D scenario={scenario} vehicle={vehicle} observation={observation} /></CardContent>
            </Card>
            </div>

            <section className="grid gap-px overflow-hidden rounded-panel border bg-border sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="目标距离" value={`${observation.targetDistance.toFixed(1)} m`} />
              <Metric label="目标方位" value={`${targetDegrees >= 0 ? "右" : "左"} ${Math.abs(targetDegrees).toFixed(0)}°`} />
              <Metric label="车速" value={`${vehicle.speed.toFixed(1)} m/s`} />
              <Metric label="方向盘 · 实际 / 指令" value={`${Math.round(vehicle.steer * 100)} / ${Math.round((snapshot?.action.steer ?? 0) * 100)}%`} />
              <Metric label="油门 · 实际 / 指令" value={`${Math.round(vehicle.throttle * 100)} / ${Math.round((snapshot?.action.throttle ?? 0) * 100)}%`} />
              <Metric label="制动 · 实际 / 指令" value={`${Math.round(vehicle.brake * 100)} / ${Math.round((snapshot?.action.brake ?? 0) * 100)}%`} />
              <Metric label="挡位 / 纵向加速度" value={`${gearLabel(vehicle.gear)} / ${vehicle.acceleration.toFixed(2)} m/s²`} />
              <Metric label="目标动作" value={observation.targetMotion < 0 ? "倒车" : observation.targetMotion > 0 ? "前进" : "停稳"} />
              <Metric label="坡停阶段 / 保持" value={`${rampPhaseLabel(observation.rampPhase)} / ${Math.round(observation.holdProgress * 100)}%`} />
              <Metric label="当前奖励" value={(snapshot?.reward ?? 0).toFixed(3)} />
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <Card><CardHeader><h2 className="text-sm font-semibold">固定标准场地全景</h2><p className="mt-1 text-xs text-muted-foreground">橙色虚线只表示最终终点；过程控制线不作为位置导航目标</p></CardHeader><CardContent className="p-2"><Subject2CourseCanvas scenario={scenario} vehicle={vehicle} observation={observation} checkpoint={checkpoint} overview /></CardContent></Card>
              <Card><CardHeader><h2 className="text-sm font-semibold">考试目标与流程</h2></CardHeader><CardContent><div className="flex items-start gap-3"><Target className="mt-0.5 text-primary" size={20} /><div><div className="text-sm font-semibold">{scenario.label} · 最终目标：{checkpoint.label}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{checkpoint.instruction}</p></div></div><div className="mt-4 flex items-center gap-1" aria-label="考试流程进度">{scenario.checkpoints.map((item, index) => <div key={item.id} className={`h-1.5 flex-1 rounded-full ${index < (snapshot?.checkpointIndex ?? 0) ? "bg-success" : index === (snapshot?.checkpointIndex ?? 0) ? "bg-primary" : "bg-border"}`} title={item.label} />)}</div><div className="mt-2 font-mono text-[9px] text-muted-foreground">过程条件 {(snapshot?.checkpointIndex ?? 0) + 1} / {scenario.checkpoints.length}</div><dl className="mt-4 space-y-2 border-t pt-3 text-xs"><Row label="标准场地" value={standardDimension(scenario.project)} /><Row label="车辆外廓" value={`${SUBJECT2_VEHICLE.length.toFixed(3)} × ${SUBJECT2_VEHICLE.width.toFixed(3)}m · 轴距 ${SUBJECT2_VEHICLE.wheelBase.toFixed(3)}m`} />{scenario.project === "reverse-parking" ? <Row label="标称入库余量" value={`左右各 ${lateralClearanceCm.toFixed(1)}cm · 前后各 ${longitudinalClearanceCm.toFixed(0)}cm`} /> : null}<Row label="转向几何" value={`前轮 ±${steeringDegrees.toFixed(1)}° · 轴心最小半径 ${turningRadius.toFixed(2)}m`} />{scenario.project === "ramp" ? <><Row label="坡道物理" value="10% 重力坡 · 后溜 >0.30m 立即失败" /><Row label="静态保持估算" value={`空油门至少约 ${Math.ceil(minimumServiceBrakeForStaticHold(SUBJECT2_STANDARD.ramp.grade) * 100)}% 行车制动`} /><Row label="停车判定" value={`前保险杠在 0–${SUBJECT2_STANDARD.ramp.poleLineDistance.toFixed(2)}m 控制带 · 连续保持 ${SUBJECT2_STANDARD.ramp.holdDurationSeconds.toFixed(0)}s`} /><Row label="当前停车线距离" value={`${observation.stopLineDistance.toFixed(2)}m`} /><Row label="停稳后起步" value={`${SUBJECT2_STANDARD.ramp.launchTimeLimitSeconds}s 内完成`} /></> : null}<Row label="地图方式" value="固定方向 · 固定尺寸 · 每次复位一致" /><Row label="当前动作" value={observation.targetMotion < 0 ? "必须倒车" : observation.targetMotion > 0 ? "必须前进" : "必须停稳"} /><Row label="过程奖励" value={scenario.project === "reverse-parking" ? "距离改善 + 姿态改善 + 车身入库比例改善" : scenario.project === "ramp" ? "连续稳定制动 / 定点停稳 / 合格起步" : "真实考试条件"} /><Row label="最终判定" value={checkpoint.containmentBayId ? "整车在线内即可 · 无隐藏边距" : "完整车体到达出口"} /></dl></CardContent></Card>
            </div>
            <Subject2LearningPanel snapshot={snapshot} history={lab.rewardHistory} backend={lab.metrics.backend} />
          </div>

          <aside className="space-y-4">
            <Card><CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><Gauge size={17} />训练控制</h2></CardHeader><CardContent className="space-y-4">
              {lab.mode === "training" ? <section aria-label="训练范围" className="space-y-2 border-b pb-4">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium">训练范围</span><span className="font-mono text-[10px] text-muted-foreground">共享模型 + Replay</span></div>
                <Tabs value={trainingScope} onValueChange={(value) => lab.setTrainingSelection(value as Subject2TrainingScope, selectedProject)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="rotation">五项轮换</TabsTrigger><TabsTrigger value="single">单项专训</TabsTrigger></TabsList></Tabs>
                {trainingScope === "single" ? <label className="block text-[10px] text-muted-foreground">专训科目<select aria-label="专训科目" value={selectedProject} onChange={(event) => lab.setTrainingSelection("single", event.target.value as Subject2Project)} className="mt-1.5 h-9 w-full rounded-control border bg-card px-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{SUBJECT2_PROJECT_ORDER.map((project) => <option key={project} value={project}>{SUBJECT2_PROJECT_LABELS[project]}</option>)}</select></label> : null}
                <p className="text-[10px] leading-4 text-muted-foreground">{trainingScope === "rotation" ? "每项完成 100 次尝试后切换到下一项。" : "持续训练所选科目，不自动切换；切换科目不会清空已学权重或经验。"}</p>
              </section> : null}
              <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">运行速度</span><span className="font-mono text-[10px] text-muted-foreground">1× 实时 · MAX 抽样</span></div><div className="grid grid-cols-4 gap-1.5">{([1, 4, 16, "max"] as Subject2TrainingSpeed[]).map((speed) => <Button key={speed} size="sm" variant={lab.speed === speed ? "default" : "secondary"} onClick={() => lab.setSpeed(speed)}>{typeof speed === "number" ? `${speed}×` : "MAX"}</Button>)}</div><p className="mt-2 text-[10px] leading-4 text-muted-foreground">1× 按真实 100ms 物理时钟观察；加速模式仍按同一动力学计算，MAX 只抽样显示训练轨迹。</p></div>
              <Button className="w-full" onClick={running ? lab.pause : lab.start}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "暂停并保留模型" : snapshot ? "继续" : lab.mode === "training" ? "开始训练" : "开始评估"}</Button>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-control border bg-border"><Metric label="Replay" value={snapshot?.replaySize.toLocaleString() ?? "0"} /><Metric label="网络更新" value={snapshot?.updates.toLocaleString() ?? "0"} /><Metric label="当前项目进度" value={trainingScope === "rotation" ? `${snapshot?.projectAttempts ?? 0} / ${snapshot?.attemptsPerProject ?? 100}` : `${snapshot?.projectAttempts ?? 0} 次`} /><Metric label="当前项目通过" value={snapshot?.projectPasses.toLocaleString() ?? "0"} /><Metric label="完成过程条件" value={snapshot?.checkpointCompletions.toLocaleString() ?? "0"} /><Metric label="场地复位次数" value={snapshot?.sceneGeneration.toLocaleString() ?? "0"} /><Metric label="Critic loss" value={snapshot?.criticLoss?.toFixed(4) ?? "等待"} /><Metric label="评估通过 / 尝试" value={`${snapshot?.passes ?? 0} / ${snapshot?.evaluationAttempts ?? 0}`} /></div>
              <section className="border p-3" aria-label="终止诊断">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">最近终止原因</span><span className="font-mono text-[10px] text-danger">{terminalReasonLabel(snapshot?.lastTerminalReason ?? null)}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] sm:grid-cols-3">{TERMINATION_REASONS.map((reason) => <div key={reason} className="flex justify-between gap-2 border-b pb-1"><span className="text-muted-foreground">{terminalReasonLabel(reason)}</span><span className="font-mono">{snapshot?.terminationCounts[reason] ?? 0} 次</span></div>)}</div>
                <p className="mt-2 text-[9px] leading-4 text-muted-foreground">诊断会跨场地复位保留；无弹窗、无蒙板。驶出考试区、碰线会立即结束；仅连续 12 秒没有实质进展才判定无进展。</p>
              </section>
              <Subject2CheckpointPanel info={lab.checkpointInfo} promptOpen={lab.restorePromptOpen} canSave={Boolean(snapshot)} error={lab.checkpointError} onSave={lab.saveCheckpoint} onRestore={lab.restoreCheckpoint} onDismissPrompt={lab.dismissRestorePrompt} />
            </CardContent></Card>

            <Card><CardHeader><h2 className="text-sm font-semibold">五项训练表现</h2><p className="mt-1 text-xs text-muted-foreground">同一模型依次学习五张固定标准场地{weakest ? `；当前薄弱项：${SUBJECT2_PROJECT_LABELS[weakest]}` : ""}</p></CardHeader><CardContent className="space-y-1.5">{SUBJECT2_PROJECT_ORDER.map((project) => {
              const stats = snapshot?.projectStats[project];
              const active = scenario.project === project;
              return <div key={project} className={`flex items-center justify-between rounded-control border px-3 py-2 text-xs ${active ? "border-primary bg-accent" : "bg-card"}`}><span>{SUBJECT2_PROJECT_LABELS[project]}</span><span className="font-mono text-[9px] text-muted-foreground">{stats?.attempts ? `${Math.round(stats.passRate * 100)}% · ${stats.passes}/${stats.attempts}` : active ? "当前固定场地" : "待训练"}</span></div>;
            })}</CardContent></Card>

          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-card p-3"><div className="font-mono text-sm font-semibold">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{label}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono text-right">{value}</dd></div>; }
function Legend({ mark, label }: { mark: string; label: string }) { return <div className="flex items-center gap-2 bg-card px-3 py-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${mark}`} aria-hidden="true" /><span>{label}</span></div>; }
function standardDimension(project: keyof typeof SUBJECT2_PROJECT_LABELS): string {
  if (project === "reverse-parking") return `库长 ${SUBJECT2_STANDARD.reverseParking.bayLength.toFixed(2)}m · 库宽 ${SUBJECT2_STANDARD.reverseParking.bayWidth.toFixed(2)}m · 车道/控制距 ${SUBJECT2_STANDARD.reverseParking.laneWidth.toFixed(2)}m`;
  if (project === "s-curve") return "外半径 7.5m · 路宽 3.5m";
  if (project === "right-angle") return "路宽 3.6m · 路长 ≥6.8m";
  if (project === "ramp") return "路宽 3.20m · 坡长 ≥20m · 坡度 10% · 定点距 0.50m";
  return `车位 ${SUBJECT2_STANDARD.sideParking.bayLength.toFixed(2)}×${SUBJECT2_STANDARD.sideParking.bayWidth.toFixed(2)}m · 车道 ${SUBJECT2_STANDARD.sideParking.laneWidth.toFixed(2)}m`;
}

function gearLabel(gear: -1 | 0 | 1): string { return gear < 0 ? "R" : gear > 0 ? "1" : "N"; }
function rampPhaseLabel(phase: "approach" | "braking" | "holding" | "launch" | null): string {
  return phase === "approach" ? "接近" : phase === "braking" ? "制动" : phase === "holding" ? "保持" : phase === "launch" ? "起步" : "—";
}

const TERMINATION_REASONS: readonly Subject2CompletedTerminalReason[] = ["passed", "collision", "out-of-bounds", "rollback", "start-timeout", "stalled", "timeout"];
function terminalReasonLabel(reason: Subject2CompletedTerminalReason | null): string {
  if (reason === "passed") return "考试通过";
  if (reason === "collision") return "碰线 / 碰撞";
  if (reason === "out-of-bounds") return "驶出考试区";
  if (reason === "rollback") return "坡道后溜";
  if (reason === "start-timeout") return "坡起超时";
  if (reason === "stalled") return "12 秒无进展";
  if (reason === "timeout") return "回合超时";
  return "暂无";
}
