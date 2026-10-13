# qlearning/ src/workers（8 文件）——Web Worker 训练器

### src/workers/driving-trainer-protocol.ts
- 职责: 单车训练 Worker 边界的共享命令/载荷契约与校验助手。
- 关键: DrivingTrainerCommand/TrainerPayload/TrainerStatus/createTrainerEnvelope/isDrivingTrainerCommand/commandRequiresRuntime；~57 行。
- 坑/价值: 纯类型/校验模块零运行时依赖——主线程与 worker 双侧 import；resume/step/export-model 要求先 start。
- lastRead: 72f5adb (2026-10-13)

### src/workers/driving-trainer-protocol.test.ts
- 职责: 验证信封形状（schema "driving-v3"、模式、单调序号）、start 前置校验、reset/dispose/pause 允许无运行时；~41 行。
- lastRead: 72f5adb (2026-10-13)

### src/workers/driving-trainer.ts
- 职责: 单车 DQN 训练 Worker——TF.js 步进/探索/模型导入导出/评估全在 worker，主线程只收发信封；~162 行。
- 坑/价值: start/import/evaluate 强制 CPU 后端；泵循环每 32 步 setTimeout(0) 让出；L3 训练模式回合结束自动推进 trainingSeed（无尽课程不变量）；pumping/runtime 标志防重入。
- lastRead: 72f5adb (2026-10-13)

### src/workers/fleet-trainer-protocol.ts
- 职责: 车队 TD3 Worker 的类型契约——命令/载荷/`fleet-v2` 信封；~30 行。
- 坑/价值: 与 driving 协议不同，无运行时校验器——worker 信任 event.data 形状；信封无 mode 字段。
- lastRead: 72f5adb (2026-10-13)

### src/workers/fleet-trainer.ts
- 职责: 共享车队 TD3 运行时 Worker——训练/推理步进、速度配速、车队缩放、后端/吞吐指标；~123 行。
- 坑/价值: 单调 generation 令牌作废暂停/恢复/启动/销毁时的陈旧泵循环；训练分块 1/4/16 或 max 档 8 步（与主线程 WebGL 渲染协作）；推理按 100/playbackRate ms 配速；未知 cityId 回退第一城。
- lastRead: 72f5adb (2026-10-13)

### src/workers/subject2-trainer-protocol.ts
- 职责: 科目二 Worker 契约 + 节奏/检查点纯函数（命令/载荷/`subject2-v1` 信封、subject2Cadence、shouldAutoCheckpoint）；~36 行。
- 坑/价值: 两个函数纯且可在主线程单测；max 档 16 步批 0 延迟——实时 vs 加速由节奏而非 worker 定义；检查点间隔默认 1000 步。
- lastRead: 72f5adb (2026-10-13)

### src/workers/subject2-trainer-protocol.test.ts
- 职责: 验证 1x=100ms 实时物理钟（1 步/100ms）、4x/16x/max 节奏、自动检查点恰在每 1000 完成步触发（1000/2000 含、999/1999 不含）；~21 行。
- lastRead: 72f5adb (2026-10-13)

### src/workers/subject2-trainer.ts
- 职责: 科目二训练 Worker——按节奏物理步进、检查点导出导入、吞吐指标；~96 行。
- 坑/价值: 同车队 generation 令牌模式；每 1000 步自动检查点、暂停时也存（reason "pause"）；load-checkpoint 暂停并从检查点 stepCount 同步 lastCheckpointStep 防立即重存；错误消息为中文用户向。
- lastRead: 72f5adb (2026-10-13)
