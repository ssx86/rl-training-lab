# qlearning/ src/components（根 7 + driving 9 + learning 2 + subject2 9 + ui 5）

### src/components/app-shell.tsx
- 职责: 顶层页面骨架——标题头、TF.js 状态徽章、实验导航栏（高亮当前实验）。
- 关键: AppShell({ activeLab, children })；experimentHref 生成 <a href>；~19 行。
- 坑/价值: 导航是整页刷新的普通链接而非客户端路由；TF 徽章三态（ready/error/加载中）。
- lastRead: 72f5adb (2026-10-13)

### src/components/data-workbench.tsx
- 职责: 分页签证据面板——选中状态的 Q 表、可达状态 Q 矩阵（贪婪动作高亮）、回合奖励曲线、历史记录、算法路线图卡片。
- 关键: recharts 折线图；ALGORITHM_ROADMAP；cliff-walking 域助手；~75 行。
- 坑/价值: qMatrix 缺失时回退 [0,0,0,0]；history.slice().reverse() 倒序展示不改 props。
- lastRead: 72f5adb (2026-10-13)

### src/components/environment-grid.tsx
- 职责: 交互式 10×16 峡谷地图——可点按钮单元格、地形样式、智能体/起终点/墙/悬崖标记、三观察图层、访问计数、路径覆盖、Q 更新闪烁、奖励图例。
- 关键: EnvironmentGrid + QUpdateHighlight；~183 行。
- 坑/价值: 图层状态本地 useState（重挂载即重置）；不可达格为禁用按钮；策略平局显示"·"；valueStyle 只用可达状态归一化。
- lastRead: 72f5adb (2026-10-13)

### src/components/environment-grid.test.tsx
- 职责: 验证 160 格渲染与地形角色、图层切换（aria-pressed 且格数不变）、Q 更新格 q-heat-flash 高亮。
- 关键: 依赖 data-testid="grid-cell"、role="gridcell" 中文名、"q-heat-flash" 类名——改名即断；~45 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/metrics-panel.tsx
- 职责: 侧栏指标卡——聚合计数（回合/步/成功/坠落/碰撞/epsilon）与最新转移的 Q-learning 更新分步拆解（旧 Q/next-max/TD 目标/TD 误差/新 Q）。
- 关键: data-testid="episode-step"；~78 行。
- 坑/价值: lastStep 为空时整个拆解隐藏（显示空态提示）。
- lastRead: 72f5adb (2026-10-13)

### src/components/parameter-panel.tsx
- 职责: 超参控制表单——alpha/gamma/epsilon/速度滑条与 epsilonMin/decay/目标回合/最大步数数字输入，类型化回调上抛。
- 关键: 泛型 onChange<K extends keyof LabParameters>；~51 行。
- 坑/价值: 仅 targetEpisodes/maxSteps 组件内钳 ≥1；speedMs 以 16 的倍数步进（帧对齐）。
- lastRead: 72f5adb (2026-10-13)

### src/components/playback-controls.tsx
- 职责: 训练播放按钮行——单步/单回合/连续运行暂停/重置；~22 行。
- 坑/价值: 纯哑控件，行为全在父级回调。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/dqn-driving-lab.tsx
- 职责: 单车 DQN 驾驶实验顶层页——useDrivingLab 接入课程选择、运行控制、模型导入导出、训练指标、评估报告、画布/证据面板。
- 关键: 隐藏 file input 驱动 lab.importModel；~87 行。
- 坑/价值: 状态全在 hook、组件纯展示；指标在 evidence 为空时回退占位串（"0"、"等待 batch"）。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driver-view-3d.tsx
- 职责: Three.js 第一人称追逐视角——道路/车道虚线/建筑/树/导航线建场景，实例化车辆网格，FPS 节流。
- 关键: props { city, snapshot, vehicleIndex, renderFps }；~310 行。
- 坑/价值: 快照经 ref 进渲染循环（场景不逐帧重建）；MAX_VEHICLES=50；选中车以 scale .001 隐藏；导航线仅在路线键变化时重建；卸载时全量 dispose；无 WebGL2 时回退提示。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driving-canvas.tsx
- 职责: 单车训练环境的 2D SVG 俯视图——路线道路/中线虚线/斜纹障碍/终点环/5 条激光射线/车辆标记 + 单行数值摘要。
- 关键: obstacle-{id} 与 sensor-ray testid；~124 行。
- 坑/价值: SENSOR_FIELDS 与 SENSOR_ANGLES 按索引配对（非按名）；读数 <0.15 时射线变红加粗；速度显示硬编码 ×80。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driving-canvas.test.tsx
- 职责: 验证道路/车辆/障碍/5 射线/摘要行（含"路线进度 10%"）渲染；~34 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driving-evidence.tsx
- 职责: DQN 实验逐步训练证据——12 维观测向量、9 个 Q(s,a)（选中动作高亮）、奖励分解、s′/done 结果。
- 关键: action-q-value testid；~115 行。
- 坑/价值: 标签映射在此重复维护——新增观测字段/奖励项必须同步对应 Record，否则回退显示原始键。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driving-evidence.test.tsx
- 职责: 验证空态与填充态（9 个 Q 值、奖励分解标签、利用/探索 ε 指示）；~54 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driving-lab.tsx
- 职责: 共享车队 TD3 实验顶层页——可缩放城市画布、learner/actor 指标条、21×4 雷达可视化、多 3D 驾驶视角、运行控制（城市/车队规模/速度/渲染 FPS/learner 轮换）。
- 关键: 全部状态来自 useSharedFleet；~173 行。
- 坑/价值: 城市选择在有快照后被禁用（只能启动前换）；learner 指标读 vehicles[learnerIndex]、雷达读 vehicles[selectedVehicle]——两个不同索引；用户可见文案被 driving-lab.test.tsx 钉死。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/driving-lab.test.tsx
- 职责: 验证车队城市总览画布、速度/FPS 控制、车数/视角按钮、双角色页签、三城市选项，并排除已删的 manual/scripted 模式与"训练池车辆"旧措辞；~33 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/driving/fleet-city-canvas.tsx
- 职责: 车队城市 2D 画布总览——按等级道路/建筑/树/屏障/目的地节点/逐车虚线路线/选中车雷达波束/事故标记，含缩放按钮、跟随与适配控制。
- 关键: 相机 {zoom,panX,panY,follow} 钳 1–10x，指针拖拽 + 指针锚定滚轮；~201 行。
- 坑/价值: 首个车辆快照到达即自动锁定跟随（zoom 4）且不再重触发；手动操作即 follow:false；createLaneRoute 每车每帧重算（随车队规模变贵）；city.roads 回退映射与 driver-view-3d.tsx 重复——CityMap 形状需双侧同步。
- lastRead: 72f5adb (2026-10-13)

### src/components/learning/companion-learning-panel.tsx
- 职责: 通用 evidence-first 学习伴读条——渲染目录实验的问题、指南章节链接、5 阶段学习循环、先预测后揭示测验、证据信号、迁移/边界注记、事后公式卡。
- 关键: 单 prop { labId }；全部文案来自实验目录，组件零实验专属文本；~74 行。
- 坑/价值: 门控不变量：公式只在选择预测后渲染（测试断言）；判对错是与 experiment.prediction.answer 的严格字符串相等。
- lastRead: 72f5adb (2026-10-13)

### src/components/learning/companion-learning-panel.test.tsx
- 职责: 验证预测前隐藏机制/公式、判题反馈流、指向 RL Field Guide 精确章节的链接（reward-design/）、5 阶段标签；~32 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-lab.tsx
- 职责: 科目二实验顶层页——页头、训练/评估页签、本地课程画布 + 3D 驾驶视角、指标条、总览画布、考试目标卡、学习面板、侧栏训练控制、检查点面板、逐项目通过率。
- 关键: 全状态来自 useSubject2Lab；~125 行。
- 坑/价值: 耦合枢纽——拉取 course/environment/scenario/standard/vehicle、hooks、worker 协议类型与全部四个兄弟组件；最弱项目由 passRate reduce 计算。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-lab.test.tsx
- 职责: 验证多次尝试重置后仍渲染双画布（本地+总览）、显示"attempt #12 · fixed course"、无任何"attempt reset"横幅；~47 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-course-canvas.tsx
- 职责: 科目二课程 SVG 俯视图——地面/沥青纹理、路面/标线/库位标签、目标位姿、32 传感器射线、精细车形、5m 比例尺；车辆跟随 30×22.5m 局部视图或 4:3 适配总览。
- 关键: pathFromPoints 立方平滑；useId 派生图案 id；~105 行。
- 坑/价值: viewBox 为真实米单位（线宽/尺寸都是物理量）；总览模式隐藏射线与库位标签；平滑输出" C "段（被测试断言）。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-course-canvas.test.tsx
- 职责: 验证实尺车矩形（尺寸来自 SUBJECT2_VEHICLE）、4 轮在半宽内、32 射线、30×22.5 viewBox、总览双平滑路缘线且无导航线；~35 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-driver-view-3d.tsx
- 职责: Three.js 第一人称驾驶员相机——跟随训练车过 3D 课程（抬升坡面、路缘、目标环、引擎盖/仪表/方向盘），30 FPS 节流，速度/挡位/最近障碍遥测浮层，WebGL2 不可用回退。
- 关键: 场景每 scenario 建一次（[scenario, webglAvailable]），车辆经 vehicleRef 流动；~160 行。
- 坑/价值: 相机位置 0.42 lerp；画布命令式 append 进 hostRef div；卸载全量 dispose。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-driver-view-3d.test.tsx
- 职责: 验证 WebGL2 缺失时 role="status" 回退、坡道 10% 段相机高度 20→55m 抬升、S 线保持水平 0；~20 行。
- 坑/价值: jsdom 无 WebGL2，Three.js 渲染路径未被测试覆盖。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-checkpoint-panel.tsx
- 职责: 模型检查点状态卡——手动保存/加载控制、保存元数据、刷新后恢复提示对话框。
- 关键: 纯展示，状态在 use-subject2-lab；恢复按钮自动聚焦；~46 行。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-checkpoint-panel.test.tsx
- 职责: 验证刷新恢复提示对话框（恢复按钮调用一次 onRestore）与手动保存/加载按钮及格式化进度元数据；~23 行。
- 坑/价值: 以中文按钮/对话框名为选择器，改标签即断测试。
- lastRead: 72f5adb (2026-10-13)

### src/components/subject2/subject2-learning-panel.tsx
- 职责: 三页签诊断卡——recharts 奖励曲线（近 180 采样步）、对照当前步 rewardBreakdown 的奖励公式拆解、TD3 模型描述（架构/参数量/推理时延/理论公式）。
- 关键: describeTd3Config + DEFAULT_MODEL 回退 48→128→128→3；rewardRows 覆盖 16 个分解键；~96 行。
- 坑/价值: DEFAULT_MODEL 必须与训练端真实配置同步，否则 UI 谎报架构。
- lastRead: 72f5adb (2026-10-13)

### src/components/ui/badge.tsx · button.tsx · card.tsx · slider.tsx · tabs.tsx
- 职责: shadcn 风格 UI 原语（Badge span；cva Button 四变体三尺寸；Card/Header/Content；Radix Slider；Radix Tabs）；各 15–37 行。
- 关键: 全部经 cn() 组合类名；Button 支持 asChild Slot。
- lastRead: 72f5adb (2026-10-13)
