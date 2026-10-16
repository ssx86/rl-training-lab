# qlearning/ MANIFESTS 索引 — RL Training Lab（rl-training-lab@1.1.0）

浏览器端多实验 RL 训练工作台（React 19 + Vite + TF.js + Three.js），RL Field Guide 的可运行配套。
HEAD 72f5adb (master = origin/master, 2026-10-13)。状态：已发布（CHANGELOG 1.1.0，Pages 线上）。

## 源码/文档文件夹（per-file 摘要 → folders/）

| 文件夹 | 文件数 | 模式 | 摘要 |
|---|---|---|---|
| (root) | 18 | per-file | [root.md](folders/root.md) — 8 份设计/审计/原型文档 + 10 配置 |
| .github/workflows · .goal · .done · docs · scripts · skills · tasks | 10 | per-file | [infrastructure.md](folders/infrastructure.md) — CI、实时任务方案、完成方案归档、方法论文档、OSM 生成脚本、agent 技能、已完结任务清单 |
| src（根）· src/catalog · src/exercise · src/lib · src/simulation · src/test | 11 | per-file | [src-core.md](folders/src-core.md) — 入口、实验目录单一事实源、练习入口、几何工具 |
| src/domain | 10 | per-file | [domain.md](folders/domain.md) — 峡谷表格型 RL 领域层 + 通用环境适配契约 |
| src/components（5 组） | 32 | per-file | [components.md](folders/components.md) — 通用面板 + driving/learning/subject2 组件 + ui 原语 |
| src/driving | 40 | **folder-level** | [driving.md](folders/driving.md) — 自动驾驶域（环境/智能体/OSM 地图/感知/车辆/奖励）；抽样 3，其余按批处理规则未逐读 |
| src/hooks · src/rl · src/rl/continuous | 12 | per-file | [hooks-rl.md](folders/hooks-rl.md) — 四实验状态 hook + 共享 replay buffer + TD3 |
| src/subject2 | 25 | per-file | [subject2.md](folders/subject2.md) — 科目二仿真域（法定尺寸/物理/奖励/运行时/检查点） |
| src/workers | 8 | per-file | [workers.md](folders/workers.md) — 三个训练 Worker + 协议 |

## Gitignored 产物目录（folder-level，永不逐文件走查）

| 目录 | 生成方式 | 体量 | 备注 |
|---|---|---|---|
| node_modules/ | `npm install` | ~615MB | 可再生 |
| dist/ | `npm run build` | ~7.5MB | 当前构建产物（Pages 部署由 CI 重做） |
| tsconfig.app.tsbuildinfo · tsconfig.node.tsbuildinfo | `tsc -b` | 小 | 增量编译状态 |
| .vite-audit.log · .vite-audit.err.log | Pages 部署审计遗留 | 小 | 一次性日志 |
| .lockgen-20261013/ | lockfile 生成临时目录（空） | 0 | 已处置：删除（见 reports） |

## 机器状态

`state.json` — 162 文本文件 + 上述 ignored 目录；`node manifest-check.mjs <repo>` 复查。
报告见上级工作区 `../MANIFESTS/reports/`（工作区级审计，覆盖 qlearning + rl-guide 两库）。
