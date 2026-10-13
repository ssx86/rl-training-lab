# qlearning/ src/driving（40 文件）· folder-level + 抽样 3

### src/driving/  [folder-level]
- 内容: 完整的自动驾驶 RL 领域层——离散/连续环境、DQN/脚本/TD3 相关智能体、OSM 派生城市地图、激光/雷达感知、带碰撞检测的自行车车辆模型、奖励整形、课程与训练/评估运行时。
- 模式: kebab-case；除 td3-agent.test.ts（源码在 src/rl/continuous/）外每个手写模块都有同位 *.test.ts；模块分组——环境（driving-environment、continuous-driving-environment、shared-fleet-runtime）、智能体（dqn-agent、scripted-driver、continuous-control）、地图（maps、city-map、lane-route、osm-*.generated.ts）、感知（sensors、radar）、车辆（vehicle-model、vehicle-collision）、奖励/课程（reward、curriculum）、训练评估（training-runtime、evaluator、model-format）+ 共享 types.ts。
- 模式: 3 个生成文件 osm-houten.generated.ts（~157KB）、osm-vathorst.generated.ts（~116KB）、osm-milton-keynes.generated.ts（~52KB）共 ~325KB，远超 37 个手写文件（各 ~0.7–17KB，shared-fleet-runtime.ts 最大 ~17KB）；由 scripts/import-osm-city.ps1 从 OpenStreetMap 生成。

### src/driving/types.ts（抽样）
- 职责: 离散驾驶任务的共享观测/动作契约——12 维归一化观测、9 个离散 steer×accel 动作、schema 版本。
- 关键: DRIVING_SCHEMA_VERSION "driving-v3"、DRIVING_OBSERVATION_FIELDS、DRIVING_ACTIONS、createDrivingObservation（钳位并守护非有限值）、drivingObservationToVector；~117 行。
- 坑/价值: 归一化静默钳位并以 0 掩蔽 NaN/Infinity——上游坏值被掩盖而非暴露。
- lastRead: 72f5adb (2026-10-13)

### src/driving/driving-environment.ts（抽样）
- 职责: Gym 风格 RL 环境（实现 EnvironmentAdapter）——自行车模型车辆沿地图路线推进并发出奖励/事件（检查点/目标/碰撞/离路/停滞/超时）。
- 关键: DrivingEnvironment + DrivingEvent 联合；~182 行。
- 坑/价值: 终止阈值硬编码（离路 8 步终止、停滞 80 步、超时 600 步）；progressDelta×30 奖励缩放；reset(seed) 忽略种子。
- lastRead: 72f5adb (2026-10-13)

### src/driving/dqn-agent.ts（抽样）
- 职责: TF.js DQN 智能体——在线/目标 MLP（2×128 relu）、epsilon-greedy、Bellman 目标批量训练、权重导入导出。
- 关键: DqnAgent/DqnAgentConfig/EpsilonScheduleConfig、computeBellmanTarget、SerializedWeight；~296 行。
- 坑/价值: 张量卫生严格（tf.tidy + finally dispose）；导入权重校验形状后重同步目标网；目标网为硬拷贝而非软更新。
- lastRead: 72f5adb (2026-10-13)

> 其余 37 文件未逐个阅读（folder-level 批处理规则）；新增/变更文件由 manifest-check 提示再读。
