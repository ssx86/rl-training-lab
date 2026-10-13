# qlearning/ src/hooks + src/rl + src/rl/continuous（12 文件）

### src/hooks/use-lab.ts
- 职责: 离散峡谷 Q-learning 实验的状态控制器——按间隔步进 TrainingSession，跟踪回合/访问计数/坠落碰撞/Q 矩阵快照。
- 关键: LabMode/LabParameters/EpisodeRecord/useLab；默认 α0.1/γ0.9/ε0.2（衰减 0.995、下限 0.01）、500 回合、240ms/步；~216 行。
- 坑/价值: qVersion 计数器强制 qMatrix 重 memo（session 原地改 Q 表）；运行间隔下限 16ms；ε 衰减与停止条件在 finishEpisode；exploit 模式仍 step（learn:false）。
- lastRead: 72f5adb (2026-10-13)

### src/hooks/use-lab-route.ts
- 职责: hash 路由 hook——从 URL（hash 优先、旧路径次之）解析当前实验 id 并随 hashchange 同步。
- 关键: useLabRoute → LabId | null；旧路径经 history.replaceState 规范化为实验 hash；~23 行。
- lastRead: 72f5adb (2026-10-13)

### src/hooks/use-driving-lab.ts
- 职责: 课程驾驶实验 hook——持有 DrivingEnvironment 预览 + driving-trainer Web Worker（训练/评估/模型导入导出）。
- 关键: DrivingLabMode/useDrivingLab；schemaVersion 不匹配即丢消息；评估硬编码 20 固定种子（1–20）+ 20 未见种子（1001–1020）；模型导出走 Blob 下载；~200 行。
- 坑/价值: 对 refs/set-state-in-effect 有 eslint-disable（worker 快照经 ref 协调）。
- lastRead: 72f5adb (2026-10-13)

### src/hooks/use-driving-lab.test.tsx
- 职责: 验证初始训练模式、公开 API 无 drive 手动驾驶、课程级切换时预览（evidence/map/status）重置；~20 行。
- lastRead: 72f5adb (2026-10-13)

### src/hooks/use-shared-fleet.ts
- 职责: 多车共享车队 trainer Worker 管理——rAF 按渲染 FPS 节流发布快照，暴露车队/模式/速度/播放/驾驶视角控制。
- 关键: 拒绝 schemaVersion!=="fleet-v2" 信封；rAF 仅在 newer latestRef 存在时重渲染；缩车队钳索引、仅已有快照时发 resize-fleet；~122 行。
- 坑/价值: start 无快照或出错后发全新 start，否则 resume——worker 步进与渲染帧间无撕裂。
- lastRead: 72f5adb (2026-10-13)

### src/hooks/use-subject2-lab.ts
- 职责: 科目二实验 hook——trainer Worker、30 FPS 车辆插值、滚动奖励历史、localStorage 检查点存取恢复。
- 关键: 信封须匹配 "subject2-v1"；插值时长随训练速度（1x=100ms、4x=25ms、0=瞬移），回合/场景切换即瞬移；历史截尾 180 点；检查点失败提示存储已满；~150 行。
- 坑/价值: 恢复以 start(run:false) 进入暂停；起始种子硬编码 17。
- lastRead: 72f5adb (2026-10-13)

### src/hooks/use-tensorflow-status.ts
- 职责: 懒动态 import @tensorflow/tfjs 并报告 loading/ready（版本+后端）/error；~31 行。
- 坑/价值: 测试模式（import.meta.env.MODE==="test"）跳过加载；active 标志防卸载后 setState。
- lastRead: 72f5adb (2026-10-13)

### src/rl/replay-buffer.ts
- 职责: 通用 FIFO 经验回放缓冲——add/sample/toArray 防御性深克隆观测与动作，杜绝与调用方共享可变引用。
- 关键: Experience<TAction>/ReplayBuffer<TAction>；默认容量 50,000；~70 行。
- 坑/价值: 只克隆一层扁平动作（嵌套对象动作仍会别名）；sample 为部分 Fisher–Yates（无放回、每批 O(n)）；shift() 驱逐 O(n)；构造与超采样抛 RangeError。DQN/TD3/科目二三处共用（CHANGELOG 1.1.0 的合并产物）。
- lastRead: 72f5adb (2026-10-13)

### src/rl/replay-buffer.test.ts
- 职责: 验证 FIFO 驱逐、双向深克隆（标量 DQN 与对象 TD3 动作）、无放回采样、非法容量/批大小抛错；~52 行。
- lastRead: 72f5adb (2026-10-13)

### src/rl/continuous/td3-agent.ts
- 职责: TF.js TD3（Twin Delayed DDPG）智能体——actor/双 critic/目标网络、目标策略平滑、延迟 actor 更新、原始权重检查点导入导出。
- 关键: ContinuousExperience/Td3ActionCodec/Td3TrainResult/Td3AgentState/Td3Agent；~258 行。
- 坑/价值: 每次预测/训练前做观测校验（精确长度、全有限）；Huber critic 损失对削噪双子目标；trainBatch 手动 dispose 全部张量；trainableVariables 经 tfjs 内部 weight.val 取值——跨 tfjs 版本脆弱。
- lastRead: 72f5adb (2026-10-13)

### src/rl/continuous/td3-config.ts
- 职责: TD3 超参层——resolveTd3Config 部分配置补全默认，describeTd3Config 生成含手推参数量的 UI 描述。
- 关键: 默认 128 隐层、actor lr 3e-4/critic 1e-3、γ0.99、τ0.005、policyNoise 0.2、noiseClip 0.5、policyDelay 2、seed 7；~91 行。
- 坑/价值: 参数量数学假定 td3-agent.ts 的双隐层拓扑——改网络结构会静默使 describeTd3Config 失真。
- lastRead: 72f5adb (2026-10-13)

### src/test/setup.ts
- 职责: Vitest 全局 setup——jest-dom、RTL cleanup、ResizeObserver 与 canvas getContext 桩；~18 行。
- lastRead: 72f5adb (2026-10-13)
