# qlearning/ 根目录文件（19）

### AGENTS.md
- 职责: 代理立法文件——四件套（Project Focus 焦点与边界 / Structure Contract 结构契约指向 MANIFESTS/INDEX.md / File Hygiene Rules 卫生法 / Last Audit 指针）。
- 关键: 焦点=浏览器端可运行 RL 实验台（rl-guide 只链接不编辑）；卫生法来自 2026-10-13 审计类别（SSOT 引用同提交清理、换路必清旧路、一次性残留当场删、无游离文件、删除留墓碑）；~70 行。
- lastRead: 5f1ef8e (2026-10-14)

### .gitignore
- 职责: Vite/React 标准忽略规则。
- 关键: node_modules/、dist/、coverage/、test-results/、.env*、*.log、*.tsbuildinfo、编译产物 vite.config.js/.d.ts；~12 行。
- 坑/价值: 忽略 vite.config.js 但不忽略 vite.config.ts——把杂散 `tsc` 编译产物挡在库外而不隐藏真正配置。
- lastRead: 72f5adb (2026-10-13)

### CHANGELOG.md
- 职责: 发布日志，当前仅 1.1.0（2026-10-13）一条。
- 关键: Added/Changed/Removed/Verification；1.1.0 加入 evidence-first 学习面板（predict→run→inspect→explain→transfer）、experiment-catalog 导航、RL Field Guide 章节链接；合并 DQN/TD3/Subject2 replay buffer；删除重复 catalog 与旧 2D driver 投影；引用 209 tests/50 文件 + lint/TS/Pages 审计；~31 行。
- 坑/价值: 单条日志；"Removed" 项与 DRIVING_PROTOTYPE.md 的 V2→V5 历史一致，可作为"已不存在之物"的可靠索引。
- lastRead: 72f5adb (2026-10-13)

### DRIVING_PROTOTYPE.md
- 职责: 共享车队 TD3 出租车驾驶实验的设计原型与自审历史（V1–V5 叠层文档）。
- 关键: 继承 design.md 参数；产品模型（训练/推理、单一轮换 learner、Worker/RAF 解耦）；180°/21 扇区/4 通道雷达；Three.js 驾驶视角；V3（TD3 连续控制替换 DQN、93 维观测）、V4（车辆数热调整、停滞检测）、V5（废弃"训练池"抽象、右行车道线、旋转矩形碰撞）；~125 行。
- 坑/价值: 分层历史文档——早期章节被 V3–V5 修订部分取代（V1 虚构三城已被 README 的 OSM 真实地图取代）；自下而上读才是当前事实。
- lastRead: 72f5adb (2026-10-13)

### PROTOTYPE.md
- 职责: 表格型 Q-learning 峡谷导航实验的自审原型规格（"RL Navigation Lab 2.0"）。
- 关键: 10×16 峡谷环境奖励表（+30 目标、-1 移动、-3 泥地、-4 墙/边界、-60 悬崖→重开）；三图层（地形/策略/价值）；SARSA/Expected SARSA/Double Q/Dyna-Q 仅作路线图；实现红线（不得覆盖 src/exercise/update-q-value.ts、不得硬编码 48 状态）；~98 行。
- 坑/价值: 只覆盖 Q-learning 实验、早于 4 实验 app shell；奖励表与观测图层仍与 README 完全一致；附"无人工审批门"授权注记。
- lastRead: 72f5adb (2026-10-13)

### PUBLISH_ARCHITECTURE_AUDIT.md
- 职责: 发布前架构与主菜单审计（2026-10-13），曾判定"不可发布"并开出统一改造方案。
- 关键: 结论 not ready to ship；6 项阻塞（统一菜单、URL/菜单脱节、缺 Vite base、静默未知路径回退、DQN hook 残留 manual/scripted 模式、共享 TD3/replay/geometry 放错目录）；hash 路由 `#/q-learning` 等；目标架构树与 8 步实施顺序；~100 行。
- 坑/价值: 时间点审计——其阻塞项按 CHANGELOG 1.1.0 与 README 的线上 Pages URL 均已解决；作历史依据读，非现状。审计提出的 `rl/continuous` 布局只部分落地（现为 src/rl/replay-buffer.ts）。
- lastRead: 72f5adb (2026-10-13)

### README.md
- 职责: 项目主 README——浏览器端多实验 RL 训练工作台，RL Field Guide 教程的可运行配套。
- 关键: 4 实验 hash 路由目录；quickstart；线上 Pages 链接与 Actions 质量门；TD3 车队细节（3 张固定 OSM 地图 Vathorst/Milton Keynes/Houten、21×4 雷达→93 维观测、速度档、Three.js、ODbL 署名）；Q-learning 奖励表；学习入口 src/exercise/update-q-value.ts；单一目录源 src/catalog/experiment-catalog.ts；~99 行。
- 坑/价值: 最新顶层文档；标题"RL Navigation Lab"比正文描述的 4 实验产品窄。
- lastRead: 72f5adb (2026-10-13)

### SUBJECT2_DESIGN.md
- 职责: 中国 C1 科目二随机泛化训练实验（TD3 连续控制）设计简报。
- 关键: 泛化目标（10 轮全通过后重采样、未见种子评估）；法规依据（GA 1026-2022/GA 1029-2022 精确尺寸）；41 维观测 = 32 条 360° 射线 + 目标/进度状态；车辆 4.7×1.85m、轴距 2.72m；~46 行。
- 坑/价值: 车辆尺寸已被 SUBJECT2_QUALITY_AUDIT.md 的校准教练车值（4.473×1.706m、轴距 2.548m）取代。
- lastRead: 72f5adb (2026-10-13)

### SUBJECT2_QUALITY_AUDIT.md
- 职责: 科目二实验对照"大学试用级商用质量候选"标准的质量审计，88/100 通过（≥85 且无维度<70%）。
- 关键: 7 维加权评分表；10 项已修复拒绝项（连续 S 线、0.14m 线宽、16m 感知、坡道 10% 坡度回滚 0.30m 失败、倒车路径可行性回归等）；车辆动力学参数表（4.473/1.706m、轴距 2.548m）；明确未建模物理清单；发布前外部检查清单；~53 行。
- 坑/价值: 诚实划界——最大转向角是车辆参数而非国标；实车校准与师生试用仍是外部关卡；其车辆尺寸取代 SUBJECT2_DESIGN.md。
- lastRead: 72f5adb (2026-10-13)

### design.md
- 职责: 实验室 UI 的视觉与交互设计规范（"现代科学仪器"美学），全部原型文档的单一设计来源。
- 关键: 设计参数（DESIGN_VARIANCE 4 / MOTION_INTENSITY 5 / VISUAL_DENSITY 8）；色彩令牌（琥珀 #d97706 单强调色）；Noto Sans SC + Cascadia；圆角/间距/三栏断点；地图可视化规则（三图层、灰度可读纹理）；动效时长与 prefers-reduced-motion；WCAG AA；组件规则；~81 行。
- 坑/价值: 标题写"Q-learning Lab 设计规范"，实为全局设计系统——PROTOTYPE.md 与 DRIVING_PROTOTYPE.md 均引用它为继承参数源。
- lastRead: 72f5adb (2026-10-13)

### components.json
- 职责: shadcn/ui CLI 组件生成配置。
- 关键: style "new-york"、Tailwind v4、别名 @/components 等、iconLibrary phosphor；~17 行。
- lastRead: 72f5adb (2026-10-13)

### eslint.config.js
- 职责: 扁平配置 ESLint（TS React）。
- 关键: react-hooks + react-refresh + typescript-eslint recommended；忽略 dist/、coverage/；~24 行。
- lastRead: 72f5adb (2026-10-13)

### index.html
- 职责: Vite 入口 HTML（zh-CN，"Q-learning Lab"，挂载 #root → /src/main.tsx）；~13 行。
- lastRead: 72f5adb (2026-10-13)

### package-lock.json
- 职责: npm 锁文件（lockfileVersion 3）。
- 关键: 仅读了头部——根包 rl-training-lab@1.1.0，deps tfjs/three/recharts/radix/phosphor/react 19，devDeps vite 8/vitest 5/tailwind 4/TS 6/eslint 10/@emnapi*。
- lastRead: 72f5adb (2026-10-13)

### package.json
- 职责: "rl-training-lab" 项目清单。
- 关键: scripts dev/build(tsc -b && vite build)/lint/test(vitest run)/test:watch/preview；tfjs ^4.22、three ^0.186、recharts ^3.10、react 19；MIT；~58 行。
- 坑/价值: @emnapi/*（tfjs WASM 运行时支持）放在 devDependencies 不寻常——生产式安装会缺包，需验证是否真被构建卷入。
- lastRead: 72f5adb (2026-10-13)

### tsconfig.app.json
- 职责: src/ 浏览器侧 TS 配置。
- 关键: ES2022 strict、Bundler 解析、@/* 别名、vitest/globals + jest-dom 类型；~22 行。
- lastRead: 72f5adb (2026-10-13)

### tsconfig.json
- 职责: 根 TS project-references 汇总（app + node）；~7 行。
- 坑/价值: `tsc -b` 依赖此文件；新增 TS 上下文需新增引用项目。
- lastRead: 72f5adb (2026-10-13)

### tsconfig.node.json
- 职责: Node 侧工具文件（vite/eslint config）TS 配置；~10 行。
- 坑/价值: composite+noEmit 仅在 `tsc -b` 引用下成立；eslint.config.js 被按 Node 文件检查，不得 import 浏览器类型。
- lastRead: 72f5adb (2026-10-13)

### vite.config.ts
- 职责: Vite + Vitest 配置。
- 关键: base 取自 VITE_BASE_PATH（默认 "/"，支撑 Pages 子路径部署）；react + tailwindcss 插件；@→src；vitest jsdom + setup；~21 行。
- lastRead: 72f5adb (2026-10-13)
