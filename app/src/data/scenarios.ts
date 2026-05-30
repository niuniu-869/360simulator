/**
 * scenarios.ts — 6 个经典剧本（Phase 4）
 *
 * 每个剧本预设：品牌 / 区位 / 装修 / 选品 / 初始资金 / seed / 难度描述。
 * 玩家选择剧本后，CLI/UI 会自动跳过部分筹备步骤。
 *
 * 注意：地址 ID 在数据中可能没有对应字段，开店时如未指定地址，
 *      会以 location 默认地址作为 fallback。
 */

import type { Brand, Location, Decoration, Product, GameState } from '@/types/game';

export interface ScenarioBlueprint {
  id: string;
  name: string;
  description: string;
  /** 难度：easy / medium / hard / nightmare */
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  /** 推荐 seed（可复现） */
  recommendedSeed: number;
  /** 起始现金（覆盖 INITIAL_CASH） */
  initialCash?: number;
  brandId: string;
  locationId: string;
  addressId?: string;
  decorationId: string;
  productIds: string[];
  staffSetup?: Array<{ staffTypeId: string; assignedTask?: string }>;
  /** 一段开局 narrative（UI 在欢迎页/剧本说明显示） */
  narrative: string;
  /** 标签（用于筛选/挑战） */
  tags: string[];
  /** 该剧本胜利后解锁的成就 id（仅元数据，非校验） */
  victoryAchievementId?: string;
}

export const SCENARIOS: ScenarioBlueprint[] = [
  {
    id: 'scen_zhinanguozhi',
    name: '脚盆果汁：蜜雪对面',
    description: '在蜜雪冰城对门开果汁店，初始资金只有 ¥30k，挑战极限。',
    difficulty: 'hard',
    recommendedSeed: 1024,
    initialCash: 30000,
    brandId: 'independent',
    locationId: 'business',
    decorationId: 'simple',
    productIds: ['fruittea', 'milktea'],
    staffSetup: [{ staffTypeId: 'parttime' }],
    narrative:
      '你被房东哄上车，开在蜜雪冰城正对门。手里只剩 ¥30k，对面 6 块钱的柠檬水正笑着等你倒下。',
    tags: ['困难', '位置劣势'],
    victoryAchievementId: 'scenario_zhinanguozhi',
  },
  {
    id: 'scen_baiwanshenglou',
    name: '百万奶茶大厦',
    description: '300 平整栋楼 / 7 个员工 / 高负债开局。能不能撑过 12 周？',
    difficulty: 'nightmare',
    recommendedSeed: 7777,
    initialCash: 80000,
    brandId: 'tastien',
    locationId: 'business',
    decorationId: 'premium',
    productIds: ['burger', 'fries', 'milktea', 'coffee'],
    staffSetup: [
      { staffTypeId: 'fulltime' },
      { staffTypeId: 'fulltime' },
      { staffTypeId: 'fulltime' },
      { staffTypeId: 'parttime' },
      { staffTypeId: 'parttime' },
    ],
    narrative:
      '一个朋友说"做大才能挣钱"，劝你拿下整栋楼。装修砸了 ¥30 万，员工开了 7 个，第一周薪资就咬住你的现金流。',
    tags: ['过度投资', '现金流压力'],
    victoryAchievementId: 'scenario_baiwan',
  },
  {
    id: 'scen_zhongyao',
    name: '中药奶茶：小学门口',
    description: '在小学门口开中药奶茶。客群定位灾难，你怎么救？',
    difficulty: 'hard',
    recommendedSeed: 369,
    initialCash: 100000,
    brandId: 'independent',
    locationId: 'school',
    decorationId: 'cozy',
    productIds: ['milktea', 'fruittea'],
    staffSetup: [{ staffTypeId: 'fulltime' }, { staffTypeId: 'parttime' }],
    narrative:
      '你被一个"中药养生奶茶"概念打动，开在小学门口。结果学生想喝甜的，家长嫌不正经。怎么办？',
    tags: ['客群错位'],
  },
  {
    id: 'scen_shanlu',
    name: '禅意奶茶：山路深处',
    description: '在山路上开禅意奶茶。客流极低，要靠口碑+周末客流活下去。',
    difficulty: 'hard',
    recommendedSeed: 2580,
    initialCash: 80000,
    brandId: 'independent',
    locationId: 'tourist',
    decorationId: 'cozy',
    productIds: ['fruittea', 'coffee', 'dessert'],
    staffSetup: [{ staffTypeId: 'fulltime' }],
    narrative:
      '你嫌市区太吵，把店开在山路边。工作日三个人都没有，周末游客却能挤爆门口。',
    tags: ['客流极低', '周末经济'],
  },
  {
    id: 'scen_kuaizhao',
    name: '哪吒仙饮：快招陷阱',
    description: '加盟"蜜雪子品牌"，蜜月期 8 周后供货成本暴涨。',
    difficulty: 'nightmare',
    recommendedSeed: 1230,
    brandId: 'nezha',
    locationId: 'community',
    decorationId: 'modern',
    productIds: ['milktea', 'fruittea'],
    staffSetup: [{ staffTypeId: 'fulltime' }, { staffTypeId: 'parttime' }],
    narrative:
      '你被销售忽悠加盟了"哪吒仙饮"。8 周蜜月期一过，供货成本暴涨 60%，前期赚的全部吐回去。',
    tags: ['快招陷阱', '蜜月期陷阱'],
  },
  {
    id: 'scen_aixiage',
    name: 'AI 写歌：营销轰炸',
    description: '全程必须使用营销 gimmick 撑住流量。',
    difficulty: 'medium',
    recommendedSeed: 3141,
    initialCash: 250000,
    brandId: 'independent',
    locationId: 'office',
    decorationId: 'modern',
    productIds: ['coffee', 'milktea', 'dessert'],
    staffSetup: [{ staffTypeId: 'fulltime' }, { staffTypeId: 'parttime' }],
    narrative:
      '你做了款"AI 给你写歌"咖啡店，但客户来一次就够了，复购为 0。每周必须想新花样。',
    tags: ['营销驱动', '低复购'],
  },
];

export const SCENARIO_BY_ID: Record<string, ScenarioBlueprint> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

/**
 * 应用一个剧本到 GameState；返回的 state 仍处于 setup 阶段，等调用方依次 dispatch。
 *
 * 注意：本函数只负责套用**初始资金**（initialCash），真正的品牌/选址/选品/员工
 * 由调用方（useGameState.quickStart）通过真实 action 的 dispatch 序列完成，以走
 * 完整校验、避免强塞非法 state。GameState 目前没有 scenarioId 字段，故只改 cash，
 * 其余字段保持原样。保持纯函数（无副作用）。
 */
export function applyScenarioToInitialState(state: GameState, scenarioId: string): GameState {
  const sc = SCENARIO_BY_ID[scenarioId];
  if (!sc) return state;
  return {
    ...state,
    cash: sc.initialCash ?? state.cash,
  };
}

// 仅用于满足 import * tree-shake：把类型暴露出来
export type { Brand, Location, Decoration, Product };
