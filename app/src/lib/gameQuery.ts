/**
 * gameQuery.ts — 纯函数计算属性
 *
 * 从 useGameState.ts 的 useMemo / useCallback 中提取，零 React 依赖。
 * 供 CLI Agent 和 React UI 共享。
 */

import type { GameState, SupplyDemandResult } from "@/types/game";
import type { FixedCostBreakdown } from "@/lib/gameEngine";
import {
  WIN_STREAK,
  WIN_EXPOSURE,
  WIN_REPUTATION,
  MIN_OPERATING_CASH,
  calculateFixedCostBreakdown,
  calculateWeeklyFixedCost,
  calculateVariableCost,
  calculateCOGS,
  calculateWeeklyPromotionCost,
  getEffectiveSupplyCostModifier,
} from "@/lib/gameEngine";
import { calculateSupplyDemand } from "@/lib/supplyDemand";
import {
  brands,
  locations,
  decorations,
  products,
  staffTypes,
  SETUP_FIXED_COSTS,
} from "@/data/gameData";
import { PRODUCT_ADJUSTMENT_CONFIG } from "@/data/productAdjustmentData";
import { DELIVERY_PLATFORMS } from "@/data/deliveryData";
import {
  EXPOSURE_ACTIVITIES,
  REPUTATION_ACTIVITIES,
  MIXED_ACTIVITIES,
} from "@/data/marketingData";
import { RECRUITMENT_CHANNELS } from "@/data/staffData";

// ============ 结果类型 ============

export interface CurrentStats {
  revenue: number;
  variableCost: number; // 贡献毛益用变动成本（COGS + 加盟抽成 + 外卖佣金/包装）
  cogs: number; // 销售成本：仅原材料+损耗（管理会计"毛利率"分母用）
  fixedCost: number;
  fixedCostBreakdown: FixedCostBreakdown;
  profit: number;
  margin: number; // 贡献毛益率 (Revenue - VariableCost) / Revenue
  grossMargin: number; // 毛利率 (Revenue - COGS) / Revenue
  breakEvenPoint: number; // 盈亏平衡销售额 = 固定成本 / 贡献毛益率
}

export interface GameResult {
  isWin: boolean;
  reason: "win" | "bankrupt" | "time_limit";
  totalProfit: number;
  totalInvestment: number;
  roi: number;
  cognitionLevel: number;
  meetsStreakRequirement: boolean;
  meetsReturnRequirement: boolean;
  meetsBrandRequirement: boolean;
}

// ============ 辅助函数 ============

/** 筹备阶段预估周收入（真实值，UI 层再做模糊化） */
export function calculateSetupEstimatedRevenue(state: GameState): number {
  if (!state.selectedLocation || state.selectedProducts.length === 0) return 0;

  const ft = state.selectedLocation.footTraffic;
  const totalBase = ft.students + ft.office + ft.family + ft.tourist;
  const trafficMod = state.selectedAddress?.trafficModifier || 1;
  const baseTraffic = totalBase * trafficMod;
  const convRate = 0.15; // 新手高估值
  const avgPrice =
    state.selectedProducts.reduce((s, p) => s + p.basePrice, 0) /
    state.selectedProducts.length;

  return baseTraffic * convRate * avgPrice * 7;
}

// ============ 计算属性 ============

const EMPTY_STATS: CurrentStats = {
  revenue: 0,
  variableCost: 0,
  cogs: 0,
  fixedCost: 0,
  fixedCostBreakdown: {
    rent: 0,
    salary: 0,
    utilities: 0,
    marketing: 0,
    depreciation: 0,
    promotion: 0,
    holding: 0,
    activityMarketing: 0,
    total: 0,
  },
  profit: 0,
  margin: 0,
  grossMargin: 0,
  breakEvenPoint: 0,
};

/** 计算当前财务统计（筹备阶段用预估，经营阶段用供需模型） */
export function computeCurrentStats(
  state: GameState,
  precomputedSdResult?: SupplyDemandResult,
): CurrentStats {
  if (state.gamePhase === "setup") {
    if (
      !state.selectedLocation ||
      !state.selectedDecoration ||
      state.selectedProducts.length === 0
    ) {
      return EMPTY_STATS;
    }
    const revenue = calculateSetupEstimatedRevenue(state);
    const fixedCost = calculateWeeklyFixedCost(state);
    const variableCost = calculateVariableCost(revenue, state);
    const cogs = calculateCOGS(revenue, state);
    const profit = revenue - variableCost - fixedCost;
    const margin = revenue > 0 ? ((revenue - variableCost) / revenue) * 100 : 0;
    const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
    const breakEvenPoint = margin > 0 ? fixedCost / (margin / 100) : Infinity;

    return {
      revenue,
      variableCost,
      cogs,
      fixedCost,
      fixedCostBreakdown: calculateFixedCostBreakdown(state),
      profit,
      margin,
      grossMargin,
      breakEvenPoint,
    };
  }

  // 经营阶段
  const sdResult = precomputedSdResult ?? calculateSupplyDemand(state);
  const revenue = sdResult.totalRevenue;
  const variableCost = calculateVariableCost(revenue, state, sdResult);
  const cogs = calculateCOGS(revenue, state, sdResult);
  const fixedCostBd = calculateFixedCostBreakdown(state);
  const fixedCost = fixedCostBd.total;
  const weeklyPromotionCostTotal = calculateWeeklyPromotionCost(state);
  const profit = revenue - variableCost - fixedCost - weeklyPromotionCostTotal;
  const margin = revenue > 0 ? ((revenue - variableCost) / revenue) * 100 : 0;
  const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  const totalFixed = fixedCost + weeklyPromotionCostTotal;
  // BEP（盈亏平衡销售额） = 固定成本 / 贡献毛益率
  // 贡献毛益率 = (Rev - VC) / Rev；所以 BEP = 固定成本 * Rev / (Rev - VC)
  const breakEvenPoint = margin > 0 ? totalFixed / (margin / 100) : Infinity;

  return {
    revenue,
    variableCost,
    cogs,
    fixedCost: totalFixed,
    fixedCostBreakdown: {
      ...fixedCostBd,
      promotion: weeklyPromotionCostTotal,
      total: totalFixed,
    },
    profit,
    margin,
    grossMargin,
    breakEvenPoint,
  };
}

/** 计算供需模型结果（经营阶段才有值） */
export function computeSupplyDemandResult(
  state: GameState,
): SupplyDemandResult | null {
  if (state.gamePhase === "setup") return null;
  if (!state.selectedLocation || state.selectedProducts.length === 0)
    return null;
  return calculateSupplyDemand(state);
}

/** 检查是否满足开店条件 */
export function computeCanOpen(state: GameState): boolean {
  const area = state.selectedAddress?.area || state.storeArea;
  const rentModifier = state.selectedAddress?.rentModifier || 1;
  const weeklyRent =
    ((state.selectedLocation?.rentPerSqm || 0) * area * rentModifier) / 4;
  const monthlyRent = weeklyRent * 4;
  const setupCost =
    SETUP_FIXED_COSTS.businessLicense +
    SETUP_FIXED_COSTS.equipmentBase +
    SETUP_FIXED_COSTS.firstBatchInventory +
    monthlyRent *
      (SETUP_FIXED_COSTS.depositMonths + SETUP_FIXED_COSTS.prepaidRentMonths);
  const scm = getEffectiveSupplyCostModifier(state);
  const stockWeeks = state.cognition.level < 1 ? 4 : 1.5;
  const projectedRestockCost = state.selectedProducts.reduce((sum, p) => {
    const qty = Math.ceil(50 * stockWeeks);
    return sum + qty * p.baseCost * scm;
  }, 0);
  const projectedCashAfterOpen = state.cash - setupCost - projectedRestockCost;

  return (
    state.selectedBrand !== null &&
    state.selectedLocation !== null &&
    state.selectedAddress !== null &&
    state.selectedDecoration !== null &&
    state.selectedProducts.length > 0 &&
    state.staff.length > 0 &&
    projectedCashAfterOpen >= MIN_OPERATING_CASH
  );
}

/** 计算游戏结果（仅 ended 阶段有值） */
export function computeGameResult(state: GameState): GameResult | null {
  if (state.gamePhase !== "ended") return null;

  const totalProfit = state.cumulativeProfit || 0;
  const meetsReturnRequirement = totalProfit >= state.totalInvestment;
  const meetsStreakRequirement = (state.consecutiveProfits || 0) >= WIN_STREAK;
  const meetsBrandRequirement =
    state.exposure >= WIN_EXPOSURE && state.reputation >= WIN_REPUTATION;
  const reason = (state.gameOverReason || "time_limit") as
    | "win"
    | "bankrupt"
    | "time_limit";
  const isWin = reason === "win";

  return {
    isWin,
    reason,
    totalProfit,
    totalInvestment: state.totalInvestment,
    roi:
      state.totalInvestment > 0
        ? (totalProfit / state.totalInvestment) * 100
        : 0,
    cognitionLevel: state.cognition.level,
    meetsStreakRequirement,
    meetsReturnRequirement,
    meetsBrandRequirement,
  };
}

// ============ 可用操作查询 ============

export interface AvailableAction {
  type: string;
  description: string;
  params?: Record<string, unknown>;
}

/** 返回当前阶段所有合法操作及参数范围 */
export function getAvailableActions(state: GameState): AvailableAction[] {
  if (state.gamePhase === "ended") {
    return [{ type: "restart", description: "重新开始游戏" }];
  }
  if (state.gamePhase === "setup") {
    return getSetupActions(state);
  }
  return getOperatingActions(state);
}

function getSetupActions(state: GameState): AvailableAction[] {
  const actions: AvailableAction[] = [];

  // 品牌选择
  actions.push({
    type: "select_brand",
    description: state.selectedBrand
      ? `更换品牌（当前: ${state.selectedBrand.name}，传 null 取消）`
      : "选择品牌（加盟或自主创业）",
    params: {
      current: state.selectedBrand?.id ?? null,
      options: brands
        .filter((b) => !b.isQuickFranchise)
        .map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          fee: b.franchiseFee,
        })),
    },
  });

  // 选址
  if (!state.locationLocked) {
    actions.push({
      type: "select_location",
      description: "选择区位",
      params: {
        current: state.selectedLocation?.id ?? null,
        options: locations.map((l) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          rentPerSqm: l.rentPerSqm,
        })),
      },
    });

    if (state.selectedLocation) {
      actions.push({
        type: "select_address",
        description: "选择具体地址",
        params: {
          current: state.selectedAddress?.id ?? null,
          locationId: state.selectedLocation.id,
          options: state.selectedLocation.addresses.map((a) => ({
            id: a.id,
            name: a.name,
            area: a.area,
            trafficModifier: a.trafficModifier,
            rentModifier: a.rentModifier,
          })),
        },
      });
    }
  }

  // 装修
  if (!state.decorationLocked) {
    actions.push({
      type: "select_decoration",
      description: "选择装修风格",
      params: {
        current: state.selectedDecoration?.id ?? null,
        options: decorations.map((d) => ({
          id: d.id,
          name: d.name,
          costPerSqm: d.costPerSqm,
          level: d.level,
        })),
      },
    });
  }

  // 选品
  if (!state.productsLocked) {
    const allowed = state.selectedBrand?.allowedCategories;
    const available = allowed
      ? products.filter((p) =>
          allowed.includes(p.category as "drink" | "food" | "snack" | "meal"),
        )
      : products;
    actions.push({
      type: "toggle_product",
      description: `添加/移除产品（当前 ${state.selectedProducts.length}/${PRODUCT_ADJUSTMENT_CONFIG.maxProducts}）`,
      params: {
        selected: state.selectedProducts.map((p) => p.id),
        available: available.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          basePrice: p.basePrice,
        })),
      },
    });
  }

  // 员工
  if (state.selectedLocation) {
    actions.push({
      type: "add_staff",
      description: "添加员工",
      params: {
        currentCount: state.staff.length,
        options: staffTypes.map((s) => ({
          id: s.id,
          name: s.name,
          baseSalary: s.baseSalary,
        })),
      },
    });
  }

  if (state.staff.length > 0) {
    actions.push({
      type: "fire_staff",
      description: "解雇员工（筹备阶段）",
      params: {
        staff: state.staff.map((s) => ({
          id: s.id,
          name: s.name,
          typeId: s.typeId,
          salary: s.salary,
        })),
      },
    });
  }

  // 开店
  if (computeCanOpen(state)) {
    actions.push({
      type: "open_store",
      description: "开店营业（可选择起始季节）",
      params: { seasons: ["spring", "summer", "autumn", "winter"] },
    });
  }

  return actions;
}

function getOperatingActions(state: GameState): AvailableAction[] {
  const actions: AvailableAction[] = [];

  // 核心操作
  actions.push({ type: "next_week", description: "推进到下一周" });
  actions.push({ type: "restart", description: "重新开始游戏" });

  // 定价
  actions.push({
    type: "set_product_price",
    description: "调整产品价格",
    params: {
      products: state.selectedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        currentPrice: state.productPrices[p.id] ?? p.basePrice,
        basePrice: p.basePrice,
        referencePrice: p.referencePrice,
      })),
    },
  });

  // 库存管理（认知等级>=1）
  if (state.cognition.level >= 1) {
    actions.push({
      type: "set_product_inventory",
      description: "调整产品库存量",
      params: {
        items: state.inventoryState.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      },
    });
    actions.push({
      type: "set_restock_strategy",
      description: "设置补货策略",
      params: {
        items: state.inventoryState.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          currentStrategy: i.restockStrategy,
        })),
        strategies: [
          "manual",
          "auto_conservative",
          "auto_standard",
          "auto_aggressive",
        ],
      },
    });
  }

  // 员工管理
  if (state.staff.length > 0) {
    actions.push({
      type: "assign_staff_task",
      description: "分配员工岗位",
      params: {
        staff: state.staff.map((s) => ({
          id: s.id,
          name: s.name,
          typeId: s.typeId,
          currentTask: s.assignedTask,
          availableTasks:
            staffTypes.find((t) => t.id === s.typeId)?.availableTasks || [],
        })),
      },
    });
    actions.push({
      type: "set_staff_work_hours",
      description: "设置员工工时（天数5-7，小时4-12）",
      params: {
        staff: state.staff.map((s) => ({
          id: s.id,
          name: s.name,
          days: s.workDaysPerWeek,
          hours: s.workHoursPerDay,
        })),
      },
    });
    actions.push({
      type: "fire_staff",
      description: "解雇员工（经营阶段，影响其他员工士气）",
      params: {
        staff: state.staff.map((s) => ({
          id: s.id,
          name: s.name,
          typeId: s.typeId,
          salary: s.salary,
        })),
      },
    });

    // v2.7: 薪资调整（认知Lv2+）
    if (state.cognition.level >= 2) {
      actions.push({
        type: "set_staff_salary",
        description: "调整员工薪资（影响士气和离职风险）",
        params: {
          staff: state.staff.map((s) => ({
            id: s.id,
            name: s.name,
            salary: s.salary,
            skillLevel: s.skillLevel,
          })),
        },
      });
    }

    // v2.7: 士气管理工具（认知Lv1+）
    if (state.cognition.level >= 1) {
      actions.push({
        type: "staff_morale_action",
        description: "士气管理（发奖金/团建聚餐/放假一天）",
        params: {
          actionTypes: ["bonus", "team_meal", "day_off"],
          staff: state.staff.map((s) => ({
            id: s.id,
            name: s.name,
            morale: s.morale,
            fatigue: s.fatigue,
          })),
        },
      });
    }

    // v2.7: 离职挽留（认知Lv2+，仅对想辞职的员工）
    const quittingStaff = state.staff.filter((s) => s.wantsToQuit);
    if (state.cognition.level >= 2 && quittingStaff.length > 0) {
      actions.push({
        type: "retain_staff",
        description: "挽留想辞职的员工",
        params: {
          staff: quittingStaff.map((s) => ({
            id: s.id,
            name: s.name,
            salary: s.salary,
          })),
          methods: ["raise", "reduce_hours", "bonus"],
        },
      });
    }
  }

  // 招聘
  actions.push({
    type: "recruit_staff",
    description: "通过招聘渠道招人",
    params: {
      channels: RECRUITMENT_CHANNELS.map((c) => ({
        id: c.id,
        name: c.name,
        cost: c.cost,
        quality: c.candidateQuality,
      })),
      staffTypes: staffTypes.map((s) => ({
        id: s.id,
        name: s.name,
        baseSalary: s.baseSalary,
      })),
    },
  });

  // 外卖平台（按品牌类型判断解锁条件）
  const joinedPlatformIds = state.deliveryState.platforms.map(
    (p) => p.platformId,
  );
  const brandKey: "franchise" | "independent" =
    state.selectedBrand?.type === "franchise" ||
    state.selectedBrand?.isQuickFranchise
      ? "franchise"
      : "independent";
  const availablePlatforms = DELIVERY_PLATFORMS.filter(
    (p) =>
      !joinedPlatformIds.includes(p.id) &&
      state.cognition.level >= p.minCognitionByBrandType[brandKey],
  );
  if (availablePlatforms.length > 0) {
    actions.push({
      type: "join_platform",
      description: "上线外卖平台",
      params: {
        options: availablePlatforms.map((p) => ({
          id: p.id,
          name: p.name,
          commissionRate: p.commissionRate,
          minCognitionLevel: p.minCognitionByBrandType[brandKey],
        })),
      },
    });
  }

  if (state.deliveryState.platforms.length > 0) {
    actions.push({
      type: "leave_platform",
      description: "下线外卖平台",
      params: {
        joined: state.deliveryState.platforms.map((p) => ({
          platformId: p.platformId,
        })),
      },
    });
    actions.push({
      type: "toggle_promotion",
      description: "切换平台推广档位",
      params: {
        platforms: state.deliveryState.platforms.map((p) => ({
          platformId: p.platformId,
          currentTier: p.promotionTierId,
        })),
        tiers: [0, 1, 2, 3],
      },
    });

    // v3.0 外卖运营操作
    actions.push({
      type: "set_discount_tier",
      description: "设置满减活动档位",
      params: {
        platforms: state.deliveryState.platforms.map((p) => ({
          platformId: p.platformId,
          currentTier: p.discountTierId,
        })),
        tiers: ["none", "small", "standard", "large", "loss_leader"],
      },
    });
    actions.push({
      type: "set_delivery_pricing",
      description: "设置外卖定价倍率",
      params: {
        platforms: state.deliveryState.platforms.map((p) => ({
          platformId: p.platformId,
          currentPricing: p.deliveryPricingId,
        })),
        options: ["same", "slight", "medium", "high"],
      },
    });
    actions.push({
      type: "set_packaging_tier",
      description: "设置包装档次",
      params: {
        platforms: state.deliveryState.platforms.map((p) => ({
          platformId: p.platformId,
          currentTier: p.packagingTierId,
        })),
        options: ["basic", "premium"],
      },
    });

    // 出餐分配优先级
    actions.push({
      type: "set_supply_priority",
      description: "设置出餐分配策略（堂食优先/外卖优先/按需分配）",
      params: {
        current: state.supplyPriority || "dine_in_first",
        options: ["dine_in_first", "delivery_first", "proportional"],
      },
    });
  }

  // 营销活动
  const allActivities = [
    ...EXPOSURE_ACTIVITIES,
    ...REPUTATION_ACTIVITIES,
    ...MIXED_ACTIVITIES,
  ];
  const activeIds = state.activeMarketingActivities.map((a) => a.id);
  const availableActivities = allActivities.filter(
    (a) => !activeIds.includes(a.id),
  );
  if (availableActivities.length > 0) {
    actions.push({
      type: "start_marketing",
      description: "启动营销活动",
      params: {
        options: availableActivities.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          category: a.category,
          baseCost: a.baseCost,
          description: a.description,
        })),
      },
    });
  }

  if (state.activeMarketingActivities.length > 0) {
    actions.push({
      type: "stop_marketing",
      description: "停止营销活动（可能有曝光度惩罚）",
      params: {
        active: state.activeMarketingActivities.map((a) => ({
          id: a.id,
          name: a.name,
          activeWeeks: a.activeWeeks,
        })),
      },
    });
  }

  // 选品调整（经营阶段）
  if (!state.productsLocked) {
    const allowed = state.selectedBrand?.allowedCategories;
    const available = allowed
      ? products.filter((p) =>
          allowed.includes(p.category as "drink" | "food" | "snack" | "meal"),
        )
      : products;
    const changesLeft =
      PRODUCT_ADJUSTMENT_CONFIG.maxWeeklyChanges -
      (state.weeklyProductChanges || 0);
    if (changesLeft > 0) {
      actions.push({
        type: "toggle_product",
        description: `添加/移除产品（本周剩余 ${changesLeft} 次调整）`,
        params: {
          selected: state.selectedProducts.map((p) => p.id),
          available: available.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            basePrice: p.basePrice,
          })),
          changesLeft,
        },
      });
    }
  }

  // 勇哥咨询
  actions.push({
    type: "consult_yong_ge",
    description: "咨询赛博勇哥（获得认知经验，消耗现金）",
    params: {
      timesThisWeek: state.cognition.consultYongGeThisWeek || 0,
    },
  });

  // v2.8 产品专注度（有产能员工时可用）
  const productionStaff = state.staff.filter((s) => {
    const st = staffTypes.find((t) => t.id === s.typeId);
    return (
      st &&
      s.assignedTask &&
      ["chef", "waiter", "cleaner"].includes(s.assignedTask)
    );
  });
  if (productionStaff.length > 0 && state.selectedProducts.length > 0) {
    actions.push({
      type: "set_staff_focus_product",
      description: "设置员工产品专注（80%工时集中于指定产品）",
      params: {
        staff: productionStaff.map((s) => ({
          id: s.id,
          name: s.name,
          currentFocus: s.focusProductId || null,
        })),
        products: state.selectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
        })),
      },
    });
  }

  // v2.9 老板周行动
  actions.push({
    type: "set_boss_action",
    description:
      "设置老板本周行动（巡店督导/亲自坐镇/考察周边/蹲点数客流/休息）",
    params: {
      current: state.bossAction?.currentAction || "supervise",
      currentRole: state.bossAction?.workRole,
      options: [
        "supervise",
        "work_in_store",
        "investigate_nearby",
        "count_traffic",
        "industry_dinner",
      ],
    },
  });

  // v2.9 交互式事件响应
  if (state.pendingInteractiveEvent) {
    actions.push({
      type: "respond_to_event",
      description: `响应交互事件: ${state.pendingInteractiveEvent.name}`,
      params: {
        eventId: state.pendingInteractiveEvent.id,
        options: state.pendingInteractiveEvent.options.map((o) => ({
          id: o.id,
          text: o.text,
        })),
      },
    });
  }

  // 清除弹窗状态
  if (state.weeklySummary) {
    actions.push({
      type: "clear_weekly_summary",
      description: "关闭每周总结弹窗",
    });
  }
  if (state.lastWeekEvent) {
    actions.push({
      type: "clear_last_week_event",
      description: "关闭上周事件弹窗",
    });
  }

  return actions;
}

// ============ 决策预测 (Phase 2) ============

export interface PricePrediction {
  productId: string;
  oldPrice: number;
  newPrice: number;
  /** 当前周需求估算（份/周） */
  currentDemand: number;
  /** 调价后需求估算（份/周） */
  predictedDemand: number;
  /** 收入增量（¥/周）— 仅本商品 */
  deltaRevenue: number;
  /** 利润增量（¥/周）— 仅近似，剔除营销/外卖二阶项 */
  deltaProfit: number;
  /** 盈亏平衡销量（份/周）— 单品成本回收所需销量 */
  breakEvenSales: number;
  /** 警告（如调价过激、低于成本等） */
  warnings: string[];
}

/** 估算单价调整对当前周收入/利润的近似影响 */
export function predictPriceChange(
  state: GameState,
  productId: string,
  newPrice: number,
): PricePrediction | null {
  if (state.gamePhase !== "operating") return null;
  const prod = state.selectedProducts.find((p) => p.id === productId);
  if (!prod) return null;
  const oldPrice = state.productPrices[productId] ?? prod.basePrice;
  const sd = calculateSupplyDemand(state);
  const cur = sd.productSales?.find((x) => x.productId === productId);
  if (!cur) return null;

  // 价格弹性近似：基于参考价的相对偏离 — 与 demandCalculator 的 priceElasticity 一致
  const ref = prod.referencePrice || prod.basePrice;
  const oldDeviation = (oldPrice - ref) / Math.max(1, ref);
  const newDeviation = (newPrice - ref) / Math.max(1, ref);
  const elasticity = 0.8;
  const oldFactor = 1 - oldDeviation * elasticity;
  const newFactor = 1 - newDeviation * elasticity;
  const baseDemand = cur.demand / Math.max(0.05, oldFactor);
  const predictedDemand = Math.max(0, Math.round(baseDemand * newFactor));

  // 估算 unit cost：用产品 supplyCost 字段（如果存在），否则按 40% 估算
  const unitCost =
    (prod as { supplyCost?: number }).supplyCost ?? Math.max(0, oldPrice * 0.4);

  const deltaRevenue = predictedDemand * newPrice - cur.demand * oldPrice;
  const deltaProfit =
    (newPrice - unitCost) * predictedDemand -
    (oldPrice - unitCost) * cur.demand;
  const breakEvenSales =
    newPrice > unitCost
      ? Math.ceil((unitCost * cur.demand) / Math.max(1, newPrice - unitCost))
      : Infinity;

  const warnings: string[] = [];
  if (newPrice < unitCost) warnings.push("新价低于单位变动成本，越卖越亏");
  if (Math.abs(newDeviation) > 0.4)
    warnings.push("调价偏离参考价 > 40%，需求会显著变化");
  if (predictedDemand <= 0) warnings.push("预测需求 ≤ 0，可能完全劝退顾客");

  return {
    productId,
    oldPrice,
    newPrice,
    currentDemand: cur.demand,
    predictedDemand,
    deltaRevenue: Math.round(deltaRevenue),
    deltaProfit: Math.round(deltaProfit),
    breakEvenSales,
    warnings,
  };
}

export interface MarketingPrediction {
  activityId: string;
  weeklyCost: number;
  estExposureGain: number;
  estReputationGain: number;
  /** 简易 ROI = (预计带来周收入增量 - 成本) / 成本 */
  estROI: number;
  /** 周回本估算 */
  weeksToBreakEven: number;
  notes: string[];
}

/** 估算开启某营销活动的预期 ROI（启发式） */
export function predictMarketingROI(
  state: GameState,
  activityId: string,
): MarketingPrediction | null {
  const all = [
    ...EXPOSURE_ACTIVITIES,
    ...REPUTATION_ACTIVITIES,
    ...MIXED_ACTIVITIES,
  ];
  const act = all.find((a) => a.id === activityId);
  if (!act) return null;
  const weeklyCost = act.baseCost ?? 0;
  const expGain = act.exposureBoost ?? 0;
  const repGain = act.reputationBoost ?? 0;
  // 一个非常粗的"曝光每+1 → 周收入估算 +1%"启发式（仅做提示，不参与游戏逻辑）
  const baselineRev =
    state.weeklyRevenue ||
    (state.revenueHistory?.[state.revenueHistory.length - 1] ?? 5000);
  const revLift = baselineRev * (expGain * 0.012 + repGain * 0.018);
  const estROI =
    weeklyCost > 0
      ? (revLift - weeklyCost) / weeklyCost
      : revLift > 0
        ? Infinity
        : 0;
  const weeksToBreakEven =
    revLift > weeklyCost && revLift > 0
      ? 1
      : revLift > 0
        ? Math.ceil(weeklyCost / revLift)
        : Infinity;
  const notes: string[] = [];
  if (act.unique || (act.maxDuration && act.maxDuration <= 1))
    notes.push("一次性活动，单次费用而非周费");
  if (estROI < 0) notes.push("当前预测 ROI 为负，建议先提升基础流量");
  return {
    activityId,
    weeklyCost,
    estExposureGain: expGain,
    estReputationGain: repGain,
    estROI: Math.round(estROI * 100) / 100,
    weeksToBreakEven,
    notes,
  };
}
