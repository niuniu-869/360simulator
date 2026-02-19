// 库存系统数据配置（v2.1 重构）

import type { StorageType, RestockStrategy, RestockStrategyConfig, StockoutEffect } from '@/types/game';

// ============ 损耗率配置 ============
// 直接按存储方式分类，不再按原料品类（消除与产品 category 的映射断裂）

export const WASTE_RATES: Record<StorageType, number> = {
  normal: 0.05,        // 常温：5%/周
  refrigerated: 0.08,  // 冷藏：8%/周
  frozen: 0.03,        // 冷冻：3%/周
};

// ============ 持有成本配置 ============

export const HOLDING_COST_RATES: Record<StorageType, number> = {
  normal: 0.02,        // 常温：2%/周
  refrigerated: 0.05,  // 冷藏：5%/周（含电费）
  frozen: 0.07,        // 冷冻：7%/周（含电费）
};

// ============ 缺货效果配置 ============
// 按满足率分级，影响销量和口碑

export const STOCKOUT_EFFECTS: StockoutEffect[] = [
  { minFulfillment: 0.9, maxFulfillment: 1.0, salesModifier: 1.0, reputationImpact: 0, description: '备货充足，来一单出一单' },
  { minFulfillment: 0.8, maxFulfillment: 0.9, salesModifier: 0.97, reputationImpact: -0.3, description: '偶尔断货，少数顾客不满' },
  { minFulfillment: 0.7, maxFulfillment: 0.8, salesModifier: 0.93, reputationImpact: -0.8, description: '时有缺货，部分顾客白跑一趟' },
  { minFulfillment: 0.6, maxFulfillment: 0.7, salesModifier: 0.87, reputationImpact: -1.5, description: '频繁断货，回头客明显减少' },
  { minFulfillment: 0.5, maxFulfillment: 0.6, salesModifier: 0.82, reputationImpact: -3, description: '严重缺货，差评增多' },
  { minFulfillment: 0.2, maxFulfillment: 0.5, salesModifier: 0.70, reputationImpact: -6, description: '经常没货，口碑急剧下降' },
  { minFulfillment: 0.0, maxFulfillment: 0.2, salesModifier: 0.50, reputationImpact: -10, description: '基本断供，口碑崩了' },
];

// ============ 补货策略配置 ============
// 每个产品可独立设置补货策略

export const RESTOCK_STRATEGIES: RestockStrategyConfig[] = [
  { id: 'manual', name: '手动补货', targetStockWeeks: 0, description: '完全手动控制采购量' },
  { id: 'auto_conservative', name: '保守补货', targetStockWeeks: 1, description: '自动补到1周用量，节省资金' },
  { id: 'auto_standard', name: '标准补货', targetStockWeeks: 1.5, description: '自动补到1.5周用量（推荐）' },
  { id: 'auto_aggressive', name: '激进补货', targetStockWeeks: 2.5, description: '自动补到2.5周用量，减少缺货但占用资金' },
];

// ============ 工具函数 ============

/**
 * 获取损耗率
 */
export function getWasteRate(storageType: StorageType): number {
  return WASTE_RATES[storageType] ?? 0.05;
}

/**
 * 计算库存持有成本
 */
export function calculateHoldingCost(value: number, storageType: StorageType): number {
  const rate = HOLDING_COST_RATES[storageType] ?? 0.02;
  return value * rate;
}

/**
 * 根据满足率获取缺货效果
 */
export function getStockoutEffect(fulfillment: number): StockoutEffect {
  const effect = STOCKOUT_EFFECTS.find(
    e => fulfillment >= e.minFulfillment && fulfillment <= e.maxFulfillment
  );
  return effect || STOCKOUT_EFFECTS[STOCKOUT_EFFECTS.length - 1];
}

/**
 * 获取补货策略配置
 */
export function getRestockStrategyConfig(strategy: RestockStrategy): RestockStrategyConfig {
  return RESTOCK_STRATEGIES.find(s => s.id === strategy) || RESTOCK_STRATEGIES[0];
}

/**
 * 计算自动补货量
 * @param currentStock 当前库存
 * @param lastWeekSales 上周销量
 * @param strategy 补货策略
 * @param cognitionLevel 认知等级（影响补货精准度）
 * @returns 需要补货的数量
 */
export function calculateRestockQuantity(
  currentStock: number,
  lastWeekSales: number,
  strategy: RestockStrategy,
  cognitionLevel?: number
): number {
  if (strategy === 'manual') return 0;

  const config = getRestockStrategyConfig(strategy);
  // 首周没有销量数据时，用默认预估值
  const estimatedWeeklySales = lastWeekSales > 0 ? lastWeekSales : 50;
  let targetStock = Math.ceil(estimatedWeeklySales * config.targetStockWeeks);

  // 缺货追赶机制：当库存接近耗尽（< 上周销量的 50%），说明供不应求
  // 补货目标翻倍，帮助快速恢复库存水位（模拟店主紧急加单）
  if (lastWeekSales > 0 && currentStock < lastWeekSales * 0.5) {
    targetStock = Math.ceil(targetStock * 2.0);
  }

  // 新手补货偏差：认知不足时判断失误，补货量有随机偏差
  if (cognitionLevel !== undefined && cognitionLevel < 4) {
    let deviationRate = 0;
    if (cognitionLevel <= 1) {
      deviationRate = 0.30; // Lv0-1: ±30% 偏差
    } else if (cognitionLevel <= 3) {
      deviationRate = 0.10; // Lv2-3: ±10% 偏差
    }
    // Lv4+: 0% 偏差（精准补货）
    if (deviationRate > 0) {
      const deviation = 1 + (Math.random() - 0.5) * 2 * deviationRate;
      targetStock = Math.ceil(targetStock * deviation);
    }
  }

  return Math.max(0, targetStock - currentStock);
}
