/**
 * 外卖需求计算模块 (v3.0 重做)
 *
 * 核心公式：
 * 外卖需求[产品] = Σ(ring=0,1,2,3) [
 *   ringConsumers[type] × platformAudienceMultiplier[type]
 *   × DELIVERY_CONVERSION_RATE × platformWeightCoeff
 *   × ratingCoeff × deliveryAppealRatio × deliveryMarketShare
 *   × distanceDecay × (1 + seasonModifier)
 *   × discountPricingMultiplier
 * ] × 7天
 *
 * v3 变更：
 * - 基础转化率 0.025→0.007，满减倍率成为主要单量放大器
 * - 新增 discountPricingMultiplier（满减×定价弹性组合）
 * - platformExposure 语义变为"权重分"（由多因子综合计算）
 * - 目标单量：单平台稳定期 80-250单/周
 */

import type {
  GameState,
  Product,
  CustomerType,
  RingId,
} from '@/types/game';
import {
  DELIVERY_CONVERSION_RATE,
  DELIVERY_DISTANCE_DECAY,
  getPlatformExposureCoefficient,
  getRatingCoefficient,
  getDeliveryPlatform,
  getMultiPlatformOverlapDiscount,
  getDeliveryCompetitionBase,
  getDiscountPricingMultiplier,
} from '@/data/deliveryData';
import { SEASON_MODIFIER } from '@/data/gameData';
import { getStockoutEffect } from '@/data/inventoryData';
import { calculateAbsolutePriceEffect, getNewStoreAwarenessFactor, getTrafficReachMultiplier } from './demandCalculator';

const CUSTOMER_TYPES: CustomerType[] = ['students', 'office', 'family', 'tourist'];

// ============ 外卖产品吸引力（去掉装修加成） ============

function calculateDeliveryAppealRatio(
  product: Product,
  allProducts: Product[],
  customerType: CustomerType
): number {
  const productAppeal = product.appeal[customerType];
  let totalAppeal = 0;
  allProducts.forEach(p => { totalAppeal += p.appeal[customerType]; });
  return totalAppeal > 0 ? productAppeal / totalAppeal : 0;
}

// ============ 外卖市场份额 ============

const RING_ORDER: RingId[] = ['ring0', 'ring1', 'ring2', 'ring3'];

function calculateDeliveryMarketShareForRing(state: GameState, ringId: RingId): number {
  const { deliveryState, nearbyShops } = state;
  if (!deliveryState || deliveryState.platforms.length === 0) return 0;

  const avgAppeal = state.selectedProducts.length > 0
    ? state.selectedProducts.reduce((sum, p) => {
        return sum + (p.appeal.students + p.appeal.office + p.appeal.family + p.appeal.tourist) / 4;
      }, 0) / state.selectedProducts.length
    : 50;

  const playerScore = deliveryState.totalPlatformExposure
    * getRatingCoefficient(deliveryState.platformRating)
    * (avgAppeal / 100);

  const ringIdx = RING_ORDER.indexOf(ringId);
  const competitorScore = (nearbyShops || [])
    .filter(s => !s.isClosing && s.hasDelivery)
    .reduce((sum, shop) => {
      const shopRingIdx = RING_ORDER.indexOf(shop.ring);
      if (Math.abs(shopRingIdx - ringIdx) > 1) return sum;
      const distWeight = shopRingIdx === ringIdx ? 1.0 : 0.5;
      return sum + shop.exposure * 0.5 * shop.serviceQuality * distWeight;
    }, 0);

  const locationType = state.selectedLocation?.type || 'community';
  const competitionBase = getDeliveryCompetitionBase(locationType);

  const totalScore = playerScore + competitorScore + competitionBase;
  return totalScore > 0 ? playerScore / totalScore : 0;
}

// ============ 综合满减+定价转化倍率（多平台加权平均） ============

function getAverageDiscountPricingMultiplier(state: GameState): number {
  const { deliveryState } = state;
  if (!deliveryState || deliveryState.platforms.length === 0) return 0.3;

  // 按平台权重分加权平均各平台的满减×定价倍率
  const totalWeight = deliveryState.platforms.reduce((s, p) => s + Math.max(1, p.platformExposure), 0);
  if (totalWeight <= 0) return 0.3;

  let weightedSum = 0;
  deliveryState.platforms.forEach(ap => {
    const mult = getDiscountPricingMultiplier(ap.discountTierId, ap.deliveryPricingId);
    weightedSum += mult * Math.max(1, ap.platformExposure);
  });

  return weightedSum / totalWeight;
}

// ============ 核心导出函数 ============

/**
 * 计算单个产品的外卖需求
 * 遍历 Ring 0-3 所有消费者环
 */
export function calculateDeliveryDemandForProduct(
  product: Product,
  allProducts: Product[],
  state: GameState
): number {
  const { deliveryState, consumerRings } = state;

  if (!deliveryState || deliveryState.platforms.length === 0) return 0;
  if (!consumerRings || consumerRings.length === 0) return 0;

  // 绝对价格弹性（基于堂食价，外卖定价上浮不影响此处，因为消费者看到的是满减后价格）
  const actualPrice = state.productPrices[product.id] || product.basePrice;
  const absolutePriceEffect = calculateAbsolutePriceEffect(actualPrice, product.referencePrice);

  const platformExposureCoeff = getPlatformExposureCoefficient(deliveryState.totalPlatformExposure);
  const ratingCoeff = getRatingCoefficient(deliveryState.platformRating);
  const seasonMod = SEASON_MODIFIER[state.currentSeason] - 1;
  const trafficReachMultiplier = getTrafficReachMultiplier(state.exposure, state.reputation);

  // v3: 满减+定价组合的综合转化倍率
  const discountPricingMult = getAverageDiscountPricingMultiplier(state);

  const platformCount = deliveryState.platforms.length;

  let totalDemand = 0;

  consumerRings.forEach(ring => {
    const ringReach = ring.distance === 'ring0' ? 1 : trafficReachMultiplier;
    const marketShare = calculateDeliveryMarketShareForRing(state, ring.distance);
    const distanceDecay = DELIVERY_DISTANCE_DECAY[ring.distance] ?? 0.12;

    CUSTOMER_TYPES.forEach(type => {
      const consumers = ring.consumers[type] * ringReach;
      if (consumers <= 0) return;

      const appealRatio = calculateDeliveryAppealRatio(product, allProducts, type);

      let audienceMultiplier = 0;
      deliveryState.platforms.forEach((ap, idx) => {
        const platform = getDeliveryPlatform(ap.platformId);
        if (!platform) return;
        const mult = platform.audienceMultiplier[type];
        const overlapDiscount = idx === 0
          ? 1.0
          : getMultiPlatformOverlapDiscount(platformCount, type);
        audienceMultiplier += mult * overlapDiscount;
      });

      const ringDemand = consumers
        * audienceMultiplier
        * DELIVERY_CONVERSION_RATE
        * platformExposureCoeff
        * ratingCoeff
        * appealRatio
        * marketShare
        * distanceDecay
        * (1 + seasonMod)
        * absolutePriceEffect
        * discountPricingMult;       // v3: 满减+定价组合倍率

      totalDemand += ringDemand;
    });
  });

  // 新店知名度爬坡因子
  const brandType = state.selectedBrand?.isQuickFranchise
    ? 'quick_franchise' as const
    : (state.selectedBrand?.type === 'franchise' ? 'franchise' as const : 'independent' as const);
  const awarenessFactor = getNewStoreAwarenessFactor(state.currentWeek, brandType, state.growthSystem);

  // 周需求 = 日需求 × 7 × 爬坡因子
  let weeklyDemand = totalDemand * 7 * awarenessFactor;

  // 缺货惩罚
  const stockoutEffect = getStockoutEffect(state.lastWeekFulfillment);
  weeklyDemand *= stockoutEffect.salesModifier;

  // 保底机制：有满减活动的平台，每平台每产品至少2单/周
  const activePlatformsWithDiscount = deliveryState.platforms.filter(
    p => p.discountTierId !== 'none'
  ).length;
  const minDemand = activePlatformsWithDiscount * 2;

  return Math.max(minDemand, Math.round(weeklyDemand));
}
