# qlearning/ src/domain（10 文件）——表格型 RL 领域层

### src/domain/cliff-walking.ts
- 职责: 定义 10×16 峡谷网格世界——状态编码、地形集合、奖励常量、Transition 记录与 CliffWalkingEnvironment 步进机。
- 关键: 导出 ROWS/COLUMNS/STATE_COUNT/START_STATE/GOAL_STATE、REWARDS、ACTIONS、地形判定与中文标签、Position/Transition、CliffWalkingEnvironment；零依赖；~145 行。
- 坑/价值: 掉悬崖传回 START_STATE（-60、fell: true）但不置 done，只有到 GOAL 才 done；START 左下（144）、GOAL 右上（15）；setStateForTesting 是指定测试缝。
- lastRead: 72f5adb (2026-10-13)

### src/domain/cliff-walking.test.ts
- 职责: 验证网格动力学——起终点、地形奖励、悬崖回起点、BFS 式验证存在多条最短安全路径（距离 24）。
- 关键: 本地 shortestSafeRoutes BFS 助手；~94 行。
- 坑/价值: 路径计数刻意封顶 2（断言"多于一条"而非精确数）。
- lastRead: 72f5adb (2026-10-13)

### src/domain/cliff-walking-adapter.ts
- 职责: 把具体 CliffWalkingEnvironment 包装进通用 EnvironmentAdapter 接口（id "canyon-navigation"、schema "cliff-walking-v2"），为每步补充观测/奖励分解/步序证据。
- 关键: 导出 CliffEnvironmentStep、CliffWalkingAdapter；~45 行。
- 坑/价值: 适配器自持内部环境实例（不可注入）；seed 参数被接受但忽略（确定性环境）；stepIndex 计入悬崖重置步。
- lastRead: 72f5adb (2026-10-13)

### src/domain/cliff-walking-adapter.test.ts
- 职责: 验证适配器在保留底层转移的同时暴露通用证据（观测、rewardBreakdown、stepIndex）。
- 关键: 锁定契约——reset 返回 START_STATE、边界 UP 原地、rewardBreakdown 恰为 { step: reward }；~18 行。
- lastRead: 72f5adb (2026-10-13)

### src/domain/environment-adapter.ts
- 职责: 声明环境无关契约——EnvironmentAdapter、EnvironmentStep（观测/动作/奖励/分解/事件）、Worker RuntimeEnvelope（含 RuntimeMode）。
- 关键: 纯类型模块零运行时代码；~26 行。
- 坑/价值: rewardBreakdown 为任意键 Record——消费方不得假设固定奖励键集。
- lastRead: 72f5adb (2026-10-13)

### src/domain/environment-adapter.test.ts
- 职责: 验证类型契约可编译、每步携带奖励证据、RuntimeEnvelope 带版本/模式/序号。
- 关键: 内联玩具 "line-world" 适配器；~51 行。
- 坑/价值: 类型级/形状测试——守护 worker 消息 schema 而非运行时逻辑。
- lastRead: 72f5adb (2026-10-13)

### src/domain/learning-strategy.ts
- 职责: 定义 LearningStrategy 接口（可插拔课程更新算法 + 教学 UI 信号）并提供 createQLearningStrategy（把 QValueUpdater 接入标准 Q-learning 更新）。
- 关键: 导出 LearningSignal/Context/Update、LearningStrategy、createQLearningStrategy；~57 行。
- 坑/价值: 策略只管更新语义；返回信号（bootstrap/target/tdError）即教学 UI 渲染内容，改键名即断课程显示。
- lastRead: 72f5adb (2026-10-13)

### src/domain/q-table.ts
- 职责: Q 表——STATE_COUNT×4 的 Float64Array，带校验 get/set、逐状态访问器、矩阵序列化、epsilon-greedy 选动作与探索/利用标注。
- 关键: 导出 ActionSource/ActionSelection/QTable/selectAction；~68 行。
- 坑/价值: 硬耦合峡谷地图（160 状态/4 动作）——形状不匹配构造即抛 RangeError；set 拒绝非有限值；平局随机打破（注入 RNG 保证测试确定性）。
- lastRead: 72f5adb (2026-10-13)

### src/domain/training-session.ts
- 职责: 训练循环编排——逐步 epsilon-greedy 选动作、把值更新委托给 LearningStrategy（默认 Q-learning）、写回 Q 表、章节/步数/累计奖励记账与重置。
- 关键: 导出 LearningParameters/StepResult/TrainingSession；~147 行。
- 坑/价值: 同时给 updater 与 strategy 即抛错；learn:false 时 epsilon 强制 0 且 Q/tdTarget/tdError 冻结但 nextMaxQ 仍计算；回合推进不自内置——done 后调用方须 nextEpisode()；resetEpisode 保留计数、resetAll 清表。
- lastRead: 72f5adb (2026-10-13)

### src/domain/training-session.test.ts
- 职责: 验证 Q 表零初始化与矩阵往返、选动作标注、自定义 updater 结果写表、learn:false 冻结、策略供给 algorithmId+信号、双供抛错。
- 关键: ~109 行。
- 坑/价值: random()=>0 + epsilon 0 时确定性地利用 UP——断言依赖该平局打破。
- lastRead: 72f5adb (2026-10-13)
