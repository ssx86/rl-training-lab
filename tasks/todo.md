# 障碍物自动驾驶训练任务清单

## V4 当前交付状态（2026-10-11）

- [x] 删除错误的“训练池”概念；任一时刻只有一辆 learner，并在全部 4 / 10 / 20 / 50 辆实时交通中轮换
- [x] 运行中热扩缩容，保留 TD3 权重、Replay、step、updates 和现有订单
- [x] 无进展持续扣分，80 步低速无进展触发 `stalled` 终止并自动换起点
- [x] 50 车 3D 实例容量、A–Z / AA–AX 标识与驾驶视角选择
- [x] 29 个测试文件、98 项测试，lint 与 production build 通过
- [x] 真实浏览器中车队热扩容到 20 / 50 辆，step 与 Replay 连续增长，两个驾驶视角均有 50 个车辆选项，控制台无 warning / error
- [x] 右侧通行车道路线、环岛 / 单行边方向约束、有朝向车身矩形碰撞

## V3 历史交付状态

- [x] 仅保留训练与推理评估；推理冻结探索噪声、Replay、actor 和双 critic 更新
- [x] 3 张固定 OSM 真实街区，包含环岛、死胡同与绕行拓扑
- [x] 4 / 10 / 20 车共享一个 TD3 actor，单 learner 更新并每 1,000 步轮换
- [x] 连续方向盘 / 踏板动作替代九个离散组合
- [x] 21×4 多通道雷达替代五条单标签射线，观察扩展为 93 维
- [x] 连续出租车订单，到站不重置模型或 Replay
- [x] 碰撞 `-50`、临时事故阻塞、120 步恢复、分离重生
- [x] Worker `1× / 4× / 16× / MAX` 与 RAF `15 / 30 / 60 FPS` 解耦
- [x] 米制总览支持 `1×–10×`、拖拽、跟车、全图；局部雷达校准为 32m
- [x] Three.js `PerspectiveCamera`，1 / 2 / 4 个独立可选车辆视角
- [x] 20 车运行、桌面/390px 响应式、训练/推理状态均完成真实浏览器回归
- [x] 29 个测试文件、93 项测试，lint 与 production build 通过
- [x] MAX 长跑通过 Replay 预热并完成 455 次更新；10 车约 20–27 fleet step/s，WebGL 后端下页面持续响应
- [x] 推理评估实测步数继续增长，同时噪声归零、Replay 与更新次数冻结；浏览器零 warning / error
- [ ] 独立长时训练收敛报告与固定/未见地图评估门槛尚未执行
- [ ] PPO/连续控制和动态交通仍为后续课程，不伪装为已实现

> 下列 Task 1–8 是第一版离散 DQN 课程的历史计划。V3 已用上方连续 TD3 契约取代其中的 9 动作、12 维观察和 DQN 运行时；保留清单用于解释迁移原因，不作为当前实现状态。

## Task 1: 通用环境与驾驶协议（历史）

**Description:** 把现有训练调度从网格状态抽象为带版本的 environment、observation、action 和 evidence 契约，同时保持 Q-learning 行为不变。

**Acceptance criteria:**
- [x] Q-learning 通过适配器继续运行且现有回归全绿
- [x] 驾驶 observation 的 12 个字段和 9 个动作有稳定顺序与中文标签
- [x] Worker 消息包含 schema version 和运行模式

**Verification:**
- [x] `npm test`
- [x] `npm run build`

**Dependencies:** None

**Files likely touched:** `src/domain/environment-adapter.ts`, `src/domain/learning-strategy.ts`, `src/domain/training-session.ts`, 对应测试

**Estimated scope:** Medium

## Task 2: 确定性车辆环境

**Description:** 实现固定时间步的简化车辆运动、道路边界、检查点、射线检测、障碍碰撞和回合终止。

**Acceptance criteria:**
- [x] 相同种子与动作序列产生相同轨迹
- [x] 车辆不能穿过障碍或道路边界
- [x] 12 维观测始终有限并处于约定范围

**Verification:**
- [x] 环境单元测试覆盖转向、加速、射线、碰撞和终止
- [ ] 脚本基线完成无障碍路线

**Dependencies:** Task 1

**Files likely touched:** `src/driving/vehicle-model.ts`, `src/driving/driving-environment.ts`, `src/driving/sensors.ts`, 对应测试

**Estimated scope:** Medium

## Task 3: 奖励与种子地图

**Description:** 实现可分解的进度、检查点、车道、安全距离、平顺性、越界与碰撞奖励，并建立固定和随机障碍地图。

**Acceptance criteria:**
- [x] 每项 reward component 可单独读取且总和一致
- [x] 检查点顺序单次领取，静止和抖动不能获得正回报
- [ ] 所有评估种子可达且至少存在一条无碰撞路线

**Verification:**
- [ ] 奖励作弊与地图可达性测试
- [ ] 固定种子快照测试

**Dependencies:** Task 2

**Files likely touched:** `src/driving/reward.ts`, `src/driving/maps.ts`, `src/driving/driving-environment.test.ts`

**Estimated scope:** Medium

## Task 4: DQN 与训练 Worker

**Description:** 使用 TensorFlow.js 实现在线网络、target network、replay buffer、epsilon 调度和后台训练协议。

**Acceptance criteria:**
- [ ] 网络输出固定为 9 个有限 Q 值
- [ ] target 计算、终止状态、同步周期和 replay 采样可确定性测试
- [ ] 暂停、恢复与纯评估不污染 replay 或权重

**Verification:**
- [ ] DQN 与 buffer 单元测试
- [ ] Worker 集成测试
- [ ] L1 短训练的 loss 和成功率趋势检查

**Dependencies:** Tasks 1-3

**Files likely touched:** `src/driving/dqn-agent.ts`, `src/driving/replay-buffer.ts`, `src/workers/driving-trainer.ts`, 对应测试

**Estimated scope:** Medium

## Task 5: 驾驶实验原型

**Description:** 按 `design.md` 产出画布、控制、状态观察、DQN 信号和评估报告的桌面/移动端布局及完整交互状态。

**Acceptance criteria:**
- [x] 明确手动、训练、暂停、评估、空、错误和训练完成状态
- [x] 传感器、动作 Q 值、奖励分解和 replay 样本均有固定位置
- [x] 主画布优先，移动端无页面横向溢出

**Verification:**
- [x] 原型逐场景自审并记录结论
- [x] 与 `design.md` 的色彩、层级、动效和可访问性逐项核对

**Dependencies:** Task 1

**Files likely touched:** `DRIVING_PROTOTYPE.md`, `design.md`

**Estimated scope:** Small

## Task 6: 可观察训练 UI

**Description:** 在原型通过后实现驾驶画布、观察层、训练控制和证据面板，并连接 Worker 事件流。

**Acceptance criteria:**
- [ ] 四种运行模式状态转换正确，暂停保持完整上下文
- [ ] 单步数据来自真实环境和 DQN 事件，不在组件中重算
- [ ] 高速训练期间交互保持响应

**Verification:**
- [ ] 组件和状态机测试
- [ ] 桌面与 390px 浏览器交互检查
- [ ] 浏览器控制台零错误、零警告

**Dependencies:** Tasks 4-5

**Files likely touched:** `src/components/driving/*`, `src/hooks/use-driving-lab.ts`, `src/App.tsx`, 对应测试

**Estimated scope:** Medium

## Task 7: 课程、模型与评估

**Description:** 实现 L1-L3 难度、带版本的模型导入导出、固定/未见种子评估和报告。

**Acceptance criteria:**
- [ ] 课程配置独立且可复现
- [ ] 不兼容权重拒绝导入并解释原因
- [ ] 报告同时包含成功、碰撞、越界、效率和停滞指标及样本数

**Verification:**
- [ ] 序列化往返与版本拒绝测试
- [ ] 40 个种子的评估器测试

**Dependencies:** Tasks 3-6

**Files likely touched:** `src/driving/curriculum.ts`, `src/driving/model-format.ts`, `src/driving/evaluator.ts`, 对应测试

**Estimated scope:** Medium

## Task 8: 回归与教学沉淀

**Description:** 完成全量回归、浏览器验收、性能检查，并把 DQN 教学方法沉淀到算法目录、方法论和项目技能。

**Acceptance criteria:**
- [ ] 自动驾驶训练达到计划中的固定与未见种子门槛
- [ ] Q-learning 全部现有行为和测试保持通过
- [ ] DQN 被标为 active，PPO 和动态障碍仍明确为 planned

**Verification:**
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] 桌面/移动端真实浏览器回归与控制台检查

**Dependencies:** Tasks 1-7

**Files likely touched:** `README.md`, `docs/RL_LAB_METHOD.md`, `skills/rl-teaching-lab/SKILL.md`, `src/domain/algorithm-catalog.ts`

**Estimated scope:** Medium
