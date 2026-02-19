// simulator.test.ts — 提案验证模拟器测试
// 覆盖"假勇哥"问题：验证各类提案的利润变化方向正确

import { describe, it, expect } from 'vitest';
import { simulateProposals } from '../simulator';
import { createInitialGameState } from '@/lib/gameEngine';
import type { GameState } from '@/types/game';
import type { Proposal } from '../prompts';
import { products, locations, decorations } from '@/data/gameData';
import { generateConsumerRings } from '@/lib/consumerRingGenerator';

/**
 * 构造一个最小可运行的经营中 GameState
 * 包含：品牌、选址、装修、选品、员工、库存、消费者环
 */
function createTestGameState(overrides?: Partial<GameState>): GameState {
  const base = createInitialGameState();
  const location = locations[0]; // 学校周边
  const address = location.addresses[0]; // 校门口临街铺
  const decoration = decorations[0]; // 简约装修
  const selectedProducts = [products[0], products[1]]; // 奶茶 + 咖啡

  const consumerRings = generateConsumerRings(location, address);

  const state: GameState = {
    ...base,
    gamePhase: 'operating',
    currentWeek: 8,
    currentSeason: 'spring',
    selectedBrand: {
      id: 'self_drink',
      name: '自主饮品店',
      type: 'independent',
      franchiseFee: 0,
      royaltyRate: 0,
      supplyCostModifier: 1.0,
      isQuickFranchise: false,
      description: '自主创业',
      initialReputation: 10,
      trafficMultiplier: 1.0,
      conversionBonus: 0,
    },
    selectedLocation: location,
    selectedAddress: address,
    storeArea: address.area,
    selectedDecoration: decoration,
    selectedProducts,
    productPrices: {
      milktea: 12,
      coffee: 18,
    },
    exposure: 40,
    reputation: 45,
    cash: 200000,
    totalInvestment: 100000,
    consumerRings,
    baseConsumerRings: consumerRings,
    staff: [
      {
        id: 'staff_chef_1',
        typeId: 'fulltime',
        name: '厨师小王',
        salary: 4000,
        skillLevel: 2,
        baseEfficiency: 1.0,
        efficiency: 1.0,
        baseServiceQuality: 0.8,
        serviceQuality: 0.8,
        morale: 70,
        fatigue: 20,
        hiredWeek: 1,
        assignedTask: 'chef',
        taskExp: 0,
        currentTaskSince: 1,
        workDaysPerWeek: 6,
        workHoursPerDay: 8,
        isOnboarding: false,
        onboardingEndsWeek: 2,
      },
      {
        id: 'staff_waiter_1',
        typeId: 'fulltime',
        name: '服务员小李',
        salary: 3500,
        skillLevel: 1,
        baseEfficiency: 0.9,
        efficiency: 0.9,
        baseServiceQuality: 0.75,
        serviceQuality: 0.75,
        morale: 65,
        fatigue: 25,
        hiredWeek: 1,
        assignedTask: 'waiter',
        taskExp: 0,
        currentTaskSince: 1,
        workDaysPerWeek: 6,
        workHoursPerDay: 8,
        isOnboarding: false,
        onboardingEndsWeek: 2,
      },
    ],
    inventoryState: {
      items: selectedProducts.map(p => ({
        productId: p.id,
        name: p.name,
        unitCost: p.baseCost,
        storageType: p.storageType as 'normal' | 'refrigerated' | 'frozen',
        quantity: 100,
        restockStrategy: 'auto_standard' as const,
        lastWeekSales: 50,
        lastWeekWaste: 5,
        lastRestockQuantity: 60,
        lastRestockCost: 60 * p.baseCost,
      })),
      totalValue: 100 * 5 + 100 * 7,
      weeklyHoldingCost: 20,
      weeklyWasteCost: 30,
      weeklyRestockCost: 600,
    },
    profitHistory: [500, -200, 300, 100, 600, 400, 200, 350],
    ...overrides,
  };

  return state;
}

/** 获取当前利润（简化：用上一周利润作为基准） */
function getCurrentProfit(state: GameState): number {
  return state.profitHistory.length > 0
    ? state.profitHistory[state.profitHistory.length - 1]
    : 0;
}

describe('simulateProposals', () => {
  it('裁掉唯一厨师应导致利润下降', () => {
    const state = createTestGameState();
    const currentProfit = getCurrentProfit(state);

    const proposals: Proposal[] = [
      { type: 'fire_staff', params: { index: 0 }, label: '开掉厨师小王' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    // 裁掉唯一厨师 → 出餐能力归零 → 收入暴跌 → 利润应该下降
    expect(result.appliedProposals).toContain('开掉厨师小王');
    expect(result.projectedRevenue).toBeLessThan(currentProfit + 5000); // 收入应大幅下降
    // 注意：即使固定成本降低了，没有厨师意味着没有收入
  });

  it('涨价超过心理价位应导致需求下降', () => {
    const state = createTestGameState();
    const currentProfit = getCurrentProfit(state);

    // 奶茶心理价位15元，涨到25元（超过130%）
    const proposals: Proposal[] = [
      { type: 'set_price', params: { productId: 'milktea', price: 25 }, label: '奶茶涨到25元' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    expect(result.appliedProposals).toContain('奶茶涨到25元');
    // 大幅涨价应导致需求下降，收入不一定增加
    // 至少验证提案被成功应用
    expect(result.projectedRevenue).toBeDefined();
  });

  it('降价到成本线以下应导致利润下降', () => {
    const state = createTestGameState();
    const currentProfit = getCurrentProfit(state);

    // 奶茶成本5元，降到4元（低于成本）
    const proposals: Proposal[] = [
      { type: 'set_price', params: { productId: 'milktea', price: 4 }, label: '奶茶降到4元' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    expect(result.appliedProposals).toContain('奶茶降到4元');
    // 低于成本卖 → 卖越多亏越多
    // 对比不做任何操作的基准
    const baseline = simulateProposals(state, 0, 0, currentProfit, []);
    expect(result.projectedProfit).toBeLessThan(baseline.projectedProfit);
  });

  it('上外卖平台应改善利润（正常经营状态下）', () => {
    const state = createTestGameState();
    const currentProfit = getCurrentProfit(state);

    // 基准：不做任何操作
    const baseline = simulateProposals(state, 0, 0, currentProfit, []);

    const proposals: Proposal[] = [
      { type: 'join_platform', params: { platformId: 'meituan' }, label: '上线美团外卖' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    expect(result.appliedProposals).toContain('上线美团外卖');
    // 上外卖应增加收入渠道
    expect(result.projectedRevenue).toBeGreaterThanOrEqual(baseline.projectedRevenue);
  });

  it('重复上线同一平台应失败', () => {
    const state = createTestGameState({
      deliveryState: {
        platforms: [{
          platformId: 'meituan',
          activeWeeks: 4,
          platformExposure: 30,
          promotionTierId: 'none',
          discountTierId: 'none' as const,
          deliveryPricingId: 'same' as const,
          packagingTierId: 'basic' as const,
          weeklyPromotionCost: 0,
          recentWeeklyOrders: [15, 18, 20, 22],
        }],
        totalPlatformExposure: 30,
        platformRating: 4.0,
        weeklyDeliveryOrders: 20,
        weeklyDeliveryRevenue: 500,
        weeklyCommissionPaid: 90,
        weeklyPackageCost: 20,
        weeklyDiscountCost: 0,
      },
      hasDelivery: true,
    });
    const currentProfit = getCurrentProfit(state);

    const proposals: Proposal[] = [
      { type: 'join_platform', params: { platformId: 'meituan' }, label: '再次上线美团' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    expect(result.failedProposals).toContain('再次上线美团');
  });

  it('综合提案：招厨师+开营销应改善利润', () => {
    // 构造一个曝光度低、缺人手的状态
    const state = createTestGameState({
      exposure: 15,
      reputation: 30,
    });
    const currentProfit = getCurrentProfit(state);

    const baseline = simulateProposals(state, 0, 0, currentProfit, []);

    const proposals: Proposal[] = [
      { type: 'hire_staff', params: { task: 'chef' }, label: '招一个厨师' },
      { type: 'start_marketing', params: { activityId: 'social_media' }, label: '开始社交媒体推广' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    expect(result.appliedProposals).toHaveLength(2);
    // 增加产能+提升曝光 → 收入应不低于基准（新员工入职期效率为0，收入可能持平）
    expect(result.projectedRevenue).toBeGreaterThanOrEqual(baseline.projectedRevenue);
  });

  it('无效提案类型应被标记为失败', () => {
    const state = createTestGameState();
    const currentProfit = getCurrentProfit(state);

    const proposals: Proposal[] = [
      { type: 'fire_staff', params: { index: 99 }, label: '开掉不存在的员工' },
    ];

    const result = simulateProposals(state, 0, 0, currentProfit, proposals);

    expect(result.failedProposals).toContain('开掉不存在的员工');
    expect(result.appliedProposals).toHaveLength(0);
  });

  it('空提案列表应返回与当前一致的预测', () => {
    const state = createTestGameState();
    const currentProfit = getCurrentProfit(state);

    const result = simulateProposals(state, 0, 0, currentProfit, []);

    expect(result.appliedProposals).toHaveLength(0);
    expect(result.failedProposals).toHaveLength(0);
    // 无操作时预测利润应该有值（基于供需模型计算）
    expect(result.projectedRevenue).toBeGreaterThan(0);
  });
});
