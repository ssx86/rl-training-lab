# RL Navigation Lab

一个用于学习、训练和观察强化学习的浏览器实验台。主菜单统一管理四套可运行课程，地址可直接收藏和恢复：

- `#/q-learning`：Q-learning 峡谷导航，观察 TD 更新、策略、Q 值与跨回合结果。
- `#/dqn-driving`：DQN 单车驾驶，只保留训练与冻结权重的评估模式。
- `#/td3-fleet`：TD3 共享出租车队，一辆 learner 更新共享网络，其余车辆实时推理并轮换 learner。
- `#/subject-2`：TD3 科目二固定考场，多科目循环训练、物理约束与过程奖励共用同一模型。

它是独立教程 [RL Field Guide](https://ssx86.github.io/rl-field-guide/en/) 的交互配套项目。每个实验都明确链接到对应英文教程章节，并使用相同的学习顺序：**先预测 → 再运行 → 看数值证据 → 读公式解释 → 改变假设做迁移**。实验目录、章节映射和教学契约只有一个来源：`src/catalog/experiment-catalog.ts`。

## 启动

```bash
npm install
npm run dev
```

完整质量检查：

```bash
npm test
npm run build
npm run lint
```

## 在线版本

访问：[RL Training Lab on GitHub Pages](https://ssx86.github.io/rl-training-lab/)

推送到 `master` 后，GitHub Actions 会先执行 lint、全量测试、依赖审计和带仓库子路径的生产构建；全部通过后才更新 GitHub Pages。页面使用 hash 路由，因此四个实验在 Pages 刷新后仍能恢复当前入口。

## 当前环境

### TD3 连续控制共享车队

- 3 张固定的 OpenStreetMap 街区：Vathorst、Milton Keynes、Houten；保留环岛、死胡同、绕行和真实道路拓扑。
- 4 / 10 / 20 / 50 辆车共享一个 TD3 actor；默认 10 辆，单步只写入当前 learner 的经验。
- actor 输出连续 `steer [-1,1]` 和 `throttle [-1,1]`；双 critic、延迟 actor 更新和软 target 更新替代九个离散动作。
- 180° 前向雷达使用 21 个扇区，每个扇区同时保留道路边缘、车辆、结构物和目的地四个距离通道，共形成 93 维观察。
- 训练速度提供 `1× / 4× / 16× / MAX`，训练 Worker 与 RAF 渲染频率解耦。
- 地图为米制矢量观察窗，支持 `1×–10×` 缩放、拖拽、跟车与全图；城市雷达固定为 32 米，并按真实比例绘制。
- Three.js `PerspectiveCamera` 提供真实 3D 驾驶相机，可同时打开 1 / 2 / 4 个窗口并分别选择车辆。
- 到站后直接分配下一笔远距离订单，不重置共享权重或 Replay；碰撞产生 `-50` 奖励、临时路障和分离重生。
- 训练模式更新权重；推理评估冻结探索、Replay 与权重，只保留连续驾驶观察。

地图来自 OpenStreetMap，遵循页面标注的 ODbL attribution。当前是教学仿真，不代表现实车辆安全能力或道路部署认证。

### Q-learning 峡谷导航

| 事件 | 奖励 | 结果 |
| --- | ---: | --- |
| 到达目标 | +30 | 回合结束 |
| 普通移动 | -1 | 进入下一格 |
| 进入泥地 | -3 | 进入下一格 |
| 撞边界或墙 | -4 | 留在原地 |
| 掉入悬崖 | -60 | 返回起点 |

边界与墙体惩罚被单独建模，既明显差于普通移动，又不会与悬崖的灾难性信号混在一起。

## 学习入口

Q-learning 更新函数位于：

```text
src/exercise/update-q-value.ts
```

页面会读取函数真实返回的 `implemented`、`tdTarget`、`tdError` 和 `newQ`，并把结果同步到状态观察器、策略层和学习曲线。

## 观察方式

- 地形层：理解墙、泥地、悬崖、路径与访问次数。
- 策略层：观察每个状态的贪心动作；并列最优显示为中心点。
- 价值层：用单色琥珀明度观察最大 Q 值的空间分布。
- 状态观察器：读取所选状态四个动作的精确 Q 值与当前 TD 分解。
- 学习证据：比较回报曲线、回合步数、掉落与成功记录。

## 扩展算法

实验与算法学习路线统一登记在 `src/catalog/experiment-catalog.ts`，可执行更新遵循 `src/domain/learning-strategy.ts` 的策略契约。当前 Q-learning、离散 DQN 与连续控制 TD3 均有独立可运行入口；SARSA、Expected SARSA、Dyna-Q、PPO 与 SAC 保持为后续学习路线，不伪装成已实现功能。

配套教程架构见 [docs/TUTORIAL_COMPANION_ARCHITECTURE.md](docs/TUTORIAL_COMPANION_ARCHITECTURE.md)，新算法如何复用环境、交互与证据体系见 [docs/RL_LAB_METHOD.md](docs/RL_LAB_METHOD.md)。视觉与交互约束见 [design.md](design.md)，自主审核后的布局原型见 [PROTOTYPE.md](PROTOTYPE.md)。

继续扩展新算法时，可直接使用项目技能 [skills/rl-teaching-lab/SKILL.md](skills/rl-teaching-lab/SKILL.md)，它把学习问题、策略信号、奖励审计、观察层和验收门槛串成同一套执行流程。

## 技术栈

- Vite + React + TypeScript
- Tailwind CSS
- shadcn/ui 风格的本地组件
- Phosphor Icons
- Recharts
- Three.js
- Vitest + Testing Library

TensorFlow.js 在独立 Worker 中执行 TD3 的 actor、双 critic 与 target 网络，并自动选择浏览器支持的最快后端；表格型 Q-learning 继续使用 `Float64Array`，便于逐项观察和调试。

DQN、TD3 车队和 TD3 科目二共享 `src/rl/replay-buffer.ts`；TD3 的纯配置与参数说明独立于 TensorFlow.js 执行模块，使教学页面无需加载训练引擎即可展示准确的模型结构。
