# qlearning/ 基础设施（.github · docs · scripts · skills · tasks，7 文件）

### .github/workflows/pages.yml
- 职责: GitHub Actions CI/CD——lint/test/audit/build 后部署 Pages（push master 或手动）。
- 关键: 两 job（build→deploy）；Node 22 + npm cache；npm ci、lint、`npm test -- --run`、`npm audit --omit=dev --audit-level=high`、VITE_BASE_PATH=/<repo名>/ 构建、上传 dist；deploy-pages@v4；pages 权限 + concurrency；~57 行。
- 坑/价值: base 注入为 `/<github.event.repository.name>/`——仓库名与 Pages URL 耦合；触发分支仅 master。
- lastRead: 72f5adb (2026-10-13)

### docs/RL_LAB_METHOD.md
- 职责: 中文方法论文档——可扩展教学实验方法（predict-run-inspect-explain-transfer 循环、四层架构、连续控制约束、奖励设计法、质量门）。
- 关键: 循环映射到 RL Field Guide；声明 src/catalog/experiment-catalog.ts 为实验/章节映射唯一注册表、src/domain/learning-strategy.ts 为更新层契约；六步新算法接入模板；TD3/PPO/SAC 约束（米制世界单位、Worker/RAF 解耦、单轮换 learner、方向车道语义、do-nothing 基线审计、OSM 地图质量门）；奖励梯度 +30/-1/-3/-4/-60；~89 行。
- 坑/价值: 规定 UI 不得保留算法定义/教程链接的第二份拷贝；诚实规则禁止把"计划中"算法展示为可运行/已验证。
- lastRead: 72f5adb (2026-10-13)

### docs/TUTORIAL_COMPANION_ARCHITECTURE.md
- 职责: 英文架构冻结文档——把本库变成只读 `rl-guide` 课程的可运行配套，收敛重复事实源而不改变实验语义。
- 关键: 权威链（rl-guide curriculum.ts 管章节、design.md 管视觉）；四实验映射（峡谷→tabular-control、DQN 车→dqn、TD3 车队→distributed-rl、科目二→reward-design）；experiment-catalog.ts 与通用 rl/replay-buffer.ts 双共享核心；六点显示契约；目录结构；命令、测试策略、always/ask/never 边界；~103 行。
- 坑/价值: 对 rl-guide 脏工作区的 never-edit 规则；Pages 构建示例硬编码 base /rl-training-lab/。
- lastRead: 72f5adb (2026-10-13)

### scripts/import-osm-city.ps1
- 职责: PowerShell 生成器——下载 OSM bbox 并产出 TypeScript CityMap 常量模块。
- 关键: 经纬度→米投影；6 类公路过滤；单行道/环岛方向；最大强连通分量；48 目的地/140 建筑采样；UTF-8 无 BOM `as const satisfies CityMap` + ODbL 署名；默认输出 src/driving/osm-<city>.generated.ts；~161 行。
- 坑/价值: 依赖在线 OSM 数据，再生成不可比特复现；roadWidth 7 与 48/140 上限为内建魔数。
- lastRead: 72f5adb (2026-10-13)

### skills/rl-teaching-lab/SKILL.md
- 职责: Agent 技能——规定如何在本库新增/修订 RL 课程，保持可观测更新证据、物理尺度一致、性能与设计系统。
- 关键: 教学契约（注册到 catalog、实现 LearningStrategy、策略+UI+测试接通前不得标 active）；奖励排序；三种观察时间尺度；连续控制规则（单单位制、Worker+RAF、[-1,1] 控制、固定角栅格雷达、单轮换 learner、do-nothing 基线、命名事件、署名真实地图）；验收清单含 390px 移动端；~61 行。
- 坑/价值: 反漂移核心是四态诚实状态（implemented/test-verified/browser-verified/merely planned）；曾指向已删除的 src/domain/algorithm-catalog.ts——2026-10-13 审计修正为 src/catalog/experiment-catalog.ts。
- lastRead: 72f5adb→工作树 (2026-10-13, 修正后重读戳记)

### tasks/plan.md
- 职责: "RL Field Guide Companion Refactor" 实施计划——依赖顺序、风险控制、验证检查点。
- 关键: 七步依赖链（冻结规格→失败测试→统一 catalog→通用 replay buffer→可复用 companion panel→作废文件审计→全回归+发布+公共路由验证）；5 项风险各配控制；4 个检查点；~27 行。
- 坑/价值: 状态：全部步骤完成——todo.md 全勾，含最终发布检查点，重构处于已完成/已发布阶段。
- lastRead: 72f5adb (2026-10-13)

### tasks/todo.md
- 职责: 配套重构的逐步执行清单。
- 关键: 8 项 RED/GREEN 测试驱动顺序（架构规格、catalog 测试、catalog 迁移替换 lab-registry.ts、通用 replay-buffer、DQN/TD3/科目二迁移并删两套旧 replay、prediction-to-transfer 面板替换 AlgorithmLearningPanel、死文件审计、全验证+发布）；~10 行。
- 坑/价值: 8/8 全勾、0 未勾——无剩余工作，此清单已完结。
- lastRead: 72f5adb (2026-10-13)
