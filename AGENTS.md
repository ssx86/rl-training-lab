# AGENTS.md — rl-training-lab (qlearning)

Legislated 2026-10-14 by repo-cartographer from the workspace audit reports
(`../MANIFESTS/reports/2026-10-13-audit.md`, `2026-10-13-status-audit.md`).

## Project Focus

- 本项目只做： browser-based **runnable RL training labs** — Q-learning canyon, DQN
  driving, TD3 shared fleet, Subject-2 — the runnable companion to the
  [RL Field Guide](https://ssx86.github.io/rl-field-guide/) (sibling repo `rl-guide`).
- 属于本项目的工作流（层，不是独立目标）： design/prototype/audit docs at repo root
  (`design.md`, `*PROTOTYPE*.md`, audits — dated history, read bottom-up), the agent
  skill (`skills/rl-teaching-lab/`), completed task plans (`tasks/`), OSM map
  generation (`scripts/import-osm-city.ps1`), CI + GitHub Pages deployment.
- 不属于本项目的事情（发现即向用户提出，不静默吸收）:
  - Course content / curriculum authoring — that belongs to the `rl-guide` repo.
    This repo only *links* to published guide chapters via
    `src/catalog/experiment-catalog.ts` (`GUIDE_BASE_URL`); never edit rl-guide
    from here (see `docs/TUTORIAL_COMPANION_ARCHITECTURE.md` never-edit rule).
  - Backends / servers / databases — everything runs in the browser (Workers).
  - Labs that are not registered in `src/catalog/experiment-catalog.ts` — the
    catalog is the single registry (routing, nav, page titles all derive from it).

## Structure Contract

- 目录权威: `MANIFESTS/INDEX.md` — new top-level folders must be registered there
  (with a summary) in the same change that creates them.
- 放置规则: new lab → register in `src/catalog/experiment-catalog.ts` + UI in
  `src/components/<lab>/` + simulation in `src/domain|driving|subject2/` + trainer
  worker in `src/workers/`; shared RL infrastructure → `src/rl/` (generic, e.g.
  `replay-buffer.ts`) and `src/simulation/` (pure geometry); teaching update
  algorithms behind `src/domain/learning-strategy.ts`; method docs → `docs/`;
  generator scripts → `scripts/`.
- 根目录禁放: one-off screenshots, manual backups, scratch exports. Design/audit
  docs and config files are the only root residents.

## File Hygiene Rules

From the 2026-10-13 audit findings — these are "do it right at creation time" laws:

- **被替换的模块，同提交清引用 (SSOT references)**: when a module is replaced
  (e.g. `algorithm-catalog.ts` → `catalog/experiment-catalog.ts`), the same commit
  must update every doc/skill/test that names the old path. Audit finding F3: the
  rl-teaching-lab skill still pointed at a file deleted days earlier.
- **换路必清旧路**: when an implementation path is replaced, delete the old surface
  or banner it in the same change. (The 1.1.0 companion refactor did this correctly —
  old replay buffers and lab-registry were removed with their successors' commit.)
- **一次性工具残留当场删**: scratch dirs from tooling (e.g. `.lockgen-*`) are
  deleted in the session that created them (finding F7); generated artifacts
  (`dist/`, `*.tsbuildinfo`, logs) are gitignored the moment they exist.
- **无游离文件**: every new file is either committed or gitignored within its
  working session — nothing floats as long-term untracked `??`.
- **带日期的审计文档保持带日期**: point-in-time audits (`PUBLISH_ARCHITECTURE_AUDIT.md`)
  stay as dated history; never edit them to masquerade as current state.
- **删除留墓碑**: any `git rm` records what/why/how-to-restore in
  `MANIFESTS/folders/*.md`.

## Last Audit

- 2026-10-13 repo-cartographer: reports at `../MANIFESTS/reports/2026-10-13-audit.md`
  and `2026-10-13-status-audit.md`; 遗留用户决策 0 项 in this repo
  (2 open decisions live in the sibling `rl-guide` repo — see its AGENTS.md).
