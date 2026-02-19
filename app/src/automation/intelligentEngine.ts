import type { GameAction } from '@/lib/gameActionTypes';
import type { CurrentStats } from '@/lib/gameQuery';
import type { GameState, SupplyDemandResult, Staff } from '@/types/game';
import { dispatch } from '@/lib/gameActions';
import { computeCurrentStats, computeSupplyDemandResult } from '@/lib/gameQuery';
import { createInitialGameState } from '@/lib/gameEngine';
import { staffTypes } from '@/data/gameData';
import { ALL_MARKETING_ACTIVITIES } from '@/data/marketingData';
import { PROMOTION_TIERS } from '@/data/deliveryData';
import type { AutomationFinding, DecisionSnapshot, RunSummary, SetupBlueprint, AggregateSummary } from './types';

interface CandidatePlan {
  id: string;
  rationale: string;
  actions: GameAction[];
}

interface PlanEvaluation {
  plan: CandidatePlan;
  score: number;
  nextState: GameState;
  statsAfter: CurrentStats;
  sdAfter: SupplyDemandResult | null;
  fulfillmentBefore: number;
  fulfillmentAfter: number;
  profitBefore: number;
  profitAfter: number;
  failedActions: string[];
  findings: AutomationFinding[];
  lowFulfillmentExposureRise: boolean;
}

const staffTypeById = new Map(staffTypes.map(s => [s.id, s]));
const marketingById = new Map(ALL_MARKETING_ACTIVITIES.map(a => [a.id, a]));

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function hashText(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function withSeed<T>(seed: number, fn: () => T): T {
  const originalRandom = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function weekSeed(baseSeed: number, week: number, salt: string): number {
  return (baseSeed + week * 131 + hashText(salt)) >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getFulfillment(sd: SupplyDemandResult | null): number {
  if (!sd) return 1;
  if (sd.demand.totalDemand <= 0) return 1;
  return clamp(sd.totalSales / Math.max(1, sd.demand.totalDemand), 0, 1);
}

function actionSignature(actions: GameAction[]): string {
  return actions.map(a => JSON.stringify(a)).join('|');
}

function addPlan(plans: CandidatePlan[], seen: Set<string>, plan: CandidatePlan): void {
  if (plan.actions.length === 0 && plans.some(p => p.id === plan.id)) return;
  const sig = `${plan.id}::${actionSignature(plan.actions)}`;
  if (seen.has(sig)) return;
  seen.add(sig);
  plans.push(plan);
}

function promotionIndexById(tierId: string): number {
  const idx = PROMOTION_TIERS.findIndex(t => t.id === tierId);
  return idx >= 0 ? idx : 0;
}

function ensureSetupAction(state: GameState, action: GameAction, context: string): GameState {
  const result = dispatch(state, action);
  if (!result.changed || result.error) {
    throw new Error(`Setup failed (${context}): ${result.error || 'unknown error'}`);
  }
  return result.state;
}

export function buildScenarioInitialState(blueprint: SetupBlueprint, seed: number): GameState {
  return withSeed(seed, () => {
    let state = createInitialGameState();

    state = ensureSetupAction(state, { type: 'select_brand', brandId: blueprint.brandId }, 'select_brand');
    state = ensureSetupAction(state, { type: 'select_location', locationId: blueprint.locationId }, 'select_location');
    state = ensureSetupAction(state, { type: 'select_address', addressId: blueprint.addressId }, 'select_address');
    state = ensureSetupAction(state, { type: 'select_decoration', decorationId: blueprint.decorationId }, 'select_decoration');

    for (const productId of blueprint.productIds) {
      state = ensureSetupAction(state, { type: 'toggle_product', productId }, `toggle_product:${productId}`);
    }

    for (const staff of blueprint.staffPlan) {
      state = ensureSetupAction(state, { type: 'add_staff', staffTypeId: staff.staffTypeId }, `add_staff:${staff.staffTypeId}`);
    }

    state = ensureSetupAction(state, { type: 'open_store', season: blueprint.startSeason }, 'open_store');

    for (let i = 0; i < blueprint.staffPlan.length; i++) {
      const target = blueprint.staffPlan[i];
      const staff = state.staff[i];
      if (!staff) continue;
      const result = dispatch(state, {
        type: 'assign_staff_task',
        staffId: staff.id,
        taskType: target.task,
      });
      if (result.changed && !result.error) {
        state = result.state;
      }
    }

    return state;
  });
}

function buildPricingActions(
  state: GameState,
  sd: SupplyDemandResult | null,
  mode: 'margin_repair' | 'demand_stimulus' | 'balanced',
): GameAction[] {
  if (!sd) return [];

  const sales = [...sd.productSales].sort((a, b) => b.revenue - a.revenue);
  const actions: GameAction[] = [];

  for (const sale of sales.slice(0, 4)) {
    const product = state.selectedProducts.find(p => p.id === sale.productId);
    if (!product) continue;

    const current = state.productPrices[product.id] ?? product.basePrice;
    const minPrice = Math.max(product.baseCost * 1.3, 3);
    const maxPrice = Math.max(minPrice + 1, product.referencePrice * 1.35);

    let target = current;
    if (mode === 'margin_repair') {
      target = current * 1.06;
      if (sale.bottleneck === 'demand' && current > product.referencePrice * 1.15) {
        target = current * 0.98;
      }
    } else if (mode === 'demand_stimulus') {
      if (sale.bottleneck === 'demand') {
        target = Math.min(current * 0.94, product.referencePrice * 0.96);
      }
    } else {
      if (sale.bottleneck === 'supply_capacity' || sale.bottleneck === 'supply_inventory') {
        target = current * 1.05;
      } else if (sale.bottleneck === 'demand' && current > product.referencePrice * 1.03) {
        target = current * 0.97;
      }
    }

    target = clamp(target, minPrice, maxPrice);
    const rounded = Math.round(target * 10) / 10;

    if (Math.abs(rounded - current) >= 0.8) {
      actions.push({ type: 'set_product_price', productId: product.id, price: rounded });
    }
  }

  return actions;
}

function chooseEligibleStaff(state: GameState, task: string, exclude: Set<string>): Staff[] {
  return state.staff
    .filter(s => !exclude.has(s.id))
    .filter(s => {
      const type = staffTypeById.get(s.typeId);
      return Boolean(type?.availableTasks?.includes(task));
    });
}

function buildTaskRebalanceActions(state: GameState, fulfillment: number): GameAction[] {
  if (state.staff.length === 0) return [];

  const hasHeavyFood = state.selectedProducts.some(p => p.category === 'meal' || p.category === 'food');
  const chefsBase = hasHeavyFood ? 2 : 1;
  const chefTarget = clamp(
    chefsBase + (fulfillment < 0.78 ? 1 : 0),
    1,
    Math.max(1, state.staff.length - 1),
  );
  const marketerTarget = state.exposure < 38 ? 1 : 0;
  const cleanerTarget = state.cleanliness < 55 ? 1 : 0;
  const managerTarget = state.staff.length >= 4 && state.reputation < 60 ? 1 : 0;

  const desiredTaskByStaffId = new Map<string, string>();
  const assigned = new Set<string>();

  const fillTask = (
    task: string,
    count: number,
    sorter: (a: Staff, b: Staff) => number,
  ) => {
    if (count <= 0) return;
    const pool = chooseEligibleStaff(state, task, assigned).sort(sorter);
    for (const staff of pool.slice(0, count)) {
      desiredTaskByStaffId.set(staff.id, task);
      assigned.add(staff.id);
    }
  };

  fillTask('manager', managerTarget, (a, b) => (b.skillLevel - a.skillLevel) || (b.efficiency - a.efficiency));
  fillTask('chef', chefTarget, (a, b) => b.efficiency - a.efficiency);
  fillTask('marketer', marketerTarget, (a, b) => b.efficiency - a.efficiency);
  fillTask('cleaner', cleanerTarget, (a, b) => a.efficiency - b.efficiency);

  const waiterPool = chooseEligibleStaff(state, 'waiter', assigned).sort((a, b) => b.serviceQuality - a.serviceQuality);
  for (const staff of waiterPool) {
    desiredTaskByStaffId.set(staff.id, 'waiter');
    assigned.add(staff.id);
  }

  const actions: GameAction[] = [];
  for (const staff of state.staff) {
    const desired = desiredTaskByStaffId.get(staff.id);
    if (!desired) continue;
    if (staff.assignedTask !== desired) {
      actions.push({ type: 'assign_staff_task', staffId: staff.id, taskType: desired });
    }
  }

  return actions.slice(0, 5);
}

function buildRestockActions(state: GameState, fulfillment: number, profit: number): GameAction[] {
  if (state.cognition.level < 1 || state.inventoryState.items.length === 0) return [];

  let strategy: 'auto_conservative' | 'auto_standard' | 'auto_aggressive' = 'auto_standard';
  if (fulfillment < 0.8) strategy = 'auto_aggressive';
  else if (fulfillment > 0.97 && profit < 0) strategy = 'auto_conservative';

  const actions: GameAction[] = [];
  for (const item of state.inventoryState.items) {
    if (item.restockStrategy !== strategy) {
      actions.push({ type: 'set_restock_strategy', productId: item.productId, strategy });
    }
  }

  return actions;
}

function buildMarketingActions(state: GameState, profit: number): GameAction[] {
  const active = new Set(state.activeMarketingActivities.map(a => a.id));
  const actions: GameAction[] = [];

  if (state.exposure < 35 && !active.has('social_media') && state.cash >= 2500) {
    actions.push({ type: 'start_marketing', activityId: 'social_media' });
  }

  if (state.reputation < 45 && !active.has('ingredient_upgrade') && state.cash >= 1200) {
    actions.push({ type: 'start_marketing', activityId: 'ingredient_upgrade' });
  }

  if (state.reputation < 40 && !active.has('service_training') && state.cash >= 1500) {
    actions.push({ type: 'start_marketing', activityId: 'service_training' });
  }

  if (state.cognition.level < 2 && state.cash > 3000 && (state.currentWeek % 3 === 0)) {
    actions.push({ type: 'consult_yong_ge' });
  }

  if (profit < -3500 || state.cash < 8000) {
    const expensive = [...state.activeMarketingActivities]
      .sort((a, b) => b.weeklyCost - a.weeklyCost)
      .find(a => (marketingById.get(a.id)?.type || a.type) === 'continuous');
    if (expensive) {
      actions.push({ type: 'stop_marketing', activityId: expensive.id });
    }
  }

  return actions.slice(0, 3);
}

function buildDeliveryActions(state: GameState, profit: number, fulfillment: number): GameAction[] {
  const actions: GameAction[] = [];

  if (state.cognition.level >= 2 && state.deliveryState.platforms.length === 0 && state.cash > 12000) {
    actions.push({ type: 'join_platform', platformId: 'meituan' });
  }

  if (state.cognition.level >= 3 && state.deliveryState.platforms.length === 1 && state.cash > 22000) {
    const existsEleme = state.deliveryState.platforms.some(p => p.platformId === 'eleme');
    if (!existsEleme) {
      actions.push({ type: 'join_platform', platformId: 'eleme' });
    }
  }

  for (const platform of state.deliveryState.platforms) {
    if (platform.activeWeeks > 10 && platform.platformExposure < 2 && profit < 0) {
      actions.push({ type: 'leave_platform', platformId: platform.platformId });
      continue;
    }

    let targetTier = platform.promotionTierId;
    if (fulfillment < 0.75) {
      targetTier = 'none';
    } else if (platform.platformExposure < 8 && state.cash > 10000) {
      targetTier = 'basic';
    } else if (platform.platformExposure < 18 && profit > 1800 && state.cash > 22000) {
      targetTier = 'advanced';
    } else if (profit < -2500 || state.cash < 7000) {
      targetTier = 'none';
    }

    if (targetTier !== platform.promotionTierId) {
      actions.push({
        type: 'toggle_promotion',
        platformId: platform.platformId,
        tierIndex: promotionIndexById(targetTier),
      });
    }
  }

  return actions.slice(0, 4);
}

function buildCandidatePlans(state: GameState): CandidatePlan[] {
  const stats = computeCurrentStats(state);
  const sd = computeSupplyDemandResult(state);
  const fulfillment = getFulfillment(sd);

  const seen = new Set<string>();
  const plans: CandidatePlan[] = [];

  const pricingRepair = buildPricingActions(state, sd, 'margin_repair');
  const pricingStimulus = buildPricingActions(state, sd, 'demand_stimulus');
  const pricingBalanced = buildPricingActions(state, sd, 'balanced');
  const taskRebalance = buildTaskRebalanceActions(state, fulfillment);
  const restock = buildRestockActions(state, fulfillment, stats.profit);
  const marketing = buildMarketingActions(state, stats.profit);
  const delivery = buildDeliveryActions(state, stats.profit, fulfillment);

  addPlan(plans, seen, {
    id: 'baseline_hold',
    rationale: '不执行额外动作，只推进一周，作为对照基线。',
    actions: [],
  });

  addPlan(plans, seen, {
    id: 'price_margin_repair',
    rationale: '优先修复毛利，缓解现金流压力。',
    actions: pricingRepair,
  });

  addPlan(plans, seen, {
    id: 'price_demand_stimulus',
    rationale: '通过需求导向定价提高销量。',
    actions: pricingStimulus,
  });

  addPlan(plans, seen, {
    id: 'ops_rebalance',
    rationale: '重排岗位并修正补货策略，提高履约稳定性。',
    actions: [...taskRebalance, ...restock],
  });

  addPlan(plans, seen, {
    id: 'growth_push',
    rationale: '增长优先：营销+外卖联动推动认知扩张。',
    actions: [...delivery, ...marketing],
  });

  addPlan(plans, seen, {
    id: 'balanced_mixed',
    rationale: '平衡推进：定价、岗位、补货、营销协同。',
    actions: [...pricingBalanced, ...taskRebalance, ...restock, ...marketing.slice(0, 1)],
  });

  addPlan(plans, seen, {
    id: 'cash_guard',
    rationale: '现金优先：降运营开支并保守推进。',
    actions: [
      ...state.activeMarketingActivities
        .sort((a, b) => b.weeklyCost - a.weeklyCost)
        .slice(0, 1)
        .map(a => ({ type: 'stop_marketing', activityId: a.id } as GameAction)),
      ...state.deliveryState.platforms
        .filter(p => p.promotionTierId !== 'none')
        .slice(0, 1)
        .map(p => ({ type: 'toggle_promotion', platformId: p.platformId, tierIndex: promotionIndexById('none') } as GameAction)),
      ...pricingRepair.slice(0, 2),
    ],
  });

  return plans.filter(plan => plan.actions.length > 0 || plan.id === 'baseline_hold');
}

function evaluatePlan(state: GameState, plan: CandidatePlan, seed: number): PlanEvaluation {
  return withSeed(seed, () => {
    const beforeStats = computeCurrentStats(state);
    const beforeSd = computeSupplyDemandResult(state);
    const beforeFulfillment = getFulfillment(beforeSd);

    let next = cloneState(state);
    const failed: string[] = [];

    for (const action of plan.actions) {
      const result = dispatch(next, action);
      if (result.changed && !result.error) {
        next = result.state;
      } else if (result.error) {
        failed.push(`${action.type}: ${result.error}`);
      }
    }

    const weekResult = dispatch(next, { type: 'next_week' });
    if (!weekResult.changed || weekResult.error) {
      failed.push(`next_week: ${weekResult.error || 'failed'}`);
      const fallbackStats = computeCurrentStats(next);
      return {
        plan,
        score: -1e12,
        nextState: next,
        statsAfter: fallbackStats,
        sdAfter: computeSupplyDemandResult(next),
        fulfillmentBefore: beforeFulfillment,
        fulfillmentAfter: getFulfillment(computeSupplyDemandResult(next)),
        profitBefore: beforeStats.profit,
        profitAfter: fallbackStats.profit,
        failedActions: failed,
        findings: [{
          severity: 'critical',
          category: 'engine_bug',
          code: 'NEXT_WEEK_FAILED',
          message: `next_week 执行失败: ${weekResult.error || 'unknown'}`,
          suspectedModule: 'app/src/lib/gameActions.ts',
          week: state.currentWeek + 1,
        }],
        lowFulfillmentExposureRise: false,
      };
    }

    next = weekResult.state;
    const afterStats = computeCurrentStats(next);
    const afterSd = computeSupplyDemandResult(next);
    const afterFulfillment = getFulfillment(afterSd);

    const { findings, lowFulfillmentExposureRise } = detectRuntimeFindings(next, state, afterStats, afterSd);

    let score = 0;
    score += afterStats.profit * 9;
    score += next.cash * 0.04;
    score += afterFulfillment * 2200;
    score += next.reputation * 75;
    score += next.exposure * 45;
    score += (next.growthSystem?.launchProgress ?? 0) * 24;
    score += (next.growthSystem?.trustConfidence ?? 0) * 800;
    score += (next.cumulativeProfit || 0) * 0.6;

    if (afterStats.profit < 0) score += afterStats.profit * 8;
    score -= failed.length * 700;

    if (next.gamePhase === 'ended' && next.gameOverReason === 'bankrupt') {
      score -= 1e9;
    }
    if (next.gamePhase === 'ended' && next.gameOverReason === 'win') {
      score += 1e9;
    }

    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    score -= criticalCount * 1200;

    return {
      plan,
      score,
      nextState: next,
      statsAfter: afterStats,
      sdAfter: afterSd,
      fulfillmentBefore: beforeFulfillment,
      fulfillmentAfter: afterFulfillment,
      profitBefore: beforeStats.profit,
      profitAfter: afterStats.profit,
      failedActions: failed,
      findings,
      lowFulfillmentExposureRise,
    };
  });
}

function detectRuntimeFindings(
  state: GameState,
  prevState: GameState,
  stats: CurrentStats,
  sd: SupplyDemandResult | null,
): { findings: AutomationFinding[]; lowFulfillmentExposureRise: boolean } {
  const findings: AutomationFinding[] = [];

  const numericChecks: Array<{ label: string; value: number; module: string }> = [
    { label: 'cash', value: state.cash, module: 'app/src/lib/gameEngine.ts' },
    { label: 'weeklyRevenue', value: state.weeklyRevenue, module: 'app/src/lib/gameEngine.ts' },
    { label: 'weeklyVariableCost', value: state.weeklyVariableCost, module: 'app/src/lib/gameEngine.ts' },
    { label: 'weeklyFixedCost', value: state.weeklyFixedCost, module: 'app/src/lib/gameEngine.ts' },
    { label: 'exposure', value: state.exposure, module: 'app/src/lib/gameEngine.ts' },
    { label: 'reputation', value: state.reputation, module: 'app/src/lib/gameEngine.ts' },
    { label: 'cleanliness', value: state.cleanliness, module: 'app/src/lib/gameEngine.ts' },
    { label: 'profit', value: stats.profit, module: 'app/src/lib/gameQuery.ts' },
  ];

  for (const check of numericChecks) {
    if (!Number.isFinite(check.value)) {
      findings.push({
        severity: 'critical',
        category: 'engine_bug',
        code: 'NON_FINITE_NUMBER',
        message: `${check.label} 出现非有限数值: ${String(check.value)}`,
        suspectedModule: check.module,
        week: state.currentWeek,
      });
    }
  }

  if (state.exposure < 0 || state.exposure > 100) {
    findings.push({
      severity: 'critical',
      category: 'engine_bug',
      code: 'EXPOSURE_OUT_OF_RANGE',
      message: `exposure 越界: ${state.exposure}`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
      week: state.currentWeek,
    });
  }

  if (state.reputation < 0 || state.reputation > 100) {
    findings.push({
      severity: 'critical',
      category: 'engine_bug',
      code: 'REPUTATION_OUT_OF_RANGE',
      message: `reputation 越界: ${state.reputation}`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
      week: state.currentWeek,
    });
  }

  const gs = state.growthSystem;
  if (gs) {
    const growthChecks: Array<{ label: string; value: number; min: number; max: number }> = [
      { label: 'launchProgress', value: gs.launchProgress, min: 0, max: 100 },
      { label: 'awarenessFactor', value: gs.awarenessFactor, min: 0.25, max: 1.0 },
      { label: 'awarenessStock', value: gs.awarenessStock, min: 0, max: 100 },
      { label: 'campaignPulse', value: gs.campaignPulse, min: 0, max: 60 },
      { label: 'trustConfidence', value: gs.trustConfidence, min: 0, max: 1 },
      { label: 'repeatIntent', value: gs.repeatIntent, min: 0, max: 100 },
    ];
    for (const item of growthChecks) {
      if (!Number.isFinite(item.value) || item.value < item.min - 1e-6 || item.value > item.max + 1e-6) {
        findings.push({
          severity: 'critical',
          category: 'engine_bug',
          code: 'GROWTH_SYSTEM_OUT_OF_RANGE',
          message: `${item.label} 越界: ${item.value} (期望 ${item.min}-${item.max})`,
          suspectedModule: 'app/src/lib/gameEngine.ts',
          week: state.currentWeek,
        });
      }
    }
  }

  const platformExposureSum = state.deliveryState.platforms.reduce((sum, p) => sum + p.platformExposure, 0);
  const platformExposureGap = Math.abs(platformExposureSum - state.deliveryState.totalPlatformExposure);
  if (platformExposureGap > 0.8) {
    findings.push({
      severity: 'warning',
      category: 'engine_bug',
      code: 'DELIVERY_EXPOSURE_SUM_MISMATCH',
      message: `deliveryState.totalPlatformExposure 与平台曝光和不一致，差值 ${platformExposureGap.toFixed(2)}`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
      week: state.currentWeek,
    });
  }

  if (state.weeklySummary) {
    if (state.weeklySummary.week !== state.currentWeek) {
      findings.push({
        severity: 'warning',
        category: 'engine_bug',
        code: 'SUMMARY_WEEK_MISMATCH',
        message: `weeklySummary.week=${state.weeklySummary.week} 与 currentWeek=${state.currentWeek} 不一致`,
        suspectedModule: 'app/src/lib/gameEngine.ts',
        week: state.currentWeek,
      });
    }
    if (Math.abs(state.weeklySummary.cashRemaining - state.cash) > 0.5) {
      findings.push({
        severity: 'warning',
        category: 'engine_bug',
        code: 'SUMMARY_CASH_MISMATCH',
        message: `weeklySummary.cashRemaining=${state.weeklySummary.cashRemaining} 与 state.cash=${state.cash} 不一致`,
        suspectedModule: 'app/src/lib/gameEngine.ts',
        week: state.currentWeek,
      });
    }
  }

  let lowFulfillmentExposureRise = false;
  if (sd) {
    const totalSalesCheck = sd.productSales.reduce((sum, p) => sum + p.actualSales, 0);
    const totalRevenueCheck = sd.productSales.reduce((sum, p) => sum + p.revenue, 0);

    if (Math.abs(totalSalesCheck - sd.totalSales) > 0.5) {
      findings.push({
        severity: 'critical',
        category: 'engine_bug',
        code: 'TOTAL_SALES_MISMATCH',
        message: `totalSales 不一致: 明细和=${totalSalesCheck}, 汇总=${sd.totalSales}`,
        suspectedModule: 'app/src/lib/supplyDemand/index.ts',
        week: state.currentWeek,
      });
    }

    if (Math.abs(totalRevenueCheck - sd.totalRevenue) > 1.0) {
      findings.push({
        severity: 'critical',
        category: 'engine_bug',
        code: 'TOTAL_REVENUE_MISMATCH',
        message: `totalRevenue 不一致: 明细和=${totalRevenueCheck}, 汇总=${sd.totalRevenue}`,
        suspectedModule: 'app/src/lib/supplyDemand/index.ts',
        week: state.currentWeek,
      });
    }

    if (sd.totalSales - sd.demand.totalDemand > 0.5) {
      findings.push({
        severity: 'critical',
        category: 'engine_bug',
        code: 'SALES_EXCEED_DEMAND',
        message: `销量超过需求: sales=${sd.totalSales}, demand=${sd.demand.totalDemand}`,
        suspectedModule: 'app/src/lib/supplyDemand/index.ts',
        week: state.currentWeek,
      });
    }

    const fulfillment = getFulfillment(sd);
    for (const platform of state.deliveryState.platforms) {
      // v3.0: 用权重分增量替代旧的 lastExposureDelta
      const weightGain = platform.platformExposure - (platform.lastWeightBase ?? 0);
      if (fulfillment < 0.65 && weightGain > 0.8) {
        lowFulfillmentExposureRise = true;
      }
    }

    if (lowFulfillmentExposureRise) {
      findings.push({
        severity: 'warning',
        category: 'balance',
        code: 'LOW_FULFILLMENT_BUT_EXPOSURE_RISE',
        message: '低履约周仍出现明显平台曝光正增长，平台分发惩罚可能偏弱。',
        suspectedModule: 'app/src/lib/gameEngine.ts',
        week: state.currentWeek,
      });
    }
  }

  const exposureDelta = state.exposure - prevState.exposure;
  if ((prevState.weeksSinceLastAction || 0) >= 3 && exposureDelta > 3.5) {
    findings.push({
      severity: 'warning',
      category: 'balance',
      code: 'IDLE_EXPOSURE_SPIKE',
      message: `长期不操作时曝光仍大幅上涨 (Δ${exposureDelta.toFixed(2)})，可能存在自动增长偏置。`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
      week: state.currentWeek,
    });
  }

  if (state.gamePhase === 'operating' && state.cash < -5000) {
    findings.push({
      severity: 'warning',
      category: 'engine_bug',
      code: 'NEGATIVE_CASH_NOT_ENDED',
      message: `现金低于破产线但游戏未结束: cash=${state.cash}`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
      week: state.currentWeek,
    });
  }

  return { findings, lowFulfillmentExposureRise };
}

export function runSingleSimulation(
  blueprint: SetupBlueprint,
  seed: number,
  maxWeeks: number,
): RunSummary {
  let state = buildScenarioInitialState(blueprint, seed);
  const decisions: DecisionSnapshot[] = [];
  const findings: AutomationFinding[] = [];
  let profitSum = 0;
  let fulfillmentSum = 0;
  let weekCounter = 0;
  let week20DualTop = false;
  let lowFulfillmentExposureRiseWeeks = 0;

  while (state.gamePhase === 'operating' && weekCounter < maxWeeks) {
    const plans = buildCandidatePlans(state);
    const evaluations = plans.map((plan, index) =>
      evaluatePlan(state, plan, weekSeed(seed, state.currentWeek + 1, `${plan.id}_${index}`))
    );

    const best = evaluations.reduce((acc, cur) => (cur.score > acc.score ? cur : acc), evaluations[0]);

    state = best.nextState;
    weekCounter += 1;
    profitSum += best.profitAfter;
    fulfillmentSum += best.fulfillmentAfter;

    if (state.currentWeek === 20 && state.exposure >= 95 && state.reputation >= 95) {
      week20DualTop = true;
    }

    findings.push(...best.findings);
    if (best.lowFulfillmentExposureRise) {
      lowFulfillmentExposureRiseWeeks += 1;
    }

    decisions.push({
      week: state.currentWeek,
      planId: best.plan.id,
      rationale: best.plan.rationale,
      actions: best.plan.actions,
      score: best.score,
      profitBefore: best.profitBefore,
      profitAfter: best.profitAfter,
      fulfillmentBefore: best.fulfillmentBefore,
      fulfillmentAfter: best.fulfillmentAfter,
      failedActions: best.failedActions,
    });

    if (state.gamePhase === 'ended') break;
  }

  const avgProfit = weekCounter > 0 ? profitSum / weekCounter : 0;
  const avgFulfillment = weekCounter > 0 ? fulfillmentSum / weekCounter : 0;

  return {
    scenarioId: blueprint.id,
    scenarioName: blueprint.name,
    seed,
    finalWeek: state.currentWeek,
    isWin: state.gameOverReason === 'win',
    isBankrupt: state.gameOverReason === 'bankrupt',
    finalCash: state.cash,
    cumulativeProfit: state.cumulativeProfit || 0,
    roi: state.totalInvestment > 0 ? ((state.cumulativeProfit || 0) / state.totalInvestment) * 100 : 0,
    avgProfit,
    avgFulfillment,
    week20DualTopRate: week20DualTop,
    lowFulfillmentExposureRiseWeeks,
    findings,
    decisions,
  };
}

export function buildAggregateSummary(runs: RunSummary[]): AggregateSummary {
  const totalRuns = runs.length;
  const winCount = runs.filter(r => r.isWin).length;
  const bankruptCount = runs.filter(r => r.isBankrupt).length;
  const dualTopCount = runs.filter(r => r.week20DualTopRate).length;

  const totalFindings = runs.flatMap(r => r.findings);
  const critical = totalFindings.filter(f => f.severity === 'critical').length;
  const warning = totalFindings.filter(f => f.severity === 'warning').length;
  const info = totalFindings.filter(f => f.severity === 'info').length;

  const avg = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  const lowFulfillmentExposureRiseRate = avg(
    runs.map(r => (r.finalWeek > 0 ? r.lowFulfillmentExposureRiseWeeks / r.finalWeek : 0))
  );

  return {
    totalRuns,
    winRate: totalRuns > 0 ? winCount / totalRuns : 0,
    bankruptRate: totalRuns > 0 ? bankruptCount / totalRuns : 0,
    averageFinalCash: avg(runs.map(r => r.finalCash)),
    averageRoi: avg(runs.map(r => r.roi)),
    averageProfit: avg(runs.map(r => r.avgProfit)),
    averageFulfillment: avg(runs.map(r => r.avgFulfillment)),
    dualTopByWeek20Rate: totalRuns > 0 ? dualTopCount / totalRuns : 0,
    lowFulfillmentExposureRiseRate,
    findingCounts: {
      critical,
      warning,
      info,
    },
  };
}

export function buildBalanceAlerts(aggregate: AggregateSummary, runs: RunSummary[]): AutomationFinding[] {
  const alerts: AutomationFinding[] = [];

  if (aggregate.winRate < 0.15) {
    alerts.push({
      severity: 'critical',
      category: 'balance',
      code: 'WIN_RATE_TOO_LOW',
      message: `总体胜率仅 ${(aggregate.winRate * 100).toFixed(1)}%，难度偏高。`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
    });
  } else if (aggregate.winRate > 0.75) {
    alerts.push({
      severity: 'critical',
      category: 'balance',
      code: 'WIN_RATE_TOO_HIGH',
      message: `总体胜率达 ${(aggregate.winRate * 100).toFixed(1)}%，难度偏低。`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
    });
  }

  if (aggregate.bankruptRate > 0.5) {
    alerts.push({
      severity: 'warning',
      category: 'balance',
      code: 'BANKRUPT_RATE_HIGH',
      message: `破产率 ${(aggregate.bankruptRate * 100).toFixed(1)}% 过高，可能存在开局挫败感。`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
    });
  }

  if (aggregate.dualTopByWeek20Rate > 0.2) {
    alerts.push({
      severity: 'warning',
      category: 'balance',
      code: 'DUAL_TOP_TOO_FAST',
      message: `第20周曝光/口碑双高占比 ${(aggregate.dualTopByWeek20Rate * 100).toFixed(1)}%，成长可能过快。`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
    });
  }

  if (aggregate.lowFulfillmentExposureRiseRate > 0.1) {
    alerts.push({
      severity: 'warning',
      category: 'balance',
      code: 'DELIVERY_RANK_PENALTY_WEAK',
      message: `低履约周平台曝光仍上涨占比 ${(aggregate.lowFulfillmentExposureRiseRate * 100).toFixed(1)}%，排序惩罚可能偏弱。`,
      suspectedModule: 'app/src/lib/gameEngine.ts',
    });
  }

  const criticalEngineFindings = runs
    .flatMap(r => r.findings)
    .filter(f => f.category === 'engine_bug' && f.severity === 'critical').length;

  if (criticalEngineFindings > 0) {
    alerts.push({
      severity: 'critical',
      category: 'engine_bug',
      code: 'CRITICAL_ENGINE_FINDINGS',
      message: `检测到 ${criticalEngineFindings} 条关键引擎异常，需优先修复。`,
    });
  }

  const riskProbeRuns = runs.filter(r => r.scenarioId === 'risk_probe_high_cost');
  if (riskProbeRuns.length > 0) {
    const riskProbeWinRate = riskProbeRuns.filter(r => r.isWin).length / riskProbeRuns.length;
    if (riskProbeWinRate > 0.35) {
      alerts.push({
        severity: 'warning',
        category: 'balance',
        code: 'RISK_PROBE_TOO_SAFE',
        message: `高风险探针场景胜率 ${(riskProbeWinRate * 100).toFixed(1)}%，风险惩罚可能不足。`,
        suspectedModule: 'app/src/data/gameData.ts',
      });
    }
  }

  return alerts;
}
