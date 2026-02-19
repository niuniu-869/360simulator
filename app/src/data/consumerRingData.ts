// 消费者环系统数据配置
// 各区位的消费者环倍率配置、客群衰减系数

import type { CustomerType, RingId } from '@/types/game';

// ============ 距离环基础配置 ============

export interface RingConfig {
  id: RingId;
  label: string;
  baseConversion: number;  // 堂食基础转化率
}

export const RING_CONFIGS: RingConfig[] = [
  { id: 'ring0', label: '门前300m', baseConversion: 1.0 },
  { id: 'ring1', label: '步行1km', baseConversion: 0.5 },
  { id: 'ring2', label: '骑行3km', baseConversion: 0.2 },
  { id: 'ring3', label: '外卖5km', baseConversion: 0.0 },  // 堂食不可达
];

// ============ 区位消费者环倍率 ============

// 各区位 Ring 1-3 相对于 Ring 0 的消费者倍率范围
export interface LocationRingMultiplier {
  locationType: string;
  ring1: { min: number; max: number };
  ring2: { min: number; max: number };
  ring3: { min: number; max: number };
}

export const LOCATION_RING_MULTIPLIERS: LocationRingMultiplier[] = [
  {
    locationType: 'school',
    ring1: { min: 2.3, max: 3.0 },
    ring2: { min: 3.1, max: 4.6 },
    ring3: { min: 2.0, max: 3.4 },
  },
  {
    locationType: 'office',
    ring1: { min: 1.9, max: 2.9 },
    ring2: { min: 3.8, max: 6.2 },
    ring3: { min: 4.0, max: 6.5 },
  },
  {
    locationType: 'community',
    ring1: { min: 2.5, max: 3.8 },   // v2: 从3.1-4.7下调，社区步行圈人口适度收敛
    ring2: { min: 2.0, max: 3.2 },   // v2: 从2.4-3.8下调
    ring3: { min: 3.5, max: 5.0 },   // v2: 从5.4-7.8大幅下调，5km外卖圈不应是Ring0的7倍
  },
  {
    locationType: 'business',
    ring1: { min: 1.6, max: 2.4 },
    ring2: { min: 2.4, max: 4.0 },
    ring3: { min: 2.6, max: 4.0 },
  },
  {
    locationType: 'tourist',
    ring1: { min: 1.3, max: 1.8 },
    ring2: { min: 1.6, max: 2.5 },
    ring3: { min: 1.3, max: 2.6 },
  },
];

// ============ 客群远环衰减系数 ============

// 不同客群在远环的保留比例（相对于倍率计算后的值）
// 游客远环急剧衰减，上班族远环保持较高
export const CUSTOMER_RING_DECAY: Record<CustomerType, Record<RingId, number>> = {
  students: { ring0: 1.0, ring1: 1.0, ring2: 0.6, ring3: 0.4 },
  office:   { ring0: 1.0, ring1: 1.0, ring2: 0.7, ring3: 0.9 },
  family:   { ring0: 1.0, ring1: 1.0, ring2: 0.9, ring3: 0.8 },
  tourist:  { ring0: 1.0, ring1: 0.65, ring2: 0.4, ring3: 0.05 },
};

// ============ 周边店铺环分配权重 ============

// 初始生成的店铺按权重分配到 Ring 0-2
export const SHOP_RING_WEIGHTS: Record<RingId, number> = {
  ring0: 0.4,
  ring1: 0.4,
  ring2: 0.2,
  ring3: 0.0,  // Ring3 无实体店竞争
};

// ============ 工具函数 ============

/**
 * 获取区位的消费者环倍率配置
 */
export function getLocationRingMultiplier(
  locationType: string
): LocationRingMultiplier | undefined {
  return LOCATION_RING_MULTIPLIERS.find(m => m.locationType === locationType);
}
