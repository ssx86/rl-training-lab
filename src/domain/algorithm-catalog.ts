export type AlgorithmStatus = "active" | "next" | "planned";
export type ActiveAlgorithmId = "q-learning" | "dqn" | "td3";

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

export interface AlgorithmLesson {
  id: ActiveAlgorithmId | "sarsa" | "expected-sarsa" | "dyna-q";
  name: string;
  status: AlgorithmStatus;
  statusLabel: string;
  learningQuestion: string;
  evidence: string;
  requiredSignals: readonly string[];
  concepts: readonly LearningConcept[];
  formulas: readonly AlgorithmFormula[];
  observationGuide: readonly string[];
}

export const ALGORITHM_LESSONS: readonly AlgorithmLesson[] = [
  {
    id: "q-learning",
    name: "Q-learning",
    status: "active",
    statusLabel: "表格方法",
    learningQuestion: "一次真实经历，怎样只更新表格中的一个状态动作格？",
    evidence: "TD 分解 · Q 表 · 策略箭头 · 回报曲线",
    requiredSignals: ["bootstrap", "target", "tdError"],
    concepts: [
      { label: "任务", value: "穿过峡谷到达终点", explanation: "智能体需要找到安全且较短的路径。" },
      { label: "状态", value: "160 个地图位置", explanation: "当前位置就是它此刻看到的状态 s。" },
      { label: "动作", value: "上 / 右 / 下 / 左", explanation: "每个状态都有 4 个可比较动作。" },
      { label: "奖励", value: "前进成本、碰撞与终点", explanation: "奖励把安全和效率变成可学习的数字。" },
    ],
    formulas: [
      {
        label: "Q 值更新",
        expression: "Q(s,a) <- Q(s,a) + alpha [r + gamma max Q(s',a') - Q(s,a)]",
        explanation: "旧估计加上学习率 alpha 乘以 TD error。gamma 决定多重视未来。",
      },
    ],
    observationGuide: ["先单步，确认状态 s、动作 a 与奖励 r", "观察 TD target 和 TD error", "回到地图，确认只有对应 Q 格发生变化"],
  },
  {
    id: "dqn",
    name: "DQN · 单车驾驶",
    status: "active",
    statusLabel: "深度价值方法",
    learningQuestion: "状态太多不能建表时，神经网络怎样预测每个离散动作的 Q 值？",
    evidence: "12 维观察 · 9 个动作 Q 值 · Replay · Target Network · Huber loss",
    requiredSignals: ["qValues", "epsilon", "replaySize", "targetQ", "tdError", "loss"],
    concepts: [
      { label: "任务", value: "单车沿路线避障", explanation: "课程从直道开始，再加入固定和随机障碍。" },
      { label: "状态", value: "12 维驾驶观察", explanation: "距离传感器、速度、航向、横向偏差和路线进度组成 s。" },
      { label: "动作", value: "9 个离散驾驶动作", explanation: "网络为每个方向与加速度组合输出一个 Q 值。" },
      { label: "奖励", value: "进度、偏离、危险与碰撞", explanation: "只有持续前进且保持安全，累计回报才会提高。" },
    ],
    formulas: [
      { label: "目标值", expression: "y = r + gamma max Q_target(s', a')", explanation: "Target Network 提供相对稳定的下一状态估计；终止时 y 只等于 r。" },
      { label: "网络学习", expression: "loss = Huber(y - Q_online(s,a))", explanation: "Replay 随机抽取过去经历，Online Network 用误差更新参数。" },
    ],
    observationGuide: ["看 12 维观察如何进入网络", "比较 9 个动作 Q 值和 epsilon 选择", "查看 Replay 样本的 target、TD error 与 loss"],
  },
  {
    id: "td3",
    name: "TD3 · 共享车队",
    status: "active",
    statusLabel: "连续控制方法",
    learningQuestion: "动作不能枚举时，Actor 与两个 Critic 怎样学习连续方向盘和踏板？",
    evidence: "93 维雷达 · 连续动作 · 双 Critic · 延迟 Actor 更新 · 单 learner",
    requiredSignals: ["steer", "throttle", "explorationNoise", "criticLoss", "actorLoss", "replaySize", "learnerIndex"],
    concepts: [
      { label: "任务", value: "城市连续接单", explanation: "一辆 learner 更新共享模型，其余车辆推理并形成动态交通。" },
      { label: "状态", value: "93 维雷达与车辆状态", explanation: "21 个方向分别识别道路、车辆、结构和目的地。" },
      { label: "动作", value: "连续方向盘 + 踏板", explanation: "Actor 直接输出 -1 到 1 的两个连续控制量。" },
      { label: "奖励", value: "路线进度、安全与到站", explanation: "停住、碰撞和偏离都会阻止模型靠不行动逃避扣分。" },
    ],
    formulas: [
      { label: "双 Critic 目标", expression: "y = r + gamma min(Q1_target, Q2_target)", explanation: "取两个目标 Critic 中较小的估计，减少价值被高估。" },
      { label: "延迟 Actor 更新", expression: "actor loss = -mean Q1(s, actor(s))", explanation: "Critic 多更新几次后才更新 Actor，让连续控制更稳定。" },
    ],
    observationGuide: ["确认当前只有一个 learner 写入 Replay", "比较雷达输入与连续动作输出", "观察 critic loss、actor loss 与到站换单"],
  },
  {
    id: "sarsa", name: "SARSA", status: "next", statusLabel: "下一实验",
    learningQuestion: "下一动作如何改变同策略 target？", evidence: "next action · 同路径对照",
    requiredSignals: ["nextAction", "target", "tdError"], concepts: [], formulas: [], observationGuide: [],
  },
  {
    id: "expected-sarsa", name: "Expected SARSA", status: "planned", statusLabel: "规划中",
    learningQuestion: "策略概率如何形成期望价值？", evidence: "动作分布 · 加权 target",
    requiredSignals: ["actionProbabilities", "expectedValue", "target"], concepts: [], formulas: [], observationGuide: [],
  },
  {
    id: "dyna-q", name: "Dyna-Q", status: "planned", statusLabel: "规划中",
    learningQuestion: "真实经验与模拟更新如何协作？", evidence: "规划次数 · 样本来源",
    requiredSignals: ["sampleSource", "planningSteps", "modelSize"], concepts: [], formulas: [], observationGuide: [],
  },
] as const;

export function getAlgorithmLesson(id: ActiveAlgorithmId): AlgorithmLesson {
  const lesson = ALGORITHM_LESSONS.find((item) => item.id === id);
  if (!lesson) throw new RangeError(`Unknown algorithm lesson: ${id}`);
  return lesson;
}
