// 提案验证模拟器
// 用真实的供需模型验证勇哥建议是否能改善盈利
// v2.7: 复用 gameEngine 的成本计算函数，修复营销费用/变动成本/推广费用 bug

import type { GameState } from '@/types/game';
import { calculateSupplyDemand } from '@/lib/supplyDemand';
import { calculateVariableCost, calculateWeeklyFixedCost } from '@/lib/gameEngine';
import { EXPOSURE_ACTIVITIES, REPUTATION_ACTIVITIES, MIXED_ACTIVITIES } from '@/data/marketingData';
import { DELIVERY_PLATFORMS, PROMOTION_TIERS } from '@/data/deliveryData';
import type { Proposal } from './prompts';

export interface SimulationResult {
  currentProfit: number;
  projectedProfit: number;
  projectedRevenue: number;
  projectedFixedCost: number;
  improvement: number;       // 利润改善额
  isProfitable: boolean;
  appliedProposals: string[]; // 成功应用的提案描述
  failedProposals: string[];  // 无法应用的提案描述
}

const ALL_ACTIVITIES = [...EXPOSURE_ACTIVITIES, ...REPUTATION_ACTIVITIES, ...MIXED_ACTIVITIES];

/**
 * 将提案应用到 GameState 的深拷贝上，运行供需模型，返回预测结果
 */
export function simulateProposals(
  gameState: GameState,
  _currentRevenue: number,
  _currentFixedCost: number,
  currentProfit: number,
  proposals: Proposal[]
): SimulationResult {
  void _currentRevenue;
  void _currentFixedCost;
  // 深拷贝 GameState（确保所有可变字段都被复制）
  const simState: GameState = JSON.parse(JSON.stringify(gameState));

  const applied: string[] = [];
  const failed: string[] = [];

  // 逐个应用提案
  for (const proposal of proposals) {
    const ok = applyProposal(simState, proposal);
    if (ok) {
      applied.push(proposal.label);
    } else {
      failed.push(proposal.label);
    }
  }

  // 运行供需模型
  const sdResult = calculateSupplyDemand(simState);
  const projectedRevenue = sdResult.totalRevenue;

  // 复用引擎的固定成本计算（包含租金、工资、水电、基础营销、折旧）
  const projectedFixedCost = calculateWeeklyFixedCost(simState);

  // 复用引擎的变动成本计算（包含加盟抽成、外卖佣金/包装、损耗、持有成本、营销活动费用）
  const projectedVariableCost = calculateVariableCost(projectedRevenue, simState, sdResult);

  // 外卖推广费用（不在固定/变动成本中，需单独计算）
  let weeklyPromotionCost = 0;
  simState.deliveryState.platforms.forEach(ap => {
    if (ap.promotionTierId !== 'none') {
      const tier = PROMOTION_TIERS.find(t => t.id === ap.promotionTierId);
      if (tier) weeklyPromotionCost += tier.weeklyCost;
    }
  });

  const projectedProfit = projectedRevenue - projectedVariableCost - projectedFixedCost - weeklyPromotionCost;

  return {
    currentProfit,
    projectedProfit,
    projectedRevenue,
    projectedFixedCost,
    improvement: projectedProfit - currentProfit,
    isProfitable: projectedProfit > 0,
    appliedProposals: applied,
    failedProposals: failed,
  };
}

function applyProposal(state: GameState, proposal: Proposal): boolean {
  switch (proposal.type) {
    case 'fire_staff': {
      // 优先使用 staffId 精确匹配（与 App.tsx handleApplyProposals 一致）
      const staffId = proposal.params.staffId ? String(proposal.params.staffId) : null;
      if (staffId) {
        const idx = state.staff.findIndex(s => s.id === staffId);
        if (idx >= 0) { state.staff.splice(idx, 1); return true; }
      }
      // 兼容旧版：fallback 到 index
      const idx = Number(proposal.params.index);
      if (idx >= 0 && idx < state.staff.length) {
        state.staff.splice(idx, 1);
        return true;
      }
      return false;
    }

    case 'set_price': {
      const pid = String(proposal.params.productId);
      const price = Number(proposal.params.price);
      const product = state.selectedProducts.find(p => p.id === pid);
      if (product && price > 0 && price < 100) {
        state.productPrices[pid] = price;
        return true;
      }
      return false;
    }

    case 'start_marketing': {
      const aid = String(proposal.params.activityId);
      const config = ALL_ACTIVITIES.find(a => a.id === aid);
      if (!config) return false;
      // 检查是否已在进行
      if (state.activeMarketingActivities.some(a => a.id === aid)) return false;
      state.activeMarketingActivities.push({
        ...config,
        weeklyCost: config.baseCost, // 修复: baseCost 已经是周费用，不应再除以4
        startWeek: state.currentWeek,
        activeWeeks: 0,
      } as never);
      // 模拟曝光/口碑提升效果
      state.exposure = Math.min(100, state.exposure + config.exposureBoost);
      state.reputation = Math.min(100, state.reputation + config.reputationBoost);
      return true;
    }

    case 'stop_marketing': {
      const aid = String(proposal.params.activityId);
      const idx = state.activeMarketingActivities.findIndex(a => a.id === aid);
      if (idx >= 0) {
        state.activeMarketingActivities.splice(idx, 1);
        return true;
      }
      return false;
    }

    case 'change_restock': {
      const strategyName = String(proposal.params.strategy);
      const strategyMap: Record<string, 'auto_conservative' | 'auto_standard' | 'auto_aggressive'> = {
        conservative: 'auto_conservative',
        standard: 'auto_standard',
        aggressive: 'auto_aggressive',
      };
      const restockStrategy = strategyMap[strategyName];
      if (restockStrategy && state.inventoryState) {
        // 更新每个库存项的补货策略
        const multiplier = strategyName === 'aggressive' ? 2.0 : strategyName === 'standard' ? 1.5 : 1.0;
        state.inventoryState.items = state.inventoryState.items.map(item => ({
          ...item,
          restockStrategy,
          quantity: Math.ceil(multiplier * 80),
        }));
        return true;
      }
      return false;
    }

    case 'hire_staff': {
      const task = String(proposal.params.task);
      if (!['chef', 'waiter', 'marketer', 'cleaner'].includes(task)) return false;
      const wageLevel = state.selectedLocation?.wageLevel || 1;
      const salary = Math.round(5000 * wageLevel);
      state.staff.push({
        id: `staff_proposal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        typeId: 'fulltime',
        name: '新员工',
        salary,
        skillLevel: 1,
        baseEfficiency: 0.9,
        efficiency: 0.9,
        baseServiceQuality: 0.72,
        serviceQuality: 0.72,
        morale: 70,
        fatigue: 0,
        hiredWeek: state.currentWeek,
        assignedTask: task,
        taskExp: 0,
        currentTaskSince: state.currentWeek,
        workDaysPerWeek: 6,
        workHoursPerDay: 8,
        isOnboarding: true,
        onboardingEndsWeek: state.currentWeek + 1,
      });
      return true;
    }

    case 'join_platform': {
      const pid = String(proposal.params.platformId);
      const platformConfig = DELIVERY_PLATFORMS.find(p => p.id === pid);
      if (!platformConfig) return false;
      if (state.deliveryState.platforms.some(p => p.platformId === pid)) return false;
      // v3.0 权重分模型：新店扶持期基础分15，冷启动期权重较低
      const estimatedExposure = 15;
      state.deliveryState.platforms.push({
        platformId: pid,
        activeWeeks: 0,
        platformExposure: estimatedExposure,
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
        lastWeightDiscount: -5,
      });
      state.hasDelivery = true;
      state.deliveryState.totalPlatformExposure =
        state.deliveryState.platforms.reduce((s, p) => s + p.platformExposure, 0);
      return true;
    }

    case 'leave_platform': {
      const pid = String(proposal.params.platformId);
      const idx = state.deliveryState.platforms.findIndex(p => p.platformId === pid);
      if (idx < 0) return false;
      state.deliveryState.platforms.splice(idx, 1);
      state.hasDelivery = state.deliveryState.platforms.length > 0;
      return true;
    }

    default:
      return false;
  }
}
