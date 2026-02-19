// prompts.test.ts — prompt 序列化测试
// 验证 serializeGameState 输出包含关键信息段落，且 healthAlerts 正确注入

import { describe, it, expect } from 'vitest';
import { serializeGameState, buildMessages } from '../prompts';
import type { GameState, HealthAlert } from '@/types/game';
import { createInitialGameState } from '@/lib/gameEngine';
import { products, locations, decorations } from '@/data/gameData';

/** 构造经营中的最小 GameState */
function createOperatingState(): GameState {
  const base = createInitialGameState();
  const location = locations[0];
  const address = location.addresses[0];

  return {
    ...base,
    gamePhase: 'operating',
    currentWeek: 6,
    currentSeason: 'summer',
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
    selectedDecoration: decorations[0],
    selectedProducts: [products[0]],
    productPrices: { milktea: 12 },
    exposure: 35,
    reputation: 40,
    cash: 150000,
    totalInvestment: 80000,
    staff: [{
      id: 'staff_1',
      typeId: 'fulltime',
      name: '小王',
      salary: 4000,
      skillLevel: 1,
      baseEfficiency: 0.9,
      efficiency: 0.9,
      baseServiceQuality: 0.75,
      serviceQuality: 0.75,
      morale: 65,
      fatigue: 20,
      hiredWeek: 1,
      assignedTask: 'chef',
      taskExp: 0,
      currentTaskSince: 1,
      workDaysPerWeek: 6,
      workHoursPerDay: 8,
      isOnboarding: false,
      onboardingEndsWeek: 2,
    }],
    profitHistory: [200, -100, 300],
    consecutiveProfits: 1,
    cumulativeProfit: 400,
  };
}

const mockStats = {
  revenue: 4000,
  variableCost: 2000,
  fixedCost: 1500,
  fixedCostBreakdown: {
    rent: 700,
    salary: 500,
    utilities: 140,
    marketing: 60,
    depreciation: 100,
  },
  profit: 500,
  margin: 50,
  breakEvenPoint: 3000,
};

describe('serializeGameState', () => {
  it('应包含所有关键信息段落', () => {
    const state = createOperatingState();
    const output = serializeGameState(state, mockStats, null);

    expect(output).toContain('【玩家经营状况】');
    expect(output).toContain('【品牌】');
    expect(output).toContain('【选址】');
    expect(output).toContain('【选品】');
    expect(output).toContain('【员工】');
    expect(output).toContain('【财务数据】');
    expect(output).toContain('【经营指标】');
  });

  it('应包含品牌和选址信息', () => {
    const state = createOperatingState();
    const output = serializeGameState(state, mockStats, null);

    expect(output).toContain('自主饮品店');
    expect(output).toContain('学校周边');
    expect(output).toContain('校门口临街铺');
  });

  it('应包含财务数据', () => {
    const state = createOperatingState();
    const output = serializeGameState(state, mockStats, null);

    expect(output).toContain('本周收入');
    expect(output).toContain('本周利润');
    expect(output).toContain('毛利率');
    expect(output).toContain('盈亏平衡点');
  });

  it('应包含员工信息和产品ID映射', () => {
    const state = createOperatingState();
    const output = serializeGameState(state, mockStats, null);

    expect(output).toContain('小王');
    expect(output).toContain('chef');
    expect(output).toContain('产品ID映射');
    expect(output).toContain('milktea');
  });

  it('无 healthAlerts 时不应包含经营诊断段落', () => {
    const state = createOperatingState();
    const output = serializeGameState(state, mockStats, null);

    expect(output).not.toContain('【经营诊断】');
  });

  it('空 healthAlerts 数组不应包含经营诊断段落', () => {
    const state = createOperatingState();
    const output = serializeGameState(state, mockStats, null, []);

    expect(output).not.toContain('【经营诊断】');
  });

  it('有 healthAlerts 时应包含经营诊断段落', () => {
    const state = createOperatingState();
    const alerts: HealthAlert[] = [
      {
        id: 'chronic_loss',
        severity: 'critical',
        title: '连续亏损警报！',
        message: '已经连续3周亏钱了',
        suggestion: '检查固定成本',
        category: 'finance',
      },
      {
        id: 'low_exposure',
        severity: 'warning',
        title: '没人知道你的店',
        message: '曝光度太低了',
        suggestion: '启动营销',
        category: 'marketing',
      },
    ];

    const output = serializeGameState(state, mockStats, null, alerts);

    expect(output).toContain('【经营诊断】');
    expect(output).toContain('🔴严重');
    expect(output).toContain('连续亏损警报');
    expect(output).toContain('🟡注意');
    expect(output).toContain('没人知道你的店');
  });

  it('info 级别的 healthAlert 应显示蓝色提示标签', () => {
    const state = createOperatingState();
    const alerts: HealthAlert[] = [
      {
        id: 'no_delivery',
        severity: 'info',
        title: '还没上外卖？',
        message: '都开了6周了还没上外卖平台',
        suggestion: '考虑上线美团',
        category: 'delivery',
      },
    ];

    const output = serializeGameState(state, mockStats, null, alerts);

    expect(output).toContain('🔵提示');
    expect(output).toContain('还没上外卖');
  });
});

describe('buildMessages', () => {
  it('应返回 system + user 两条消息', () => {
    const state = createOperatingState();
    const messages = buildMessages(state, mockStats, null);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('system 消息应包含勇哥人设', () => {
    const state = createOperatingState();
    const messages = buildMessages(state, mockStats, null);

    expect(messages[0].content).toContain('勇哥');
    expect(messages[0].content).toContain('360度');
  });

  it('user 消息应包含序列化的游戏状态', () => {
    const state = createOperatingState();
    const messages = buildMessages(state, mockStats, null);

    expect(messages[1].content).toContain('【玩家经营状况】');
    expect(messages[1].content).toContain('自主饮品店');
  });

  it('传入 healthAlerts 时 user 消息应包含经营诊断', () => {
    const state = createOperatingState();
    const alerts: HealthAlert[] = [
      {
        id: 'slow_bleeding',
        severity: 'warning',
        title: '微利陷阱',
        message: '利润太低了',
        suggestion: '提升客单价',
        category: 'finance',
      },
    ];

    const messages = buildMessages(state, mockStats, null, alerts);

    expect(messages[1].content).toContain('【经营诊断】');
    expect(messages[1].content).toContain('微利陷阱');
  });

  it('system prompt 应包含提案质量约束', () => {
    const state = createOperatingState();
    const messages = buildMessages(state, mockStats, null);

    expect(messages[0].content).toContain('提案必须针对【经营诊断】');
    expect(messages[0].content).toContain('裁员前先确认');
  });

  it('system prompt 应包含案例类比模板', () => {
    const state = createOperatingState();
    const messages = buildMessages(state, mockStats, null);

    expect(messages[0].content).toContain('案例类比');
    expect(messages[0].content).toContain('百万奶茶大厦');
  });

  it('system prompt 应包含情绪层次指导', () => {
    const state = createOperatingState();
    const messages = buildMessages(state, mockStats, null);

    expect(messages[0].content).toContain('情绪层次');
    expect(messages[0].content).toContain('干不了哥们');
  });
});
