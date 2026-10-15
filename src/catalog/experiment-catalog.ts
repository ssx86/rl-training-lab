export type LabId = "q-learning" | "dqn-driving" | "td3-fleet" | "subject-2";
export type AlgorithmId = "q-learning" | "dqn" | "td3";

export interface LearningConcept {
  readonly label: "任务" | "状态" | "动作" | "奖励" | "模型";
  readonly value: string;
  readonly explanation: string;
}

export interface AlgorithmFormula {
  readonly label: string;
  readonly expression: string;
  readonly explanation: string;
}

export interface ExperimentDefinition {
  readonly id: LabId;
  readonly name: string;
  readonly algorithmId: AlgorithmId;
  readonly algorithmLabel: string;
  readonly description: string;
  readonly pageTitle: string;
  readonly learningQuestion: string;
  readonly prediction: {
    readonly prompt: string;
    readonly choices: readonly [string, string];
    readonly answer: string;
    readonly explanation: string;
  };
  readonly runInstruction: string;
  readonly evidenceSignals: readonly string[];
  readonly requiredSignals: readonly string[];
  readonly concepts: readonly LearningConcept[];
  readonly formulas: readonly AlgorithmFormula[];
  readonly observationGuide: readonly string[];
  readonly transfer: { readonly prompt: string; readonly note: string };
  readonly boundary: string;
  readonly guide: {
    readonly slug: string;
    readonly title: string;
    readonly url: string;
    readonly reason: string;
    readonly prerequisites: readonly string[];
  };
}

export const GUIDE_BASE_URL = "https://ssx86.github.io/rl-field-guide/en/learn";

export const LEARNING_LOOP = [
  { id: "predict", label: "先预测", note: "运行前先承诺一个判断" },
  { id: "run", label: "再运行", note: "只改变一个动作或一次训练状态" },
  { id: "inspect", label: "看证据", note: "读取真实数值而非只看动画" },
  { id: "explain", label: "讲机制", note: "再用公式压缩刚才的关系" },
  { id: "transfer", label: "做迁移", note: "改变假设，判断方法是否仍成立" },
] as const;

function guide(slug: string, title: string, reason: string, prerequisites: readonly string[] = []) {
  return { slug, title, reason, prerequisites, url: `${GUIDE_BASE_URL}/${slug}/` };
}

export const EXPERIMENTS: readonly ExperimentDefinition[] = [
  {
    id: "q-learning",
    name: "Q-learning 峡谷",
    algorithmId: "q-learning",
    algorithmLabel: "表格 TD 控制",
    description: "160 状态价值更新",
    pageTitle: "Q-learning 峡谷 · RL 训练实验室",
    learningQuestion: "一次真实经历，怎样只更新表格中的一个状态动作格？",
    prediction: {
      prompt: "智能体到达终止状态后，TD target 还应该加上下一状态的最大 Q 值吗？",
      choices: ["应该继续 bootstrap", "不应该，target 只剩终止奖励"],
      answer: "不应该，target 只剩终止奖励",
      explanation: "终止状态之后没有下一次决策；继续 bootstrap 会凭空加入不存在的未来价值。",
    },
    runInstruction: "先执行一个单步 transition，再把地图中高亮的 Q 格与右侧 TD 分解逐项对上。",
    evidenceSignals: ["状态 s 与动作 a", "奖励 r 与终止标志", "bootstrap 与 TD target", "旧 Q、TD error 与新 Q"],
    requiredSignals: ["bootstrap", "target", "tdError"],
    concepts: [
      { label: "任务", value: "穿过峡谷到达终点", explanation: "智能体需要找到安全且较短的路径。" },
      { label: "状态", value: "160 个地图位置", explanation: "当前位置就是它此刻看到的状态 s。" },
      { label: "动作", value: "上 / 右 / 下 / 左", explanation: "每个状态都有 4 个可比较动作。" },
      { label: "奖励", value: "前进成本、碰撞与终点", explanation: "奖励把安全和效率变成可学习的数字。" },
    ],
    formulas: [{ label: "Q 值更新", expression: "Q(s,a) <- Q(s,a) + alpha [r + gamma max Q(s',a') - Q(s,a)]", explanation: "旧估计加上学习率乘以 TD error；终止 transition 的 bootstrap 为 0。" }],
    observationGuide: ["单步确认 s、a、r 与 s'", "查看 target 与 TD error", "确认只有对应 Q 格发生变化"],
    transfer: { prompt: "如果完整转移模型已经已知，是否还值得用采样 Q-learning？", note: "对照教程中的 planning：已知模型时，动态规划通常能利用更多信息。" },
    boundary: "Q 表要求状态和动作可以枚举；图像、连续位置或高维传感器会让表格失去可扩展性。",
    guide: guide("tabular-control", "Compare SARSA, Expected SARSA, Q-learning, and Double Q-learning", "本实验把教程中的行为策略、目标策略、终止 target 与单步 TD 更新变成可逐项核对的证据。", ["td-traces", "bandits-contextual-bandits"]),
  },
  {
    id: "dqn-driving",
    name: "DQN 单车",
    algorithmId: "dqn",
    algorithmLabel: "离散深度价值",
    description: "单车避障与路线学习",
    pageTitle: "DQN 单车 · RL 训练实验室",
    learningQuestion: "状态太多不能建表时，神经网络怎样预测每个离散动作的 Q 值？",
    prediction: {
      prompt: "把连续相邻的驾驶 transition 立刻按顺序训练，是否比随机 Replay 更稳定？",
      choices: ["是，相邻样本越多越稳定", "不是，强相关样本会让回归目标更不稳定"],
      answer: "不是，强相关样本会让回归目标更不稳定",
      explanation: "Replay 打乱并复用过去经验；Target Network 则减慢回归目标自身的移动。",
    },
    runInstruction: "单步观察 12 维输入和 9 个 Q 值，再开始训练，比较 Replay 预热前后的 loss 与 target。",
    evidenceSignals: ["12 维观察向量", "9 个动作 Q 值与 epsilon", "Replay 样本与终止 mask", "Target Q、TD error 与 Huber loss"],
    requiredSignals: ["qValues", "epsilon", "replaySize", "targetQ", "tdError", "loss"],
    concepts: [
      { label: "任务", value: "单车沿路线避障", explanation: "课程从直道开始，再加入固定和随机障碍。" },
      { label: "状态", value: "12 维驾驶观察", explanation: "距离、速度、航向、偏差和路线进度组成 s。" },
      { label: "动作", value: "9 个离散动作", explanation: "网络为方向与加速度组合分别输出 Q 值。" },
      { label: "模型", value: "Online + Target 网络", explanation: "共享参数带来泛化，也带来移动目标和误差扩散风险。" },
    ],
    formulas: [
      { label: "DQN target", expression: "y = r + gamma (1 - done) max Q_target(s', a')", explanation: "Target Network 提供较慢变化的下一状态估计；终止时 continuation 为 0。" },
      { label: "网络损失", expression: "loss = Huber(y - Q_online(s,a))", explanation: "随机 Replay batch 把相关的在线经历变成较稳定的监督回归样本。" },
    ],
    observationGuide: ["先看 observation 是否包含决策所需信息", "比较 epsilon 探索与贪心动作", "核对样本 target、误差和 loss"],
    transfer: { prompt: "如果动作改为任意方向盘角度，继续枚举更多 DQN 动作是否仍合适？", note: "连续动作通常转向 actor-critic，而不是无限细分离散动作。" },
    boundary: "DQN 仍要求有限离散动作；Replay 与 Target Network 改善稳定性，但不会自动解决错误奖励、缺失观测或分布外地图。",
    guide: guide("dqn", "Stabilize deep Q-learning with replay and target networks", "本实验直接展示教程 DQN 章节中的 replay、target network、terminal mask 和 moving-target 问题。", ["neural-approximation", "tabular-control"]),
  },
  {
    id: "td3-fleet",
    name: "TD3 城市车队",
    algorithmId: "td3",
    algorithmLabel: "共享连续策略",
    description: "多车推理与单车学习",
    pageTitle: "TD3 城市车队 · RL 训练实验室",
    learningQuestion: "一个 learner 怎样用多车场景训练共享 Actor，而不把推理车辆误当成独立学习器？",
    prediction: {
      prompt: "50 辆车同时运行时，让 50 辆车各自更新同一组权重，会自然得到更稳定的策略吗？",
      choices: ["会，更新越多一定越稳定", "不会，异步非平稳更新可能互相覆盖"],
      answer: "不会，异步非平稳更新可能互相覆盖",
      explanation: "本实验一次只允许一辆 learner 写 Replay 和更新权重，其余车辆共享最新 Actor 推理，并定期轮换 learner。",
    },
    runInstruction: "启动 MAX 训练，观察 learner 编号轮换，同时确认 Replay 和网络更新只有一条写入链。",
    evidenceSignals: ["当前 learner 编号", "共享 Replay 大小", "Actor/Critic 更新计数", "其余车辆的共享策略推理"],
    requiredSignals: ["steer", "throttle", "explorationNoise", "criticLoss", "actorLoss", "replaySize", "learnerIndex"],
    concepts: [
      { label: "任务", value: "多车连续接单", explanation: "所有车辆拥有不同起点和目标，共享一个策略。" },
      { label: "状态", value: "93 维雷达与车辆状态", explanation: "多通道雷达区分道路、车辆、结构与目的地。" },
      { label: "动作", value: "连续方向盘 + 踏板", explanation: "Actor 直接输出连续控制量。" },
      { label: "模型", value: "单 learner · 共享 Actor", explanation: "轮换数据来源，同时避免多写者把更新时序变成隐藏变量。" },
    ],
    formulas: [
      { label: "双 Critic target", expression: "y = r + gamma (1 - done) min(Q1_target, Q2_target)", explanation: "取较小估计以降低连续控制中的价值高估。" },
      { label: "延迟 Actor 更新", expression: "actor loss = -mean Q1(s, actor(s))", explanation: "Critic 多更新几次后才移动 Actor。" },
    ],
    observationGuide: ["确认 learner 与 inference vehicles 的角色", "观察 Replay/updates 是否连续增长", "轮换后比较不同车辆场景带来的经验"],
    transfer: { prompt: "如果每辆车都拥有独立策略并同时学习，环境的哪项假设会变化？", note: "其他智能体的策略不断变化，会让每个 learner 看到非平稳环境。" },
    boundary: "共享 Actor 的车队不是完整多智能体协作算法；它没有独立策略、集中 critic 或显式通信，不能据此宣称解决了 MARL。",
    guide: guide("distributed-rl", "Separate actors, learners, and replay in distributed RL", "本实验把教程中的 actor、learner、replay 与陈旧策略问题映射到一个可观察的浏览器车队。", ["dqn-family", "actor-critic-gae", "continuous-control"]),
  },
  {
    id: "subject-2",
    name: "TD3 科目二",
    algorithmId: "td3",
    algorithmLabel: "连续约束控制",
    description: "五项固定标准场地",
    pageTitle: "TD3 科目二 · RL 训练实验室",
    learningQuestion: "怎样让奖励表达考试目标与过程约束，而不是诱导车辆钻评分漏洞？",
    prediction: {
      prompt: "只给最终入库成功奖励、不提供过程证据，是否最不容易产生奖励作弊？",
      choices: ["是，稀疏奖励一定最安全", "不是，信号可能过稀；过程奖励仍需可审计且不改变最终目标"],
      answer: "不是，信号可能过稀；过程奖励仍需可审计且不改变最终目标",
      explanation: "这里用公开考试事件提供过程反馈，同时分别记录碰线、越界、方向、停滞和姿态，避免一个总分掩盖捷径。",
    },
    runInstruction: "先看当前科目的过程条件，再运行训练；对照奖励分项、车辆姿态、终止原因与最终考试判定。",
    evidenceSignals: ["当前考试过程条件", "逐项奖励与总和", "车辆位置、姿态、速度和控制", "终止原因与科目轮换计数"],
    requiredSignals: ["scenario", "processStage", "rewardBreakdown", "pose", "controls", "terminationReason"],
    concepts: [
      { label: "任务", value: "五项固定考试循环", explanation: "同一 TD3 模型每项尝试 100 次后轮换。" },
      { label: "状态", value: "57 维车辆与场地观测", explanation: "观测包含近场感知、姿态、速度、坡度、5 类科目和 4 个公开流程阶段。" },
      { label: "动作", value: "转向 · 互斥踏板 · 挡位", explanation: "自动挡 Actor 输出连续控制，油门与制动互斥。" },
      { label: "奖励", value: "目标、过程、约束分账", explanation: "每个分项都能追溯到考试事件或连续物理量。" },
    ],
    formulas: [
      { label: "可审计奖励", expression: "r_t = progress + checkpoints + pass - time - safety - terminal penalties", explanation: "正负项分开记录，检查总回报是否来自真正完成而非代理漏洞。" },
      { label: "TD3 target", expression: "y = r + gamma (1 - done) min(Q1_target, Q2_target)", explanation: "约束与终止进入 transition 后，再由 TD3 学习连续动作价值。" },
    ],
    observationGuide: ["先读当前公开过程条件", "核对每个奖励分项的触发证据", "检查完成、碰线、越界或超时是否立即终止"],
    transfer: { prompt: "若提高速度就能更快获得进度奖励，但碰线概率同时上升，应只看平均回报吗？", note: "不能；成功率、各类失败率和约束违反必须分开报告。" },
    boundary: "奖励分项可解释并不等于策略已学会，也不等于真实道路安全；必须用冻结模型、固定场景和分项失败指标独立评估。",
    guide: guide("reward-design", "Design rewards without confusing the score with the goal", "科目二实验把教程中的 reward shaping、proxy objective、specification gaming 和奖励审计变成实时分项证据。", ["interaction-loop", "transfer-meta-generalization", "continuous-control"]),
  },
] as const;

export const DEFAULT_LAB_ID: LabId = "subject-2";

export function getExperiment(id: LabId): ExperimentDefinition {
  const experiment = EXPERIMENTS.find((candidate) => candidate.id === id);
  if (!experiment) throw new RangeError(`Unknown experiment: ${id}`);
  return experiment;
}

export function experimentHref(id: LabId): string {
  return `#/${id}`;
}

export function experimentFromHash(hash: string): LabId | null {
  const id = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  return EXPERIMENTS.some((experiment) => experiment.id === id) ? id as LabId : null;
}

export function legacyPathToExperiment(pathname: string): LabId | null {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/q-learning") return "q-learning";
  if (path === "/dqn") return "dqn-driving";
  if (path === "/td3") return "td3-fleet";
  if (path === "/subject-2" || path === "/") return "subject-2";
  return null;
}

export interface AlgorithmRoadmapItem {
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "next" | "planned";
  readonly statusLabel: string;
  readonly learningQuestion: string;
  readonly evidence: string;
  readonly requiredSignals: readonly string[];
}

const activeRoadmap: readonly AlgorithmRoadmapItem[] = (["q-learning", "dqn-driving", "td3-fleet"] as const).map((id) => {
  const experiment = getExperiment(id);
  return {
    id: experiment.algorithmId,
    name: experiment.algorithmId === "td3" ? "TD3" : experiment.algorithmId === "dqn" ? "DQN" : "Q-learning",
    status: "active" as const,
    statusLabel: experiment.algorithmLabel,
    learningQuestion: experiment.learningQuestion,
    evidence: experiment.evidenceSignals.join(" · "),
    requiredSignals: experiment.requiredSignals,
  };
});

export const ALGORITHM_ROADMAP: readonly AlgorithmRoadmapItem[] = [
  ...activeRoadmap,
  { id: "sarsa", name: "SARSA", status: "next", statusLabel: "下一实验", learningQuestion: "下一动作如何改变同策略 target？", evidence: "next action · 同路径对照", requiredSignals: ["nextAction", "target", "tdError"] },
  { id: "expected-sarsa", name: "Expected SARSA", status: "planned", statusLabel: "规划中", learningQuestion: "策略概率如何形成期望价值？", evidence: "动作分布 · 加权 target", requiredSignals: ["actionProbabilities", "expectedValue", "target"] },
  { id: "dyna-q", name: "Dyna-Q", status: "planned", statusLabel: "规划中", learningQuestion: "真实经验与模拟更新如何协作？", evidence: "规划次数 · 样本来源", requiredSignals: ["sampleSource", "planningSteps", "modelSize"] },
];
