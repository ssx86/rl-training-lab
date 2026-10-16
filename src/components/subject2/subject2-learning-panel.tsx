import { Brain, ChartLineUp, Function as FunctionIcon } from "@phosphor-icons/react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { describeTd3Config } from "@/rl/continuous/td3-config";
import type { Subject2HistoryPoint } from "@/hooks/use-subject2-lab";
import type { Subject2Snapshot } from "@/subject2/subject2-runtime";
import { summarizeSubject2Controls } from "@/subject2/subject2-telemetry";

interface Props {
  readonly snapshot: Subject2Snapshot | null;
  readonly history: readonly Subject2HistoryPoint[];
  readonly backend: string;
}

const DEFAULT_MODEL = describeTd3Config({ observationSize: 57, actionSize: 3, hiddenUnits: 128 });
const rewardRows = [
  ["通用目标进步", "poseProgress"], ["接近车位", "bayApproachProgress"], ["姿态对正", "bayAlignmentProgress"], ["车身入库", "bayOverlapProgress"], ["过程条件", "checkpoint"], ["全程通过", "passBonus"],
  ["每步时间", "timeCost"], ["停滞", "inactivity"], ["方向错误", "wrongDirection"],
  ["超速", "unsafeSpeed"], ["控制突变", "controlSmoothness"], ["安全间距", "clearance"],
  ["稳定制动保持", "stableHold"], ["碰线", "collision"], ["驶出考试区", "outOfBounds"],
  ["坡起后溜 >30cm", "rollback"], ["停车后 30 秒未起步", "startTimeout"], ["12 秒无进展", "stalled"], ["回合超时", "timeout"],
] as const;

export function Subject2LearningPanel({ snapshot, history, backend }: Props) {
  const model = snapshot?.modelInfo ?? DEFAULT_MODEL;
  const latency = snapshot?.inferenceMs ?? 0;
  const inferenceRate = latency > 0 ? 1000 / latency : 0;
  const hasHeadroom = latency === 0 || inferenceRate >= 100;
  const controls = summarizeSubject2Controls(history.slice(-60));
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">学习原理与实时诊断</h2><p className="mt-1 text-xs text-muted-foreground">页面展示的公式、奖励分项与训练实际使用同一份数据</p></div>
        <Badge className="font-mono text-muted-foreground">TD3 · Actor {model.observationSize}→{model.hiddenUnits}→{model.hiddenUnits}→{model.actionSize}</Badge>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="curve">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="curve"><ChartLineUp size={15} />奖励曲线</TabsTrigger>
            <TabsTrigger value="reward"><FunctionIcon size={15} />奖励公式</TabsTrigger>
            <TabsTrigger value="model"><Brain size={15} />TD3 模型</TabsTrigger>
          </TabsList>

          <TabsContent value="curve">
            <div className="h-[250px] border bg-[#fafbf9] p-2" aria-label="过程完成率曲线">
              {history.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#dfe4e1" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="step" tick={{ fontSize: 9 }} minTickGap={30} /><YAxis yAxisId="reward" tick={{ fontSize: 9 }} width={42} /><YAxis yAxisId="completion" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} width={32} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} labelFormatter={(step) => `step ${step}`} /><ReferenceLine yAxisId="reward" y={0} stroke="#8b9690" />
                <Line yAxisId="reward" type="monotone" dataKey="total" name="总奖励" stroke="#a9630c" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line yAxisId="reward" type="monotone" dataKey="progress" name="连续进步" stroke="#2f7d55" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line yAxisId="reward" type="monotone" dataKey="penalties" name="惩罚合计" stroke="#b84a3a" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line yAxisId="completion" type="stepAfter" dataKey="completionRate" name="过程完成率 %" stroke="#2d65a8" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">开始训练后显示最近 180 个抽样步<br />橙：总奖励 · 绿：进步 · 红：惩罚</div>}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">绿线汇总通用目标、接近车位、姿态对正、车身入库和稳定保持；蓝线是过程完成率（右轴 0–100%）。</p>
            <div className="mt-3 grid gap-px overflow-hidden rounded-control border bg-border sm:grid-cols-3 lg:grid-cols-6"><Stat label="当前步奖励" value={(snapshot?.reward ?? 0).toFixed(3)} /><Stat label="本回合累计" value={(snapshot?.episodeReward ?? 0).toFixed(1)} /><Stat label="曲线样本" value={`${history.length} / 180`} /><Stat label="近 60 步油门" value={`${controls.throttlePercent}%`} /><Stat label="近 60 步制动" value={`${controls.brakePercent}%`} /><Stat label="近 60 步静止" value={`${controls.stationaryPercent}%`} /></div>
          </TabsContent>

          <TabsContent value="reward">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4 text-xs leading-5">
                <Formula>rₜ = r通用目标 + r接近车位 + r姿态对正 + r车身入库 + r稳定保持 + r过程条件 + r通过 − c时间 − c停滞 − c方向 − c速度 − c控制 − c贴边 − c终止</Formula>
                <div><h3 className="font-semibold">1. 车位目标采用由弱到强的连续梯度</h3><Formula>r接近车位 = clip(0.9 × [d前 − d后], −1.2, 1.2)</Formula><Formula>r姿态对正 = clip(0.35 × [|θ前| − |θ后|], −0.4, 0.4)</Formula><Formula>r车身入库 = clip(90 × [overlap后 − overlap前], −15, 15)</Formula><p className="mt-2 text-muted-foreground">倒车入库仍只有可见车库这一个目标，没有隐藏路线点。距离缩短先给小分，方向对正给更小的辅助分；车身哪怕只搭入 1%，也得到约 0.9 的明显反馈。三项都只奖励相邻状态的改善：原地不重复得分，退出或走远会把相应分数扣回。允许短暂前进调整，但最终仍必须倒车、低速且整车在线内。</p></div>
                <div><h3 className="font-semibold">2. 坡停必须形成连续证据</h3><p className="mt-1 text-muted-foreground">前保险杠进入停车线与桩杆线之间、速度不超过 0.03m/s 且制动力足以抵消坡道重力时，每个 100ms 步累计保持进度。连续 1 秒才发放停车过程奖励；松刹车、溜动或离开区域会立即清零。停稳后 30 秒内必须起步，后溜超过 30cm 或超时均为 −100。</p></div>
                <div><h3 className="font-semibold">3. 通过奖励只对应真实完成</h3><p className="mt-1 text-muted-foreground">倒车入库不再要求先发现“过线—停车—换挡”流程。整车进入车库、姿态与速度合格且以倒车到达时，才获得目标分与额外 +100，并立即结束。碰线或驶出考试区均为 −100，回合总时长超限为 −30。</p></div>
                <div><h3 className="font-semibold">4. 连续驾驶质量单独计分</h3><p className="mt-1 text-muted-foreground">逆着要求行驶、超过随目标距离收紧的安全速度、距离边线不足 0.60m、方向盘或踏板突变，都会产生连续惩罚。低速本身每步仅 −0.05；只有连续 12 秒没有让当前条件误差改善至少 0.05，才以 −35 结束。坡道合法停车区和完成停车后的起步窗口不受这条无进展规则影响。</p></div>
              </div>
              <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">当前步逐项对账</div><dl className="space-y-1.5">{rewardRows.map(([label, key]) => <RewardRow key={key} label={label} value={snapshot?.rewardBreakdown[key] ?? 0} />)}<div className="mt-2 flex justify-between border-t pt-2 text-xs font-semibold"><dt>总奖励</dt><dd className="font-mono">{(snapshot?.rewardBreakdown.total ?? 0).toFixed(3)}</dd></div></dl></div>
            </div>
          </TabsContent>

          <TabsContent value="model">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4 text-xs leading-5"><div><h3 className="font-semibold">现在用的不是表格 Q-learning，而是 TD3</h3><p className="mt-1 text-muted-foreground">TD3（Twin Delayed Deep Deterministic Policy Gradient）适合连续控制。自动挡 Actor 看见 {model.observationSize} 个观测值，输出方向、纵向踏板轴和 D/N/R 挡位 {model.actionSize} 个连续量；踏板轴正值映射油门、负值映射制动，所以两者不会同时踩下。</p></div>
                <Formula>Actor：{model.observationSize} → {model.hiddenUnits} ReLU → {model.hiddenUnits} ReLU → {model.actionSize} tanh</Formula><Formula>双 Critic：({model.observationSize} + {model.actionSize}) → {model.hiddenUnits} ReLU → {model.hiddenUnits} ReLU → 1 × 2</Formula>
                <div className="grid gap-3 sm:grid-cols-2"><Theory title="57 维观测">32 束雷达 · 相对目标与车辆状态 · 5 类科目 one-hot · 4 阶段 one-hot</Theory><Theory title="自动挡动作">转向 · 互斥油门/制动轴 · D/N/R 挡位</Theory></div>
                <div className="grid gap-3 sm:grid-cols-2"><Theory title="如何探索动作">aₜ = πθ(sₜ) + ε；未覆盖状态用 UCB 选择持续动作</Theory><Theory title="Critic 学习目标">y = r + γ(1−done) min(Q′₁, Q′₂)</Theory><Theory title="Critic 损失">L = Huber(Q − y)</Theory><Theory title="Actor 目标">最大化 E[Q₁(s, πθ(s))]</Theory></div>
                <p className="border-l-2 border-primary pl-3 text-muted-foreground">双 Critic 取较小值，抑制价值高估；Actor 每 2 次 Critic 更新才更新一次；目标网络用 τ={model.tau} 缓慢追随，提升训练稳定性。</p>
                <p className="border-l-2 border-[#2d65a8] pl-3 text-muted-foreground">训练时会按“静止且制动、静止已松刹、前进、倒车”统计覆盖次数，并用 UCB 优先尝试尚未充分覆盖的起步、前进调整、制动或滑行选项。每个选项会持续 0.6–约 2.4 秒，让车辆真正完成松刹、起步、修正或停车。UCB 只决定训练期探索哪个动作选项，不加入考试奖励；评估模式完全关闭探索。</p>
              </div>
              <div className="space-y-3"><div className="grid grid-cols-2 gap-px overflow-hidden rounded-control border bg-border"><Stat label="Actor 参数" value={model.actorParameters.toLocaleString()} /><Stat label="单个 Critic" value={model.criticParametersEach.toLocaleString()} /><Stat label="在线可训练" value={model.onlineTrainableParameters.toLocaleString()} /><Stat label="含目标网络" value={model.totalParameters.toLocaleString()} /></div>
                <div className="border p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">浏览器推理</span><Badge className={hasHeadroom ? "bg-[#e8f3ec] text-success" : "bg-[#fff1ee] text-danger"}>{hasHeadroom ? "余量充足" : "需要关注"}</Badge></div><dl className="mt-3 space-y-2 text-xs"><Info label="后端" value={backend} /><Info label="单次 Actor" value={latency ? `${latency.toFixed(2)} ms` : "启动后测量"} /><Info label="估算吞吐" value={inferenceRate ? `${Math.round(inferenceRate).toLocaleString()} 次/秒` : "等待"} /><Info label="物理控制频率" value="10 次/秒" /></dl></div>
                <p className="text-[10px] leading-4 text-muted-foreground">当前 128×128 网络对单车控制已经很小。盲目加宽会让训练和推理都变慢，却不保证学得更好；现阶段更关键的是奖励质量、场景覆盖和有效样本。</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Formula({ children }: { children: React.ReactNode }) { return <div className="overflow-x-auto border-l-2 border-primary bg-[#f4f6f4] px-3 py-2 font-mono text-[11px] text-foreground">{children}</div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="bg-card p-3"><div className="font-mono text-sm font-semibold">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{label}</div></div>; }
function RewardRow({ label, value }: { label: string; value: number }) { return <div className="flex justify-between gap-3 text-xs"><dt className="text-muted-foreground">{label}</dt><dd className={value > 0 ? "font-mono text-success" : value < 0 ? "font-mono text-danger" : "font-mono"}>{value.toFixed(3)}</dd></div>; }
function Theory({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border p-3"><div className="text-[10px] font-semibold text-muted-foreground">{title}</div><div className="mt-1 font-mono text-[11px]">{children}</div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono text-right">{value}</dd></div>; }
