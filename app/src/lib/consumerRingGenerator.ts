/**
 * 消费者环生成器
 * 选址时根据区位类型随机生成4层距离环的消费者池
 */

import type { ConsumerRing, CustomerType, RingId, Location, StoreAddress, NearbyShop, Season } from '@/types/game';
import {
  RING_CONFIGS,
  CUSTOMER_RING_DECAY,
  getLocationRingMultiplier,
} from '@/data/consumerRingData';

const CUSTOMER_TYPES: CustomerType[] = ['students', 'office', 'family', 'tourist'];

// ============ 工具函数 ============

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ============ 核心生成函数 ============

/**
 * 选址时生成消费者环数据
 * Ring 0 = 现有 footTraffic × 地址修正
 * Ring 1-3 = Ring 0 × 区位倍率 × 随机波动 × 客群衰减
 */
export function generateConsumerRings(
  location: Location,
  address: StoreAddress
): ConsumerRing[] {
  const multiplierConfig = getLocationRingMultiplier(location.type);
  if (!multiplierConfig) {
    // 兜底：只有 Ring 0
    return [createRing0(location, address)];
  }

  const trafficMod = address.trafficModifier;

  // Ring 0：门前客流 = footTraffic × 地址修正
  const ring0 = createRing0(location, address);

  // Ring 1-3：基于 Ring 0 扩展
  const ring1 = createOuterRing(
    'ring1', location, trafficMod,
    multiplierConfig.ring1
  );
  const ring2 = createOuterRing(
    'ring2', location, trafficMod,
    multiplierConfig.ring2
  );
  const ring3 = createOuterRing(
    'ring3', location, trafficMod,
    multiplierConfig.ring3
  );

  return [ring0, ring1, ring2, ring3];
}

export function assignNearbyShopsToConsumerRings(
  consumerRings: ConsumerRing[],
  nearbyShops: NearbyShop[]
): ConsumerRing[] {
  const ringIds: RingId[] = ['ring0', 'ring1', 'ring2', 'ring3'];
  const idsByRing = new Map<RingId, string[]>(
    ringIds.map(id => [id, []])
  );

  nearbyShops.filter(s => !s.isClosing).forEach(shop => {
    const ring = ringIds.includes(shop.ring) ? shop.ring : 'ring0';
    idsByRing.get(ring)!.push(shop.id);
  });

  return consumerRings.map(ring => ({
    ...ring,
    nearbyShopIds: idsByRing.get(ring.distance) ?? [],
  }));
}

// ============ 辅助函数 ============

/**
 * 创建 Ring 0（门前客流）
 */
function createRing0(location: Location, address: StoreAddress): ConsumerRing {
  const ringConfig = RING_CONFIGS[0];
  const trafficMod = address.trafficModifier;

  const consumers: Record<CustomerType, number> = {
    students: Math.round(location.footTraffic.students * trafficMod),
    office: Math.round(location.footTraffic.office * trafficMod),
    family: Math.round(location.footTraffic.family * trafficMod),
    tourist: Math.round(location.footTraffic.tourist * trafficMod),
  };

  return {
    distance: 'ring0',
    label: ringConfig.label,
    consumers,
    baseConversion: ringConfig.baseConversion,
    nearbyShopIds: [],
  };
}

/**
 * 创建外环（Ring 1-3）
 * 公式：Ring 0 消费者[type] × 区位倍率 × 随机波动(0.8~1.2) × 客群衰减
 */
function createOuterRing(
  ringId: RingId,
  location: Location,
  trafficMod: number,
  multiplierRange: { min: number; max: number }
): ConsumerRing {
  const ringConfig = RING_CONFIGS.find(r => r.id === ringId)!;

  const consumers = {} as Record<CustomerType, number>;

  CUSTOMER_TYPES.forEach(type => {
    const baseCount = location.footTraffic[type] * trafficMod;
    const multiplier = randomInRange(multiplierRange.min, multiplierRange.max);
    const randomFactor = 0.8 + Math.random() * 0.4; // 0.8~1.2
    const decay = CUSTOMER_RING_DECAY[type][ringId];

    consumers[type] = Math.round(baseCount * multiplier * randomFactor * decay);
  });

  return {
    distance: ringId,
    label: ringConfig.label,
    consumers,
    baseConversion: ringConfig.baseConversion,
    nearbyShopIds: [],
  };
}

// ============ 季节性客流波动 ============

/** 季节对各客群路过人数的影响系数（与需求修正因子独立） */
const SEASON_TRAFFIC_MOD: Record<Season, Record<CustomerType, number>> = {
  spring: { students: 1.0, office: 1.0, family: 1.05, tourist: 1.1 },
  summer: { students: 0.7, office: 0.95, family: 1.1, tourist: 1.3 },
  autumn: { students: 1.05, office: 1.0, family: 1.0, tourist: 0.9 },
  winter: { students: 0.95, office: 1.0, family: 0.9, tourist: 0.6 },
};

/**
 * 对基础消费者环施加季节性客流波动
 * baseRings 为选址时生成的原始值，返回受季节影响后的当前值
 */
export function applySeasonalTrafficVariation(
  baseRings: ConsumerRing[],
  season: Season
): ConsumerRing[] {
  const mods = SEASON_TRAFFIC_MOD[season];
  return baseRings.map(ring => ({
    ...ring,
    consumers: {
      students: Math.round(ring.consumers.students * mods.students),
      office: Math.round(ring.consumers.office * mods.office),
      family: Math.round(ring.consumers.family * mods.family),
      tourist: Math.round(ring.consumers.tourist * mods.tourist),
    },
  }));
}
