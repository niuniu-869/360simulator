// 选品调整机制数据配置

// ============ 选品调整限制配置 ============

export const PRODUCT_ADJUSTMENT_CONFIG = {
  maxWeeklyChanges: 2,      // 每周最多调整2次
  cooldownWeeks: 2,         // 下架后冷却2周才能重新上架
  maxProducts: 5,           // 最多同时上架5种产品
  minProducts: 1,           // 最少保留1种产品
};

// ============ 调整成本配置 ============

export const ADJUSTMENT_COSTS = {
  addProduct: {
    moneyCost: 500,
    description: '上架新产品',
  },
  removeProduct: {
    moneyCost: 0,
    description: '下架产品',
  },
};

// ============ 工具函数 ============

/**
 * 检查是否可以调整产品
 */
export function canAdjustProduct(
  weeklyChanges: number,
  productId: string,
  cooldowns: Record<string, number>,
  currentWeek: number,
  isAdding: boolean
): { can: boolean; reason?: string } {
  if (weeklyChanges >= PRODUCT_ADJUSTMENT_CONFIG.maxWeeklyChanges) {
    return { can: false, reason: '本周调整次数已达上限' };
  }

  if (isAdding && cooldowns[productId]) {
    const remainingWeeks = cooldowns[productId] - currentWeek;
    if (remainingWeeks > 0) {
      return { can: false, reason: `该产品冷却中，还需${remainingWeeks}周` };
    }
  }

  return { can: true };
}
