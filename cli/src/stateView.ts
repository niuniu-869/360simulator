/**
 * stateView.ts — GameState → AgentGameView 序列化
 *
 * 将完整 GameState 转换为 Agent 友好的 JSON 摘要。
 *
 * 设计原则：1:1 复刻 UI 玩家可见的核心信息，避免 agent 因信息缺失
 * 而做出与 UI 玩家不同的决策。
 */

import type { GameState, WeeklySummary } from "@/types/game";

// ============ 视图类型定义 ============

export interface AgentEventOptionView {
  id: string;
  text: string;
  yonggeQuote?: string;
  narrativeHint?: string;
}

export interface AgentPendingEventView {
  id: string;
  name: string;
  description: string;
  category: string;
  options: AgentEventOptionView[];
  isNotification: boolean; // 纯通知型事件无选项
}

export interface AgentLastWeekEventView {
  id: string;
  title: string;
  description: string;
  impact: { type: string; value: number };
}

export interface AgentInventoryItemView {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
  restockStrategy: string;
  lastWeekSales: number;
  lastWeekWaste: number;
}

export interface AgentDeliveryPlatformView {
  platformId: string;
  promotionTier: string;
  discountTier: string;
  deliveryPricing: string;
  packagingTier: string;
  weeklyCost: number;
  exposureScore: number;
  activeWeeks: number;
}

export interface AgentNearbyShopView {
  id: string;
  name: string;
  icon: string;
  category: string;
  ring: string;
  exposure: number;
  hasDelivery: boolean;
  isClosing: boolean;
}

export interface AgentNearbyShopEventView {
  type: string;
  shopName: string;
  description: string;
  week: number;
}

export interface AgentWeeklySummaryView {
  week: number;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  profit: number;
  cumulativeProfit: number;
  cashRemaining: number;
  totalDemand: number;
  totalSupply: number;
  fulfillmentRate: number;
  productSales: Array<{
    productId: string;
    name: string;
    sales: number;
    revenue: number;
  }>;
  staffCount: number;
  avgMorale: number;
  avgFatigue: number;
  quitStaffNames: string[];
  cognitionLevel: number;
  expGained: number;
  expSources: Array<{ label: string; exp: number }>;
  event: AgentLastWeekEventView | null;
  interactiveEventResponse: {
    eventId: string;
    optionId: string;
    week: number;
  } | null;
  consecutiveProfits: number;
  returnOnInvestmentProgress: number;
  cognitionLevelUp: { fromLevel: number; toLevel: number } | null;
  cleanlinessChange: number;
  delayedEffectNarratives: string[];
  activeBuffSummaries: string[];
  restockCost: number;
  bossActionCost: number;
  staffWorkStats: Array<{
    staffId: string;
    name: string;
    task: string;
    taskName: string;
    totalHours: number;
    busyHours: number;
    busyRate: number;
    efficiency: number;
    weeklyContribution: number;
    weeklyRevenue: number;
    costEfficiency: number;
  }>;
  healthAlerts: Array<{
    id: string;
    severity: string;
    title: string;
    message: string;
    suggestion: string;
    category: string;
  }>;
}

export interface AgentGameView {
  phase: string;
  gameOverReason?: string | null;
  week: number;
  totalWeeks: number;
  season: string | null;
  startMonth: number;
  cash: number;
  totalInvestment: number;
  cumulativeProfit: number;
  consecutiveProfits: number;
  consecutiveLossWeeks: number;
  crisisMode: "none" | "cash_low" | "rep_crisis" | "bankruptcy_warning";

  // 上一周经营数据
  weeklyRevenue: number;
  weeklyVariableCost: number;
  weeklyFixedCost: number;

  // 历史趋势（最近 8 周）
  profitHistory: number[];
  revenueHistory: number[];
  cashHistory: number[];

  // 配置摘要
  brand: { id: string; name: string; type: string } | null;
  location: { id: string; name: string; type: string } | null;
  address: { id: string; name: string; area: number } | null;
  storeArea: number;
  decoration: { id: string; name: string; level: number } | null;
  products: Array<{
    id: string;
    name: string;
    price: number;
    basePrice: number;
    referencePrice: number;
    category: string;
  }>;
  staff: Array<{
    id: string;
    name: string;
    typeId: string;
    salary: number;
    task: string;
    morale: number;
    fatigue: number;
    workDaysPerWeek: number;
    workHoursPerDay: number;
    skillLevel: number;
    wantsToQuit: boolean;
    focusProductId: string | null;
  }>;

  // 双指标 + 整洁度 + 认知
  exposure: number;
  reputation: number;
  cleanliness: number;
  cognition: {
    level: number;
    exp: number;
    expToNext: number;
    totalExp: number;
    consultYongGeThisWeek: number;
  };

  // 营销
  activeMarketing: Array<{
    id: string;
    name: string;
    activeWeeks: number;
    weeklyCost: number;
  }>;

  // 外卖
  hasDelivery: boolean;
  supplyPriority: string;
  delivery: {
    platforms: AgentDeliveryPlatformView[];
    weeklyOrders: number;
    weeklyRevenue: number;
    weeklyCommission: number;
    weeklyPackageCost: number;
    weeklyDiscountCost: number;
    platformRating: number;
  };

  // 老板行动
  bossAction: {
    currentAction: string;
    workRole: string | null;
    targetShopId: string | null;
    activeBuffsCount: number;
    consecutiveStudyWeeks: number;
  };

  // 周边店铺
  nearbyShops: AgentNearbyShopView[];
  nearbyShopEvents: AgentNearbyShopEventView[];

  // 库存摘要
  inventory: AgentInventoryItemView[];

  // 事件 buff
  activeEventBuffs: Array<{
    type: string;
    value: number;
    durationWeeks: number;
    source: string;
  }>;
  pendingDelayedEffectsCount: number;

  // 待响应交互事件（关键 — UI 玩家会看到弹窗）
  pendingInteractiveEvent: AgentPendingEventView | null;

  // 上周被动事件（UI 弹窗展示）
  lastWeekEvent: AgentLastWeekEventView | null;

  // 上周总结（UI 弹窗展示，含完整周报数据）
  weeklySummary: AgentWeeklySummaryView | null;
}

// ============ 序列化辅助 ============

/** 取数组最后 N 项 */
function tail<T>(arr: T[] | undefined, n: number): T[] {
  if (!arr || arr.length === 0) return [];
  return arr.slice(-n);
}

/** WeeklySummary → AgentWeeklySummaryView */
function serializeWeeklySummary(
  s: WeeklySummary | null,
): AgentWeeklySummaryView | null {
  if (!s) return null;
  return {
    week: s.week,
    revenue: Math.round(s.revenue),
    variableCost: Math.round(s.variableCost),
    fixedCost: Math.round(s.fixedCost),
    profit: Math.round(s.profit),
    cumulativeProfit: Math.round(s.cumulativeProfit),
    cashRemaining: Math.round(s.cashRemaining),
    totalDemand: s.totalDemand,
    totalSupply: s.totalSupply,
    fulfillmentRate: Math.round(s.fulfillmentRate * 1000) / 1000,
    productSales: (s.productSales || []).map((p) => ({
      productId: p.productId,
      name: p.name,
      sales: p.sales,
      revenue: Math.round(p.revenue),
    })),
    staffCount: s.staffCount,
    avgMorale: Math.round(s.avgMorale * 10) / 10,
    avgFatigue: Math.round(s.avgFatigue * 10) / 10,
    quitStaffNames: s.quitStaffNames || [],
    cognitionLevel: s.cognitionLevel,
    expGained: s.expGained,
    expSources: s.expSources || [],
    event: s.event
      ? {
          id: s.event.id,
          title: s.event.title,
          description: s.event.description,
          impact: s.event.impact,
        }
      : null,
    interactiveEventResponse: s.interactiveEventResponse
      ? {
          eventId: s.interactiveEventResponse.eventId,
          optionId: s.interactiveEventResponse.optionId,
          week: s.interactiveEventResponse.week,
        }
      : null,
    consecutiveProfits: s.consecutiveProfits,
    returnOnInvestmentProgress:
      Math.round(s.returnOnInvestmentProgress * 100) / 100,
    cognitionLevelUp: s.cognitionLevelUp
      ? {
          fromLevel: s.cognitionLevelUp.fromLevel,
          toLevel: s.cognitionLevelUp.toLevel,
        }
      : null,
    cleanlinessChange: Math.round(s.cleanlinessChange * 10) / 10,
    delayedEffectNarratives: s.delayedEffectNarratives || [],
    activeBuffSummaries: s.activeBuffSummaries || [],
    restockCost: Math.round(s.restockCost ?? 0),
    bossActionCost: Math.round(s.bossActionCost ?? 0),
    staffWorkStats: (s.staffWorkStats || []).map((w) => ({
      staffId: w.staffId,
      name: w.name,
      task: w.task,
      taskName: w.taskName,
      totalHours: Math.round(w.totalHours * 10) / 10,
      busyHours: Math.round(w.busyHours * 10) / 10,
      busyRate: Math.round(w.busyRate * 100) / 100,
      efficiency: Math.round(w.efficiency * 100) / 100,
      weeklyContribution: Math.round(w.weeklyContribution * 100) / 100,
      weeklyRevenue: Math.round(w.weeklyRevenue),
      costEfficiency: Math.round(w.costEfficiency * 100) / 100,
    })),
    healthAlerts: (s.healthAlerts || []).map((a) => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      message: a.message,
      suggestion: a.suggestion,
      category: a.category,
    })),
  };
}

/** 将 GameState 序列化为 Agent 友好的视图 */
export function serializeState(state: GameState): AgentGameView {
  const pendingEvent = state.pendingInteractiveEvent;
  const pendingDescription =
    typeof pendingEvent?.description === "function"
      ? pendingEvent.description(state)
      : (pendingEvent?.description ?? "");

  return {
    phase: state.gamePhase,
    gameOverReason: state.gameOverReason ?? null,
    week: state.currentWeek,
    totalWeeks: state.totalWeeks,
    season: state.currentSeason ?? null,
    startMonth: state.startMonth,
    cash: Math.round(state.cash),
    totalInvestment: Math.round(state.totalInvestment),
    cumulativeProfit: Math.round(state.cumulativeProfit || 0),
    consecutiveProfits: state.consecutiveProfits || 0,
    consecutiveLossWeeks: state.consecutiveLossWeeks || 0,
    crisisMode: state.crisisMode ?? "none",

    weeklyRevenue: Math.round(state.weeklyRevenue ?? 0),
    weeklyVariableCost: Math.round(state.weeklyVariableCost ?? 0),
    weeklyFixedCost: Math.round(state.weeklyFixedCost ?? 0),

    profitHistory: tail(state.profitHistory, 8).map((v) => Math.round(v)),
    revenueHistory: tail(state.revenueHistory, 8).map((v) => Math.round(v)),
    cashHistory: tail(state.cashHistory, 8).map((v) => Math.round(v)),

    brand: state.selectedBrand
      ? {
          id: state.selectedBrand.id,
          name: state.selectedBrand.name,
          type: state.selectedBrand.type,
        }
      : null,
    location: state.selectedLocation
      ? {
          id: state.selectedLocation.id,
          name: state.selectedLocation.name,
          type: state.selectedLocation.type,
        }
      : null,
    address: state.selectedAddress
      ? {
          id: state.selectedAddress.id,
          name: state.selectedAddress.name,
          area: state.selectedAddress.area,
        }
      : null,
    storeArea: state.storeArea,
    decoration: state.selectedDecoration
      ? {
          id: state.selectedDecoration.id,
          name: state.selectedDecoration.name,
          level: state.selectedDecoration.level,
        }
      : null,

    products: state.selectedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: state.productPrices[p.id] ?? p.basePrice,
      basePrice: p.basePrice,
      referencePrice: p.referencePrice,
      category: p.category,
    })),
    staff: state.staff.map((s) => ({
      id: s.id,
      name: s.name,
      typeId: s.typeId,
      salary: s.salary,
      task: s.assignedTask,
      morale: Math.round(s.morale * 10) / 10,
      fatigue: Math.round((s.fatigue ?? 0) * 10) / 10,
      workDaysPerWeek: s.workDaysPerWeek,
      workHoursPerDay: s.workHoursPerDay,
      skillLevel: s.skillLevel ?? 0,
      wantsToQuit: !!s.wantsToQuit,
      focusProductId: s.focusProductId ?? null,
    })),

    exposure: Math.round(state.exposure * 10) / 10,
    reputation: Math.round(state.reputation * 10) / 10,
    cleanliness: Math.round((state.cleanliness ?? 60) * 10) / 10,
    cognition: {
      level: state.cognition.level,
      exp: state.cognition.exp,
      expToNext: state.cognition.expToNext,
      totalExp: state.cognition.totalExp,
      consultYongGeThisWeek: state.cognition.consultYongGeThisWeek,
    },

    activeMarketing: (state.activeMarketingActivities || []).map((a) => ({
      id: a.id,
      name: a.name,
      activeWeeks: a.activeWeeks ?? 0,
      weeklyCost: a.weeklyCost ?? 0,
    })),

    hasDelivery: state.hasDelivery,
    supplyPriority: state.supplyPriority,
    delivery: {
      platforms: state.deliveryState.platforms.map((p) => ({
        platformId: p.platformId,
        promotionTier: p.promotionTierId,
        discountTier: p.discountTierId,
        deliveryPricing: p.deliveryPricingId,
        packagingTier: p.packagingTierId,
        weeklyCost: Math.round(p.weeklyPromotionCost),
        exposureScore: Math.round(p.platformExposure * 10) / 10,
        activeWeeks: p.activeWeeks,
      })),
      weeklyOrders: state.deliveryState.weeklyDeliveryOrders,
      weeklyRevenue: Math.round(state.deliveryState.weeklyDeliveryRevenue),
      weeklyCommission: Math.round(state.deliveryState.weeklyCommissionPaid),
      weeklyPackageCost: Math.round(state.deliveryState.weeklyPackageCost),
      weeklyDiscountCost: Math.round(state.deliveryState.weeklyDiscountCost),
      platformRating: Math.round(state.deliveryState.platformRating * 10) / 10,
    },

    bossAction: {
      currentAction: state.bossAction.currentAction,
      workRole: state.bossAction.workRole ?? null,
      targetShopId: state.bossAction.targetShopId ?? null,
      activeBuffsCount: (state.bossAction.activeBuffs || []).length,
      consecutiveStudyWeeks: state.bossAction.consecutiveStudyWeeks,
    },

    nearbyShops: (state.nearbyShops || []).map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      category: s.shopCategory,
      ring: s.ring,
      exposure: Math.round(s.exposure * 10) / 10,
      hasDelivery: s.hasDelivery,
      isClosing: s.isClosing,
    })),
    nearbyShopEvents: (state.nearbyShopEvents || []).map((e) => ({
      type: e.type,
      shopName: e.shopName,
      description: e.description,
      week: e.week,
    })),

    inventory: (state.inventoryState.items || []).map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitCost: Math.round(i.unitCost * 100) / 100,
      restockStrategy: i.restockStrategy,
      lastWeekSales: i.lastWeekSales,
      lastWeekWaste: i.lastWeekWaste,
    })),

    activeEventBuffs: (state.activeEventBuffs || []).map((b) => ({
      type: b.type,
      value: b.value,
      durationWeeks: b.durationWeeks,
      source: b.source,
    })),
    pendingDelayedEffectsCount: (state.pendingDelayedEffects || []).length,

    pendingInteractiveEvent: pendingEvent
      ? {
          id: pendingEvent.id,
          name: pendingEvent.name,
          description: pendingDescription,
          category: pendingEvent.category,
          options: (pendingEvent.options || []).map((o) => ({
            id: o.id,
            text: o.text,
            yonggeQuote: o.yonggeQuote,
            narrativeHint: o.narrativeHint,
          })),
          isNotification:
            !!pendingEvent.notificationEffects &&
            (pendingEvent.options || []).length === 0,
        }
      : null,

    lastWeekEvent: state.lastWeekEvent
      ? {
          id: state.lastWeekEvent.id,
          title: state.lastWeekEvent.title,
          description: state.lastWeekEvent.description,
          impact: state.lastWeekEvent.impact,
        }
      : null,

    weeklySummary: serializeWeeklySummary(state.weeklySummary),
  };
}
