# qlearning/ src 核心与目录/练习/工具（src 根 5 + catalog 2 + exercise 1 + lib 1 + simulation 1 + test 1）

### src/main.tsx
- 职责: Vite 入口——StrictMode 挂载 App 并加载全局样式；~11 行。
- 坑/价值: 对 #root 使用非空断言，依赖 index.html 定义该元素。
- lastRead: 72f5adb (2026-10-13)

### src/App.tsx
- 职责: 根组件——按 URL 解析当前实验、设文档标题、渲染对应实验页与未知实验 404 回退。
- 关键: 导出 App；LAB_COMPONENTS 把 LabId 映射到 Subject2Lab/DqnDrivingLab/DrivingLab(td3-fleet)/QLearningLab；QLearningLab 组合 EnvironmentGrid/ParameterPanel/MetricsPanel/PlaybackControls/DataWorkbench；~62 行。
- 坑/价值: LabPage 用 key={labId}——切实验完全重挂载，训练进度不跨导航保留；"更新链路已接通"徽章由 lab.lastStep?.implemented===true 驱动（真实转移而非硬编码）。
- lastRead: 72f5adb (2026-10-13)

### src/App.test.tsx
- 职责: 集成测试——主 App 渲染、Q-learning 实验行为、跨实验证据/路线图交互。
- 关键: 锁定用户可见契约：URL 规范化到 #/subject-2、160 格、"Q-learning 更新链路已接通"、fake-timer 连续运行、算法路径证据信号、各实验公式揭示按钮；~101 行。
- 坑/价值: beforeEach 重置 history 到 /q-learning——对 window.location 顺序敏感。
- lastRead: 72f5adb (2026-10-13)

### src/app-navigation.test.tsx
- 职责: 测试四实验间 hash 导航、重挂载后 URL 保持、未知实验恢复页。
- 关键: 锁定导航 href（#/q-learning、#/dqn-driving、#/td3-fleet）、aria-current="page"、404 页"找不到这个训练实验"与"返回科目二"；~39 行。
- lastRead: 72f5adb (2026-10-13)

### src/styles.css
- 职责: 全局样式——Tailwind v4 主题令牌、基础元素样式、实验专用单元格纹理与 Q 值闪烁动画；~95 行。
- 坑/价值: 主题令牌（bg-card、text-success、rounded-panel 等）只在此定义，改名即断 Tailwind 工具类生成；reduced-motion 下全局禁用 heat-flash。
- lastRead: 72f5adb (2026-10-13)

### src/catalog/experiment-catalog.ts
- 职责: 中央目录——四个 RL 实验定义（元数据、学习问题、公式、证据信号、指南链接）、5 阶段学习循环、hash/路径路由助手、算法路线图。
- 关键: 导出 LabId、EXPERIMENTS、GUIDE_BASE_URL、LEARNING_LOOP、getExperiment/experimentHref/experimentFromHash/legacyPathToExperiment、ALGORITHM_ROADMAP 等；~243 行。
- 坑/价值: 路由+导航+页面标题的单一事实源——新增 LabId 必须同步 App.tsx 的 LAB_COMPONENTS；legacyPathToExperiment 保留旧路径（"/" 默认 subject-2）；路线图三个 active 项由 EXPERIMENTS 派生，sarsa/expected-sarsa/dyna-q "planned" 是唯一手写项。
- lastRead: 72f5adb (2026-10-13)

### src/catalog/experiment-catalog.test.ts
- 职责: 验证目录结构契约——每实验映射恰好一个指南章节、完整 evidence-first 学习契约、路由解析同源。
- 关键: 固定 id→guide-slug 对（q-learning/tabular-control、dqn-driving/dqn、td3-fleet/distributed-rl、subject-2/reward-design）、5 阶段 LEARNING_LOOP id、最少内容长度、恰好 2 个预测选项含答案、≥3 证据信号；~51 行。
- 坑/价值: 任何内容改动必须保持这些不变量。
- lastRead: 72f5adb (2026-10-13)

### src/exercise/update-q-value.ts
- 职责: 学习者练习入口——计算 Q-learning 更新（tdTarget/tdError/newQ）并返回供页面展示的中间量。
- 关键: 导出 QUpdateInput/QUpdateResult/QValueUpdater/updateQValue；~45 行。
- 坑/价值: 教学脚手架——中文文档串"你的练习入口"，TODO 注释保留但已实现（implemented: true）；tdTarget/tdError 可空以让未实现的学习者仍通过类型检查。
- lastRead: 72f5adb (2026-10-13)

### src/lib/utils.ts
- 职责: 共享 UI 工具——cn（clsx+tailwind-merge）与 formatMetric（null→"待实现"，整数原样，否则定小数）；~11 行。
- 坑/价值: formatMetric 的 null 分支是练习 UI 的"未实现"显示约定——传 undefined（非 null）会落到 toFixed 抛错。
- lastRead: 72f5adb (2026-10-13)

### src/simulation/geometry.ts
- 职责: 纯 2D 几何工具——Point/RouteProjection、distanceBetween、projectOntoRoute（折线最近点投影、带符号横向偏移、航向、段索引）、normalizeAngle；~73 行。
- 坑/价值: 少于 2 点的路线抛错；t 每段截断 [0,1]；零长段有专门分支；符号偏移用叉积区分左右——被 driving 与 subject2 两侧共用。
- lastRead: 72f5adb (2026-10-13)

### src/test/setup.ts
- 职责: Vitest 全局 setup——jest-dom 匹配器、RTL cleanup、jsdom 缺失 API 桩（ResizeObserver、canvas getContext）；~18 行。
- 坑/价值: getContext 强制返回 null——canvas 组件必须在测试中容忍 null 渲染上下文。
- lastRead: 72f5adb (2026-10-13)
