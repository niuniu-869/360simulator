// 外卖平台系统数据配置 (v3.0 重做：权重分 + 满减 + 独立定价 + 包装档次)

import type {
  DeliveryPlatform, PromotionTier, DiscountTierConfig, DeliveryPricingConfig,
  PackagingTierConfig, CustomerType, RingId, DiscountTierId, DeliveryPricingId, PackagingTierId,
} from '@/types/game';

// ============ 外卖平台定义 ============

export const DELIVERY_PLATFORMS: DeliveryPlatform[] = [
  {
    id: 'meituan',
    name: '美团外卖',
    commissionRate: 0.16,
    audienceMultiplier: {
      students: 1.0,
      office: 1.2,
      family: 1.3,
      tourist: 0.3,
    },
    minCognitionByBrandType: {
      franchise: 0,
      independent: 2,
    },
    newStoreBoostWeeks: 2,    // 美团新店扶持2周
  },
  {
    id: 'eleme',
    name: '饿了么',
    commissionRate: 0.14,
    audienceMultiplier: {
      students: 1.1,
      office: 1.0,
      family: 1.2,
      tourist: 0.2,
    },
    minCognitionByBrandType: {
      franchise: 0,
      independent: 2,
    },
    newStoreBoostWeeks: 2,
  },
  {
    id: 'douyin',
    name: '抖音外卖',
    commissionRate: 0.10,
    audienceMultiplier: {
      students: 1.5,
      office: 0.8,
      family: 0.7,
      tourist: 0.5,
    },
    minCognitionByBrandType: {
      franchise: 1,
      independent: 3,
    },
    newStoreBoostWeeks: 3,    // 抖音新店扶持稍长（鼓励内容创作者入驻）
  },
];

// ============ 推广档位配置 ============

export const PROMOTION_TIERS: PromotionTier[] = [
  {
    id: 'none',
    name: '不推广',
    weeklyCost: 0,
    weightBonus: 0,
    ratingBoost: 0,
    description: '纯靠自然流量',
  },
  {
    id: 'basic',
    name: '基础推广',
    weeklyCost: 500,
    weightBonus: 8,
    ratingBoost: 0.02,
    description: '搜索排名提升',
  },
  {
    id: 'advanced',
    name: '进阶推广',
    weeklyCost: 1200,
    weightBonus: 15,
    ratingBoost: 0.04,
    description: '首页推荐位',
  },
  {
    id: 'premium',
    name: '豪华推广',
    weeklyCost: 2500,
    weightBonus: 22,
    ratingBoost: 0.08,
    description: '开屏+首页+搜索全覆盖',
  },
];

// ============ 满减档位配置 ============

export const DISCOUNT_TIERS: DiscountTierConfig[] = [
  {
    id: 'none',
    name: '无满减',
    description: '不做满减活动，平台会降权',
    subsidyRate: 0,
    conversionMultiplier: 0.3,    // 没满减几乎没单
    weightBonus: -5,              // 平台降权惩罚
  },
  {
    id: 'small',
    name: '小额满减',
    description: '满20减3 / 满30减5',
    subsidyRate: 0.15,
    conversionMultiplier: 0.7,
    weightBonus: 0,
  },
  {
    id: 'standard',
    name: '标准满减',
    description: '满20减5 / 满30减8',
    subsidyRate: 0.25,
    conversionMultiplier: 1.0,    // 基准转化率
    weightBonus: 5,
  },
  {
    id: 'large',
    name: '大额满减',
    description: '满20减8 / 满30减12',
    subsidyRate: 0.35,
    conversionMultiplier: 1.3,
    weightBonus: 10,
  },
  {
    id: 'loss_leader',
    name: '亏本冲量',
    description: '满15减10 / 满25减15，慎用！',
    subsidyRate: 0.50,
    conversionMultiplier: 1.6,
    weightBonus: 15,
  },
];

// ============ 外卖定价倍率配置 ============

export const DELIVERY_PRICING_TIERS: DeliveryPricingConfig[] = [
  {
    id: 'same',
    name: '与堂食同价',
    multiplier: 1.0,
    description: '利润被佣金吃掉',
  },
  {
    id: 'slight',
    name: '小幅上浮',
    multiplier: 1.15,
    description: '行业常规操作（+15%）',
  },
  {
    id: 'medium',
    name: '中幅上浮',
    multiplier: 1.25,
    description: '需配合满减（+25%）',
  },
  {
    id: 'high',
    name: '大幅上浮',
    multiplier: 1.35,
    description: '必须大额满减否则没单（+35%）',
  },
];

// ============ 包装档次配置 ============

export const PACKAGING_TIERS: PackagingTierConfig[] = [
  {
    id: 'basic',
    name: '基础包装',
    costPerOrder: 2.0,
    ratingBonus: 0,
    description: '普通塑料餐盒',
  },
  {
    id: 'premium',
    name: '精美包装',
    costPerOrder: 3.5,
    ratingBonus: 0.03,
    description: '品牌纸盒+保温袋，提升评分',
  },
];

// ============ 外卖常量 ============

/** 外卖基础转化率
 * v3: 0.025→0.007→0.010
 * 0.007 导致标准满减成熟期仅~70单/周，低于80-250目标下限
 * 0.010 使标准满减成熟期达~100单/周，落入目标区间
 * 满减倍率仍是主要的单量放大器（无满减×0.3，标准满减×1.0，亏本冲量×1.6）
 */
export const DELIVERY_CONVERSION_RATE = 0.010;

/** 初始平台评分（冷启动：新店无评分） */
export const INITIAL_PLATFORM_RATING = 0;

/** 外卖距离衰减系数（按距离环）
 * 参考：美团数据显示3km+订单占比不足15%，5km+不足3%
 */
export const DELIVERY_DISTANCE_DECAY: Record<RingId, number> = {
  ring0: 1.00,
  ring1: 0.45,
  ring2: 0.18,
  ring3: 0.06,
};

/** 按区位差异化的外卖隐形竞争基数 */
export const DELIVERY_COMPETITION_BY_LOCATION: Record<string, number> = {
  school: 80,
  office: 100,
  community: 95,
  business: 110,
  tourist: 45,
};

/** 外卖定价弹性系数
 * 菜单价上浮后，即使有满减，消费者仍能感知到"原价贵"
 * 上浮越多，需要越大的满减才能维持转化率
 */
export const PRICING_ELASTICITY: Record<DeliveryPricingId, Record<DiscountTierId, number>> = {
  // 同价：满减效果正常
  same:   { none: 1.0, small: 1.0, standard: 1.0, large: 1.0, loss_leader: 1.0 },
  // 小幅上浮：无满减/小额满减时消费者敏感
  slight: { none: 0.85, small: 0.95, standard: 1.0, large: 1.0, loss_leader: 1.0 },
  // 中幅上浮：必须标准以上满减才不影响
  medium: { none: 0.65, small: 0.80, standard: 0.95, large: 1.0, loss_leader: 1.0 },
  // 大幅上浮：必须大额满减
  high:   { none: 0.45, small: 0.60, standard: 0.80, large: 0.95, loss_leader: 1.0 },
};

// ============ 评分增长参数 ============

export const RATING_GROWTH_CONFIG = {
  initialRating: 0,
  ratingPerFulfilledOrder: 0.012,     // v3: 0.008→0.012，单量降低后每单评分贡献提高
  ratingPerUnfulfilledOrder: -0.025,  // v3: -0.02→-0.025
  maxWeeklyGrowth: 0.25,
  ingredientUpgradeBonus: 0.08,
  naturalDecay: 0.02,
};

// ============ 权重分计算 ============

/** 新店基础分（平台流量扶持） */
export function getNewStoreBaseScore(activeWeeks: number, boostWeeks: number): number {
  if (activeWeeks <= boostWeeks) return 15;       // 扶持期：高基础分
  if (activeWeeks <= boostWeeks + 2) return 8;    // 扶持衰减期
  return 3;                                        // 稳定基础分
}

/** 销量分（基于近4周滚动平均日单量，边际递减） */
export function getSalesScore(recentWeeklyOrders: number[]): number {
  if (recentWeeklyOrders.length === 0) return 0;
  const avgWeekly = recentWeeklyOrders.reduce((s, v) => s + v, 0) / recentWeeklyOrders.length;
  const avgDaily = avgWeekly / 7;

  if (avgDaily <= 0) return 0;
  if (avgDaily <= 10) return avgDaily * 0.5;                          // 0~5
  if (avgDaily <= 30) return 5 + (avgDaily - 10) * 0.5;              // 5~15
  if (avgDaily <= 60) return 15 + (avgDaily - 30) * 0.333;           // 15~25
  return Math.min(30, 25 + (avgDaily - 60) * 0.1);                   // 25~30（边际递减）
}

/** 评分分 */
export function getRatingWeightScore(rating: number): number {
  if (rating >= 4.5) return 15;
  if (rating >= 4.0) return 10;
  if (rating >= 3.5) return 5;
  return 0;
}

/** 计算平台总权重分（各因子之和，上限约85-90） */
export function calculatePlatformWeightScore(
  activeWeeks: number,
  boostWeeks: number,
  recentWeeklyOrders: number[],
  rating: number,
  promotionTierId: string,
  discountTierId: DiscountTierId,
): { total: number; base: number; sales: number; ratingW: number; promotion: number; discount: number } {
  const base = getNewStoreBaseScore(activeWeeks, boostWeeks);
  const sales = getSalesScore(recentWeeklyOrders);
  const ratingW = getRatingWeightScore(rating);

  const promoTier = PROMOTION_TIERS.find(t => t.id === promotionTierId);
  const promotion = promoTier?.weightBonus ?? 0;

  const discTier = DISCOUNT_TIERS.find(t => t.id === discountTierId);
  const discount = discTier?.weightBonus ?? 0;

  const total = Math.max(0, Math.min(90, base + sales + ratingW + promotion + discount));
  return { total, base, sales, ratingW, promotion, discount };
}

// ============ 工具函数 ============

export function getDeliveryPlatform(platformId: string): DeliveryPlatform | undefined {
  return DELIVERY_PLATFORMS.find(p => p.id === platformId);
}

export function getPromotionTier(tierId: string): PromotionTier | undefined {
  return PROMOTION_TIERS.find(t => t.id === tierId);
}

export function getDiscountTier(tierId: DiscountTierId): DiscountTierConfig | undefined {
  return DISCOUNT_TIERS.find(t => t.id === tierId);
}

export function getDeliveryPricing(pricingId: DeliveryPricingId): DeliveryPricingConfig | undefined {
  return DELIVERY_PRICING_TIERS.find(t => t.id === pricingId);
}

export function getPackagingTier(tierId: PackagingTierId): PackagingTierConfig | undefined {
  return PACKAGING_TIERS.find(t => t.id === tierId);
}

/**
 * 平台权重分 → 转化系数（S型曲线）
 * v3: 参数调整，权重分0→0.03，权重分45→0.55，权重分90→0.95
 */
export function getPlatformExposureCoefficient(weightScore: number): number {
  return 0.03 + 0.95 * (1 - Math.exp(-weightScore / 40));
}

/**
 * 平台评分转化系数（冷启动版本）
 * 评分0→0.20（新店尝鲜流量），评分5→1.0
 * v3.1: 0.05→0.20，修复冷启动0单问题（0.05与低权重分相乘后四舍五入为0）
 */
export function getRatingCoefficient(rating: number): number {
  if (rating <= 0) return 0.20;
  if (rating <= 1) return 0.30;
  if (rating <= 2) return 0.40;
  if (rating <= 3) return 0.50;
  if (rating <= 3.5) return 0.50 + (rating - 3) / 0.5 * 0.15;
  if (rating <= 4) return 0.65 + (rating - 3.5) / 0.5 * 0.15;
  if (rating <= 4.5) return 0.80 + (rating - 4) / 0.5 * 0.13;
  return 0.93 + (rating - 4.5) / 0.5 * 0.07;
}

/**
 * 获取满减+定价组合的综合转化倍率
 * = 满减转化倍率 × 定价弹性修正
 */
export function getDiscountPricingMultiplier(
  discountTierId: DiscountTierId,
  pricingId: DeliveryPricingId,
): number {
  const discTier = DISCOUNT_TIERS.find(t => t.id === discountTierId);
  const convMult = discTier?.conversionMultiplier ?? 0.3;
  const elasticity = PRICING_ELASTICITY[pricingId]?.[discountTierId] ?? 1.0;
  return convMult * elasticity;
}

/** 多平台客群重叠衰减 */
export function getMultiPlatformOverlapDiscount(
  platformCount: number,
  _customerType: CustomerType,
): number {
  void _customerType;
  if (platformCount <= 1) return 1.0;
  if (platformCount === 2) return 0.7;
  return 0.5;
}

/** 获取区位对应的外卖竞争基数 */
export function getDeliveryCompetitionBase(locationType: string): number {
  return DELIVERY_COMPETITION_BY_LOCATION[locationType] ?? 35;
}
