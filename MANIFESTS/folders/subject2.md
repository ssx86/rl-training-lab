# qlearning/ src/subject2（25 文件）——科目二仿真域

### src/subject2/subject2-course.ts
- 职责: 科目二场景领域词汇——项目 id、位姿检查点、线段、路面/标线、库位类型 + 项目目录与中文标签。
- 关键: 纯类型/常量零导入；SUBJECT2_PROJECT_ORDER/LABELS；~87 行。
- 坑/价值: PROJECT_ORDER 仅是目录而非训练顺序（运行时采样随机化）；是 subject2 其余模块的类型枢纽。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-course.test.ts
- 职责: 验证目录恰含现行五个 C1 项目、场景采样随机（非目录序）、倒库恒用固定标准图（不镜像/旋转/缩放）；~16 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-standard.ts
- 职责: GA 1029-2022 课程与车辆标准尺寸/限值的单一事实源。
- 关键: 冻结常量 SUBJECT2_STANDARD（training + 倒库/侧方/坡道/S 线/直角弯）；~40 行。
- 坑/价值: 倒库 bayLength=车长+0.7m；坡道 1 秒保持是训练证据窗口而 GA 1026-2022 实际给 30 秒起步；附来源 PDF 链接注记。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-scenario.ts
- 职责: 确定性生成五个固定科目二课程图（GA 1029-2022 法定尺寸）并校验起点/检查点位姿无碰撞且在合法路面。
- 关键: createSeededRandom/generateSubject2Scenario/validateSubject2Scenario/trainingScenarioSeed/evaluationScenarioSeed；~253 行。
- 坑/价值: 地图刻意不随机化（无镜像/旋转/缩放，仅项目随种子选）；训练/评估种子流用大互素步长（104729/130363）+1000003 偏移保持不相交；transformPoint/transformHeading 是已删镜像/旋转管线的恒等占位。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-scenario.test.ts
- 职责: 验证逐种子确定性、每项目恰一张固定图、100×76 场景内几何、训练/评估种子空间不相交、法定尺寸（库位、3.4m 侧方车道、坡道杆线、S 线半径、直角路宽≥3.6m）、检查点语义、全部起/目标位姿无碰撞且在合法路面；~161 行。
- 坑/价值: 本地 circumradius 助手校验 S 线边界曲率；侧方控制线在库边 6.7m 偏移处验证。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-vehicle.ts
- 职责: 科目二车辆状态、TD3 动作编解码与 100ms 步长物理积分器（限速自动踏板、挡位逻辑、坡度力、自行车模型运动学）。
- 关键: advanceSubject2Vehicle/createSubject2Vehicle/minimumServiceBrakeForStaticHold/SUBJECT2_ACTION_CODEC/SUBJECT2_VEHICLE；~147 行。
- 坑/价值: 油门/刹车共享双极轴（正油门负刹车）且绝不同时激活（直调双给时刹车优先）；换挡仅 |speed|≤0.15 时接合；过零速在阻力主导时归 0（防方向抖动、支撑 isBrakeHolding）；坡度钳 ±0.3。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-vehicle.test.ts
- 职责: 验证动力学与编解码——单轴解码互斥踏板带挡位、倒挡、钳位与速率限制、零速稳定不震荡、真实米制尺寸与转弯半径（~3.8–4m）、10% 坡静态驻车制动阈值、100ms 积分、溜坡与爬坡；~122 行。
- 坑/价值: 钉死精确常量（4.473/1.706/2.548、14.4/9 km/h、踏板斜坡 .3/步）；断言 throttle×brake===0 不变量。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-sensors.ts
- 职责: 全周界 32 波束射线投射（16m 量程类激光扫描）→ 观测向量。
- 关键: senseSubject2Course、SUBJECT2_SENSOR_BEAMS=32、SUBJECT2_SENSOR_RANGE=16m；~51 行。
- 坑/价值: "exam-line"（计分控制线）段被刻意跳过——那是策略必须越过的语义门而非障碍。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-sensors.test.ts
- 职责: 验证 360° 全覆盖、考试线对波束透明、实体边界命中距离正确；~25 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-collision.ts
- 职责: 纯几何谓词——车体对线段/路面/库位（四角旋转矩形、前轮触点、前保险杠点、路面包含、库位完全包含）。
- 关键: ~97 行；库位判定在旋转局部系 + 1e-7 ε。
- 坑/价值: collidesWithCourse 刻意跳过 exam-line 段（不计分）；路面包含要求四角都在并集内。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-collision.test.ts
- 职责: 验证触线即碰撞、四角全在才入库（45° 旋转失败）、仅 ~2cm 侧向余量的合法入库被接受（无隐藏余量）；~30 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-environment.ts
- 职责: 核心 RL 环境——推进车辆物理、判定过程检查点（含坡道停/保持/起步状态机）、施加终止条件、产出 48 维观测与奖励。
- 关键: Subject2Environment、SUBJECT2_OBSERVATION_SIZE=48、checkpointPoseError、RampTrainingPhase；~250 行。
- 坑/价值: 不变量——checkpointReached 恒被 !collided 门控；坡道相位回撤沿固定 -π/2 上坡方向计量；停滞计数仅在不容许停车时累积；observe() 长度≠48 即抛（形状守卫）；setVehicleForTest 为测试后门。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-environment.test.ts
- 职责: 验证步进循环——检查点门控、坡道保持状态机、终止条件、观测卫生；~292 行（域内最大测试）。
- 坑/价值: 验证观测目标是最终端点而非当前门、48 维无种子/绝对坐标；倒库控制线按双前轮越线计分（不要求车身后部）；坡道停采用前保险杠带 + 连续保持 + 松刹重置；回撤>30cm、30s 起步期限、2s 通用停滞（合法坡道保持期暂停）等终止原因与罚值逐一验证。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-reward.ts
- 职责: 从位姿误差势能与罚项计算科目二逐步成形奖励分解。
- 关键: posePotential/calculateSubject2Reward/Subject2RewardBreakdown；~87 行。
- 坑/价值: 终止罚可叠加（-100 碰撞/出界/回撤/起步超时、-120 停滞）；timeout -50 仅在无其他终止且非刚达检查点时计；shapePoseProgress===false 可关势能项。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-reward.test.ts
- 职责: 逐组件验证可解释奖励——有界势能、总量=分量和、逆行/低净空罚、突变刹车、通过(+80)优于闲置、碰撞(<-90)与超时(<-45)、合法保持清零惰性罚并付 stableHold、startTimeout -100、stalled -120；~75 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-runtime.ts
- 职责: 科目二训练编排——播种场景、TD3 智能体（回放、warmup、相关探索、周期训练）、五项目轮换、训练/评估统计、快照与检查点存取。
- 关键: Subject2TrainingRuntime/nextSubject2ExplorationNoise/sampleSubject2WarmupAction/shouldAdvanceTrainingProject；~315 行。
- 坑/价值: 探索噪声 120k 步内 .32→.04 衰减且时间相关（ρ=.85）；warmup 随机动作保持整秒；回放≥max(warmup,batch) 才训练、每 trainEvery 步一次；评估用不相交种子空间与冻结回放；importCheckpoint 版本/索引不匹配抛中文 RangeError；推理时延为 EMA(.9/.1)。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-runtime.test.ts
- 职责: 验证每步一条回放转移、warmup 保持、相关噪声、精确模型元数据（48 观测/3 动作/23171 actor 参数）、目录序项目轮换、评估冻结、观测隐私（无路线/项目/种子泄漏）、训练/评估分离统计、检查点导出导入（replaySize 0、权重一致）；~119 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-checkpoint-store.ts
- 职责: 浏览器 localStorage 检查点持久化——Float32Array 权重按 0x8000 字节块 base64 编码进 JSON。
- 关键: SUBJECT2_CHECKPOINT_KEY/save/load；~85 行。
- 坑/价值: 加载端严格校验 schemaVersion 1/网络数组形状/可解析 savedAt，任何不匹配返回 null 而非抛错；解码复制缓冲使权重不与 base64 草稿数组别名。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-checkpoint-store.test.ts
- 职责: 验证类型化权重字节级往返（savedAt 保留）与损坏 JSON（"{broken"）返回 null 不抛；~26 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-display.ts
- 职责: 两帧车辆状态插值供 RAF 渲染——位置/速度/转向线性、航向取最短角路径、离散字段 t<.5 切换；~22 行。
- 坑/价值: 纯显示输出，绝不可回馈物理/环境。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-display.test.ts
- 职责: 验证 t=.5 线性插值与 ±π 边界最短角路径；~22 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-camera-geometry.ts
- 职责: 坡道项目渲染相机高度偏移（(65-y)×grade 钳 0）；纯显示助手；~6 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-telemetry.ts
- 职责: 近期控制样本聚合为油门/刹车/静止时长占比（>0.05 死区、独立取整）；~21 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-telemetry.test.ts
- 职责: 验证占比汇总与空样本清零；~18 行。
- lastRead: 72f5adb (2026-10-13)

### src/subject2/subject2-reverse-feasibility.test.ts
- 职责: 倒库地图可行性回归——按转向速率限制微步重放手工倒车路径，全程无碰撞且在合法路面，终态对齐库向（<.08rad）且完全入库；~56 行。
- 坑/价值: 防止地图改动使任务无解的守卫测试。
- lastRead: 72f5adb (2026-10-13)
