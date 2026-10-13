import {
  createCornerTrainingMap,
  createSeededObstacleMap,
  createStraightTrainingMap,
  type DrivingMap,
} from "./maps";

export type CurriculumLevel = "L1" | "L2" | "L3";

export interface CurriculumDefinition {
  readonly id: CurriculumLevel;
  readonly label: string;
  readonly description: string;
  readonly createMap: (seed: number) => DrivingMap;
}

export const DRIVING_CURRICULUM: readonly CurriculumDefinition[] = [
  {
    id: "L1",
    label: "L1 车道保持",
    description: "直道、无障碍，先学习稳定前进。",
    createMap: () => createStraightTrainingMap(),
  },
  {
    id: "L2",
    label: "L2 固定避障",
    description: "固定转弯路线和静态障碍，观察传感器响应。",
    createMap: () => createCornerTrainingMap(),
  },
  {
    id: "L3",
    label: "L3 随机障碍",
    description: "由种子生成静态障碍，检验泛化而非背图。",
    createMap: (seed) => createSeededObstacleMap(seed),
  },
] as const;

export function createCurriculumMap(level: CurriculumLevel, seed: number): DrivingMap {
  const curriculum = DRIVING_CURRICULUM.find((item) => item.id === level);
  if (!curriculum) throw new RangeError(`Unknown curriculum level: ${level}`);
  return curriculum.createMap(seed);
}
