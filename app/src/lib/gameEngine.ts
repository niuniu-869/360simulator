/**
 * gameEngine.ts — 纯游戏逻辑共享模块
 *
 * 从 useGameState.ts 提取的核心游戏逻辑，供 React Hook 和 CLI 模拟脚本共同调用。
 * 所有函数均为纯函数，不依赖 React。
 */

import type {
  GameState,
  Staff,
  Season,
  CognitionLevel,
  SupplyDemandResult,
  WeeklySummary,
  NearbyShopEvent,
  InteractiveGameEvent,
} from '@/types/game';
import { calculateSupplyDemand } from '@/lib/supplyDemand';
import {
  tryGenerateNewShop,
  checkShopClosing,
  updateShopPrices,
  updateShopProfits,
} from '@/lib/nearbyShopGenerator';
import { assignNearbyShopsToConsumerRings, applySeasonalTrafficVariation } from '@/lib/consumerRingGenerator';
import { rollInteractiveEvent, applyEventEffects } from '@/lib/eventEngine';
import { INTERACTIVE_EVENTS } from '@/data/interactiveEvents';
import {
  staffTypes,
  gameEvents,
  MONTHLY_MARKETING_COST,
  EQUIPMENT_DEPRECIATION,
} from '@/data/gameData';
import { COGNITION_LEVELS, PASSIVE_EXP_CONFIG, MISTAKE_EXP_TABLE, applyCognitionExp } from '@/data/cognitionData';
import {
  PROMOTION_TIERS,
  INITIAL_PLATFORM_RATING,
  getDeliveryPlatform,
  RATING_GROWTH_CONFIG,
  calculatePlatformWeightScore,
  getPackagingTier,
} from '@/data/deliveryData';
import {
  getWasteRate,
  calculateHoldingCost,
  calculateRestockQuantity,
  getStockoutEffect,
} from '@/data/inventoryData';
import { getStaffFatigueEffect, getMoraleEffect, getTaskDefinition } from '@/data/staffData';
import {
  getActivityConfig,
  calculateActivityEffectDecay,
  getLocationExposureFloor,
  DEPENDENCY_CONFIG,
} from '@/data/marketingData';
import {
  calculateWeeklyExp,
  getSkillUpgradeRequirement,
  calculateFatigueGain,
  calculateWorkHoursMoraleEffect,
} from '@/data/staffData';
import { diagnoseHealth } from '@/lib/healthCheck';
import {
  getBossActionConfig,
  INVESTIGATION_DIMENSIONS,
  generateInvestigationResult,
  generateTrafficCountResult,
  generateDinnerInsight,
} from '@/data/bossActionData';
import type { InvestigationDimension } from '@/types/game';

// ============ 常量 ============

export const INITIAL_CASH = 400000; // 初始资金40万（原30万，给加盟品牌留足运营缓冲）
export const WIN_STREAK = 6; // 连续盈利6周即胜利
export const WIN_EXPOSURE = 35;
export const WIN_REPUTATION = 55;
export const MIN_OPERATING_CASH = -5000; // 允许小额透支缓冲，减少早期“猝死”式破产

// 快招品牌蜜月期配置
export const QUICK_FRANCHISE_HONEYMOON = {
  weeks: 8,                    // 蜜月期8周
  supplyCostMultiplier: 1.0,   // 蜜月期供货成本正常（之后才暴露真实成本）
  fakeReputationBoost: 3,      // 蜜月期每周虚假口碑加成（总部刷单）
};

// ============ 工具函数 ============

/** 根据月份获取季节 */
export const getSeasonFromMonth = (month: number): Season => {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
};

/** 根据周数计算当前月份 */
export const getCurrentMonth = (startMonth: number, weeksPassed: number): number => {
  const monthsPassed = Math.floor(weeksPassed / 4);
  return ((startMonth - 1 + monthsPassed) % 12) + 1;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function mapLaunchProgressToAwareness(progress: number): number {
  // 0.25~1.0：低进度几乎无人知晓，高进度接近稳定期
  const normalized = sigmoid((progress - 45) / 10);
  return 0.25 + 0.75 * normalized;
}

/** 获取有效供货成本系数（快招品牌蜜月期内返回1.0，蜜月期后返回真实值；叠加饭局 buff） */
export function getEffectiveSupplyCostModifier(state: GameState): number {
  const brand = state.selectedBrand;
  let modifier = 1;
  if (brand) {
    if (!brand.isQuickFranchise) {
      modifier = brand.supplyCostModifier;
    } else if (state.currentWeek <= QUICK_FRANCHISE_HONEYMOON.weeks) {
      modifier = QUICK_FRANCHISE_HONEYMOON.supplyCostMultiplier;
    } else {
      modifier = brand.supplyCostModifier;
    }
  }
  // 叠加 activeBuffs 中的 supply_cost_reduction（饭局获得的进货折扣）
  const buffs = state.bossAction?.activeBuffs ?? [];
  for (const buff of buffs) {
    if (buff.type === 'supply_cost_reduction') {
      modifier *= (1 - buff.value);
    }
  }
  return modifier;
}

// ============ 固定成本计算 ============

export interface FixedCostBreakdown {
  rent: number;
  salary: number;
  utilities: number;
  marketing: number;
  depreciation: number;
  promotion: number;  // 外卖推广费（由调用方注入，base 函数返回 0）
  total: number;
}

/** 计算每周固定成本明细（含隐性成本） */
export function calculateFixedCostBreakdown(state: GameState): FixedCostBreakdown {
  const empty: FixedCostBreakdown = { rent: 0, salary: 0, utilities: 0, marketing: 0, depreciation: 0, promotion: 0, total: 0 };
  if (!state.selectedLocation || !state.selectedDecoration) return empty;

  const area = state.selectedAddress?.area || state.storeArea;
  const rentModifier = state.selectedAddress?.rentModifier || 1;

  const seasonRentMultiplier = state.selectedLocation.type === 'tourist'
    ? (state.currentSeason === 'summer' ? 1.0 : state.currentSeason === 'winter' ? 0.75 : 0.85)
    : 1.0;
  const monthlyRent = state.selectedLocation.rentPerSqm * area * rentModifier * seasonRentMultiplier;
  const rent = monthlyRent / 4;

  const monthlySalary = state.staff.reduce((sum, s) => sum + s.salary, 0);
  const salary = monthlySalary / 4;

  const utilities = (monthlyRent * 0.2) / 4;
  const marketing = MONTHLY_MARKETING_COST / 4;
  const depreciation = EQUIPMENT_DEPRECIATION / 4;

  return {
    rent,
    salary,
    utilities,
    marketing,
    depreciation,
    promotion: 0,
    total: rent + salary + utilities + marketing + depreciation,
  };
}

/** 计算每周固定成本（含隐性成本）— 兼容旧调用 */
export function calculateWeeklyFixedCost(state: GameState): number {
  return calculateFixedCostBreakdown(state).total;
}

/** 计算当前外卖推广费用总额（纯函数，供 gameQuery 复用） */
export function calculateWeeklyPromotionCost(state: GameState): number {
  let total = 0;
  if (state.deliveryState && state.deliveryState.platforms.length > 0) {
    for (const ap of state.deliveryState.platforms) {
      if (ap.promotionTierId !== 'none') {
        const tier = PROMOTION_TIERS.find(t => t.id === ap.promotionTierId);
        if (tier) total += tier.weeklyCost;
      }
    }
  }
  return total;
}

/** 计算变动成本（含加盟抽成、平台抽成、损耗 - 使用详细损耗率） */
export function calculateVariableCost(revenue: number, state: GameState, sdResult?: SupplyDemandResult): number {
  if (state.selectedProducts.length === 0) return 0;

  const supplyCostModifier = getEffectiveSupplyCostModifier(state);

  // 平均成本率（库存持有成本计算也需要）
  const avgCostRate = state.selectedProducts.reduce((sum, p) => {
    const modifiedCost = p.baseCost * supplyCostModifier;
    return sum + (modifiedCost / p.basePrice);
  }, 0) / state.selectedProducts.length;

  // 基础变动成本：优先使用实际销量 × 单位成本
  let baseCost: number;
  if (sdResult && sdResult.productSales.length > 0) {
    baseCost = sdResult.productSales.reduce((sum, sale) => {
      const product = state.selectedProducts.find(p => p.id === sale.productId);
      if (!product) return sum;
      return sum + sale.actualSales * product.baseCost * supplyCostModifier;
    }, 0);
  } else {
    // 筹备阶段 fallback：用平均成本率估算
    baseCost = revenue * avgCostRate;
  }

  // 加盟抽成（按营业额百分比）
  const franchiseFee = revenue * (state.selectedBrand?.royaltyRate || 0);

  // 外卖佣金、包装成本（从供需结果中获取，已在 index.ts 精确计算）
  // 注：deliveryDiscountCost 不计入变动成本，因为 deliveryRevenue 已是顾客实付金额
  const deliveryCommission = sdResult?.deliveryCommission || 0;
  const deliveryPackageCost = sdResult?.deliveryPackageCost || 0;

  // ============ 损耗与持有成本 ============
  let wasteCost = 0;
  let holdingCost = 0;
  if (state.inventoryState.items.length > 0) {
    wasteCost = state.inventoryState.weeklyWasteCost;
    holdingCost = state.inventoryState.weeklyHoldingCost;
  } else {
    state.selectedProducts.forEach(product => {
      const wasteRate = getWasteRate(product.storageType as 'normal' | 'refrigerated' | 'frozen');
      const productRevenue = revenue / state.selectedProducts.length;
      wasteCost += productRevenue * wasteRate;
      const productValue = productRevenue * avgCostRate;
      holdingCost += calculateHoldingCost(productValue, product.storageType);
    });
  }

  // ============ 营销活动成本 ============
  let marketingCost = 0;
  state.activeMarketingActivities.forEach(activity => {
    const config = getActivityConfig(activity.id);
    if (config) {
      marketingCost += config.baseCost;
    }
  });

  // 注意：deliveryDiscountCost 不计入变动成本，因为 deliveryRevenue 已经是顾客实付金额（menuPrice × (1-subsidyRate)），
  // 满减补贴已体现在更低的收入中。deliveryDiscountCost 仅用于 UI 展示和勇哥诊断上下文。
  return baseCost + franchiseFee + deliveryCommission + deliveryPackageCost + wasteCost + holdingCost + marketingCost;
}

// ============ 初始游戏状态 ============

/** 创建初始游戏状态 */
export function createInitialGameState(): GameState {
  return {
    currentWeek: 0,
    totalWeeks: 52,
    consecutiveProfits: 0,
    gamePhase: 'setup',
    gameOverReason: null,
    selectedBrand: null,
    selectedLocation: null,
    selectedAddress: null,
    storeArea: 30,
    selectedDecoration: null,
    selectedProducts: [],
    staff: [],
    isOpen: false,
    hasDelivery: false,
    cash: INITIAL_CASH,
    totalInvestment: 0,
    weeklyRevenue: 0,
    weeklyVariableCost: 0,
    weeklyFixedCost: 0,
    profitHistory: [],
    revenueHistory: [],
    cashHistory: [],
    // 双指标系统
    exposure: 20,
    reputation: 20,
    cleanliness: 60,
    // v3 增长系统（曝光存量+营销脉冲+口碑置信）
    growthSystem: {
      launchProgress: 8,
      awarenessFactor: mapLaunchProgressToAwareness(8),
      awarenessStock: 12,
      campaignPulse: 8,
      trustConfidence: 0.12,
      repeatIntent: 45,
    },
    // 快招品牌锁定状态
    locationLocked: false,
    decorationLocked: false,
    productsLocked: false,
    decorationCostMarkup: 1.0,
    // 季节与时间机制
    currentSeason: 'spring',
    startMonth: 3,
    // 周边店铺系统
    nearbyShops: [],
    nearbyShopEvents: [],
    // 消费者环数据
    baseConsumerRings: [],
    consumerRings: [],
    // 外卖状态
    deliveryState: {
      platforms: [],
      totalPlatformExposure: 0,
      platformRating: INITIAL_PLATFORM_RATING,
      weeklyDeliveryOrders: 0,
      weeklyDeliveryRevenue: 0,
      weeklyCommissionPaid: 0,
      weeklyPackageCost: 0,
      weeklyDiscountCost: 0,
    },
    // 出餐分配优先级
    supplyPriority: 'dine_in_first',
    // 老板周行动系统
    bossAction: {
      currentAction: 'supervise' as const,
      workRole: undefined,
      consecutiveStudyWeeks: 0,
      benchmarkCooldown: 0,
      revealedShopInfo: {},
      investigationHistory: [],
      insightHistory: [],
      activeBuffs: [],
      lastActionWeek: 0,
    },
    // 认知系统
    cognition: {
      level: 0 as CognitionLevel,
      exp: 0,
      expToNext: COGNITION_LEVELS[1].expRequired,
      totalExp: 0,
      unlockedInfo: [],
      mistakeHistory: [],
      weeklyOperationCount: 0,
      consultYongGeThisWeek: 0,
    },
    // 定价系统
    productPrices: {},
    // 营销活动系统
    activeMarketingActivities: [],
    // 库存系统
    inventoryState: {
      items: [],
      totalValue: 0,
      weeklyHoldingCost: 0,
      weeklyWasteCost: 0,
      weeklyRestockCost: 0,
    },
    lastWeekFulfillment: 1,
    // 选品调整追踪
    weeklyProductChanges: 0,
    weeksSinceLastAction: 0,
    // 活动使用记录
    usedOneTimeActivities: [],
    lastActivityWeek: {},
    // 事件追踪
    encounteredEventTypes: [],
    lastWeekEvent: null,
    // 交互式事件系统（v2.9）
    pendingInteractiveEvent: null,
    interactiveEventHistory: [],
    lastInteractiveEventResponse: null,
    // 事件高级机制（v3.1）
    activeEventBuffs: [],
    pendingDelayedEffects: [],
    pendingChainEvents: [],
    // 每周总结与回本追踪
    weeklySummary: null,
    lastWeeklySummary: null,
    cumulativeProfit: 0,
  };
}

// ============ 核心周循环逻辑 ============

/**
 * weeklyTick — 推进一周的纯函数
 * 从 useGameState.ts nextWeek 闭包体原样提取，零逻辑复制。
 */
export function weeklyTick(prev: GameState): {
  state: GameState;
  summary: WeeklySummary;
} {
  const newWeek = prev.currentWeek + 1;

  // ============ v3.1: 处理到期的延迟效果 ============
  const delayedEffectNarratives: string[] = [];
  let stateAfterDelayed = prev;
  const dueEffects = (prev.pendingDelayedEffects || []).filter(de => de.executeAtWeek <= newWeek);
  const remainingDelayed = (prev.pendingDelayedEffects || []).filter(de => de.executeAtWeek > newWeek);

  if (dueEffects.length > 0) {
    let tempState = { ...prev, pendingDelayedEffects: remainingDelayed };
    for (const de of dueEffects) {
      tempState = applyEventEffects(tempState, de.effects, de.sourceEventId);
      if (de.description) {
        delayedEffectNarratives.push(de.description);
      }
    }
    stateAfterDelayed = tempState;
  } else {
    stateAfterDelayed = { ...prev, pendingDelayedEffects: remainingDelayed };
  }

  // ============ v3.1: 处理到期的链式事件 ============
  const dueChains = (stateAfterDelayed.pendingChainEvents || []).filter(ce => ce.triggerAtWeek <= newWeek);
  const remainingChains = (stateAfterDelayed.pendingChainEvents || []).filter(ce => ce.triggerAtWeek > newWeek);
  let chainTriggeredEvent: InteractiveGameEvent | null = null;

  for (const ce of dueChains) {
    if (Math.random() < ce.probability) {
      // 从 INTERACTIVE_EVENTS 中查找链式事件（链式事件不受去重限制）
      const chainEvent = INTERACTIVE_EVENTS.find(e => e.id === ce.eventId);
      if (chainEvent && !stateAfterDelayed.pendingInteractiveEvent) {
        chainTriggeredEvent = chainEvent;
        break; // 每周最多触发一个链式事件
      }
    }
  }
  stateAfterDelayed = { ...stateAfterDelayed, pendingChainEvents: remainingChains };

  // ============ v3.1: 递减事件 buff 持续时间，移除过期 buff ============
  const updatedEventBuffs = (stateAfterDelayed.activeEventBuffs || [])
    .map(b => ({ ...b, durationWeeks: b.durationWeeks - 1 }))
    .filter(b => b.durationWeeks > 0);
  const activeBuffSummaries = updatedEventBuffs.map(b => b.source);
  stateAfterDelayed = { ...stateAfterDelayed, activeEventBuffs: updatedEventBuffs };

  // 用处理后的 state 替代 prev 继续后续计算
  const prevWithEffects = stateAfterDelayed;

  // 更新季节
  const currentMonth = getCurrentMonth(prev.startMonth, newWeek);
  const newSeason = getSeasonFromMonth(currentMonth);

  // ============ v3 增长系统：曝光存量 + 营销脉冲 + 口碑置信 ============
  const locationFloor = getLocationExposureFloor(prev.selectedAddress?.trafficModifier || 1);
  const fallbackLaunch = clamp(prev.currentWeek * 4 + 8, 0, 100);
  const prevGrowth = prev.growthSystem ?? {
    launchProgress: fallbackLaunch,
    awarenessFactor: mapLaunchProgressToAwareness(fallbackLaunch),
    awarenessStock: Math.max(locationFloor, prev.exposure * 0.7),
    campaignPulse: Math.max(0, prev.exposure * 0.3),
    trustConfidence: clamp(0.1 + prev.currentWeek * 0.03, 0.1, 0.8),
    repeatIntent: clamp(prev.reputation, 35, 80),
  };

  let launchProgress = prevGrowth.launchProgress;
  let awarenessStock = prevGrowth.awarenessStock;
  let campaignPulse = prevGrowth.campaignPulse;
  let trustConfidence = prevGrowth.trustConfidence;
  let repeatIntent = prevGrowth.repeatIntent;
  let newReputation = prev.reputation;

  // 存量/脉冲自然衰减：存量慢衰、脉冲快衰
  awarenessStock = Math.max(locationFloor, awarenessStock - Math.max(0.35, awarenessStock * 0.02));
  campaignPulse *= 0.58;

  // 口碑自然回归（比旧版更强），防止长期无成本维持高分
  newReputation = Math.max(DEPENDENCY_CONFIG.reputationFloor, newReputation - 0.35);

  let campaignPulseGain = 0;
  let trustGainFromActivities = 0;
  let launchGainFromActivities = 0;

  // Step 1: 营销活动改为主要作用在“脉冲/信任”，不再直接给需求硬加成
  prev.activeMarketingActivities.forEach(activity => {
    const config = getActivityConfig(activity.id);
    if (!config) return;

    const decay = config.type === 'continuous'
      ? calculateActivityEffectDecay(activity.activeWeeks, config.dependencyCoefficient)
      : 1;
    const duration = config.type === 'one_time' ? (config.maxDuration || 1) : 1;
    const exposureGain = (config.exposureBoost * decay) / duration;
    const trustGain = (config.reputationBoost * decay) / duration;

    // 曝光类更偏脉冲；混合类会有少量沉淀到存量
    const pulseWeight = config.category === 'exposure' ? 1.0 : 0.75;
    campaignPulseGain += Math.max(0, exposureGain) * pulseWeight;
    awarenessStock += Math.max(0, exposureGain) * (config.category === 'both' ? 0.08 : 0.04);

    trustGainFromActivities += trustGain * 0.55;
    launchGainFromActivities += Math.max(0, exposureGain * 0.12 + trustGain * 0.2);
  });

  // Step 1.5: 营销员贡献（线上线下都有，但偏脉冲）
  const MARKETER_EXPOSURE_RATE = 2.2;
  let marketerExposureBoost = 0;
  prevWithEffects.staff.forEach(s => {
    if (s.isOnboarding || s.assignedTask !== 'marketer') return;
    const hours = s.workDaysPerWeek * s.workHoursPerDay;
    marketerExposureBoost += s.efficiency * (hours / 48) * MARKETER_EXPOSURE_RATE;
  });
  campaignPulseGain += marketerExposureBoost;
  awarenessStock += marketerExposureBoost * 0.12;

  // Step 1.8: 不活跃惩罚（主要打击脉冲和开业进度）
  const inactiveWeeks = prev.weeksSinceLastAction || 0;
  if (inactiveWeeks >= 3) {
    const inactivityPenalty = Math.min(3, (inactiveWeeks - 2) * 0.6);
    campaignPulseGain -= inactivityPenalty;
    awarenessStock -= inactivityPenalty * 0.4;
    launchProgress -= inactivityPenalty * 0.8;
  }

  campaignPulse = Math.max(0, campaignPulse + campaignPulseGain);
  awarenessStock = clamp(awarenessStock, locationFloor, 95);
  launchProgress = clamp(launchProgress + launchGainFromActivities, 0, 100);

  // Step 2: 口碑活动收益受置信度约束，避免低样本快速冲高
  const confidenceGainFactor = 0.45 + trustConfidence * 0.55;
  newReputation += trustGainFromActivities * confidenceGainFactor;

  // Step 2.5: 快招品牌蜜月期虚假口碑加成（保留，但缩小并随周次衰减）
  if (prev.selectedBrand?.isQuickFranchise && newWeek <= QUICK_FRANCHISE_HONEYMOON.weeks) {
    const remainingRatio = (QUICK_FRANCHISE_HONEYMOON.weeks - newWeek + 1) / QUICK_FRANCHISE_HONEYMOON.weeks;
    newReputation += QUICK_FRANCHISE_HONEYMOON.fakeReputationBoost * 0.45 * remainingRatio;
  }

  // 本周供需计算前的曝光值（由存量+脉冲+少量复购口碑外溢构成）
  let newExposure = awarenessStock + campaignPulse + Math.max(0, (repeatIntent - 50) * 0.12);
  newExposure = clamp(newExposure, locationFloor, 100);

  // 周边店铺动态更新
  const shopEvents: NearbyShopEvent[] = [];
  let updatedNearbyShops = updateShopPrices(prev.nearbyShops);

  // 尝试新开店
  const rentBase = prev.selectedLocation
    ? prev.selectedLocation.rentPerSqm * (prev.selectedAddress?.rentModifier || 1) * (prev.selectedAddress?.area || 30)
    : 3000;
  const newShop = tryGenerateNewShop(
    prev.selectedLocation?.type || 'community',
    updatedNearbyShops, newWeek, rentBase
  );
  if (newShop) {
    updatedNearbyShops = [...updatedNearbyShops, newShop];
    shopEvents.push({
      type: 'new_open',
      shopId: newShop.id,
      shopName: newShop.name,
      description: `新店「${newShop.name}」在附近开业了！`,
      week: newWeek,
    });
  }

  // 检查关门
  const closingResult = checkShopClosing(updatedNearbyShops, newWeek);
  updatedNearbyShops = closingResult.updatedShops;
  shopEvents.push(...closingResult.events);

  // 估算店铺利润
  const areaTotalDemand = prev.selectedLocation
    ? Object.values(prev.selectedLocation.footTraffic).reduce((s, v) => s + v, 0)
    : 500;
  updatedNearbyShops = updateShopProfits(updatedNearbyShops, areaTotalDemand);

  // 修复 #9：消费者环季节性波动（基于 baseConsumerRings 原始值）
  const baseRings = prev.baseConsumerRings.length > 0
    ? prev.baseConsumerRings
    : prev.consumerRings || [];
  const seasonAdjustedRings = applySeasonalTrafficVariation(baseRings, newSeason);
  const updatedConsumerRings = assignNearbyShopsToConsumerRings(
    seasonAdjustedRings,
    updatedNearbyShops
  );

  // 使用更新后的状态计算收入
  const updatedState = {
    ...prevWithEffects,
    currentSeason: newSeason,
    exposure: newExposure,
    reputation: newReputation,
    growthSystem: {
      launchProgress,
      awarenessFactor: mapLaunchProgressToAwareness(launchProgress),
      awarenessStock,
      campaignPulse,
      trustConfidence,
      repeatIntent,
    },
    nearbyShops: updatedNearbyShops,
    nearbyShopEvents: shopEvents,
    consumerRings: updatedConsumerRings,
  };

  const supplyDemandResult = calculateSupplyDemand(updatedState);
  const revenue = supplyDemandResult.totalRevenue;

  // ============ 外卖平台状态更新（v3.0：权重分驱动） ============
  let updatedDeliveryState = { ...prev.deliveryState };
  let weeklyPromotionCostTotal = 0;

  if (updatedDeliveryState.platforms.length > 0) {
    // --- 评分更新（基于订单完成率，冷启动从0增长） ---
    const currentRating = updatedDeliveryState.platformRating;
    const fulfilledOrders = supplyDemandResult.deliverySales;
    const totalDeliveryDemand = supplyDemandResult.productSales.reduce((sum, ps) => {
      const dineInDemand = supplyDemandResult.demand.productDemands.find(
        pd => pd.productId === ps.productId
      )?.finalDemand || 0;
      return sum + Math.max(0, ps.demand - dineInDemand);
    }, 0);
    const unfulfilledOrders = Math.max(0, totalDeliveryDemand - fulfilledOrders);

    let ratingGrowth = fulfilledOrders * RATING_GROWTH_CONFIG.ratingPerFulfilledOrder
      + unfulfilledOrders * RATING_GROWTH_CONFIG.ratingPerUnfulfilledOrder;

    // 食材升级活动加成
    const hasIngredientUpgrade = prev.activeMarketingActivities.some(
      a => a.id === 'ingredient_upgrade'
    );
    if (hasIngredientUpgrade) ratingGrowth += RATING_GROWTH_CONFIG.ingredientUpgradeBonus;

    // 推广档位评分加成
    let totalRatingBoostFromPromotion = 0;
    updatedDeliveryState.platforms.forEach(ap => {
      if (ap.promotionTierId !== 'none') {
        const tier = PROMOTION_TIERS.find(t => t.id === ap.promotionTierId);
        if (tier) totalRatingBoostFromPromotion += tier.ratingBoost;
      }
      // v3: 精美包装评分加成
      const pkg = getPackagingTier(ap.packagingTierId);
      if (pkg && pkg.ratingBonus > 0) totalRatingBoostFromPromotion += pkg.ratingBonus;
    });
    ratingGrowth += totalRatingBoostFromPromotion;

    // 自然衰减
    ratingGrowth -= RATING_GROWTH_CONFIG.naturalDecay;

    ratingGrowth = Math.max(-0.5, Math.min(RATING_GROWTH_CONFIG.maxWeeklyGrowth, ratingGrowth));
    const newRating = Math.max(0, Math.min(5.0, currentRating + ratingGrowth));

    // --- v3: 权重分计算（替代旧的线性曝光增长） ---
    const updatedPlatforms = updatedDeliveryState.platforms.map(ap => {
      const platform = getDeliveryPlatform(ap.platformId);
      if (!platform) return { ...ap, activeWeeks: ap.activeWeeks + 1 };

      // 更新滚动4周单量（按平台权重分占比分摊本周总单量）
      const totalWeight = updatedDeliveryState.platforms.reduce(
        (s, p) => s + Math.max(1, p.platformExposure), 0
      );
      const platformShare = Math.max(1, ap.platformExposure) / totalWeight;
      const thisWeekOrders = Math.round(fulfilledOrders * platformShare);
      const recentOrders = [...(ap.recentWeeklyOrders || []), thisWeekOrders].slice(-4);

      // 推广费用累计
      if (ap.promotionTierId !== 'none') {
        const tier = PROMOTION_TIERS.find(t => t.id === ap.promotionTierId);
        if (tier) weeklyPromotionCostTotal += tier.weeklyCost;
      }

      // 计算权重分
      const ws = calculatePlatformWeightScore(
        ap.activeWeeks + 1,
        platform.newStoreBoostWeeks,
        recentOrders,
        newRating,
        ap.promotionTierId,
        ap.discountTierId,
      );

      return {
        ...ap,
        activeWeeks: ap.activeWeeks + 1,
        platformExposure: ws.total,
        recentWeeklyOrders: recentOrders,
        lastWeightBase: ws.base,
        lastWeightSales: ws.sales,
        lastWeightRating: ws.ratingW,
        lastWeightPromotion: ws.promotion,
        lastWeightDiscount: ws.discount,
      };
    });

    const totalExposure = updatedPlatforms.reduce((sum, p) => sum + p.platformExposure, 0);

    updatedDeliveryState = {
      platforms: updatedPlatforms,
      totalPlatformExposure: totalExposure,
      platformRating: newRating,
      weeklyDeliveryOrders: supplyDemandResult.deliverySales,
      weeklyDeliveryRevenue: supplyDemandResult.deliveryRevenue,
      weeklyCommissionPaid: supplyDemandResult.deliveryCommission,
      weeklyPackageCost: supplyDemandResult.deliveryPackageCost,
      weeklyDiscountCost: supplyDemandResult.deliveryDiscountCost,
    };
  }

  const variableCost = calculateVariableCost(revenue, updatedState, supplyDemandResult);
  const fixedCost = calculateWeeklyFixedCost(updatedState);
  // profit 由后续 finalProfit 统一计算（含事件/buff影响）

  // 随机事件（12%概率，约每2个月一次，更接近现实）
  const event = Math.random() > 0.88
    ? gameEvents[Math.floor(Math.random() * gameEvents.length)]
    : null;

  // 交互式事件抽取（v2.9）：上下文感知，每个事件最多触发一次
  // 注入当前周财务数据，使上下文检查（staff_cost_exceeds_revenue / low_margin）用实时值
  const stateForEventRoll = {
    ...updatedState,
    weeklyRevenue: revenue,
    weeklyVariableCost: variableCost,
  };
  const interactiveEvent = rollInteractiveEvent(stateForEventRoll, newWeek);

  let finalRevenue = revenue;
  let eventCostExtra = 0;

  // 事件口碑影响（需要在口碑更新前累积，后续统一 clamp）
  let eventReputationDelta = 0;

  if (event) {
    if (event.impact.type === 'revenue') {
      finalRevenue *= (1 + event.impact.value);
    } else if (event.impact.type === 'cost') {
      eventCostExtra = event.impact.value;
    } else if (event.impact.type === 'reputation') {
      eventReputationDelta = event.impact.value;
    }
  }

  // ============ v3.1: 应用事件 buff 修正到收入/成本（增量式） ============
  let buffCostExtra = 0;
  {
    let buffRevenueMultiplier = 1;
    for (const buff of updatedEventBuffs) {
      switch (buff.type) {
        case 'revenue_multiplier': buffRevenueMultiplier *= (1 + buff.value); break;
        case 'cost_multiplier': buffCostExtra += variableCost * buff.value; break;
        case 'demand_boost': buffRevenueMultiplier *= (1 + buff.value); break;
        case 'supply_reduction': buffRevenueMultiplier *= (1 - buff.value); break;
        // exposure_weekly / reputation_weekly 在后续对应区块处理
        default: break;
      }
    }
    if (buffRevenueMultiplier !== 1) {
      finalRevenue *= buffRevenueMultiplier;
    }
  }

  // 统一利润计算（唯一出口，包含所有成本项）
  let finalProfit = finalRevenue - variableCost - fixedCost
    - weeklyPromotionCostTotal - buffCostExtra - eventCostExtra;

  // ============ 口碑动态更新（v3：置信度驱动 + 饱和抑制） ============
  let avgFulfillment = 1;
  if (supplyDemandResult.productSales.length > 0) {
    avgFulfillment = supplyDemandResult.productSales.reduce(
      (sum, s) => sum + s.fulfillmentRate, 0
    ) / supplyDemandResult.productSales.length;
  }

  const hasSupply = supplyDemandResult.supply.totalSupply > 0;
  const orderSample = Math.max(0, supplyDemandResult.totalSales);
  const confidenceGain = Math.min(0.08, Math.log1p(orderSample) / 90);
  trustConfidence = clamp(
    trustConfidence + confidenceGain - (inactiveWeeks >= 4 ? 0.01 : 0),
    0.08,
    1
  );

  let reputationDelta = 0;
  if (hasSupply) {
    // 履约是口碑核心：高履约稳定慢涨，低履约迅速扣分
    const stockoutEffect = getStockoutEffect(avgFulfillment);
    reputationDelta += stockoutEffect.reputationImpact * (0.55 + trustConfidence * 0.45);

    if (avgFulfillment >= 0.97) reputationDelta += 0.75;
    else if (avgFulfillment >= 0.9) reputationDelta += 0.35;
    else if (avgFulfillment >= 0.8) reputationDelta += 0.1;
    else if (avgFulfillment < 0.55) reputationDelta -= 1.8;
    else if (avgFulfillment < 0.7) reputationDelta -= 0.9;
  }

  // 服务质量影响口碑
  const svcStaff = prevWithEffects.staff.filter(
    s => !s.isOnboarding && ['waiter', 'cleaner', 'manager'].includes(s.assignedTask)
  );
  if (svcStaff.length > 0) {
    const avgSvc = svcStaff.reduce((sum, s) => sum + (s.serviceQuality || 0.8), 0) / svcStaff.length;
    if (avgSvc >= 0.92) reputationDelta += 0.45;
    else if (avgSvc >= 0.85) reputationDelta += 0.2;
    if (avgSvc < 0.6) reputationDelta -= 0.9;
  }

  // 整洁度影响口碑（与服务质量并列）
  const currentCleanliness = prev.cleanliness ?? 60;
  if (currentCleanliness >= 80) reputationDelta += 0.35;
  if (currentCleanliness < 40) reputationDelta -= 0.8;
  if (currentCleanliness < 20) reputationDelta -= 1.8;

  // 置信度调制 + 高分段饱和抑制（避免轻易双100）
  const confidenceFactor = 0.35 + trustConfidence * 0.65;
  const positiveSaturation = newReputation > 80
    ? Math.max(0.2, 1 - (newReputation - 80) / 25)
    : 1;
  let weightedReputationDelta = reputationDelta * confidenceFactor;
  if (weightedReputationDelta > 0) weightedReputationDelta *= positiveSaturation;

  newReputation += weightedReputationDelta;

  // 事件口碑影响也受置信度约束（低样本时不应剧烈波动）
  if (eventReputationDelta !== 0) {
    newReputation += eventReputationDelta * (0.6 + trustConfidence * 0.4);
  }

  // v3.1: 事件 buff 每周口碑修正（不受置信度约束，直接生效）
  for (const buff of updatedEventBuffs) {
    if (buff.type === 'reputation_weekly') newReputation += buff.value;
  }

  // 复购意愿：由口碑增量、履约和环境共同驱动
  repeatIntent += weightedReputationDelta * 1.2;
  repeatIntent += (avgFulfillment - 0.85) * 12;
  repeatIntent += ((currentCleanliness - 60) / 40) * 0.6;
  if (hasSupply && avgFulfillment < 0.7) repeatIntent -= 1.2;
  repeatIntent = clamp(repeatIntent, 20, 95);

  // 开业进度：由动作/履约/真实经营结果驱动，替代“按周自动上升”
  let launchDelta = 0;
  if (prev.activeMarketingActivities.length > 0) launchDelta += 1.2;
  if (updatedDeliveryState.platforms.length > 0) launchDelta += 0.8;
  if (orderSample > 120) launchDelta += 1.2;
  else if (orderSample > 60) launchDelta += 0.6;
  if (hasSupply && avgFulfillment >= 0.92) launchDelta += 1.6;
  if (hasSupply && avgFulfillment < 0.7) launchDelta -= 1.8;
  if (weightedReputationDelta > 0.4) launchDelta += 0.6;
  if (inactiveWeeks >= 3) launchDelta -= Math.min(2.5, (inactiveWeeks - 2) * 0.5);
  launchProgress = clamp(launchProgress + launchDelta, 0, 100);

  // 存量与脉冲的后处理：好经营会沉淀存量，差履约会消耗曝光
  awarenessStock += Math.max(0, (newReputation - 50) / 50) * 0.9;
  awarenessStock += Math.max(0, (repeatIntent - 55) / 45) * 0.8;
  if (hasSupply && avgFulfillment < 0.75) awarenessStock -= 0.9;
  awarenessStock = clamp(awarenessStock, locationFloor, 95);

  if (avgFulfillment >= 0.95 && newReputation >= 65) campaignPulse += 0.8;
  else if (avgFulfillment < 0.7) campaignPulse -= 0.7;
  campaignPulse = clamp(campaignPulse * 0.92, 0, 45);

  // 双指标输出（仍保留 exposure/reputation 作为主界面指标）
  newReputation = clamp(newReputation, DEPENDENCY_CONFIG.reputationFloor, 100);
  newExposure = clamp(
    awarenessStock + campaignPulse + Math.max(0, (repeatIntent - 50) * 0.12),
    locationFloor,
    100
  );

  // v3.1: 事件 buff 每周曝光修正
  for (const buff of updatedEventBuffs) {
    if (buff.type === 'exposure_weekly') newExposure = clamp(newExposure + buff.value, locationFloor, 100);
  }

  // 计算连续盈利周数
  const newConsecutiveProfits = finalProfit > 0 ? (prev.consecutiveProfits || 0) + 1 : 0;

  // ============ 认知系统更新（纯被动增长） ============
  let newCognition = { ...prev.cognition };
  const expSources: { label: string; exp: number }[] = [];

  // 1. 基础时间经验
  let expGained = PASSIVE_EXP_CONFIG.weeklyBaseExp;
  expSources.push({ label: '每周基础', exp: PASSIVE_EXP_CONFIG.weeklyBaseExp });

  // 2. 经营表现经验
  if (finalProfit > 0) {
    expGained += PASSIVE_EXP_CONFIG.profitWeekBonus;
    expSources.push({ label: '盈利奖励', exp: PASSIVE_EXP_CONFIG.profitWeekBonus });

    // 2a. 利润规模奖励：每1000元利润额外经验（盈利越多学得越快）
    const profitScaleExp = Math.min(
      Math.floor(finalProfit / 1000) * PASSIVE_EXP_CONFIG.profitScalePerThousand,
      PASSIVE_EXP_CONFIG.profitScaleMax
    );
    if (profitScaleExp > 0) {
      expGained += profitScaleExp;
      expSources.push({ label: '利润规模', exp: profitScaleExp });
    }

    // 2b. 连续盈利奖励：持续盈利说明经营思路对了
    if (newConsecutiveProfits >= PASSIVE_EXP_CONFIG.consecutiveProfitThreshold) {
      expGained += PASSIVE_EXP_CONFIG.consecutiveProfitBonus;
      expSources.push({ label: '连续盈利', exp: PASSIVE_EXP_CONFIG.consecutiveProfitBonus });
    }
  } else {
    expGained += PASSIVE_EXP_CONFIG.lossWeekExp;
    expSources.push({ label: '亏损经验', exp: PASSIVE_EXP_CONFIG.lossWeekExp });
  }

  // 3. 首次遇到该类型事件才给额外经验
  const newEncounteredEventTypes = [...prev.encounteredEventTypes];
  if (event && !prev.encounteredEventTypes.includes(event.id)) {
    expGained += PASSIVE_EXP_CONFIG.firstTimeEvent;
    expSources.push({ label: '首次事件', exp: PASSIVE_EXP_CONFIG.firstTimeEvent });
    newEncounteredEventTypes.push(event.id);
  }

  // 4. 操作经验（按周结算）
  const operationExp = Math.min(
    (prev.cognition.weeklyOperationCount || 0) * PASSIVE_EXP_CONFIG.operationExpPerAction,
    PASSIVE_EXP_CONFIG.maxOperationExpPerWeek
  );
  expGained += operationExp;
  if (operationExp > 0) {
    expSources.push({ label: '经营操作', exp: operationExp });
  }

  // 5. 周边店铺观察经验
  if (shopEvents.length > 0) {
    expGained += PASSIVE_EXP_CONFIG.nearbyShopObserveExp;
    expSources.push({ label: '商圈观察', exp: PASSIVE_EXP_CONFIG.nearbyShopObserveExp });
  }

  // 5b. 老板周行动经验
  {
    const ba = prev.bossAction;
    const actionConfigs: Record<string, { label: string; expRange: [number, number] }> = {
      work_in_store: { label: '亲自坐镇', expRange: [5, 5] },
      supervise: { label: '巡店督导', expRange: [8, 8] },
      investigate_nearby: { label: '周边考察', expRange: [25, 35] },
      count_traffic: { label: '蹲点数人头', expRange: [15, 20] },
      industry_dinner: { label: '同行饭局', expRange: [30, 40] },
    };
    const cfg = actionConfigs[ba.currentAction];
    if (cfg) {
      const [min, max] = cfg.expRange;
      const bossExp = min === max ? min : min + Math.floor(Math.random() * (max - min + 1));
      expGained += bossExp;
      expSources.push({ label: cfg.label, exp: bossExp });
    }
    // 蹲点连续奖励
    if (ba.currentAction === 'count_traffic') {
      const consecutive = (ba.consecutiveStudyWeeks || 0) + 1;
      if (consecutive >= 2) {
        const bonusExp = 20;
        expGained += bonusExp;
        expSources.push({ label: '蹲点洞察', exp: bonusExp });
      }
    }
  }

  // 6. 踩坑经验（首次触发才给经验，记录到 mistakeHistory 避免重复）
  const newMistakeHistory = [...(prev.cognition.mistakeHistory || [])];
  const detectedMistakes: string[] = [];

  // 快招被骗
  if (prev.selectedBrand?.isQuickFranchise && !newMistakeHistory.some(m => m.type === 'quick_franchise')) {
    detectedMistakes.push('quick_franchise');
  }
  // 库存积压：库存总价值 > 上周收入的 2 倍
  if (prev.inventoryState.totalValue > prev.weeklyRevenue * 2 && prev.weeklyRevenue > 0
      && !newMistakeHistory.some(m => m.type === 'inventory_overstock')) {
    detectedMistakes.push('inventory_overstock');
  }
  // 现金流断裂：现金 < 0
  if (prev.cash < 0 && !newMistakeHistory.some(m => m.type === 'cash_flow_break')) {
    detectedMistakes.push('cash_flow_break');
  }
  // 人员超配：周工资 > 周租金的 2 倍
  const weekSalary = prev.staff.reduce((s, st) => s + st.salary, 0) / 4;
  const weekRent = prev.selectedLocation
    ? (prev.selectedLocation.rentPerSqm * (prev.selectedAddress?.area || prev.storeArea) * (prev.selectedAddress?.rentModifier || 1)) / 4
    : 0;
  if (weekSalary > weekRent * 2 && weekRent > 0 && !newMistakeHistory.some(m => m.type === 'over_staff')) {
    detectedMistakes.push('over_staff');
  }
  // 单品执念：只选了1个产品且已经营3周以上
  if (prev.selectedProducts.length === 1 && prev.currentWeek >= 3
      && !newMistakeHistory.some(m => m.type === 'single_product')) {
    detectedMistakes.push('single_product');
  }

  detectedMistakes.forEach(mistakeId => {
    const mistakeConfig = MISTAKE_EXP_TABLE[mistakeId];
    if (mistakeConfig) {
      expGained += mistakeConfig.exp;
      expSources.push({ label: mistakeConfig.description, exp: mistakeConfig.exp });
      newMistakeHistory.push({
        type: mistakeId,
        exp: mistakeConfig.exp,
        week: newWeek,
        description: mistakeConfig.description,
      });
    }
  });

  // 更新经验和等级（统一入口）
  const prevCognitionLevel = newCognition.level;
  newCognition = applyCognitionExp(newCognition, expGained);
  const cognitionLevelUp = newCognition.level > prevCognitionLevel
    ? { fromLevel: prevCognitionLevel, toLevel: newCognition.level }
    : null;
  // 重置每周操作计数和咨询次数
  newCognition.weeklyOperationCount = 0;
  newCognition.consultYongGeThisWeek = 0;
  newCognition.mistakeHistory = newMistakeHistory;

  // ============ 胜利判定（回本 + 连续盈利） ============
  const newCumulativeProfit = (prev.cumulativeProfit || 0) + finalProfit;
  const meetsReturnRequirement = newCumulativeProfit >= prev.totalInvestment;
  const meetsStreakRequirement = newConsecutiveProfits >= WIN_STREAK;
  const meetsBrandRequirement = newExposure >= WIN_EXPOSURE && newReputation >= WIN_REPUTATION;
  const reachedTimeLimit = prev.totalWeeks > 0 && newWeek >= prev.totalWeeks;
  const isWin = meetsReturnRequirement && meetsStreakRequirement && meetsBrandRequirement;

  // 计算本周结余（补货成本在 return 前扣除）
  const newCash = prevWithEffects.cash + finalProfit;

  // ============ 员工状态更新（完整生命周期） ============
  const updatedStaff: Staff[] = [];
  const quitStaffNames: string[] = [];

  // v2.7: 店长全局效果（士气+2/周，疲劳恢复+5%）
  const hasActiveManager = prevWithEffects.staff.some(
    s => s.assignedTask === 'manager' && !s.isOnboarding && !(s.isTransitioning)
  );
  const managerMoraleBoost = hasActiveManager ? 2 : 0;
  const managerFatigueRecoveryBonus = hasActiveManager ? 0.05 : 0;

  prevWithEffects.staff.forEach(s => {
    // --- 1. 入职适应期检查 ---
    const staff = { ...s };
    if (staff.isOnboarding && newWeek >= staff.onboardingEndsWeek) {
      staff.isOnboarding = false;
    }

    // 适应期员工跳过疲劳/士气/经验/离职计算（但占工资）
    if (staff.isOnboarding) {
      updatedStaff.push(staff);
      return;
    }

    // v2.7: 转岗过渡期检查
    if (staff.isTransitioning && newWeek >= (staff.transitionEndsWeek || 0)) {
      staff.isTransitioning = false;
    }

    // v2.7: 加薪士气加成衰减
    if (staff.salaryRaiseMoraleBoost && staff.salaryRaiseMoraleBoost > 0) {
      staff.salaryRaiseMoraleBoost = Math.max(0, staff.salaryRaiseMoraleBoost - 4);
    }

    // --- 2. 疲劳累积与恢复（基于工时和休息） ---
    const fatigueGain = calculateFatigueGain(staff);
    const lowMoraleBonus = staff.morale < 40 ? 3 : 0;
    // 自然恢复：当前疲劳的15% + 每个休息日恢复3点（店长加成+5%）
    const restDays = 7 - staff.workDaysPerWeek;
    const naturalRecovery = (staff.fatigue * 0.15 + restDays * 3) * (1 + managerFatigueRecoveryBonus);
    const netFatigue = fatigueGain + lowMoraleBonus - naturalRecovery;
    staff.fatigue = Math.max(0, Math.min(100, staff.fatigue + netFatigue));

    // --- 3. 士气变化（含工时影响，缓和死亡螺旋） ---
    const fatigueEffect = getStaffFatigueEffect(staff.fatigue);
    const fatigueMoralePenalty = staff.fatigue > 70 ? -3 : 0;
    // 盈利奖励增强（上限+4），亏损惩罚缓和（重亏-2，轻亏-1）
    const profitMoraleEffect = finalProfit > 0
      ? Math.min(4, Math.ceil(finalProfit / 2000))
      : (finalProfit < -5000 ? -2 : -1);
    const workHoursMoraleEffect = calculateWorkHoursMoraleEffect(staff);
    // 超时工作惩罚：超过 6天×10小时=60小时/周 后额外扣士气
    const weeklyHours = staff.workDaysPerWeek * staff.workHoursPerDay;
    const overtimeMoralePenalty = weeklyHours > 60 ? -5 : 0;
    // v2.7: 加薪士气加成 + 店长士气加成
    const salaryRaiseBoost = staff.salaryRaiseMoraleBoost || 0;
    // 基础衰减从 -1 降为 -0.5
    staff.morale = Math.max(0, Math.min(100,
      staff.morale - 0.5 + fatigueMoralePenalty + profitMoraleEffect + workHoursMoraleEffect + overtimeMoralePenalty + managerMoraleBoost + salaryRaiseBoost
    ));

    // --- 4. 重算实际效率和服务质量 ---
    const moraleEffect = getMoraleEffect(staff.morale);
    // 超时工作效率惩罚：超过60小时/周，效率-10%
    const overtimeEfficiencyPenalty = weeklyHours > 60 ? 0.9 : 1.0;
    // v2.7: 转岗过渡期效率惩罚
    const transitionPenalty = staff.isTransitioning ? 0.5 : 1.0;
    staff.efficiency = staff.baseEfficiency * fatigueEffect.efficiencyPenalty * moraleEffect.efficiencyMod * overtimeEfficiencyPenalty * transitionPenalty;
    staff.serviceQuality = staff.baseServiceQuality * fatigueEffect.servicePenalty * moraleEffect.serviceMod * overtimeEfficiencyPenalty * transitionPenalty;

    // --- 5. 离职检查（含1周预警缓冲） ---
    // 超时工作离职概率翻倍
    const effectiveQuitRisk = weeklyHours > 60 ? fatigueEffect.quitRisk * 2 : fatigueEffect.quitRisk;
    if (effectiveQuitRisk > 0 && Math.random() < effectiveQuitRisk) {
      if (staff.wantsToQuit) {
        // 已标记过想辞职，本周真正离职
        quitStaffNames.push(staff.name);
        return; // 不加入 updatedStaff，即离职
      } else {
        // 首次触发，标记想辞职（给玩家1周反应时间）
        staff.wantsToQuit = true;
      }
    } else {
      // 本周未触发离职风险，清除预警状态
      staff.wantsToQuit = false;
    }

    // --- 6. 岗位经验成长（确定性系统） ---
    const weeklyExp = calculateWeeklyExp(staff);
    staff.taskExp += weeklyExp;
    const expRequired = getSkillUpgradeRequirement(staff.skillLevel);
    if (staff.taskExp >= expRequired) {
      const maxSkill = staffTypes.find(st => st.id === staff.typeId)?.maxSkillLevel || 5;
      if (staff.skillLevel < maxSkill) {
        staff.taskExp -= expRequired;
        staff.skillLevel += 1;
        staff.baseEfficiency *= 1.03;
        staff.baseServiceQuality *= 1.02;
      }
    }

    // --- 7. 产品熟练度成长（v2.8） ---
    if (!staff.isOnboarding) {
      const proficiency = { ...(staff.productProficiency || {}) };
      const weeklyHours = staff.workDaysPerWeek * staff.workHoursPerDay;
      const growthBase = Math.round(3 * (weeklyHours / 48) * staff.efficiency);

      if (staff.focusProductId) {
        // 专注产品每周 +growthBase 点
        const current = proficiency[staff.focusProductId] || 0;
        proficiency[staff.focusProductId] = Math.min(100, current + growthBase);
      }

      // 非专注产品每周 -1 点（缓慢遗忘）
      for (const pid of Object.keys(proficiency)) {
        if (pid !== staff.focusProductId && proficiency[pid] > 0) {
          proficiency[pid] = Math.max(0, proficiency[pid] - 1);
        }
      }

      staff.productProficiency = proficiency;
    }

    updatedStaff.push(staff);
  });

  // ============ 整洁度更新 ============
  // v2.7: 重新设计清洁度机制，服务员可兼职清洁，小店不需要专职清洁工
  const CLEANER_RATE = 8.0;           // 专职清洁恢复率
  const WAITER_CLEAN_RATE = 2.5;      // 服务员清洁贡献
  const WAITER_BUSY_THRESHOLD = 0.7;  // 忙碌阈值
  const WAITER_BUSY_PENALTY = 0.5;    // 忙碌惩罚系数
  const BASE_DIRT = 2.0;              // 基础脏度
  const AREA_DIRT_FACTOR = 50;        // 面积因子（每50㎡+1点）
  const SALES_DIRT_FACTOR = 300;      // 销售因子（每300份+1点）

  const totalSalesForDirt = supplyDemandResult.productSales.reduce(
    (sum, ps) => sum + ps.actualSales, 0
  );
  const storeArea = prev.storeArea || 30;
  const dirtRate = BASE_DIRT + storeArea / AREA_DIRT_FACTOR + totalSalesForDirt / SALES_DIRT_FACTOR;

  // 估算服务员忙碌率（基于需求/供给比）
  const demandSupplyRatioForClean = supplyDemandResult.supply.totalSupply > 0
    ? supplyDemandResult.demand.totalDemand / supplyDemandResult.supply.totalSupply
    : 0;
  const waiterBusyRate = Math.min(1, 0.3 + Math.min(1, demandSupplyRatioForClean) * 0.6);

  let cleanerRecovery = 0;
  updatedStaff.forEach(s => {
    if (s.isOnboarding) return;
    const hours = s.workDaysPerWeek * s.workHoursPerDay;
    const workRatio = hours / 48;

    if (s.assignedTask === 'cleaner') {
      // 专职清洁工：满效率清洁
      cleanerRecovery += s.efficiency * workRatio * CLEANER_RATE;
    } else if (s.assignedTask === 'waiter') {
      // 服务员兼职清洁：忙碌时效率减半
      let contribution = s.efficiency * workRatio * WAITER_CLEAN_RATE;
      if (waiterBusyRate > WAITER_BUSY_THRESHOLD) {
        contribution *= WAITER_BUSY_PENALTY;
      }
      cleanerRecovery += contribution;
    }
    // 后厨、营销不参与清洁
  });
  const newCleanliness = Math.max(0, Math.min(100, (prev.cleanliness ?? 60) - dirtRate + cleanerRecovery));

  // ============ 营销活动状态更新 ============
  const updatedMarketingActivities = prev.activeMarketingActivities
    .map(activity => ({
      ...activity,
      activeWeeks: activity.activeWeeks + 1,
    }))
    .filter(activity => {
      const config = getActivityConfig(activity.id);
      if (config?.type === 'one_time' && config.maxDuration) {
        return activity.activeWeeks < config.maxDuration;
      }
      return true;
    });

  // ============ 库存完整周期：损耗 → 销售扣减 → 自动补货 ============
  let weeklyWasteCost = 0;
  let weeklyHoldingCost = 0;
  let weeklyRestockCost = 0;

  const updatedInventoryItems = prev.inventoryState.items.map(item => {
    const updated = { ...item };

    // Step 1: 损耗扣减（按存储类型）
    const wasteRate = getWasteRate(item.storageType);
    const wasteQty = Math.floor(item.quantity * wasteRate);
    updated.quantity = Math.max(0, updated.quantity - wasteQty);
    updated.lastWeekWaste = wasteQty;
    weeklyWasteCost += wasteQty * item.unitCost;

    // Step 2: 持有成本
    const holdingValue = updated.quantity * item.unitCost;
    weeklyHoldingCost += calculateHoldingCost(holdingValue, item.storageType);

    // Step 3: 销售扣减（根据供需模型实际销量）
    const sale = supplyDemandResult.productSales.find(
      s => s.productId === item.productId
    );
    const actualSales = sale?.actualSales || 0;
    updated.quantity = Math.max(0, updated.quantity - actualSales);
    updated.lastWeekSales = actualSales;

    // Step 4: 自动补货（已移除手动模式，遗留 manual 自动迁移为 auto_standard）
    if (updated.restockStrategy === 'manual') {
      updated.restockStrategy = 'auto_standard';
    }
    const restockQty = calculateRestockQuantity(
      updated.quantity, actualSales, updated.restockStrategy, prev.cognition.level
    );
    if (restockQty > 0) {
      const restockCost = restockQty * item.unitCost;
      updated.quantity += restockQty;
      updated.lastRestockQuantity = restockQty;
      updated.lastRestockCost = restockCost;
      weeklyRestockCost += restockCost;
    } else {
      updated.lastRestockQuantity = 0;
      updated.lastRestockCost = 0;
    }

    return updated;
  });

  const updatedInventoryValue = updatedInventoryItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost, 0
  );

  let finalCash = newCash - weeklyRestockCost;

  // Fix 4 & 5: 老板行动费用提前计算，纳入利润和破产判定
  const bossActionConfig = getBossActionConfig(prev.bossAction.currentAction);
  const bossActionCost = bossActionConfig?.cost ?? 0;
  finalCash -= bossActionCost;
  finalProfit -= bossActionCost;

  // 破产检查：资金低于最低运营线即触发破产
  const finalIsBankrupt = finalCash < MIN_OPERATING_CASH;

  // ============ 计算员工忙碌度统计 ============
  // 使用包含外卖的总需求，员工出餐同时服务堂食和外卖
  const totalDemandIncludingDelivery = supplyDemandResult.productSales.reduce(
    (sum, ps) => sum + ps.demand, 0
  );
  const demandSupplyRatio = supplyDemandResult.supply.totalSupply > 0
    ? totalDemandIncludingDelivery / supplyDemandResult.supply.totalSupply
    : 0;
  const staffWorkStats = updatedStaff.map(staff => {
    const totalHours = staff.workDaysPerWeek * staff.workHoursPerDay;
    const taskDef = getTaskDefinition(staff.assignedTask);
    const taskName = taskDef?.name || '未分配';
    let busyRate: number;
    if (staff.isOnboarding) {
      busyRate = 0.15;
    } else if ((taskDef?.productionMultiplier || 0) > 0.5) {
      busyRate = Math.min(1, demandSupplyRatio * 0.95);
    } else if (staff.assignedTask === 'marketer') {
      // 曝光越低越忙（有更多工作要做）
      busyRate = Math.max(0.3, 1.0 - newExposure / 150);
    } else if (staff.assignedTask === 'cleaner') {
      // 客流越大越忙
      busyRate = 0.4 + Math.min(0.5, demandSupplyRatio * 0.3);
    } else {
      busyRate = Math.min(1, 0.3 + Math.min(1, demandSupplyRatio) * 0.6);
    }

    // v2.7: 绩效计算
    const workRatio = totalHours / 48;
    let weeklyContribution = 0;
    let weeklyRevenue = 0;
    if (staff.isOnboarding || staff.isTransitioning) {
      weeklyContribution = 0;
      weeklyRevenue = 0;
    } else if ((taskDef?.productionMultiplier || 0) > 0.5) {
      // 产能岗：贡献 = 忙碌时间 × 效率 × 产能系数
      weeklyContribution = busyRate * staff.efficiency * (taskDef?.productionMultiplier || 0) * workRatio;
      // 创收估算：按平均客单价
      const avgPrice = supplyDemandResult.productSales.length > 0
        ? supplyDemandResult.totalRevenue / Math.max(1, supplyDemandResult.totalSales) : 0;
      weeklyRevenue = weeklyContribution * avgPrice * 10; // 归一化
    } else if (staff.assignedTask === 'marketer') {
      weeklyContribution = staff.efficiency * workRatio * (taskDef?.exposureBoostRate || 2.5);
      weeklyRevenue = 0; // 营销员不直接创收
    } else if (staff.assignedTask === 'cleaner') {
      weeklyContribution = staff.efficiency * workRatio * (taskDef?.cleanlinessRate || 8.0);
      weeklyRevenue = 0;
    } else {
      // 服务岗/店长
      weeklyContribution = staff.serviceQuality * busyRate * workRatio;
      weeklyRevenue = 0;
    }
    const weeklySalaryCost = staff.salary / 4;
    const costEfficiency = weeklySalaryCost > 0 ? weeklyContribution / weeklySalaryCost * 100 : 0;

    return {
      staffId: staff.id,
      name: staff.name,
      task: staff.assignedTask,
      taskName,
      totalHours,
      busyHours: Math.round(totalHours * busyRate * 10) / 10,
      busyRate,
      efficiency: staff.efficiency,
      isOnboarding: staff.isOnboarding,
      weeklyContribution: Math.round(weeklyContribution * 100) / 100,
      weeklyRevenue: Math.round(weeklyRevenue),
      costEfficiency: Math.round(costEfficiency * 10) / 10,
    };
  });

  // ============ 经营健康诊断 ============
  // NOTE: 此处内联构造 CurrentStats 而非复用 gameQuery.calculateCurrentStats，
  // 因为 weeklyTick 执行时 state 尚未落盘，gameQuery 依赖的是上一轮 state。
  // 这里使用本轮刚计算出的 finalRevenue/finalProfit 等值，确保诊断基于最新数据。
  const totalFixedAndExtra = fixedCost + weeklyPromotionCostTotal + buffCostExtra + eventCostExtra;
  const tempStats = {
    revenue: finalRevenue,
    variableCost,
    fixedCost: totalFixedAndExtra,
    fixedCostBreakdown: { ...calculateFixedCostBreakdown(updatedState), promotion: weeklyPromotionCostTotal, total: totalFixedAndExtra },
    profit: finalProfit,
    margin: finalRevenue > 0 ? ((finalRevenue - variableCost) / finalRevenue) * 100 : 0,
    breakEvenPoint: finalRevenue > variableCost
      ? totalFixedAndExtra / ((finalRevenue - variableCost) / finalRevenue)
      : Infinity,
  };
  const healthAlerts = diagnoseHealth(
    { ...updatedState, currentWeek: newWeek, profitHistory: [...prev.profitHistory, finalProfit] },
    tempStats,
    supplyDemandResult,
  );

  // ============ 生成每周总结数据 ============
  const weeklySummary: WeeklySummary = {
    week: newWeek,
    revenue: finalRevenue,
    variableCost,
    fixedCost: totalFixedAndExtra,
    profit: finalProfit,
    cumulativeProfit: newCumulativeProfit,
    totalInvestment: prev.totalInvestment,
    cashRemaining: finalCash,
    totalDemand: totalDemandIncludingDelivery,
    totalSupply: supplyDemandResult.supply.totalSupply,
    fulfillmentRate: avgFulfillment,
    productSales: supplyDemandResult.productSales.map(s => ({
      productId: s.productId,
      name: s.productName,
      sales: s.actualSales,
      revenue: s.revenue,
    })),
    staffCount: updatedStaff.length,
    avgMorale: updatedStaff.length > 0
      ? updatedStaff.reduce((s, st) => s + st.morale, 0) / updatedStaff.length
      : 0,
    avgFatigue: updatedStaff.length > 0
      ? updatedStaff.reduce((s, st) => s + st.fatigue, 0) / updatedStaff.length
      : 0,
    quitStaffNames,
    cognitionLevel: newCognition.level,
    expGained,
    expSources,
    event,
    interactiveEventResponse: prev.lastInteractiveEventResponse,
    consecutiveProfits: newConsecutiveProfits,
    returnOnInvestmentProgress: prev.totalInvestment > 0
      ? (newCumulativeProfit / prev.totalInvestment) * 100
      : 0,
    healthAlerts,
    cleanlinessChange: newCleanliness - (prev.cleanliness ?? 60),
    delayedEffectNarratives,
    activeBuffSummaries,
    staffWorkStats,
    cognitionLevelUp,
    restockCost: weeklyRestockCost,
    bossActionCost,
  };

  const gameOverReason: GameState['gameOverReason'] =
    finalIsBankrupt ? 'bankrupt'
      : isWin ? 'win'
        : reachedTimeLimit ? 'time_limit'
          : null;

  // ============ 老板周行动：执行本周行动 + 状态更新 ============
  const prevBossAction = prev.bossAction;
  const newBossAction = { ...prevBossAction };

  // （费用已在前面提前扣除，纳入利润和破产判定）

  // 周边考察：生成考察结果
  if (prevBossAction.currentAction === 'investigate_nearby') {
    const openShops = prev.nearbyShops.filter(s => !s.isClosing && !s.closedWeek);
    if (openShops.length > 0) {
      // 优先使用玩家选定的店铺，否则随机
      const targetShop = prevBossAction.targetShopId
        ? openShops.find(s => s.id === prevBossAction.targetShopId) || openShops[Math.floor(Math.random() * openShops.length)]
        : openShops[Math.floor(Math.random() * openShops.length)];

      const revealed = newBossAction.revealedShopInfo[targetShop.id] || [];
      const unrevealed = INVESTIGATION_DIMENSIONS
        .map(d => d.id)
        .filter(d => !revealed.includes(d));

      const dimCount = prev.cognition.level >= 3 ? Math.min(2, unrevealed.length || 1) : 1;
      const dims: InvestigationDimension[] = [];
      const dimPool = unrevealed.length > 0 ? [...unrevealed] : INVESTIGATION_DIMENSIONS.map(d => d.id);
      for (let i = 0; i < dimCount && dimPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * dimPool.length);
        dims.push(dimPool[idx]);
        dimPool.splice(idx, 1);
      }

      const results = dims.map(dim => {
        const { displayValue, isAccurate, cogWarning } = generateInvestigationResult(
          targetShop, dim, prev.cognition.level, prev.currentWeek
        );
        return {
          shopId: targetShop.id,
          shopName: targetShop.name,
          dimension: dim,
          displayValue,
          isAccurate,
          cogWarning,
          week: prev.currentWeek,
        };
      });

      newBossAction.revealedShopInfo = {
        ...newBossAction.revealedShopInfo,
        [targetShop.id]: [...revealed, ...dims.filter(d => !revealed.includes(d))],
      };
      newBossAction.investigationHistory = [...newBossAction.investigationHistory, ...results];
    }
  }

  // 蹲点数人头：生成客流观察结果
  if (prevBossAction.currentAction === 'count_traffic') {
    // 使用更新后的消费者环数据（含季节波动）
    const ringsForTraffic = updatedConsumerRings.length > 0 ? updatedConsumerRings : prev.consumerRings;
    let handled = false;

    if (prevBossAction.targetShopId) {
      // 蹲点观察指定店铺的客流
      const targetShop = prev.nearbyShops.find(s => s.id === prevBossAction.targetShopId);
      if (targetShop) {
        // 基于店铺曝光度和所在环的客流估算
        const shopTraffic = Math.round(targetShop.exposure * 1.2 + 15);
        const dailyTraffic = Math.round(shopTraffic / 7);
        const { displayValue, isAccurate, cogWarning } = generateTrafficCountResult(
          Math.max(1, dailyTraffic), prev.cognition.level
        );
        newBossAction.investigationHistory = [
          ...newBossAction.investigationHistory,
          {
            shopId: targetShop.id,
            shopName: targetShop.name,
            dimension: 'traffic' as InvestigationDimension,
            displayValue,
            isAccurate,
            cogWarning,
            week: prev.currentWeek,
          },
        ];
        handled = true;
      }
    }

    if (!handled) {
      // 蹲点观察本店周边总客流
      const totalWeeklyTraffic = ringsForTraffic.reduce((sum, ring) => {
        const ringTotal = Object.values(ring.consumers).reduce((s, v) => s + v, 0);
        return sum + ringTotal * ring.baseConversion;
      }, 0);
      // 转换为日均客流
      const dailyTraffic = Math.round(totalWeeklyTraffic / 7);
      const { displayValue, isAccurate, cogWarning } = generateTrafficCountResult(
        Math.max(1, dailyTraffic), prev.cognition.level
      );
      newBossAction.investigationHistory = [
        ...newBossAction.investigationHistory,
        {
          shopId: '_self',
          shopName: '本店周边',
          dimension: 'traffic' as InvestigationDimension,
          displayValue,
          isAccurate,
          cogWarning,
          week: prev.currentWeek,
        },
      ];
    }
  }

  // 同行饭局：生成洞察
  if (prevBossAction.currentAction === 'industry_dinner') {
    // 获取玩家主营品类用于模板替换
    const playerCategory = prev.selectedProducts.length > 0
      ? prev.selectedProducts[0].category
      : undefined;
    const { content, isAccurate, cogWarning, buff } = generateDinnerInsight(
      prev.cognition.level, prev.currentWeek, playerCategory
    );
    const insight: typeof newBossAction.insightHistory[0] = {
      content, isAccurate, cogWarning, week: prev.currentWeek,
    };
    if (buff) {
      insight.buff = { type: buff.type, value: buff.value, remainingWeeks: buff.weeks, source: buff.source };
      newBossAction.activeBuffs = [
        ...newBossAction.activeBuffs,
        { type: buff.type, value: buff.value, remainingWeeks: buff.weeks, source: buff.source },
      ];
    }
    newBossAction.insightHistory = [...newBossAction.insightHistory, insight];
  }

  // 2. buff 衰减：每周 -1，移除过期 buff
  newBossAction.activeBuffs = newBossAction.activeBuffs
    .map(b => ({ ...b, remainingWeeks: b.remainingWeeks - 1 }))
    .filter(b => b.remainingWeeks > 0);
  // 蹲点连续周数追踪
  newBossAction.consecutiveStudyWeeks = prevBossAction.currentAction === 'count_traffic'
    ? (prevBossAction.consecutiveStudyWeeks || 0) + 1
    : 0;

  // Fix 6: 历史记录上限，防止无限增长（保留最近30条）
  const HISTORY_CAP = 30;
  if (newBossAction.investigationHistory.length > HISTORY_CAP) {
    newBossAction.investigationHistory = newBossAction.investigationHistory.slice(-HISTORY_CAP);
  }
  if (newBossAction.insightHistory.length > HISTORY_CAP) {
    newBossAction.insightHistory = newBossAction.insightHistory.slice(-HISTORY_CAP);
  }

  // 3. 重置为默认行动（巡店督导）
  newBossAction.currentAction = 'supervise';
  newBossAction.workRole = undefined;
  newBossAction.targetShopId = undefined;

  // 巡店督导效果：全员士气+3
  let finalStaff = updatedStaff;
  if (prevBossAction.currentAction === 'supervise') {
    finalStaff = updatedStaff.map(s => ({
      ...s,
      morale: Math.min(100, s.morale + 3),
    }));
  }

  const newState: GameState = {
    ...updatedState,
    currentWeek: newWeek,
    consecutiveProfits: newConsecutiveProfits,
    cash: finalCash,
    weeklyRevenue: finalRevenue,
    weeklyVariableCost: variableCost,
    weeklyFixedCost: fixedCost,
    profitHistory: [...prev.profitHistory, finalProfit],
    revenueHistory: [...prev.revenueHistory, finalRevenue],
    cashHistory: [...prev.cashHistory, finalCash],
    gamePhase: (finalIsBankrupt || isWin || reachedTimeLimit) ? 'ended' : 'operating',
    // 认知系统状态
    cognition: newCognition,
    // 老板周行动
    bossAction: newBossAction,
    staff: finalStaff,
    weeklyProductChanges: 0,
    // 不活跃计数器递增（主动操作时由 gameActions 重置为0）
    weeksSinceLastAction: (prev.weeksSinceLastAction || 0) + 1,
    // v2.7: 士气管理操作计数器递增（士气操作时由 gameActions 重置为0）
    weeksSinceLastMoraleAction: (prev.weeksSinceLastMoraleAction || 0) + 1,
    activeMarketingActivities: updatedMarketingActivities,
    // 口碑与曝光度（含经营表现影响）
    reputation: newReputation,
    exposure: newExposure,
    growthSystem: {
      launchProgress,
      awarenessFactor: mapLaunchProgressToAwareness(launchProgress),
      awarenessStock,
      campaignPulse,
      trustConfidence,
      repeatIntent,
    },
    // 整洁度
    cleanliness: newCleanliness,
    // 库存完整状态
    inventoryState: {
      items: updatedInventoryItems,
      totalValue: updatedInventoryValue,
      weeklyHoldingCost: weeklyHoldingCost,
      weeklyWasteCost: weeklyWasteCost,
      weeklyRestockCost: weeklyRestockCost,
    },
    // 外卖平台状态
    deliveryState: updatedDeliveryState,
    hasDelivery: updatedDeliveryState.platforms.length > 0,
    // 供需满足率
    lastWeekFulfillment: avgFulfillment,
    // 事件记录
    lastWeekEvent: event,
    encounteredEventTypes: newEncounteredEventTypes,
    // 交互式事件（v2.9 + v3.1 链式事件优先）
    pendingInteractiveEvent: chainTriggeredEvent || interactiveEvent,
    interactiveEventHistory: (() => {
      const hist = [...prev.interactiveEventHistory];
      if (chainTriggeredEvent) hist.push(chainTriggeredEvent.id);
      else if (interactiveEvent) hist.push(interactiveEvent.id);
      return hist;
    })(),
    lastInteractiveEventResponse: null, // 清空上周响应，等玩家本周响应后填入
    // 每周总结与回本追踪
    weeklySummary,
    cumulativeProfit: newCumulativeProfit,
    gameOverReason,
  };

  return { state: newState, summary: weeklySummary };
}
