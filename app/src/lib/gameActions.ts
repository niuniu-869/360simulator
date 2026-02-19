/**
 * gameActions.ts — 纯函数 Action 处理器
 *
 * 核心 dispatch 函数：(state, action) => ActionResult
 * 从 useGameState.ts 的 useCallback lambda 中提取，零 React 依赖。
 */

import type { GameState, Staff, MarketingActivity, ActivePlatform,
  Season, BossActionType, SupplyPriority } from '@/types/game';
import type { GameAction, ActionResult } from '@/lib/gameActionTypes';
import { applyEventEffects, rollInteractiveEvent, isNotificationEvent } from '@/lib/eventEngine';
import {
  INITIAL_CASH,
  getSeasonFromMonth,
  createInitialGameState,
  calculateWeeklyFixedCost,
  weeklyTick,
  getEffectiveSupplyCostModifier,
} from '@/lib/gameEngine';
import { generateInitialShops } from '@/lib/nearbyShopGenerator';
import { assignNearbyShopsToConsumerRings, generateConsumerRings } from '@/lib/consumerRingGenerator';
import {
  staffTypes, brands, locations, decorations, products,
  SETUP_FIXED_COSTS,
} from '@/data/gameData';
import { PASSIVE_EXP_CONFIG, applyCognitionExp } from '@/data/cognitionData';
import { PRODUCT_ADJUSTMENT_CONFIG, ADJUSTMENT_COSTS } from '@/data/productAdjustmentData';
import { PROMOTION_TIERS, getDeliveryPlatform, DISCOUNT_TIERS, DELIVERY_PRICING_TIERS, PACKAGING_TIERS } from '@/data/deliveryData';
import {
  getActivityConfig,
  calculateStopPenalty,
  getLocationExposureFloor,
} from '@/data/marketingData';
import {
  RECRUITMENT_CHANNELS,
  TASK_DEFINITIONS,
  generateSkillLevel,
  calculateFireMoraleImpact,
  SALARY_CONFIG,
  MORALE_ACTION_CONFIG,
  RETENTION_CONFIG,
  TRANSITION_CONFIG,
} from '@/data/staffData';
import {
  getBossActionConfig,
} from '@/data/bossActionData';

// ============ 辅助函数 ============

function fail(state: GameState, error: string): ActionResult {
  return { state, changed: false, error };
}

function ok(state: GameState): ActionResult {
  return { state, changed: true };
}

function bumpOps(prev: GameState): GameState['cognition'] {
  return {
    ...prev.cognition,
    weeklyOperationCount: (prev.cognition.weeklyOperationCount || 0) + 1,
  };
}

// ============ 主 dispatch 函数 ============

// 经营阶段主动操作类型（触发不活跃计数器重置）
const ACTIVE_OPERATION_TYPES = new Set([
  'fire_staff', 'recruit_staff',
  'join_platform', 'leave_platform', 'toggle_promotion',
  'set_discount_tier', 'set_delivery_pricing', 'set_packaging_tier',
  'start_marketing', 'stop_marketing',
  'set_product_price', 'set_product_inventory', 'set_restock_strategy',
  'assign_staff_task', 'set_staff_work_hours',
  'toggle_product', 'consult_yong_ge',
  // v2.7 员工系统升级
  'set_staff_salary', 'staff_morale_action', 'retain_staff',
  // v2.8 产品专注度
  'set_staff_focus_product',
  // v2.9 交互式事件
  'respond_to_event',
  // v2.9 老板周行动
  'set_boss_action',
  // 出餐分配优先级
  'set_supply_priority',
]);

export function dispatch(state: GameState, action: GameAction): ActionResult {
  let result: ActionResult;
  switch (action.type) {
    case 'select_brand':       result = handleSelectBrand(state, action.brandId); break;
    case 'select_location':    result = handleSelectLocation(state, action.locationId); break;
    case 'select_address':     result = handleSelectAddress(state, action.addressId); break;
    case 'set_store_area':     result = handleSetStoreArea(state, action.area); break;
    case 'select_decoration':  result = handleSelectDecoration(state, action.decorationId); break;
    case 'toggle_product':     result = handleToggleProduct(state, action.productId); break;
    case 'add_staff':          result = handleAddStaff(state, action.staffTypeId, action.assignedTask); break;
    case 'fire_staff':         result = handleFireStaff(state, action.staffId); break;
    case 'open_store':         result = handleOpenStore(state, action.season); break;
    case 'next_week':          result = handleNextWeek(state); break;
    case 'restart':            result = handleRestart(); break;
    case 'recruit_staff':      result = handleRecruitStaff(state, action.channelId, action.staffTypeId, action.assignedTask); break;
    case 'join_platform':      result = handleJoinPlatform(state, action.platformId); break;
    case 'leave_platform':     result = handleLeavePlatform(state, action.platformId); break;
    case 'toggle_promotion':   result = handleTogglePromotion(state, action.platformId, action.tierIndex); break;
    case 'start_marketing':    result = handleStartMarketing(state, action.activityId); break;
    case 'stop_marketing':     result = handleStopMarketing(state, action.activityId); break;
    case 'set_product_price':  result = handleSetProductPrice(state, action.productId, action.price); break;
    case 'set_product_inventory': result = handleSetProductInventory(state, action.productId, action.quantity); break;
    case 'set_restock_strategy':  result = handleSetRestockStrategy(state, action.productId, action.strategy); break;
    case 'assign_staff_task':  result = handleAssignStaffTask(state, action.staffId, action.taskType); break;
    case 'set_staff_work_hours': result = handleSetStaffWorkHours(state, action.staffId, action.days, action.hours); break;
    case 'consult_yong_ge':    result = handleConsultYongGe(state); break;
    case 'clear_weekly_summary': result = handleClearWeeklySummary(state); break;
    case 'clear_last_week_event': result = handleClearLastWeekEvent(state); break;
    // v2.7 员工系统升级
    case 'set_staff_salary':     result = handleSetStaffSalary(state, action.staffId, action.newSalary); break;
    case 'staff_morale_action':  result = handleStaffMoraleAction(state, action.actionType, action.targetStaffId, action.bonusAmount); break;
    case 'retain_staff':         result = handleRetainStaff(state, action.staffId, action.method); break;
    // v2.8 产品专注度
    case 'set_staff_focus_product': result = handleSetStaffFocusProduct(state, action.staffId, action.productId); break;
    // v2.9 老板周行动
    case 'set_boss_action': result = handleSetBossAction(state, action.action, action.role, action.shopId); break;
    // v2.9 交互式事件
    case 'respond_to_event': result = handleRespondToEvent(state, action.eventId, action.optionId); break;
    // 外卖运营 (v3.0)
    case 'set_discount_tier': result = handleSetDiscountTier(state, action.platformId, action.tierId); break;
    case 'set_delivery_pricing': result = handleSetDeliveryPricing(state, action.platformId, action.pricingId); break;
    case 'set_packaging_tier': result = handleSetPackagingTier(state, action.platformId, action.tierId); break;
    // 出餐分配优先级
    case 'set_supply_priority': result = handleSetSupplyPriority(state, action.priority); break;
    default:
      return fail(state, `Unknown action type: ${(action as { type: string }).type}`);
  }

  // 主动操作成功时重置不活跃计数器
  if (result.changed && ACTIVE_OPERATION_TYPES.has(action.type)) {
    result = { ...result, state: { ...result.state, weeksSinceLastAction: 0 } };
  }

  return result;
}

// ============ 筹备阶段 Handlers ============

function handleSelectBrand(prev: GameState, brandId: string | null): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可选择品牌');
  if (brandId === null) {
    return ok({
      ...prev,
      selectedBrand: null,
      cash: INITIAL_CASH,
      totalInvestment: 0,
      reputation: 10,
      exposure: 5,
      growthSystem: {
        launchProgress: 6,
        awarenessFactor: 0.3,
        awarenessStock: 4,
        campaignPulse: 1,
        trustConfidence: 0.1,
        repeatIntent: 40,
      },
    });
  }
  const brand = brands.find(b => b.id === brandId);
  if (!brand) return fail(prev, `Brand not found: ${brandId}`);

  const newFee = brand.franchiseFee || 0;
  const initialReputation = brand.initialReputation || 10;
  const initialExposure = brand.type === 'franchise'
    ? 35 + Math.floor(Math.random() * 21)   // 加盟品牌: 35-55（自带品牌知名度）
    : 5 + Math.floor(Math.random() * 8);    // 自主创业: 5-12（从零开始，几乎无人知晓）
  const launchSeed = brand.isQuickFranchise ? 18 : (brand.type === 'franchise' ? 34 : 10);
  const awarenessFactor = 0.25 + 0.75 / (1 + Math.exp(-(launchSeed - 45) / 10));

  const newState: GameState = {
    ...prev,
    selectedBrand: brand,
    cash: INITIAL_CASH - newFee,
    totalInvestment: newFee,
    reputation: initialReputation,
    exposure: initialExposure,
    growthSystem: {
      launchProgress: launchSeed,
      awarenessFactor,
      awarenessStock: Math.max(4, initialExposure * 0.65),
      campaignPulse: Math.max(1, initialExposure * 0.35),
      trustConfidence: brand.type === 'franchise' ? 0.22 : 0.12,
      repeatIntent: Math.max(38, Math.min(75, initialReputation)),
    },
  };

  // 品牌选择后抽取 setup 事件（select_brand 步骤）
  const setupEvent = rollInteractiveEvent(newState, 0, 'select_brand');
  if (setupEvent) {
    return ok({
      ...newState,
      pendingInteractiveEvent: setupEvent,
      interactiveEventHistory: [...newState.interactiveEventHistory, setupEvent.id],
    });
  }

  return ok(newState);
}

function handleSelectLocation(prev: GameState, locationId: string | null): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可选择区位');
  if (prev.locationLocked) return fail(prev, 'Location is locked by quick franchise');
  if (locationId === null) return ok({ ...prev, selectedLocation: null, selectedAddress: null });

  const location = locations.find(l => l.id === locationId);
  if (!location) return fail(prev, `Location not found: ${locationId}`);
  const isQF = prev.selectedBrand?.isQuickFranchise || false;
  const newState: GameState = { ...prev, selectedLocation: location, selectedAddress: null, locationLocked: isQF };

  // 选址后抽取 setup 事件（select_location 步骤）
  const setupEvent = rollInteractiveEvent(newState, 0, 'select_location');
  if (setupEvent) {
    return ok({
      ...newState,
      pendingInteractiveEvent: setupEvent,
      interactiveEventHistory: [...newState.interactiveEventHistory, setupEvent.id],
    });
  }

  return ok(newState);
}

function handleSelectAddress(prev: GameState, addressId: string | null): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可选择地址');
  if (prev.locationLocked) return fail(prev, 'Location is locked by quick franchise');
  if (addressId === null) return ok({ ...prev, selectedAddress: null, nearbyShops: [], nearbyShopEvents: [], baseConsumerRings: [], consumerRings: [] });
  if (!prev.selectedLocation) return fail(prev, 'No location selected');

  const address = prev.selectedLocation.addresses.find(a => a.id === addressId);
  if (!address) return fail(prev, `Address not found: ${addressId}`);

  const rentBase = prev.selectedLocation.rentPerSqm * (address.rentModifier || 1) * address.area;
  const nearbyShops = generateInitialShops(prev.selectedLocation.type, address.id, rentBase);
  const consumerRings = generateConsumerRings(prev.selectedLocation, address);
  const assignedRings = assignNearbyShopsToConsumerRings(consumerRings, nearbyShops);
  return ok({ ...prev, selectedAddress: address, storeArea: address.area || prev.storeArea, nearbyShops, nearbyShopEvents: [], baseConsumerRings: consumerRings, consumerRings: assignedRings });
}

function handleSetStoreArea(prev: GameState, area: number): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可设置面积');
  if (prev.locationLocked) return fail(prev, 'Location is locked by quick franchise');
  if (!isFinite(area) || area <= 0) return fail(prev, '面积必须为正数');
  const clampedArea = Math.max(15, Math.min(300, Math.round(area)));
  return ok({ ...prev, storeArea: clampedArea });
}

function handleSelectDecoration(prev: GameState, decorationId: string | null): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可选择装修');
  if (prev.decorationLocked) return fail(prev, 'Decoration is locked');
  const previousCost = prev.selectedDecoration
    ? prev.selectedDecoration.costPerSqm * prev.storeArea * (prev.decorationCostMarkup || 1) : 0;

  if (decorationId === null) {
    return ok({ ...prev, selectedDecoration: null, cash: prev.cash + previousCost, totalInvestment: prev.totalInvestment - previousCost });
  }
  const decoration = decorations.find(d => d.id === decorationId);
  if (!decoration) return fail(prev, `Decoration not found: ${decorationId}`);

  const isQF = prev.selectedBrand?.isQuickFranchise || false;
  const costMarkup = isQF ? 1.3 + Math.random() * 0.2 : 1.0;
  const newCost = decoration.costPerSqm * prev.storeArea * costMarkup;
  return ok({ ...prev, selectedDecoration: decoration, cash: prev.cash + previousCost - newCost,
    totalInvestment: prev.totalInvestment - previousCost + newCost, decorationLocked: isQF, decorationCostMarkup: costMarkup });
}

function handleToggleProduct(prev: GameState, productId: string): ActionResult {
  if (prev.productsLocked) return fail(prev, 'Products locked');
  const product = products.find(p => p.id === productId);
  if (!product) return fail(prev, `Product not found: ${productId}`);

  const exists = prev.selectedProducts.find(p => p.id === productId);
  const isQF = prev.selectedBrand?.isQuickFranchise || false;
  const isOp = prev.gamePhase === 'operating';

  const allowed = prev.selectedBrand?.allowedCategories;
  if (allowed && !exists && !allowed.includes(product.category as 'drink' | 'food' | 'snack' | 'meal')) {
    return fail(prev, `Category ${product.category} not allowed`);
  }

  if (exists) {
    if (isQF) return fail(prev, 'Cannot remove under quick franchise');
    if (isOp && prev.selectedProducts.length <= PRODUCT_ADJUSTMENT_CONFIG.minProducts) return fail(prev, 'Min products reached');
    if (isOp && (prev.weeklyProductChanges || 0) >= PRODUCT_ADJUSTMENT_CONFIG.maxWeeklyChanges) return fail(prev, 'Weekly change limit');

    const newInvItems = isOp ? prev.inventoryState.items.filter(i => i.productId !== productId) : prev.inventoryState.items;
    return ok({
      ...prev,
      selectedProducts: prev.selectedProducts.filter(p => p.id !== productId),
      weeklyProductChanges: isOp ? (prev.weeklyProductChanges || 0) + 1 : prev.weeklyProductChanges,
      inventoryState: isOp ? { ...prev.inventoryState, items: newInvItems, totalValue: newInvItems.reduce((s, i) => s + i.quantity * i.unitCost, 0) } : prev.inventoryState,
    });
  }

  if (prev.selectedProducts.length >= PRODUCT_ADJUSTMENT_CONFIG.maxProducts) return fail(prev, 'Max products reached');
  if (isOp && (prev.weeklyProductChanges || 0) >= PRODUCT_ADJUSTMENT_CONFIG.maxWeeklyChanges) return fail(prev, 'Weekly change limit');
  if (isOp && prev.cash < ADJUSTMENT_COSTS.addProduct.moneyCost) return fail(prev, 'Not enough cash');

  const newProducts = [...prev.selectedProducts, product];
  let newCash = prev.cash;
  let newInvState = prev.inventoryState;

  if (isOp) {
    newCash -= ADJUSTMENT_COSTS.addProduct.moneyCost;
    const unitCost = product.baseCost * getEffectiveSupplyCostModifier(prev);
    const qty = 75;
    const cost = qty * unitCost;
    newCash -= cost;
    const newItem = { productId: product.id, name: product.name, quantity: qty, unitCost,
      storageType: product.storageType as 'normal' | 'refrigerated' | 'frozen',
      restockStrategy: 'auto_standard' as const, lastWeekSales: 0, lastWeekWaste: 0, lastRestockQuantity: qty, lastRestockCost: cost };
    const items = [...prev.inventoryState.items, newItem];
    newInvState = { ...prev.inventoryState, items, totalValue: items.reduce((s, i) => s + i.quantity * i.unitCost, 0) };
  }

  return ok({ ...prev, selectedProducts: newProducts, productsLocked: isQF && newProducts.length >= 3,
    cash: newCash, weeklyProductChanges: isOp ? (prev.weeklyProductChanges || 0) + 1 : prev.weeklyProductChanges, inventoryState: newInvState });
}

// ============ 员工 Handlers ============

function makeStaff(prev: GameState, staffTypeId: string, isRecruit: boolean, channelQuality?: 'normal' | 'high' | 'excellent', assignedTask?: string): Staff {
  const staffType = staffTypes.find(s => s.id === staffTypeId)!;
  const wageLevel = prev.selectedLocation?.wageLevel || 1;
  // 时薪制：月薪 = 时薪 × 默认周工时 × 4周 × 地区系数
  const defaultDays = 6;
  const defaultHours = 8;
  let salary: number;
  if (staffType.payType === 'hourly' && staffType.hourlyRate) {
    salary = Math.round(staffType.hourlyRate * defaultDays * defaultHours * 4 * wageLevel);
  } else {
    salary = Math.round(staffType.baseSalary * wageLevel);
  }
  const names = ['小王', '小李', '小张', '小刘', '小陈', '小杨', '小赵', '小周'];
  const skillLevel = isRecruit && channelQuality ? generateSkillLevel(channelQuality) : Math.floor(Math.random() * 3) + 1;
  const baseEff = (staffType.efficiency || 1.0) * (0.8 + skillLevel * 0.1);
  const baseSvc = (staffType.serviceQuality || 0.8) * (0.8 + skillLevel * 0.1);
  // 优先使用指定岗位（需在可用岗位列表中），否则用默认逻辑
  const defaultTask = staffType.availableTasks.includes('chef') && !staffType.availableTasks.includes('waiter') ? 'chef' : 'waiter';
  const initialTask = assignedTask && staffType.availableTasks.includes(assignedTask) ? assignedTask : defaultTask;

  return {
    id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    typeId: staffTypeId, name: names[Math.floor(Math.random() * names.length)],
    salary, skillLevel, baseEfficiency: baseEff, efficiency: baseEff,
    baseServiceQuality: baseSvc, serviceQuality: baseSvc,
    morale: 70 + Math.floor(Math.random() * 20), fatigue: 0,
    hiredWeek: prev.currentWeek, assignedTask: initialTask, taskExp: 0,
    currentTaskSince: prev.currentWeek, workDaysPerWeek: defaultDays, workHoursPerDay: defaultHours,
    isOnboarding: isRecruit, onboardingEndsWeek: isRecruit ? prev.currentWeek + 1 : prev.currentWeek,
  };
}

function handleAddStaff(prev: GameState, staffTypeId: string, assignedTask?: string): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可直接添加员工');
  if (!staffTypes.find(s => s.id === staffTypeId)) return fail(prev, `Staff type not found: ${staffTypeId}`);
  if (!prev.selectedLocation) return fail(prev, 'No location selected');
  const MAX_STAFF_SETUP = 8;
  if (prev.staff.length >= MAX_STAFF_SETUP) return fail(prev, '筹备阶段最多招聘8人');
  return ok({ ...prev, staff: [...prev.staff, makeStaff(prev, staffTypeId, false, undefined, assignedTask)] });
}

function handleFireStaff(prev: GameState, staffId: string): ActionResult {
  const firedStaff = prev.staff.find(s => s.id === staffId);
  if (!firedStaff) return fail(prev, `Staff not found: ${staffId}`);
  const moralePenalty = calculateFireMoraleImpact(firedStaff, prev.currentWeek);
  const remaining = prev.staff.filter(s => s.id !== staffId)
    .map(s => ({ ...s, morale: Math.max(0, Math.min(100, s.morale + moralePenalty)) }));
  return ok({ ...prev, staff: remaining, cognition: bumpOps(prev) });
}

function handleRecruitStaff(prev: GameState, channelId: string, staffTypeId: string, assignedTask?: string): ActionResult {
  const channel = RECRUITMENT_CHANNELS.find(c => c.id === channelId);
  if (!channel) return fail(prev, `Channel not found: ${channelId}`);
  if (!staffTypes.find(s => s.id === staffTypeId)) return fail(prev, `Staff type not found: ${staffTypeId}`);
  if (!prev.selectedLocation) return fail(prev, 'No location selected');
  if (prev.cash < channel.cost) return fail(prev, 'Not enough cash');

  const newStaff = makeStaff(prev, staffTypeId, true, channel.candidateQuality, assignedTask);
  return ok({ ...prev, staff: [...prev.staff, newStaff], cash: prev.cash - channel.cost, cognition: bumpOps(prev) });
}

// ============ 外卖平台 Handlers ============

function handleJoinPlatform(prev: GameState, platformId: string): ActionResult {
  const platform = getDeliveryPlatform(platformId);
  if (!platform) return fail(prev, `Platform not found: ${platformId}`);

  // 按品牌类型查对应的认知等级要求（快招品牌视为 franchise）
  const brandKey: 'franchise' | 'independent' =
    prev.selectedBrand?.type === 'franchise' || prev.selectedBrand?.isQuickFranchise
      ? 'franchise' : 'independent';
  const requiredLevel = platform.minCognitionByBrandType[brandKey];
  if (prev.cognition.level < requiredLevel) return fail(prev, 'Cognition level too low');

  if (prev.deliveryState.platforms.some(p => p.platformId === platformId)) return fail(prev, 'Already joined');

  // 冷启动：权重分从新店扶持基础分开始
  const np: ActivePlatform = {
    platformId,
    activeWeeks: 0,
    platformExposure: 15,           // 新店扶持期基础权重分
    promotionTierId: 'none',
    discountTierId: 'none',
    deliveryPricingId: 'same',
    packagingTierId: 'basic',
    weeklyPromotionCost: 0,
    recentWeeklyOrders: [],
    lastWeightBase: 15,
    lastWeightSales: 0,
    lastWeightRating: 0,
    lastWeightPromotion: 0,
    lastWeightDiscount: -5,         // 无满减降权
  };
  const platforms = [...prev.deliveryState.platforms, np];
  return ok({ ...prev, hasDelivery: true,
    deliveryState: { ...prev.deliveryState, platforms, totalPlatformExposure: platforms.reduce((s, p) => s + p.platformExposure, 0) },
    cognition: bumpOps(prev) });
}

function handleLeavePlatform(prev: GameState, platformId: string): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可操作外卖平台');
  if (!prev.deliveryState.platforms.some(p => p.platformId === platformId)) {
    return fail(prev, `未加入该平台: ${platformId}`);
  }
  const platforms = prev.deliveryState.platforms.filter(p => p.platformId !== platformId);
  return ok({ ...prev, hasDelivery: platforms.length > 0,
    deliveryState: { ...prev.deliveryState, platforms, totalPlatformExposure: platforms.reduce((s, p) => s + p.platformExposure, 0) },
    cognition: bumpOps(prev) });
}

function handleTogglePromotion(prev: GameState, platformId: string, tierIndex: number): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可操作推广');
  if (!prev.deliveryState.platforms.some(p => p.platformId === platformId)) {
    return fail(prev, `未加入该平台: ${platformId}`);
  }
  const tier = PROMOTION_TIERS[tierIndex];
  if (!tier) return fail(prev, `Tier not found: ${tierIndex}`);
  const platforms = prev.deliveryState.platforms.map(p =>
    p.platformId !== platformId ? p : { ...p, promotionTierId: tier.id, weeklyPromotionCost: tier.weeklyCost });
  return ok({ ...prev, deliveryState: { ...prev.deliveryState, platforms }, cognition: bumpOps(prev) });
}

function handleSetDiscountTier(prev: GameState, platformId: string, tierId: string): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可操作满减');
  if (!prev.deliveryState.platforms.some(p => p.platformId === platformId)) {
    return fail(prev, `未加入该平台: ${platformId}`);
  }
  const tier = DISCOUNT_TIERS.find(t => t.id === tierId);
  if (!tier) return fail(prev, `Discount tier not found: ${tierId}`);
  const platforms = prev.deliveryState.platforms.map(p =>
    p.platformId !== platformId ? p : { ...p, discountTierId: tier.id });
  return ok({ ...prev, deliveryState: { ...prev.deliveryState, platforms }, cognition: bumpOps(prev) });
}

function handleSetDeliveryPricing(prev: GameState, platformId: string, pricingId: string): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可操作外卖定价');
  if (!prev.deliveryState.platforms.some(p => p.platformId === platformId)) {
    return fail(prev, `未加入该平台: ${platformId}`);
  }
  const pricing = DELIVERY_PRICING_TIERS.find(t => t.id === pricingId);
  if (!pricing) return fail(prev, `Delivery pricing not found: ${pricingId}`);
  const platforms = prev.deliveryState.platforms.map(p =>
    p.platformId !== platformId ? p : { ...p, deliveryPricingId: pricing.id });
  return ok({ ...prev, deliveryState: { ...prev.deliveryState, platforms }, cognition: bumpOps(prev) });
}

function handleSetPackagingTier(prev: GameState, platformId: string, tierId: string): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可操作包装');
  if (!prev.deliveryState.platforms.some(p => p.platformId === platformId)) {
    return fail(prev, `未加入该平台: ${platformId}`);
  }
  const tier = PACKAGING_TIERS.find(t => t.id === tierId);
  if (!tier) return fail(prev, `Packaging tier not found: ${tierId}`);
  const platforms = prev.deliveryState.platforms.map(p =>
    p.platformId !== platformId ? p : { ...p, packagingTierId: tier.id });
  return ok({ ...prev, deliveryState: { ...prev.deliveryState, platforms }, cognition: bumpOps(prev) });
}

// ============ 开店 & 核心经营 ============

function handleOpenStore(prev: GameState, season?: Season): ActionResult {
  if (prev.gamePhase !== 'setup') return fail(prev, '仅筹备阶段可开店');
  if (!prev.selectedBrand) return fail(prev, '请先选择品牌');
  if (!prev.selectedLocation) return fail(prev, '请先选择区位');
  if (!prev.selectedAddress) return fail(prev, '请先选择地址');
  if (!prev.selectedDecoration) return fail(prev, '请先选择装修');
  if (prev.selectedProducts.length === 0) return fail(prev, '请先选择产品');
  if (prev.staff.length === 0) return fail(prev, '请先招聘员工');
  const fixedCost = calculateWeeklyFixedCost(prev);
  const seasonToMonth: Record<Season, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 };
  const startMonth = season ? seasonToMonth[season] : Math.floor(Math.random() * 12) + 1;
  const currentSeason = getSeasonFromMonth(startMonth);
  const scm = getEffectiveSupplyCostModifier(prev);
  const stockWeeks = prev.cognition.level < 1 ? 4 : 1.5;

  // 计算开店固定费用（营业执照+设备+首批进货+押金+预付租金）
  // BUG FIX: 单独计算月租金，不再用全部固定成本反推
  const area = prev.selectedAddress?.area || prev.storeArea;
  const rentModifier = prev.selectedAddress?.rentModifier || 1;
  const weeklyRent = (prev.selectedLocation?.rentPerSqm || 0) * area * rentModifier / 4;
  const monthlyRent = weeklyRent * 4; // 纯月租金 = 周租金 × 4
  const setupCost = SETUP_FIXED_COSTS.businessLicense
    + SETUP_FIXED_COSTS.equipmentBase
    + SETUP_FIXED_COSTS.firstBatchInventory
    + monthlyRent * (SETUP_FIXED_COSTS.depositMonths + SETUP_FIXED_COSTS.prepaidRentMonths);

  const initialItems = prev.selectedProducts.map(p => {
    const unitCost = p.baseCost * scm;
    const qty = Math.ceil(50 * stockWeeks);
    return {
      productId: p.id, name: p.name, quantity: qty, unitCost,
      storageType: p.storageType as 'normal' | 'refrigerated' | 'frozen',
      restockStrategy: 'auto_standard' as const,
      lastWeekSales: 0, lastWeekWaste: 0,
      lastRestockQuantity: qty, lastRestockCost: qty * unitCost,
    };
  });
  const restockCost = initialItems.reduce((s, i) => s + i.lastRestockCost, 0);
  const totalValue = initialItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return ok({
    ...prev, isOpen: true, gamePhase: 'operating',
    weeklyFixedCost: fixedCost, startMonth, currentSeason,
    totalInvestment: prev.totalInvestment + setupCost, // 固定费用计入总投资
    cash: prev.cash - restockCost - setupCost,         // 扣除库存+固定费用
    inventoryState: {
      items: initialItems, totalValue,
      weeklyHoldingCost: 0, weeklyWasteCost: 0, weeklyRestockCost: restockCost,
    },
  });
}

function handleNextWeek(prev: GameState): ActionResult {
  const { state } = weeklyTick(prev);
  return ok(state);
}

function handleRestart(): ActionResult {
  return ok(createInitialGameState());
}

// ============ 营销活动 Handlers ============

function handleStartMarketing(prev: GameState, activityId: string): ActionResult {
  const config = getActivityConfig(activityId);
  if (!config) return fail(prev, `Activity not found: ${activityId}`);
  if (prev.activeMarketingActivities.some(a => a.id === activityId)) return fail(prev, 'Already active');
  if (config.unique && prev.usedOneTimeActivities.includes(activityId)) return fail(prev, 'Already used');

  if (config.cooldownWeeks && config.type === 'one_time') {
    const last = prev.lastActivityWeek[activityId];
    if (last !== undefined && (prev.currentWeek - last) < config.cooldownWeeks) return fail(prev, 'In cooldown');
  }
  if (config.type === 'one_time' && prev.cash < config.baseCost) return fail(prev, 'Not enough cash');

  const act: MarketingActivity = {
    id: activityId, name: config.name, type: config.type, category: config.category,
    weeklyCost: config.baseCost, exposureBoost: config.exposureBoost,
    reputationBoost: config.reputationBoost, priceModifier: config.priceModifier,
    dependencyCoefficient: config.dependencyCoefficient, activeWeeks: 0, description: config.description,
  };

  return ok({
    ...prev,
    activeMarketingActivities: [...prev.activeMarketingActivities, act],
    cash: config.type === 'one_time' ? prev.cash - config.baseCost : prev.cash,
    usedOneTimeActivities: config.type === 'one_time' ? [...prev.usedOneTimeActivities, activityId] : prev.usedOneTimeActivities,
    lastActivityWeek: config.type === 'one_time' ? { ...prev.lastActivityWeek, [activityId]: prev.currentWeek } : prev.lastActivityWeek,
    cognition: bumpOps(prev),
  });
}

function handleStopMarketing(prev: GameState, activityId: string): ActionResult {
  const activity = prev.activeMarketingActivities.find(a => a.id === activityId);
  if (!activity) return fail(prev, `Activity not found: ${activityId}`);
  const penalty = calculateStopPenalty(activity.dependencyCoefficient, activity.activeWeeks);
  const floor = getLocationExposureFloor(prev.selectedAddress?.trafficModifier || 1);
  return ok({
    ...prev,
    activeMarketingActivities: prev.activeMarketingActivities.filter(a => a.id !== activityId),
    exposure: Math.max(floor, prev.exposure * (1 - penalty)),
    cognition: bumpOps(prev),
  });
}

// ============ 定价 & 库存 Handlers ============

function handleSetProductPrice(prev: GameState, productId: string, price: number): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可调价');
  const product = prev.selectedProducts.find(p => p.id === productId);
  if (!product) return fail(prev, `产品不存在: ${productId}`);
  if (!isFinite(price) || price <= 0) return fail(prev, '价格必须为正数');
  const maxPrice = (product.referencePrice || product.basePrice) * 3;
  const clampedPrice = Math.max(1, Math.min(maxPrice, Math.round(price * 100) / 100));
  return ok({
    ...prev,
    productPrices: { ...prev.productPrices, [productId]: clampedPrice },
    cognition: bumpOps(prev),
  });
}

function handleSetProductInventory(prev: GameState, productId: string, quantity: number): ActionResult {
  if (prev.cognition.level < 1) return fail(prev, 'Cognition level too low for inventory ops');
  const product = prev.selectedProducts.find(p => p.id === productId);
  if (!product) return fail(prev, `Product not found: ${productId}`);

  const unitCost = product.baseCost * getEffectiveSupplyCostModifier(prev);
  const existing = prev.inventoryState.items.find(i => i.productId === productId);
  const currentQty = existing?.quantity || 0;
  const newQty = Math.max(0, quantity);
  const delta = newQty - currentQty;

  let purchaseCost = 0;
  if (delta > 0) {
    purchaseCost = delta * unitCost;
    if (prev.cash < purchaseCost) return fail(prev, 'Not enough cash');
  }

  let newItems;
  if (existing) {
    newItems = prev.inventoryState.items.map(item =>
      item.productId === productId ? { ...item, quantity: newQty } : item);
  } else {
    newItems = [...prev.inventoryState.items, {
      productId, name: product.name, quantity: newQty, unitCost,
      storageType: product.storageType as 'normal' | 'refrigerated' | 'frozen',
      restockStrategy: 'auto_standard' as const,
      lastWeekSales: 0, lastWeekWaste: 0,
      lastRestockQuantity: newQty, lastRestockCost: newQty * unitCost,
    }];
  }

  return ok({
    ...prev, cash: prev.cash - purchaseCost,
    inventoryState: { ...prev.inventoryState, items: newItems,
      totalValue: newItems.reduce((s, i) => s + i.quantity * i.unitCost, 0) },
    cognition: bumpOps(prev),
  });
}

// ============ 补货策略 & 员工任务 Handlers ============

function handleSetRestockStrategy(prev: GameState, productId: string, strategy: import('@/types/game').RestockStrategy): ActionResult {
  if (prev.cognition.level < 1) return fail(prev, 'Cognition level too low for inventory ops');
  return ok({
    ...prev,
    inventoryState: {
      ...prev.inventoryState,
      items: prev.inventoryState.items.map(item =>
        item.productId === productId ? { ...item, restockStrategy: strategy } : item
      ),
    },
    cognition: bumpOps(prev),
  });
}

function handleAssignStaffTask(prev: GameState, staffId: string, taskType: string): ActionResult {
  const staff = prev.staff.find(s => s.id === staffId);
  if (!staff) return fail(prev, `Staff not found: ${staffId}`);
  if (staff.assignedTask === taskType) return fail(prev, 'Already on this task');

  // 校验：目标岗位必须在该员工类型的可用岗位列表中
  const staffType = staffTypes.find(s => s.id === staff.typeId);
  if (staffType && !staffType.availableTasks.includes(taskType)) {
    return fail(prev, `该员工类型不支持岗位: ${taskType}`);
  }

  // v2.7: 转岗过渡期 + 历史岗位经验存档
  const previousTasks = { ...(staff.previousTasks || {}) };
  // 存档当前岗位经验
  previousTasks[staff.assignedTask] = staff.taskExp;
  // 计算新岗位初始经验（回归旧岗位保留50%，新岗位保留30%通用经验）
  const historicalExp = previousTasks[taskType];
  const newTaskExp = historicalExp !== undefined
    ? Math.floor(historicalExp * TRANSITION_CONFIG.sameTaskRetainRatio)
    : Math.floor(staff.taskExp * TRANSITION_CONFIG.expRetainRatio);

  return ok({
    ...prev,
    staff: prev.staff.map(s =>
      s.id === staffId
        ? {
            ...s,
            assignedTask: taskType,
            taskExp: newTaskExp,
            currentTaskSince: prev.currentWeek,
            previousTasks,
            // 经营阶段才有过渡期
            isTransitioning: prev.gamePhase === 'operating',
            transitionEndsWeek: prev.currentWeek + TRANSITION_CONFIG.durationWeeks,
          }
        : s
    ),
    cognition: bumpOps(prev),
  });
}

function handleSetStaffWorkHours(prev: GameState, staffId: string, days: number, hours: number): ActionResult {
  const staff = prev.staff.find(s => s.id === staffId);
  if (!staff) return fail(prev, `Staff not found: ${staffId}`);
  const clampedDays = Math.max(5, Math.min(7, days));
  const clampedHours = Math.max(4, Math.min(12, hours));

  // 时薪制员工：工时变更同步更新薪资
  const staffType = staffTypes.find(s => s.id === staff.typeId);
  let newSalary = staff.salary;
  if (staffType?.payType === 'hourly' && staffType.hourlyRate) {
    const wageLevel = prev.selectedLocation?.wageLevel || 1;
    newSalary = Math.round(staffType.hourlyRate * clampedDays * clampedHours * 4 * wageLevel);
  }

  return ok({
    ...prev,
    staff: prev.staff.map(s =>
      s.id === staffId
        ? { ...s, workDaysPerWeek: clampedDays, workHoursPerDay: clampedHours, salary: newSalary }
        : s
    ),
    cognition: bumpOps(prev),
  });
}

// ============ 认知 & 周总结 Handlers ============

function handleConsultYongGe(prev: GameState): ActionResult {
  const times = prev.cognition.consultYongGeThisWeek || 0;
  if (times >= PASSIVE_EXP_CONFIG.consultYongGeWeeklyLimit) return fail(prev, 'Weekly consult limit reached');
  if (prev.cash < PASSIVE_EXP_CONFIG.consultYongGeCost) return fail(prev, 'Not enough cash');

  // 统一认知升级入口
  const newCognition = applyCognitionExp({ ...prev.cognition }, PASSIVE_EXP_CONFIG.consultYongGeExp);
  newCognition.consultYongGeThisWeek = times + 1;

  return ok({
    ...prev,
    cash: prev.cash - PASSIVE_EXP_CONFIG.consultYongGeCost,
    cognition: newCognition,
  });
}

function handleClearWeeklySummary(prev: GameState): ActionResult {
  return ok({
    ...prev,
    lastWeeklySummary: prev.weeklySummary,
    weeklySummary: null,
  });
}

function handleClearLastWeekEvent(prev: GameState): ActionResult {
  return ok({
    ...prev,
    lastWeekEvent: null,
  });
}

// ============ v2.7 员工系统升级 Handlers ============

function handleSetStaffSalary(prev: GameState, staffId: string, newSalary: number): ActionResult {
  if (prev.cognition.level < 2) return fail(prev, '认知等级不足，需要达到觉醒新手(Lv2)才能调整薪资');
  const staff = prev.staff.find(s => s.id === staffId);
  if (!staff) return fail(prev, `Staff not found: ${staffId}`);

  const staffType = staffTypes.find(s => s.id === staff.typeId);
  if (!staffType) return fail(prev, 'Staff type not found');

  // 时薪制员工不支持手动调薪
  if (staffType.payType === 'hourly') return fail(prev, '兼职员工按时薪计费，请通过调整工时来控制成本');

  const wageLevel = prev.selectedLocation?.wageLevel || 1;
  const baseSalary = Math.round(staffType.baseSalary * wageLevel);
  const minSalary = Math.round(baseSalary * SALARY_CONFIG.minRatio);
  const maxSalary = Math.round(baseSalary * SALARY_CONFIG.maxRatio);
  const clampedSalary = Math.max(minSalary, Math.min(maxSalary, Math.round(newSalary)));

  if (clampedSalary === staff.salary) return fail(prev, 'Salary unchanged');

  const oldSalary = staff.salary;
  const isRaise = clampedSalary > oldSalary;
  const changeRatio = Math.abs(clampedSalary - oldSalary) / oldSalary;

  let moraleChange = 0;
  let salaryRaiseMoraleBoost = 0;
  if (isRaise) {
    // 加薪：即时士气提升 + 持续加成（每周衰减）
    moraleChange = Math.min(SALARY_CONFIG.raiseMaxBoost, Math.round(changeRatio * 100 * SALARY_CONFIG.raiseCoefficient / 100));
    salaryRaiseMoraleBoost = moraleChange;
  } else {
    // 降薪：士气暴跌
    moraleChange = -Math.round(changeRatio * 100 * SALARY_CONFIG.cutCoefficient / 100);
  }

  const updatedStaff = prev.staff.map(s => {
    if (s.id === staffId) {
      const newMorale = Math.max(0, Math.min(100, s.morale + moraleChange));
      return {
        ...s,
        salary: clampedSalary,
        morale: newMorale,
        salaryRaiseMoraleBoost: isRaise ? salaryRaiseMoraleBoost : s.salaryRaiseMoraleBoost,
        // 降薪可能触发离职预警
        wantsToQuit: !isRaise && Math.random() < SALARY_CONFIG.cutQuitCheckRate ? true : s.wantsToQuit,
      };
    }
    return s;
  });

  return ok({ ...prev, staff: updatedStaff, cognition: bumpOps(prev) });
}

function handleStaffMoraleAction(
  prev: GameState,
  actionType: 'bonus' | 'team_meal' | 'day_off',
  targetStaffId?: string,
  bonusAmount?: number,
): ActionResult {
  const config = MORALE_ACTION_CONFIG[actionType];
  if (prev.cognition.level < config.minCognitionLevel) {
    return fail(prev, '认知等级不足，需要达到踩坑学徒(Lv1)才能使用士气管理工具');
  }

  if (actionType === 'bonus') {
    if (!targetStaffId) return fail(prev, 'Bonus requires target staff');
    const staff = prev.staff.find(s => s.id === targetStaffId);
    if (!staff) return fail(prev, 'Staff not found');

    // 冷却检查
    if (staff.lastBonusWeek !== undefined &&
        (prev.currentWeek - staff.lastBonusWeek) < config.cooldownWeeks) {
      return fail(prev, `奖金冷却中，还需${config.cooldownWeeks - (prev.currentWeek - staff.lastBonusWeek)}周`);
    }

    const bonusCfg = MORALE_ACTION_CONFIG.bonus;
    const amountIndex = bonusCfg.amounts.indexOf(bonusAmount || 500);
    const idx = amountIndex >= 0 ? amountIndex : 0;
    const amount = bonusCfg.amounts[idx];
    const moraleBoost = bonusCfg.moraleBoosts[idx];

    if (prev.cash < amount) return fail(prev, '现金不足');

    const updatedStaff = prev.staff.map(s => {
      if (s.id === targetStaffId) {
        return { ...s, morale: Math.min(100, s.morale + moraleBoost), lastBonusWeek: prev.currentWeek };
      }
      // 其他员工公平感加成
      return { ...s, morale: Math.min(100, s.morale + bonusCfg.otherBoost) };
    });

    return ok({
      ...prev, staff: updatedStaff, cash: prev.cash - amount,
      staffMoraleActionCount: (prev.staffMoraleActionCount || 0) + 1,
      weeksSinceLastMoraleAction: 0,
      cognition: bumpOps(prev),
    });
  }

  if (actionType === 'team_meal') {
    // 全局冷却检查
    if (prev.lastTeamMealWeek !== undefined &&
        (prev.currentWeek - prev.lastTeamMealWeek) < config.cooldownWeeks) {
      return fail(prev, `团建冷却中，还需${config.cooldownWeeks - (prev.currentWeek - prev.lastTeamMealWeek)}周`);
    }

    const mealCfg = MORALE_ACTION_CONFIG.team_meal;
    const totalCost = mealCfg.costPerPerson * prev.staff.length;
    if (prev.cash < totalCost) return fail(prev, '现金不足');

    const updatedStaff = prev.staff.map(s => ({
      ...s,
      morale: Math.min(100, s.morale + mealCfg.moraleBoost),
      fatigue: Math.max(0, s.fatigue - mealCfg.fatigueReduction),
    }));

    return ok({
      ...prev, staff: updatedStaff, cash: prev.cash - totalCost,
      lastTeamMealWeek: prev.currentWeek,
      staffMoraleActionCount: (prev.staffMoraleActionCount || 0) + 1,
      weeksSinceLastMoraleAction: 0,
      cognition: bumpOps(prev),
    });
  }

  if (actionType === 'day_off') {
    if (!targetStaffId) return fail(prev, 'Day off requires target staff');
    const staff = prev.staff.find(s => s.id === targetStaffId);
    if (!staff) return fail(prev, 'Staff not found');

    if (staff.lastDayOffWeek !== undefined &&
        (prev.currentWeek - staff.lastDayOffWeek) < config.cooldownWeeks) {
      return fail(prev, `放假冷却中，还需${config.cooldownWeeks - (prev.currentWeek - staff.lastDayOffWeek)}周`);
    }

    const dayOffCfg = MORALE_ACTION_CONFIG.day_off;
    const updatedStaff = prev.staff.map(s => {
      if (s.id === targetStaffId) {
        return {
          ...s,
          fatigue: Math.max(0, s.fatigue - dayOffCfg.fatigueReduction),
          morale: Math.min(100, s.morale + dayOffCfg.moraleBoost),
          lastDayOffWeek: prev.currentWeek,
        };
      }
      return s;
    });

    return ok({
      ...prev, staff: updatedStaff,
      staffMoraleActionCount: (prev.staffMoraleActionCount || 0) + 1,
      weeksSinceLastMoraleAction: 0,
      cognition: bumpOps(prev),
    });
  }

  return fail(prev, `Unknown morale action: ${actionType}`);
}

function handleRetainStaff(prev: GameState, staffId: string, method: 'raise' | 'reduce_hours' | 'bonus'): ActionResult {
  const retainConfig = RETENTION_CONFIG[method];
  if (prev.cognition.level < retainConfig.minCognitionLevel) {
    return fail(prev, '认知等级不足，需要达到觉醒新手(Lv2)才能挽留员工');
  }

  const staff = prev.staff.find(s => s.id === staffId);
  if (!staff) return fail(prev, 'Staff not found');
  if (!staff.wantsToQuit) return fail(prev, '该员工没有离职意向');

  const success = Math.random() < retainConfig.successRate;

  if (method === 'raise') {
    const newSalary = Math.round(staff.salary * (1 + RETENTION_CONFIG.raise.salaryIncreaseRate));
    if (success) {
      const updatedStaff = prev.staff.map(s =>
        s.id === staffId
          ? { ...s, salary: newSalary, morale: Math.min(100, s.morale + RETENTION_CONFIG.raise.moraleBoost), wantsToQuit: false }
          : s
      );
      return ok({ ...prev, staff: updatedStaff, cognition: bumpOps(prev) });
    }
    // 失败：加薪生效但下周仍会离职
    const updatedStaff = prev.staff.map(s =>
      s.id === staffId ? { ...s, salary: newSalary } : s
    );
    return ok({ ...prev, staff: updatedStaff, cognition: bumpOps(prev) });
  }

  if (method === 'reduce_hours') {
    if (success) {
      const updatedStaff = prev.staff.map(s =>
        s.id === staffId
          ? {
              ...s,
              workDaysPerWeek: RETENTION_CONFIG.reduce_hours.targetDays,
              workHoursPerDay: RETENTION_CONFIG.reduce_hours.targetHours,
              fatigue: Math.max(0, s.fatigue - (RETENTION_CONFIG.reduce_hours as { fatigueReduction: number }).fatigueReduction),
              wantsToQuit: false,
            }
          : s
      );
      return ok({ ...prev, staff: updatedStaff, cognition: bumpOps(prev) });
    }
    return ok({ ...prev, cognition: bumpOps(prev) });
  }

  if (method === 'bonus') {
    const bonusCost = Math.round(staff.salary * RETENTION_CONFIG.bonus.costRatio);
    if (prev.cash < bonusCost) return fail(prev, '现金不足');

    if (success) {
      const updatedStaff = prev.staff.map(s =>
        s.id === staffId
          ? { ...s, morale: Math.min(100, s.morale + RETENTION_CONFIG.bonus.moraleBoost), wantsToQuit: false }
          : s
      );
      return ok({ ...prev, staff: updatedStaff, cash: prev.cash - bonusCost, cognition: bumpOps(prev) });
    }
    // 失败：钱花了但人留不住
    return ok({ ...prev, cash: prev.cash - bonusCost, cognition: bumpOps(prev) });
  }

  return fail(prev, `Unknown retention method: ${method}`);
}

// ============ v2.8 产品专注度 Handler ============

function handleSetStaffFocusProduct(prev: GameState, staffId: string, productId: string | null): ActionResult {
  const staff = prev.staff.find(s => s.id === staffId);
  if (!staff) return fail(prev, `Staff not found: ${staffId}`);

  // 校验：员工岗位需有产能（productionMultiplier > 0）
  const taskDef = TASK_DEFINITIONS.find(t => t.id === staff.assignedTask);
  if (!taskDef || taskDef.productionMultiplier <= 0) {
    return fail(prev, '当前岗位无产能，无法设置产品专注');
  }

  // 取消专注
  if (productId === null) {
    return ok({
      ...prev,
      staff: prev.staff.map(s =>
        s.id === staffId ? { ...s, focusProductId: undefined } : s
      ),
      cognition: bumpOps(prev),
    });
  }

  // 校验：产品在已选列表中
  if (!prev.selectedProducts.find(p => p.id === productId)) {
    return fail(prev, '该产品不在当前选品列表中');
  }

  // 校验：员工能处理该产品品类
  const product = prev.selectedProducts.find(p => p.id === productId)!;
  const staffType = staffTypes.find(st => st.id === staff.typeId);
  if (staffType && !staffType.canHandleProducts.includes(product.category as 'drink' | 'food' | 'snack' | 'meal')) {
    return fail(prev, '该员工无法处理此品类产品');
  }

  return ok({
    ...prev,
    staff: prev.staff.map(s =>
      s.id === staffId ? { ...s, focusProductId: productId } : s
    ),
    cognition: bumpOps(prev),
  });
}

// ============ v2.9 老板周行动 Handler ============

function handleSetBossAction(prev: GameState, actionType: BossActionType, role?: string, shopId?: string): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可设置老板行动');

  const config = getBossActionConfig(actionType);
  if (!config) return fail(prev, `未知行动类型: ${actionType}`);

  // 认知等级检查
  if (prev.cognition.level < config.minCognitionLevel) {
    return fail(prev, `认知等级不足，需要达到 Lv${config.minCognitionLevel}`);
  }

  // 费用预检（实际扣费在 weeklyTick 执行时）
  if (prev.cash < config.cost) return fail(prev, '现金不足');

  // 点击已选中的行动 → 切回默认（巡店督导）
  // 注意：当 shopId 有值时说明是在更新目标店铺，不应触发 toggle
  const isShopUpdate = shopId !== undefined;
  if (prev.bossAction.currentAction === actionType && actionType !== 'work_in_store' && !isShopUpdate) {
    return ok({
      ...prev,
      bossAction: { ...prev.bossAction, currentAction: 'supervise', workRole: undefined, targetShopId: undefined },
    });
  }

  const newBossAction = { ...prev.bossAction };
  newBossAction.currentAction = actionType;
  newBossAction.lastActionWeek = prev.currentWeek;

  // 亲自坐镇需要指定岗位
  if (actionType === 'work_in_store') {
    const validRoles = ['chef', 'waiter', 'cleaner'];
    newBossAction.workRole = role && validRoles.includes(role) ? role : 'waiter';
  } else {
    newBossAction.workRole = undefined;
  }

  // 考察/蹲点目标店铺
  if (actionType === 'investigate_nearby' || actionType === 'count_traffic') {
    newBossAction.targetShopId = shopId;
  } else {
    newBossAction.targetShopId = undefined;
  }

  return ok({
    ...prev,
    bossAction: newBossAction,
    cognition: bumpOps(prev),
  });
}

// ============ 出餐分配优先级 Handler ============

function handleSetSupplyPriority(prev: GameState, priority: SupplyPriority): ActionResult {
  if (prev.gamePhase !== 'operating') return fail(prev, '仅经营阶段可设置出餐分配');
  if (prev.supplyPriority === priority) return fail(prev, '已是当前模式');
  return ok({ ...prev, supplyPriority: priority });
}

// ============ v2.9 交互式事件 Handler ============

function handleRespondToEvent(prev: GameState, eventId: string, optionId: string): ActionResult {
  const pending = prev.pendingInteractiveEvent;
  if (!pending) return fail(prev, '没有待响应的事件');
  if (pending.id !== eventId) return fail(prev, `事件ID不匹配: ${eventId}`);

  // 纯通知型事件：应用 notificationEffects
  if (isNotificationEvent(pending) && optionId === '__notification__') {
    const stateAfterEffects = applyEventEffects(prev, pending.notificationEffects!, eventId);
    return ok({
      ...stateAfterEffects,
      pendingInteractiveEvent: null,
      lastInteractiveEventResponse: {
        eventId,
        optionId: '__notification__',
        week: prev.currentWeek,
        effects: pending.notificationEffects!,
      },
    });
  }

  const option = pending.options.find(o => o.id === optionId);
  if (!option) return fail(prev, `选项不存在: ${optionId}`);

  // 应用效果（传入 sourceEventId 用于延迟效果追踪）
  const stateAfterEffects = applyEventEffects(prev, option.effects, eventId);

  return ok({
    ...stateAfterEffects,
    pendingInteractiveEvent: null,
    lastInteractiveEventResponse: {
      eventId,
      optionId,
      week: prev.currentWeek,
      effects: option.effects,
    },
  });
}
