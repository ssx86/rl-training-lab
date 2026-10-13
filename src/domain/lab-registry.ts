export type LabId = "q-learning" | "dqn-driving" | "td3-fleet" | "subject-2";

export interface LabDefinition {
  readonly id: LabId;
  readonly name: string;
  readonly algorithm: string;
  readonly description: string;
}

export const LABS: readonly LabDefinition[] = [
  { id: "q-learning", name: "Q-learning 峡谷", algorithm: "表格方法", description: "160 状态价值更新" },
  { id: "dqn-driving", name: "DQN 单车", algorithm: "离散深度价值", description: "单车避障与路线学习" },
  { id: "td3-fleet", name: "TD3 城市车队", algorithm: "连续共享策略", description: "多车推理与单车学习" },
  { id: "subject-2", name: "TD3 科目二", algorithm: "连续考试控制", description: "五项固定标准场地" },
] as const;

export const DEFAULT_LAB_ID: LabId = "subject-2";

export function labHref(id: LabId): string { return `#/${id}`; }

export function labFromHash(hash: string): LabId | null {
  const id = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  return LABS.some((lab) => lab.id === id) ? id as LabId : null;
}

export function legacyPathToLab(pathname: string): LabId | null {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/q-learning") return "q-learning";
  if (path === "/dqn") return "dqn-driving";
  if (path === "/td3") return "td3-fleet";
  if (path === "/subject-2" || path === "/") return "subject-2";
  return null;
}
