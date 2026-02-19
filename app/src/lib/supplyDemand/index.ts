/**
 * 供需模型主计算模块
 *
 * 核心公式：
 * 堂食收入 = Σ(min(堂食需求, 供给) × 客单价 × 营销折扣)
 * 外卖收入 = Σ(min(外卖需求, 出餐余量) × 客单价)
 * 总收入 = 堂食收入 + 外卖收入
 * 注：外卖由平台骑手配送，不需要玩家安排配送员
 */

import type {
  GameState,
  SupplyDemandResult,
  ProductSaleResult,
} from '@/types/game';
import { calculateDemand, calculateAttractionScore, getRingCoverage, getNewStoreAwarenessFactor, getTrafficReachMultiplier } from './demandCalculator';
import { calculateSupply } from './supplyCalculator';
import { calculateDeliveryDemandForProduct } from './deliveryCalculator';
import {
  getDeliveryPlatform,
  getDeliveryPricing,
  getDiscountTier,
  getPackagingTier,
} from '@/data/deliveryData';

export { calculateDemand, calculateDemandModifiers, getExposureCoefficient, getReputationCoefficient, calculateAttractionScore, getRingCoverage, getNewStoreAwarenessFactor, getTrafficReachMultiplier } from './demandCalculator';
export { calculateSupply } from './supplyCalculator';
export { calculateDeliveryDemandForProduct } from './deliveryCalculator';

/**
 * 分析整体瓶颈（堂食+外卖综合）
 */
function analyzeOverallBottleneck(
  totalDemand: number,
  totalSupply: number,
  productSales: ProductSaleResult[],
  hasDelivery: boolean
): SupplyDemandResult['overallBottleneck'] {
  if (totalDemand < totalSupply * 0.8) {
    return {
      type: 'demand',
      description: '需求不足是主要瓶颈',
      suggestion: hasDelivery
        ? '建议提升口碑、增加平台推广或调整选址'
        : '建议提升口碑、开通外卖平台或开展营销活动',
    };
  }

  if (totalSupply < totalDemand * 0.8) {
    const inventoryLimited = productSales.filter(
      p => p.bottleneck === 'supply_inventory'
    ).length;
    const capacityLimited = productSales.filter(
      p => p.bottleneck === 'supply_capacity'
    ).length;

    if (inventoryLimited > capacityLimited) {
      return {
        type: 'supply',
        description: '库存不足是主要瓶颈',
        suggestion: '建议增加库存采购量',
      };
    }
    return {
      type: 'supply',
      description: '产能不足是主要瓶颈',
      suggestion: '建议增加员工或提升员工效率',
    };
  }

  return {
    type: 'balanced',
    description: '供需基本平衡',
    suggestion: hasDelivery
      ? '可以考虑扩大规模或优化产品组合'
      : '可以考虑开通外卖平台拓展收入渠道',
  };
}

/**
 * 计算供需模型结果（堂食 + 外卖双通道）
 *
 * 堂食收入 = Σ(min(堂食需求, 供给) × 客单价 × 营销折扣)
 * 外卖收入 = Σ(min(外卖需求, 出餐余量) × 客单价)
 * 总收入 = 堂食收入 + 外卖收入
 * 注：外卖由平台骑手配送，不需要玩家安排配送员
 */
export function calculateSupplyDemand(state: GameState): SupplyDemandResult {
  // 1. 计算堂食需求侧（距离环模型）
  const demand = calculateDemand(state);

  // 2. 构建 demandHints（堂食需求 + 外卖需求预估），用于供给侧按需求比例分配工时
  // 同时缓存外卖需求，避免后续 productSales 循环中重复计算
  const hasDeliveryForHints = state.deliveryState && state.deliveryState.platforms.length > 0;
  const demandHints = new Map<string, number>();
  const deliveryDemandCache = new Map<string, number>();
  state.selectedProducts.forEach(product => {
    const dineInDemand = demand.productDemands.find(pd => pd.productId === product.id)?.finalDemand || 0;
    const deliveryDemand = hasDeliveryForHints
      ? calculateDeliveryDemandForProduct(product, state.selectedProducts, state)
      : 0;
    deliveryDemandCache.set(product.id, deliveryDemand);
    demandHints.set(product.id, dineInDemand + deliveryDemand);
  });

  // 3. 计算供给侧（传入 demandHints 实现按需求比例分配工时）
  const supply = calculateSupply(state, demandHints);

  // 4. 营销活动价格修正（仅影响堂食，多个活动取最低值）
  let marketingPriceModifier = 1;
  const discounts = state.activeMarketingActivities
    .map(a => a.priceModifier).filter(m => m < 1);
  if (discounts.length > 0) marketingPriceModifier = Math.min(...discounts);

  // 5. 外卖相关：平台状态
  const hasDelivery = state.deliveryState && state.deliveryState.platforms.length > 0;

  // 6. 计算各产品的堂食销售 + 外卖销售
  let totalDineInRevenue = 0;
  let totalDeliveryRevenue = 0;
  let totalDeliverySales = 0;

  const productSales: ProductSaleResult[] = state.selectedProducts.map(product => {
    // --- 堂食部分 ---
    const productDemand = demand.productDemands.find(
      pd => pd.productId === product.id
    );
    const dineInDemandQty = productDemand?.finalDemand || 0;

    const productSupply = supply.productSupplies.find(
      ps => ps.productId === product.id
    );
    const supplyQty = productSupply?.finalSupply || 0;

    // --- 外卖需求预计算（复用缓存，避免重复调用） ---
    let deliveryDemandQty = 0;
    if (hasDelivery) {
      deliveryDemandQty = deliveryDemandCache.get(product.id) ?? 0;
    }

    // --- 出餐分配（三模式） ---
    const priority = state.supplyPriority || 'dine_in_first';
    let dineInSales: number;
    let deliverySalesQty: number;

    if (!hasDelivery || deliveryDemandQty <= 0) {
      // 无外卖需求时直接全给堂食
      dineInSales = Math.min(dineInDemandQty, supplyQty);
      deliverySalesQty = 0;
    } else if (priority === 'delivery_first') {
      // 外卖优先：外卖先满足，堂食取剩余
      deliverySalesQty = Math.min(deliveryDemandQty, supplyQty);
      dineInSales = Math.min(dineInDemandQty, Math.max(0, supplyQty - deliverySalesQty));
    } else if (priority === 'proportional') {
      // 按需分配：供给不足时按需求比例分配
      const totalDemandForAlloc = dineInDemandQty + deliveryDemandQty;
      if (totalDemandForAlloc <= supplyQty) {
        dineInSales = dineInDemandQty;
        deliverySalesQty = deliveryDemandQty;
      } else {
        const dineInRatio = dineInDemandQty / totalDemandForAlloc;
        dineInSales = Math.round(supplyQty * dineInRatio);
        deliverySalesQty = supplyQty - dineInSales;
      }
    } else {
      // 堂食优先（默认）：堂食先满足，外卖取剩余
      dineInSales = Math.min(dineInDemandQty, supplyQty);
      deliverySalesQty = Math.min(deliveryDemandQty, Math.max(0, supplyQty - dineInSales));
    }

    const unitPrice = state.productPrices[product.id] || product.basePrice;
    const dineInPrice = unitPrice * marketingPriceModifier;
    const dineInRevenue = dineInSales * dineInPrice;
    totalDineInRevenue += dineInRevenue;

    // --- 外卖收入 (v3: 独立定价 + 满减补贴) ---
    let deliveryRevenueForProduct = 0;  // 顾客实付金额（扣除满减后）

    if (hasDelivery) {

      // v3: 外卖收入 = 各平台按权重分摊，每平台有独立定价和满减
      // 简化模型：按平台权重分占比分摊销量，各平台独立计算收入
      if (deliverySalesQty > 0) {
        const totalWeight = state.deliveryState.platforms.reduce(
          (s, p) => s + Math.max(1, p.platformExposure), 0
        );
        state.deliveryState.platforms.forEach(ap => {
          const share = Math.max(1, ap.platformExposure) / totalWeight;
          const platformSales = deliverySalesQty * share;

          // 菜单价 = 堂食价 × 定价倍率
          const pricing = getDeliveryPricing(ap.deliveryPricingId);
          const menuPrice = unitPrice * (pricing?.multiplier ?? 1.0);

          // 顾客实付 = 菜单价 × (1 - 满减补贴率)
          const discount = getDiscountTier(ap.discountTierId);
          const subsidyRate = discount?.subsidyRate ?? 0;
          const customerPays = menuPrice * (1 - subsidyRate);

          deliveryRevenueForProduct += platformSales * customerPays;
        });
      }

      totalDeliveryRevenue += deliveryRevenueForProduct;
      totalDeliverySales += deliverySalesQty;
    }

    // --- 合并结果 ---
    const totalProductDemand = dineInDemandQty + deliveryDemandQty;
    const actualSales = dineInSales + deliverySalesQty;
    const revenue = dineInRevenue + deliveryRevenueForProduct;

    // 瓶颈判断（基于总需求）
    let bottleneck: ProductSaleResult['bottleneck'] = 'balanced';
    if (totalProductDemand < supplyQty * 0.9) {
      bottleneck = 'demand';
    } else if (supplyQty < totalProductDemand * 0.9) {
      bottleneck = productSupply?.bottleneck === 'inventory'
        ? 'supply_inventory'
        : 'supply_capacity';
    }

    const fulfillmentRate = totalProductDemand > 0
      ? actualSales / totalProductDemand
      : 1;

    return {
      productId: product.id,
      productName: product.name,
      icon: product.icon,
      demand: totalProductDemand,
      supply: supplyQty,
      actualSales,
      unitPrice: dineInPrice,
      revenue,
      bottleneck,
      fulfillmentRate,
      // 堂食/外卖拆分
      dineInDemand: dineInDemandQty,
      deliveryDemand: deliveryDemandQty,
      dineInSales,
      deliverySales: deliverySalesQty,
      dineInRevenue,
      deliveryRevenue: deliveryRevenueForProduct,
    };
  });

  // 7. 计算外卖佣金 + 满减补贴 + 包装成本 (v3: 按平台独立计算)
  let deliveryCommission = 0;
  let deliveryDiscountCost = 0;
  let deliveryPackageCost = 0;

  if (hasDelivery && totalDeliverySales > 0) {
    // 修复：用实际外卖销量加权均价替代算术平均价
    const weightedAvgPrice = productSales.reduce((sum, ps) => {
      const price = state.productPrices[ps.productId]
        || state.selectedProducts.find(p => p.id === ps.productId)?.basePrice
        || 0;
      return sum + price * ps.deliverySales;
    }, 0) / totalDeliverySales;

    const totalWeight = state.deliveryState.platforms.reduce(
      (s, p) => s + Math.max(1, p.platformExposure), 0
    );

    state.deliveryState.platforms.forEach(ap => {
      const platform = getDeliveryPlatform(ap.platformId);
      if (!platform) return;

      const share = Math.max(1, ap.platformExposure) / totalWeight;
      const platformSales = totalDeliverySales * share;

      // 佣金基于顾客实付金额
      const platformRevenue = totalDeliveryRevenue * share;
      deliveryCommission += platformRevenue * platform.commissionRate;

      // 满减补贴 = 菜单价总额 × 补贴率（商家承担）
      const pricing = getDeliveryPricing(ap.deliveryPricingId);
      const discount = getDiscountTier(ap.discountTierId);
      const menuPrice = weightedAvgPrice * (pricing?.multiplier ?? 1.0);
      const subsidyRate = discount?.subsidyRate ?? 0;
      deliveryDiscountCost += platformSales * menuPrice * subsidyRate;

      // 包装成本
      const pkg = getPackagingTier(ap.packagingTierId);
      deliveryPackageCost += platformSales * (pkg?.costPerOrder ?? 2.0);
    });
  }

  // 9. 汇总
  const totalRevenue = totalDineInRevenue + totalDeliveryRevenue;
  const totalSales = productSales.reduce((sum, ps) => sum + ps.actualSales, 0);
  const totalDemand = productSales.reduce((sum, ps) => sum + ps.demand, 0);

  const overallBottleneck = analyzeOverallBottleneck(
    totalDemand,
    supply.totalSupply,
    productSales,
    !!hasDelivery
  );

  // 8. 计算中间数据（供面板可视化）
  const attractionScore = calculateAttractionScore(state);
  const ringCoverage = getRingCoverage(attractionScore);
  const brandType = state.selectedBrand?.type || 'independent';
  const awarenessFactor = getNewStoreAwarenessFactor(state.currentWeek, brandType, state.growthSystem);
  const trafficReachMultiplier = getTrafficReachMultiplier(state.exposure, state.reputation);
  const supplyPriority = state.supplyPriority || 'dine_in_first';

  return {
    demand,
    supply,
    productSales,
    dineInRevenue: totalDineInRevenue,
    deliveryRevenue: totalDeliveryRevenue,
    deliveryCommission,
    deliveryPackageCost,
    deliveryDiscountCost,
    totalRevenue,
    totalSales,
    deliverySales: totalDeliverySales,
    attractionScore,
    ringCoverage,
    awarenessFactor,
    trafficReachMultiplier,
    supplyPriority,
    overallBottleneck,
  };
}

/**
 * 从供需结果计算周收入（用于替换原有的 calculateWeeklyRevenue）
 */
export function getWeeklyRevenueFromSupplyDemand(state: GameState): number {
  const result = calculateSupplyDemand(state);
  return result.totalRevenue;
}
