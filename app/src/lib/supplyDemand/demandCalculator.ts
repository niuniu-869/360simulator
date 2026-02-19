/**
 * 需求计算模块 - 距离环 + 吸引力半径模型
 *
 * 堂食核心公式：
 * 堂食需求[产品] = Σ(ring=0,1,2) [
 *   ringConsumers[type] × ringCoverage × ring.baseConversion
 *   × CONVERSION_RATE × exposureCoeff × reputationCoeff
 *   × appealRatio × marketShare × (1 + modifiers) × (1 - indirectDiversion)
 * ] × 7天
 */

import type {
  GameState,
  Product,
  DemandBreakdown,
  DemandModifiers,
  ProductDemandBreakdown,
  CustomerType,
  ProductSubType,
  Season,
  NearbyShop,
  RingId,
} from '@/types/game';
import {
  CONVERSION_RATE,
  SEASON_MODIFIER,
} from '@/data/gameData';
import { getStockoutEffect } from '@/data/inventoryData';

const CUSTOMER_TYPES: CustomerType[] = ['students', 'office', 'family', 'tourist'];

function hashStringToUint32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rand01FromSeed(seed: number): number {
  let t = (seed + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const RING_ORDER: RingId[] = ['ring0', 'ring1', 'ring2', 'ring3'];
// 修复 #8：邻环权重不对称
const INNER_TO_OUTER_WEIGHT = 0.60; // 近处好店吸引远处消费者（顺路效应强）
const OUTER_TO_INNER_WEIGHT = 0.40; // 远处店铺对近处消费者也有一定威胁

function getAdjacentRings(ringId: RingId): RingId[] {
  const idx = RING_ORDER.indexOf(ringId);
  if (idx < 0) return [];
  const neighbors: RingId[] = [];
  if (idx - 1 >= 0) neighbors.push(RING_ORDER[idx - 1]);
  if (idx + 1 < RING_ORDER.length) neighbors.push(RING_ORDER[idx + 1]);
  return neighbors;
}

function getRingShopIdsFromState(state: GameState, ringId: RingId): string[] {
  const rings = state.consumerRings || [];
  const ring = rings.find(r => r.distance === ringId);
  if (ring && ring.nearbyShopIds && ring.nearbyShopIds.length > 0) {
    return ring.nearbyShopIds;
  }
  return (state.nearbyShops || []).filter(s => s.ring === ringId).map(s => s.id);
}

function getWeightedCompetitorsForRing(state: GameState, ringId: RingId): Array<{ shop: NearbyShop; weight: number }> {
  const nearbyShops = state.nearbyShops || [];
  const byId = new Map(nearbyShops.map(s => [s.id, s] as const));
  const weightByShopId = new Map<string, number>();

  const addRing = (id: RingId, weight: number) => {
    getRingShopIdsFromState(state, id).forEach(shopId => {
      const existing = weightByShopId.get(shopId) ?? 0;
      if (weight > existing) weightByShopId.set(shopId, weight);
    });
  };

  addRing(ringId, 1.0);
  const ringIdx = RING_ORDER.indexOf(ringId);
  getAdjacentRings(ringId).forEach(adj => {
    const adjIdx = RING_ORDER.indexOf(adj);
    // 内环(idx更小)的店铺对外环消费者影响更大
    const weight = adjIdx < ringIdx ? INNER_TO_OUTER_WEIGHT : OUTER_TO_INNER_WEIGHT;
    addRing(adj, weight);
  });

  const result: Array<{ shop: NearbyShop; weight: number }> = [];
  weightByShopId.forEach((weight, shopId) => {
    const shop = byId.get(shopId);
    if (!shop || shop.isClosing) return;
    result.push({ shop, weight });
  });
  return result;
}

// ============ 绝对价格弹性（基于消费者心理价位） ============

/**
 * 计算绝对价格弹性效果
 * 基于消费者心理价位（referencePrice），定价偏离心理价位时影响需求
 *
 * - 价格 < referencePrice*0.8: 轻微加成（便宜有吸引力），最高1.15
 * - 价格 ≈ referencePrice (0.8~1.15): 1.0（合理区间，含15%溢价空间）
 * - 价格 > referencePrice*1.15: 三次方幂函数惩罚，越贵惩罚越重
 * - 例：ratio=1.2→0.89, ratio=1.5→0.45, ratio=2.0→0.19
 */
export function calculateAbsolutePriceEffect(
  actualPrice: number,
  referencePrice: number
): number {
  if (referencePrice <= 0) return 1;

  const ratio = actualPrice / referencePrice;

  if (ratio <= 0.8) {
    // 便宜区间：轻微加成，最高1.15
    return Math.min(1.15, 1 + (0.8 - ratio) * 0.5);
  }
  if (ratio <= 1.25) {
    // 合理区间：含25%溢价空间（装修好、服务好、位置便利可以适度加价）
    return 1.0;
  }
  // 超出合理溢价：三次方幂函数惩罚
  // 以1.25为基准计算超出部分：ratio=1.3→0.89, ratio=1.5→0.58, ratio=2.0→0.24
  return Math.max(0.05, Math.pow(1.25 / ratio, 3));
}

// 价格弹性系数：不同客群对价格的敏感度
// 值越大，价格变动对需求的影响越大
const PRICE_ELASTICITY: Record<CustomerType, number> = {
  students: 1.3,   // 学生最敏感（从1.5降至1.3，缓解学校选址地狱难度）
  office: 0.8,     // 上班族中等偏低
  family: 1.0,     // 家庭中等
  tourist: 0.5,    // 游客最不敏感
};

// 季节-产品子类型加成系数（乘法形式）
// 1.0 = 无影响，>1 = 加成，<1 = 减成
const SEASON_SUBTYPE_BONUS: Record<Season, Record<ProductSubType, number>> = {
  spring: { cold_drink: 1.05, hot_drink: 1.0, main_food: 1.0, snack: 1.1, dessert: 1.1 },
  summer: { cold_drink: 1.5, hot_drink: 0.55, main_food: 0.9, snack: 1.2, dessert: 1.15 },
  autumn: { cold_drink: 0.85, hot_drink: 1.15, main_food: 1.1, snack: 1.0, dessert: 1.0 },
  winter: { cold_drink: 0.55, hot_drink: 1.5, main_food: 1.15, snack: 0.85, dessert: 0.9 },
};

// 区位-品类场景因子：解释“不同地段不同品类为什么需求不同”
const LOCATION_CATEGORY_OCCASION: Record<string, Record<Product['category'], number>> = {
  school: { drink: 1.2, food: 1.1, snack: 1.15, meal: 0.95 },
  office: { drink: 1.05, food: 0.9, snack: 0.9, meal: 1.2 },
  community: { drink: 0.95, food: 1.0, snack: 1.05, meal: 1.12 },
  business: { drink: 1.1, food: 1.0, snack: 1.08, meal: 1.0 },
  tourist: { drink: 1.08, food: 1.12, snack: 1.12, meal: 0.92 },
};

// 客群-品类偏好修正
const CUSTOMER_CATEGORY_AFFINITY: Record<CustomerType, Record<Product['category'], number>> = {
  students: { drink: 1.15, food: 1.08, snack: 1.12, meal: 0.92 },
  office: { drink: 1.0, food: 0.92, snack: 0.88, meal: 1.2 },
  family: { drink: 0.9, food: 1.0, snack: 1.08, meal: 1.12 },
  tourist: { drink: 1.05, food: 1.12, snack: 1.05, meal: 0.9 },
};

// 跨品类替代矩阵：解决“非同类也会分流”的现实问题
const CATEGORY_SUBSTITUTION_MATRIX: Record<Product['category'], Partial<Record<NearbyShop['shopCategory'], number>>> = {
  drink: { snack: 0.12, food: 0.06, meal: 0.04, grocery: 0.05, service: 0 },
  food: { snack: 0.1, meal: 0.08, drink: 0.04, grocery: 0.03, service: 0 },
  snack: { drink: 0.1, food: 0.09, meal: 0.06, grocery: 0.04, service: 0 },
  meal: { food: 0.12, snack: 0.07, drink: 0.03, grocery: 0.02, service: 0 },
};

/**
 * 获取产品在当前季节的加成系数
 */
function getSeasonSubTypeBonus(season: Season, subType: ProductSubType): number {
  return SEASON_SUBTYPE_BONUS[season]?.[subType] ?? 1.0;
}

function getCategoryOccasionMultiplier(
  locationType: string | undefined,
  category: Product['category'],
  customerType: CustomerType
): number {
  const locationFactor = LOCATION_CATEGORY_OCCASION[locationType || 'community']?.[category] ?? 1.0;
  const customerFactor = CUSTOMER_CATEGORY_AFFINITY[customerType]?.[category] ?? 1.0;
  return clamp(locationFactor * customerFactor, 0.75, 1.35);
}

function getMenuBalanceFactor(products: Product[], category: Product['category']): number {
  if (products.length === 0) return 1;
  const uniqueCategories = new Set(products.map(p => p.category));
  const categoryCount = products.filter(p => p.category === category).length;
  const share = categoryCount / products.length;

  // 纯单品店：该品类需求更集中但有天花板
  if (uniqueCategories.size === 1) return 0.92;
  // 菜单太单一会损失跨场景需求；适度聚焦有利于效率
  if (share > 0.7) return 0.95;
  if (share >= 0.25 && share <= 0.55) return 1.06;
  return 1.0;
}

// ============ 双指标系数函数 ============

/**
 * 曝光度系数（S型曲线）
 * 范围：0.05 ~ 1.0，前期回报高，后期边际递减
 * 下限从0.15降至0.05：无人知晓的新店几乎没有自然客流
 */
export function getExposureCoefficient(exposure: number): number {
  // 下限0.15（无人知晓的新店几乎没有自然客流，必须主动营销）
  // 半饱和点30（需要更多曝光投入才能获得回报）
  return 0.15 + 0.85 * (1 - Math.exp(-exposure / 30));
}

export function getTrafficReachMultiplier(exposure: number, reputation: number): number {
  const exposureBoost = Math.min(0.28, Math.max(0, exposure - 10) / 90 * 0.28);
  const reputationBoost = Math.min(0.14, Math.max(0, reputation - 30) / 70 * 0.14);
  return 1 + exposureBoost + reputationBoost;
}

// ============ 新店爬坡期机制 ============

/**
 * 新店知名度爬坡系数
 * 模拟现实中新店从"无人知晓"到"被周边居民认知"的过程
 *
 * v3：优先使用 growthSystem.awarenessFactor（由 launchProgress 映射）
 * 仅在旧存档缺失 growthSystem 时，回退到按品牌类型+周次的兼容兜底曲线。
 */
export function getNewStoreAwarenessFactor(
  currentWeek: number,
  brandType: 'franchise' | 'independent' | 'quick_franchise',
  growthSystem?: GameState['growthSystem']
): number {
  if (growthSystem?.awarenessFactor !== undefined) {
    return clamp(growthSystem.awarenessFactor, 0.25, 1.0);
  }

  if (growthSystem?.launchProgress !== undefined) {
    const normalized = 1 / (1 + Math.exp(-(growthSystem.launchProgress - 45) / 10));
    return 0.25 + 0.75 * normalized;
  }

  // 兼容兜底：仅在旧存档缺失增长系统时启用
  if (brandType === 'franchise') {
    const rampWeeks = 8;
    if (currentWeek >= rampWeeks) return 1.0;
    return 0.30 + 0.70 * (currentWeek / rampWeeks);
  }
  if (brandType === 'quick_franchise') {
    const rampWeeks = 10;
    if (currentWeek >= rampWeeks) return 1.0;
    return 0.25 + 0.75 * (currentWeek / rampWeeks);
  }
  const rampWeeks = 12;
  if (currentWeek >= rampWeeks) return 1.0;
  return 0.20 + 0.80 * (currentWeek / rampWeeks);
}

/**
 * 口碑转化系数（线性）
 * 范围：0.30 ~ 1.30，拉大差距，低口碑惩罚更重
 * 口碑45(独立初始)→0.75, 口碑90(蜜雪初始)→1.20
 */
export function getReputationCoefficient(reputation: number): number {
  // 下限0.35（低口碑严重影响转化，口碑建设是核心经营要素）
  return 0.35 + 0.85 * (reputation / 100);
}

// ============ 吸引力半径系统 ============

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 计算堂食吸引力分数（0~100）
 * 决定店铺能吸引多远的消费者来堂食
 *
 * 设计原则：attractionScore 侧重"物理存在感"（装修、位置、老店效应），
 * 口碑和曝光度通过独立系数（reputationCoeff / exposureCoeff）发挥主要作用，
 * 此处仅保留小幅贡献，避免双重放大。
 */
export function calculateAttractionScore(state: GameState): number {
  // 1. 装修贡献（0~35分）— 装修是物理存在感的核心
  const decoLevel = state.selectedDecoration?.level || 1;
  const decorationScore = (decoLevel / 5) * 35;

  // 2. 经营时长贡献（老店效应，0~25分）— 老店自带辐射力
  const weekBonus = Math.min(25, state.currentWeek * 0.8);

  // 3. 口碑贡献（0~20分）— 仅小幅贡献，主要通过 reputationCoeff 生效
  const reputationScore = (state.reputation / 100) * 20;

  // 4. 线下曝光度贡献（0~20分）— 仅小幅贡献，主要通过 exposureCoeff 生效
  const offlineExposureScore = (state.exposure / 100) * 20;

  return Math.min(100, decorationScore + weekBonus + reputationScore + offlineExposureScore);
}

/**
 * 吸引力分数 → 各环覆盖率
 */
export function getRingCoverage(attractionScore: number): Record<string, number> {
  return {
    ring0: 1.0,
    ring1: clamp((attractionScore - 15) / 50, 0, 1),
    ring2: clamp((attractionScore - 50) / 40, 0, 1),
    ring3: 0,  // 堂食永远不覆盖 Ring3
  };
}

/**
 * 计算需求修正因子（移除 reputation，口碑通过转化系数独立生效）
 */
export function calculateDemandModifiers(state: GameState): DemandModifiers {
  // 1. 季节贡献 (转换为加法形式)
  const seasonContribution = SEASON_MODIFIER[state.currentSeason] - 1;

  // 2. v3 移除“营销直接抬需求”，营销只通过曝光/口碑/价格链路间接生效
  const marketingContribution = 0;

  // 3. 服务质量（只统计服务岗位员工：waiter/cleaner/manager）
  let serviceQualityContribution = 0;
  if (state.staff.length > 0) {
    const serviceStaff = state.staff.filter(
      s => !s.isOnboarding && ['waiter', 'cleaner', 'manager'].includes(s.assignedTask)
    );

    if (serviceStaff.length === 0) {
      serviceQualityContribution = -0.15;
    } else {
      const avgServiceQuality = serviceStaff.reduce(
        (sum, s) => sum + (s.serviceQuality || 0.8), 0
      ) / serviceStaff.length;
      serviceQualityContribution = (avgServiceQuality - 0.8) * 0.5;
    }
  }

  const weeksSinceLastAction = state.weeksSinceLastAction ?? 0;
  const inactiveWeeks = Math.max(0, weeksSinceLastAction - 5);
  const basePenalty = Math.min(0.25, inactiveWeeks * 0.015);
  const reputationProtection = Math.min(0.1, Math.max(0, (state.reputation - 60)) / 40 * 0.1);
  const inactivityContribution = -Math.max(0, basePenalty - reputationProtection);

  // 4. 整洁度贡献（与服务质量并列的独立修正因子）
  const cleanlinessContribution = ((state.cleanliness ?? 60) - 50) / 50 * 0.08;

  return {
    season: seasonContribution,
    marketing: marketingContribution,
    serviceQuality: serviceQualityContribution,
    cleanliness: cleanlinessContribution,
    inactivity: inactivityContribution,
  };
}

/**
 * 计算单个产品的吸引力占比（移除口碑加成）
 */
function calculateProductAppealRatio(
  product: Product,
  allProducts: Product[],
  state: GameState,
  customerType: CustomerType
): number {
  const decoration = state.selectedDecoration;

  // 计算该产品对该客群的吸引力
  let productAppeal = product.appeal[customerType];

  // 装修加成
  if (decoration) {
    productAppeal += decoration.appealBonus[customerType];
    productAppeal += decoration.categoryBonus[product.category];
  }

  // 季节加成（基于产品子类型和当前季节）
  productAppeal *= getSeasonSubTypeBonus(state.currentSeason, product.subType);

  // 计算所有产品的总吸引力
  let totalAppeal = 0;
  allProducts.forEach(p => {
    let appeal = p.appeal[customerType];
    if (decoration) {
      appeal += decoration.appealBonus[customerType];
      appeal += decoration.categoryBonus[p.category];
    }
    appeal *= getSeasonSubTypeBonus(state.currentSeason, p.subType);
    totalAppeal += appeal;
  });

  return totalAppeal > 0 ? productAppeal / totalAppeal : 0;
}

// ============ 市场份额模型 ============

/**
 * 计算玩家在某品类的竞争力得分（双指标对称公式）
 */
function calculatePlayerCompetitiveness(
  playerAvgPrice: number,
  categoryAvgPrice: number,
  playerExposure: number,
  playerReputation: number,
  playerAppeal: number,
  playerServiceQuality: number,
  weeksSinceLastAction: number,
  customerType: CustomerType
): number {
  const elasticity = PRICE_ELASTICITY[customerType];
  // 价格得分
  const priceScore = categoryAvgPrice > 0
    ? Math.pow(categoryAvgPrice / playerAvgPrice, elasticity)
    : 1;
  // 曝光度系数（S型曲线）
  const exposureScore = getExposureCoefficient(playerExposure);
  // 口碑转化系数（线性）
  const reputationScore = getReputationCoefficient(playerReputation);
  // 品质得分
  const qualityScore = playerAppeal / 100;
  // 服务得分
  const serviceScore = Math.max(0.3, playerServiceQuality);

  const inactiveWeeks = Math.max(0, (weeksSinceLastAction || 0) - 2);
  const heatPenalty = Math.min(0.5, inactiveWeeks * 0.035);
  const reputationProtection = Math.min(0.2, Math.max(0, (playerReputation - 60)) / 40 * 0.2);
  const operationHeatScore = 1 - Math.max(0, heatPenalty - reputationProtection);

  return priceScore * exposureScore * reputationScore * qualityScore * serviceScore * operationHeatScore;
}

/**
 * 计算竞争店铺口碑（综合品牌类型、档次、服务质量）
 */
export function getShopReputation(shop: NearbyShop): number {
  let reputation = shop.serviceQuality * 60;
  if (shop.brandType === 'chain') reputation += 25;
  if (shop.brandTier === 'premium') reputation += 10;
  else if (shop.brandTier === 'standard') reputation += 5;
  return Math.min(100, reputation);
}

/**
 * 计算单个竞争店铺的竞争力得分（与玩家对称公式）
 * @param categoryAvgPrice 品类市场均价（与玩家共用同一基准）
 * @param productCategory 玩家产品品类，用于筛选同品类产品计算均价
 */
function calculateShopCompetitiveness(
  shop: NearbyShop,
  customerType: CustomerType,
  categoryAvgPrice: number,
  productCategory: string
): number {
  if (shop.isClosing) return 0;

  // 修复 #9：只取同品类产品计算价格和吸引力，避免跨品类产品干扰竞争力评估
  const sameCatProducts = shop.products.filter(p => p.category === productCategory);
  const relevantProducts = sameCatProducts.length > 0 ? sameCatProducts : shop.products;
  const avgPrice = relevantProducts.length > 0
    ? relevantProducts.reduce((s, p) => s + p.price, 0) / relevantProducts.length
    : 10;
  const avgAppeal = relevantProducts.length > 0
    ? relevantProducts.reduce((s, p) => s + p.appeal, 0) / relevantProducts.length
    : 50;

  const elasticity = PRICE_ELASTICITY[customerType];
  // 与玩家使用相同的价格得分公式：品类均价 / 店铺均价
  const priceScore = categoryAvgPrice > 0
    ? Math.pow(categoryAvgPrice / avgPrice, elasticity)
    : 1;
  // 竞争对手也使用双指标系数（对称公式）
  const exposureScore = getExposureCoefficient(shop.exposure);
  // 修复 #5：综合品牌类型、档次、服务质量计算口碑
  const shopReputation = getShopReputation(shop);
  const reputationScore = getReputationCoefficient(shopReputation);
  const qualityScore = avgAppeal / 100;
  const serviceScore = Math.max(0.3, shop.serviceQuality);

  return priceScore * exposureScore * reputationScore * qualityScore * serviceScore;
}

function calculateCategorySubstitutionPressure(
  weightedShops: Array<{ shop: NearbyShop; weight: number }>,
  targetCategory: Product['category']
): number {
  const substitutionRule = CATEGORY_SUBSTITUTION_MATRIX[targetCategory];
  const diversionScore = weightedShops.reduce((sum, entry) => {
    const sourceCategory = entry.shop.shopCategory;
    const substitution = substitutionRule[sourceCategory] ?? 0;
    if (substitution <= 0) return sum;
    const strength = (entry.shop.exposure / 100) * Math.max(0.3, entry.shop.serviceQuality);
    return sum + strength * entry.weight * substitution;
  }, 0);
  return Math.min(0.28, diversionScore);
}

/**
 * 计算堂食需求侧明细（距离环模型）
 * 遍历 Ring 0-2，根据吸引力半径决定覆盖率
 */
export function calculateDemand(state: GameState): DemandBreakdown {
  const location = state.selectedLocation;
  const products = state.selectedProducts;

  // 默认空结果
  const emptyResult: DemandBreakdown = {
    baseTraffic: { students: 0, office: 0, family: 0, tourist: 0 },
    totalBaseTraffic: 0,
    modifiers: {
      season: 0, marketing: 0, serviceQuality: 0, cleanliness: 0, inactivity: 0,
    },
    modifierTotal: 0,
    productDemands: [],
    totalDemand: 0,
  };

  if (!location || products.length === 0) {
    return emptyResult;
  }

  // 获取消费者环数据（新模型）或回退到旧模型
  const consumerRings = state.consumerRings;
  const hasRings = consumerRings && consumerRings.length > 0;

  // 吸引力半径覆盖率
  const attractionScore = calculateAttractionScore(state);
  const ringCoverage = getRingCoverage(attractionScore);

  // 计算基础客流（Ring 0 作为 baseTraffic 的兼容值）
  const ring0 = hasRings ? consumerRings[0] : null;
  const trafficModifier = state.selectedAddress?.trafficModifier || 1;

  const trafficReachMultiplier = getTrafficReachMultiplier(state.exposure, state.reputation);
  const baseTraffic: Record<CustomerType, number> = ring0
    ? { ...ring0.consumers }
    : {
        students: location.footTraffic.students * trafficModifier,
        office: location.footTraffic.office * trafficModifier,
        family: location.footTraffic.family * trafficModifier,
        tourist: location.footTraffic.tourist * trafficModifier,
      };

  const totalBaseTraffic = Object.values(baseTraffic).reduce((sum, v) => sum + v, 0);

  // 计算需求修正因子
  const modifiers = calculateDemandModifiers(state);
  const modifierTotal = Object.values(modifiers).reduce((sum, v) => sum + v, 0);

  // 玩家平均服务质量
  const serviceStaff = state.staff.filter(
    s => !s.isOnboarding && ['waiter', 'cleaner', 'manager'].includes(s.assignedTask)
  );
  const avgServiceQuality = serviceStaff.length > 0
    ? serviceStaff.reduce((sum, s) => sum + (s.serviceQuality || 0.8), 0) / serviceStaff.length
    : 0.5;

  const productDemands: ProductDemandBreakdown[] = products.map(product => {
    const baseTrafficByType: Record<CustomerType, number> = {
      students: 0, office: 0, family: 0, tourist: 0,
    };

    const actualPrice = state.productPrices[product.id] || product.basePrice;

    // 绝对价格弹性（基于消费者心理价位）
    const absolutePriceEffect = calculateAbsolutePriceEffect(actualPrice, product.referencePrice);

    // 同品类竞争店铺
    // 玩家产品吸引力
    const avgAppeal = (
      product.appeal.students + product.appeal.office +
      product.appeal.family + product.appeal.tourist
    ) / 4;

    let totalProductDemand = 0;

    // 遍历消费者环（Ring 0-2 堂食可达）
    const ringsToProcess = hasRings
      ? consumerRings.filter(r => r.distance !== 'ring3')
      : [{ distance: 'ring0' as const, consumers: baseTraffic, baseConversion: 1.0, label: '', nearbyShopIds: [] }];

    ringsToProcess.forEach(ring => {
      const coverage = ringCoverage[ring.distance] || 0;
      if (coverage <= 0) return;

      const weightedCompetitors = getWeightedCompetitorsForRing(state, ring.distance);
      const weightedDirectCompetitors = weightedCompetitors.filter(
        entry => entry.shop.shopCategory === product.category
      );
      // 修复 #2：品类均价纳入玩家自身（玩家权重1.0）
      // 修复 #9：只取同品类产品的均价，避免跨品类产品（如冰淇淋）拖低饮品均价
      let priceSum = actualPrice * 1.0;
      let weightSum = 1.0;
      weightedDirectCompetitors.forEach(entry => {
        const sameCatProducts = entry.shop.products.filter(p => p.category === product.category);
        if (sameCatProducts.length === 0) return; // 该店无同品类产品，不参与均价
        const shopCatAvgPrice = sameCatProducts.reduce((s, p) => s + p.price, 0) / sameCatProducts.length;
        priceSum += shopCatAvgPrice * entry.weight;
        weightSum += entry.weight;
      });
      const categoryAvgPrice = priceSum / weightSum;

      const substitutionPressure = calculateCategorySubstitutionPressure(
        weightedCompetitors,
        product.category
      );

      CUSTOMER_TYPES.forEach(type => {
        const ringConsumers = ring.consumers[type] * (ring.distance === 'ring0' ? 1 : trafficReachMultiplier);
        if (ringConsumers <= 0) return;

        const appealRatio = calculateProductAppealRatio(product, products, state, type);
        const categoryOccasionMultiplier = getCategoryOccasionMultiplier(
          state.selectedLocation?.type,
          product.category,
          type
        );
        const menuBalanceFactor = getMenuBalanceFactor(products, product.category);

        // 该环该客群的有效需求（含品牌流量倍率）
        const brandTraffic = state.selectedBrand?.trafficMultiplier || 1.0;
        const brandConvBonus = state.selectedBrand?.conversionBonus || 0;
        const effectiveConsumers = ringConsumers * coverage * ring.baseConversion * brandTraffic;
        const areaDemand = effectiveConsumers
          * (CONVERSION_RATE + brandConvBonus)
          * categoryOccasionMultiplier
          * menuBalanceFactor;

        // 玩家竞争力（内部已包含曝光度和口碑系数）
        const playerComp = calculatePlayerCompetitiveness(
          actualPrice, categoryAvgPrice,
          state.exposure, state.reputation,
          avgAppeal, avgServiceQuality,
          state.weeksSinceLastAction || 0,
          type
        );

        // 竞争店铺总竞争力（传入品类均价+产品品类，与玩家对称）
        const shopCompTotal = weightedDirectCompetitors.reduce((sum, entry) => {
          return sum + calculateShopCompetitiveness(entry.shop, type, categoryAvgPrice, product.category) * entry.weight;
        }, 0);

        // 修复 #1：兜底基数始终存在，代表"不进任何店"的自然流失
        // Round 5: 从0.45降至0.38，Round 4过于激进导致需求瓶颈
        const BASE_MARKET_FRICTION = 0.38;
        const marketShare = playerComp / (playerComp + shopCompTotal + BASE_MARKET_FRICTION);

        const playerModifier = modifiers.season + modifiers.marketing + modifiers.serviceQuality + modifiers.cleanliness + modifiers.inactivity;

        const typeDemand = areaDemand * appealRatio * marketShare *
          (1 + playerModifier) * (1 - substitutionPressure) * absolutePriceEffect;

        baseTrafficByType[type] += typeDemand;
        totalProductDemand += typeDemand;
      });
    });

    // 新店知名度爬坡因子（自主创业前12周需求大幅受限）
    const brandType = state.selectedBrand?.isQuickFranchise
      ? 'quick_franchise' as const
      : (state.selectedBrand?.type === 'franchise' ? 'franchise' as const : 'independent' as const);
    const awarenessFactor = getNewStoreAwarenessFactor(state.currentWeek, brandType, state.growthSystem);

    // 周需求 = 日需求 × 7 × 爬坡因子
    // 加入 ±8% 随机波动，模拟真实经营中的客流自然波动
    const WEEKLY_DEMAND_VARIANCE = 0.08;
    const varianceSeed = (hashStringToUint32(product.id) ^ Math.imul(state.currentWeek, 2654435761)) >>> 0;
    const varianceFactor = 1 + (rand01FromSeed(varianceSeed) - 0.5) * 2 * WEEKLY_DEMAND_VARIANCE;
    let weeklyDemand = totalProductDemand * 7 * varianceFactor * awarenessFactor;

    // 缺货惩罚：上周满足率低 → 本周客流减少（口碑传播效应）
    const stockoutEffect = getStockoutEffect(state.lastWeekFulfillment);
    weeklyDemand *= stockoutEffect.salesModifier;

    return {
      productId: product.id,
      productName: product.name,
      baseTrafficByType,
      appealRatio: calculateProductAppealRatio(product, products, state, 'students'),
      demandModifierTotal: modifierTotal,
      finalDemand: Math.round(weeklyDemand),
    };
  });

  const totalDemand = productDemands.reduce((sum, pd) => sum + pd.finalDemand, 0);

  return {
    baseTraffic,
    totalBaseTraffic,
    modifiers,
    modifierTotal,
    productDemands,
    totalDemand,
  };
}
