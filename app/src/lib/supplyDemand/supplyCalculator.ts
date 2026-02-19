/**
 * 供给计算模块 (v2.8 重写)
 *
 * 修复核心 Bug：旧版对每个产品独立计算全部员工出餐能力，
 * 同一员工工时被重复计入 N 个产品（N=选品数量）。
 *
 * 新算法：共享工时池 + 需求比例分配
 * Step 1: 计算每个员工的"有效生产小时数"（只算一次）
 * Step 2: 厨房拥挤修正（统一乘以 crowdingFactor）
 * Step 3: 按需求权重分配工时到各产品
 */

import type {
  GameState,
  Staff,
  SupplyBreakdown,
  ProductSupplyBreakdown,
} from '@/types/game';
import { staffTypes, AREA_PER_KITCHEN_STATION } from '@/data/gameData';
import { getTaskDefinition } from '@/data/staffData';
import { BOSS_WORK_EFFICIENCY, SUPERVISE_EFFECTS } from '@/data/bossActionData';

// ============ 内部类型 ============

/** 单个产能员工的有效生产信息 */
interface ProductionStaffInfo {
  staff: Staff;
  /** 有效生产小时数 = weeklyHours × efficiency × taskMultiplier × managerBoost */
  effectiveHours: number;
  /** 该员工能处理的产品品类列表 */
  handleCategories: string[];
  /** 专注产品 ID（null = 无专注） */
  focusProductId: string | null;
  /** 各产品熟练度 */
  productProficiency: Record<string, number>;
}

// ============ 工具函数 ============

/**
 * 获取产品库存量
 */
function getProductInventory(state: GameState, productId: string): number {
  const item = state.inventoryState.items.find(i => i.productId === productId);
  return item?.quantity || 0;
}

/**
 * 计算厨房拥挤系数
 * 对数衰减：effectiveStaff = stations × ln(1 + count/stations) / ln(2)
 */
function calculateCrowdingFactor(productionStaffCount: number, storeArea: number): number {
  if (productionStaffCount <= 0) return 1;
  const kitchenStations = Math.max(1, Math.floor(storeArea / AREA_PER_KITCHEN_STATION));
  if (productionStaffCount <= kitchenStations) return 1;
  return (kitchenStations * Math.log(1 + productionStaffCount / kitchenStations) / Math.log(2)) / productionStaffCount;
}

/**
 * 计算熟练度加成
 * 满级 100 点 = +30% 效率
 */
function getProficiencyBonus(proficiency: number): number {
  return 1 + Math.max(0, Math.min(100, proficiency)) * 0.003;
}

// ============ 核心算法 ============

/**
 * 计算供给侧明细（v2.8 共享工时池算法）
 *
 * @param state 游戏状态
 * @param demandHints 各产品预估总需求（堂食+外卖），用于按需求比例分配工时。
 *                    无 demandHints 时按产品数量均分。
 */
export function calculateSupply(
  state: GameState,
  demandHints?: Map<string, number>,
): SupplyBreakdown {
  const products = state.selectedProducts;

  const emptyResult: SupplyBreakdown = {
    staffCount: 0,
    totalWorkHours: 0,
    avgEfficiency: 0,
    productSupplies: [],
    totalSupply: 0,
  };

  if (products.length === 0) {
    return emptyResult;
  }
  // 修复：老板坐镇时允许零员工场景（老板作为虚拟产能员工）
  const hasBossWorking = state.bossAction?.currentAction === 'work_in_store'
    && !!state.bossAction?.workRole;
  if (state.staff.length === 0 && !hasBossWorking) {
    return emptyResult;
  }

  // ============ Step 1: 收集产能员工信息 ============

  const hasManager = state.staff.some(
    s => s.assignedTask === 'manager' && !s.isOnboarding,
  );
  const managerBoost = hasManager ? 1.1 : 1.0;

  const productionStaff: ProductionStaffInfo[] = [];

  state.staff.forEach(staff => {
    if (staff.isOnboarding) return;

    const staffType = staffTypes.find(st => st.id === staff.typeId);
    if (!staffType) return;

    const taskDef = getTaskDefinition(staff.assignedTask);
    if (!taskDef || taskDef.productionMultiplier <= 0) return;

    const weeklyHours = staff.workDaysPerWeek * staff.workHoursPerDay;
    const effectiveHours = weeklyHours * staff.efficiency * taskDef.productionMultiplier * managerBoost;

    if (effectiveHours <= 0) return;

    productionStaff.push({
      staff,
      effectiveHours,
      handleCategories: staffType.canHandleProducts,
      focusProductId: staff.focusProductId || null,
      productProficiency: staff.productProficiency || {},
    });
  });

  // ============ 老板行动效果 ============

  const bossAction = state.bossAction?.currentAction;

  // Fix 2: 亲自坐镇 — 老板作为虚拟产能员工（70%效率）
  if (bossAction === 'work_in_store' && state.bossAction?.workRole) {
    const bossRole = state.bossAction.workRole;
    const taskDef = getTaskDefinition(bossRole);
    if (taskDef && taskDef.productionMultiplier > 0) {
      // 老板按标准工时（6天×10小时）、70%效率参与生产
      const bossWeeklyHours = 6 * 10;
      const bossEffectiveHours = bossWeeklyHours * BOSS_WORK_EFFICIENCY * taskDef.productionMultiplier * managerBoost;
      if (bossEffectiveHours > 0) {
        productionStaff.push({
          staff: { id: '__boss__', typeId: 'senior' } as Staff,
          effectiveHours: bossEffectiveHours,
          handleCategories: ['drink', 'food', 'snack', 'meal'], // 老板什么都能做
          focusProductId: null,
          productProficiency: {},
        });
      }
    }
  }

  // Fix 3: 巡店督导 — 全员效率 +8%
  if (bossAction === 'supervise') {
    productionStaff.forEach(ps => {
      ps.effectiveHours *= (1 + SUPERVISE_EFFECTS.efficiencyBoost);
    });
  }

  // ============ Step 2: 厨房拥挤修正 ============

  const storeArea = state.selectedAddress?.area || state.storeArea || 30;
  const crowdingFactor = calculateCrowdingFactor(productionStaff.length, storeArea);

  // 统一修正所有产能员工的有效工时
  if (crowdingFactor < 1) {
    productionStaff.forEach(ps => {
      ps.effectiveHours *= crowdingFactor;
    });
  }

  // ============ Step 3: 按需求权重分配工时到各产品 ============

  // 3a. 计算每个产品的"需求工时权重" = demandQty × makeTimeHours
  const productWeights = new Map<string, number>();
  let totalWeight = 0;

  products.forEach(product => {
    const demandQty = demandHints?.get(product.id) ?? 0;
    const makeTimeHours = product.makeTime / 3600;
    // 即使需求为0，也给一个最小权重避免完全不分配
    const weight = Math.max(0.01, demandQty * makeTimeHours);
    productWeights.set(product.id, weight);
    totalWeight += weight;
  });

  // 3b. 分配每个员工的工时到各产品
  // 累加器：每个产品获得的总有效工时
  const productAllocatedHours = new Map<string, number>();
  // 累加器：每个产品获得的总熟练度加权工时（用于最终产能计算）
  const productEffectiveHours = new Map<string, number>();
  products.forEach(p => {
    productAllocatedHours.set(p.id, 0);
    productEffectiveHours.set(p.id, 0);
  });

  productionStaff.forEach(ps => {
    // 筛选该员工能处理的产品
    const eligibleProducts = products.filter(p =>
      ps.handleCategories.includes(p.category),
    );
    if (eligibleProducts.length === 0) return;

    // 计算该员工可处理产品的权重子集
    let eligibleTotalWeight = 0;
    eligibleProducts.forEach(p => {
      eligibleTotalWeight += productWeights.get(p.id) || 0.01;
    });

    if (ps.focusProductId && eligibleProducts.some(p => p.id === ps.focusProductId)) {
      // ---- 有专注产品：80% 工时给专注产品，20% 按权重分配给其余 ----
      const focusHours = ps.effectiveHours * 0.8;
      const restHours = ps.effectiveHours * 0.2;

      // 专注产品
      const focusProficiency = getProficiencyBonus(ps.productProficiency[ps.focusProductId] || 0);
      productAllocatedHours.set(
        ps.focusProductId,
        (productAllocatedHours.get(ps.focusProductId) || 0) + focusHours,
      );
      productEffectiveHours.set(
        ps.focusProductId,
        (productEffectiveHours.get(ps.focusProductId) || 0) + focusHours * focusProficiency,
      );

      // 其余产品按权重分配
      const otherProducts = eligibleProducts.filter(p => p.id !== ps.focusProductId);
      let otherTotalWeight = 0;
      otherProducts.forEach(p => {
        otherTotalWeight += productWeights.get(p.id) || 0.01;
      });

      if (otherTotalWeight > 0 && otherProducts.length > 0) {
        otherProducts.forEach(p => {
          const w = (productWeights.get(p.id) || 0.01) / otherTotalWeight;
          const hours = restHours * w;
          const proficiency = getProficiencyBonus(ps.productProficiency[p.id] || 0);
          productAllocatedHours.set(p.id, (productAllocatedHours.get(p.id) || 0) + hours);
          productEffectiveHours.set(p.id, (productEffectiveHours.get(p.id) || 0) + hours * proficiency);
        });
      } else {
        // 只有专注产品可处理，剩余20%也给专注产品
        productAllocatedHours.set(
          ps.focusProductId,
          (productAllocatedHours.get(ps.focusProductId) || 0) + restHours,
        );
        productEffectiveHours.set(
          ps.focusProductId,
          (productEffectiveHours.get(ps.focusProductId) || 0) + restHours * focusProficiency,
        );
      }
    } else {
      // ---- 无专注：按权重比例分配给所有可处理产品 ----
      eligibleProducts.forEach(p => {
        const w = (productWeights.get(p.id) || 0.01) / eligibleTotalWeight;
        const hours = ps.effectiveHours * w;
        const proficiency = getProficiencyBonus(ps.productProficiency[p.id] || 0);
        productAllocatedHours.set(p.id, (productAllocatedHours.get(p.id) || 0) + hours);
        productEffectiveHours.set(p.id, (productEffectiveHours.get(p.id) || 0) + hours * proficiency);
      });
    }
  });

  // ============ Step 4: 计算各产品产能 = 有效工时 / makeTimeHours ============

  const productSupplies: ProductSupplyBreakdown[] = products.map(product => {
    const inventoryQuantity = getProductInventory(state, product.id);
    const makeTimeHours = product.makeTime / 3600;
    const effectiveHrs = productEffectiveHours.get(product.id) || 0;
    const productionCapacity = makeTimeHours > 0 ? effectiveHrs / makeTimeHours : 0;

    const finalSupply = Math.min(inventoryQuantity, Math.round(productionCapacity));

    let bottleneck: 'inventory' | 'capacity' | 'none' = 'none';
    if (inventoryQuantity < productionCapacity * 0.9) {
      bottleneck = 'inventory';
    } else if (productionCapacity < inventoryQuantity * 0.9) {
      bottleneck = 'capacity';
    }

    return {
      productId: product.id,
      productName: product.name,
      inventoryQuantity,
      productionCapacity: Math.round(productionCapacity),
      finalSupply,
      bottleneck,
    };
  });

  // ============ 汇总统计 ============

  const activeStaff = state.staff.filter(s => !s.isOnboarding);
  const staffCount = activeStaff.length;
  const totalWorkHours = activeStaff.reduce(
    (sum, s) => sum + s.workDaysPerWeek * s.workHoursPerDay, 0,
  );
  const avgEfficiency = staffCount > 0
    ? activeStaff.reduce((sum, s) => sum + s.efficiency, 0) / staffCount
    : 0;
  const totalSupply = productSupplies.reduce((sum, ps) => sum + ps.finalSupply, 0);

  return {
    staffCount,
    totalWorkHours,
    avgEfficiency,
    productSupplies,
    totalSupply,
  };
}
