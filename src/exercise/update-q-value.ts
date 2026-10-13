import type { Action } from "@/domain/cliff-walking";

export interface QUpdateInput {
  state: number;
  action: Action;
  reward: number;
  nextState: number;
  done: boolean;
  oldQ: number;
  nextMaxQ: number;
  alpha: number;
  gamma: number;
}

export interface QUpdateResult {
  newQ: number;
  tdTarget: number | null;
  tdError: number | null;
  implemented: boolean;
}

export type QValueUpdater = (input: QUpdateInput) => QUpdateResult;

/**
 * 你的练习入口。
 *
 * 根据输入计算新的 Q 值，并返回用于页面展示的中间量。
 * 完成后把 implemented 改为 true。
 */
export const updateQValue: QValueUpdater = (input) => {
  // TODO: 在这里实现 Q-learning 的 Q 值更新。
  // 页面、环境、动作选择和训练循环都已经准备好。
  const { reward, done, oldQ, nextMaxQ, alpha, gamma } = input;

  const tdTarget = done ? reward : reward + gamma * nextMaxQ;
  const tdError = tdTarget - oldQ;
  const newQ = oldQ + alpha * tdError;

  return {
    newQ,
    tdTarget,
    tdError,
    implemented: true,
  };
};

