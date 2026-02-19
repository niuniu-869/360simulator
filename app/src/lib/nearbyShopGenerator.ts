/**
 * 周边店铺生成器
 * 负责生成、更新、关闭周边店铺
 */

import type { NearbyShop, NearbyShopProduct, NearbyShopEvent, ShopCategory, RingId } from '@/types/game';
import {
  CHAIN_BRANDS,
  INDEPENDENT_TEMPLATES,
  LOCATION_SHOP_DISTRIBUTIONS,
  SHOP_CATEGORY_ICONS,
  generateShopName,
  type ChainBrandTemplate,
} from '@/data/nearbyShopData';
import { SHOP_RING_WEIGHTS } from '@/data/consumerRingData';
import { getExposureCoefficient, getReputationCoefficient, getShopReputation } from '@/lib/supplyDemand/demandCalculator';

// ============ 工具函数 ============

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

/** 按权重随机选择品类 */
function weightedRandomCategory(weights: Record<ShopCategory, number>): ShopCategory {
  const entries = Object.entries(weights) as [ShopCategory, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [cat, w] of entries) {
    r -= w;
    if (r <= 0) return cat;
  }
  return entries[0][0];
}

/** 按档次分布随机选择 */
function weightedRandomTier(dist: { budget: number; standard: number; premium: number }): 'budget' | 'standard' | 'premium' {
  const r = Math.random();
  if (r < dist.budget) return 'budget';
  if (r < dist.budget + dist.standard) return 'standard';
  return 'premium';
}

/** 按权重随机分配店铺到距离环 */
function randomShopRing(): RingId {
  const r = Math.random();
  let cumulative = 0;
  for (const [ringId, weight] of Object.entries(SHOP_RING_WEIGHTS)) {
    cumulative += weight;
    if (r <= cumulative) return ringId as RingId;
  }
  return 'ring0';
}

// ============ 店铺创建函数 ============

/** 从连锁品牌模板创建店铺 */
function createChainShop(template: ChainBrandTemplate, week: number, rentBase: number): NearbyShop {
  const products: NearbyShopProduct[] = template.products.map(p => {
    const price = randomInRange(p.priceRange.min, p.priceRange.max);
    return {
      name: p.name,
      category: p.category,
      subType: p.subType,
      price: Math.round(price * 10) / 10,
      baseCost: Math.round(price * p.baseCostRate * 10) / 10,
      quality: p.quality + randomInt(-5, 5),
      appeal: p.appeal + randomInt(-5, 5),
    };
  });

  return {
    id: `shop_${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: template.name,
    icon: template.icon,
    shopCategory: template.shopCategory,
    brandType: 'chain',
    brandTier: template.brandTier,
    products,
    exposure: template.exposure + randomInt(-5, 5),
    serviceQuality: template.serviceQuality,
    decorationLevel: template.decorationLevel,
    openedWeek: week,
    isClosing: false,
    monthlyRent: rentBase * (template.decorationLevel * 0.3 + 0.7),
    weeklyProfit: 0,
    priceVolatility: template.priceVolatility,
    ring: randomShopRing(),
    hasDelivery: Math.random() < template.deliveryProbability,
  };
}

/** 独立店铺按品类确定外卖概率 */
const INDEPENDENT_DELIVERY_PROBABILITY: Record<ShopCategory, number> = {
  meal: 0.70,
  drink: 0.60,
  food: 0.50,
  snack: 0.40,
  grocery: 0.20,
  service: 0.05,
};

/** 从独立店铺模板创建店铺 */
function createIndependentShop(
  category: ShopCategory,
  tier: 'budget' | 'standard' | 'premium',
  week: number,
  rentBase: number
): NearbyShop {
  const templates = INDEPENDENT_TEMPLATES.filter(t => t.shopCategory === category);
  const template = templates[Math.floor(Math.random() * templates.length)]
    || INDEPENDENT_TEMPLATES[0];

  const tierMultiplier = tier === 'budget' ? 0.8 : tier === 'premium' ? 1.3 : 1.0;

  const products: NearbyShopProduct[] = template.products.map(p => {
    const price = randomInRange(p.priceRange.min, p.priceRange.max) * tierMultiplier;
    return {
      name: p.name,
      category,
      subType: p.subType,
      price: Math.round(price * 10) / 10,
      baseCost: Math.round(price * p.baseCostRate * 10) / 10,
      quality: Math.round(p.quality * tierMultiplier + randomInt(-10, 10)),
      appeal: Math.round(p.appeal * tierMultiplier + randomInt(-10, 10)),
    };
  });

  const name = generateShopName(category);

  return {
    id: `shop_ind_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    icon: SHOP_CATEGORY_ICONS[category],
    shopCategory: category,
    brandType: 'independent',
    brandTier: tier,
    products,
    exposure: randomInRange(template.exposureRange.min, template.exposureRange.max),
    serviceQuality: randomInRange(
      template.serviceQualityRange.min,
      template.serviceQualityRange.max
    ),
    decorationLevel: randomInt(template.decorationRange.min, template.decorationRange.max),
    openedWeek: week,
    isClosing: false,
    monthlyRent: rentBase * 0.6,
    weeklyProfit: 0,
    priceVolatility: template.priceVolatility,
    ring: randomShopRing(),
    hasDelivery: Math.random() < INDEPENDENT_DELIVERY_PROBABILITY[category],
  };
}

// ============ 核心导出函数 ============

/**
 * 选址时生成初始周边店铺（4-9家）
 */
export function generateInitialShops(
  locationType: string,
  _addressId: string,
  rentBase: number
): NearbyShop[] {
  const distribution = LOCATION_SHOP_DISTRIBUTIONS.find(
    d => d.locationType === locationType
  );
  if (!distribution) return [];

  const shopCount = randomInt(
    distribution.shopCountRange.min,
    distribution.shopCountRange.max
  );

  const shops: NearbyShop[] = [];

  for (let i = 0; i < shopCount; i++) {
    const isChain = Math.random() < distribution.chainProbability;
    const category = weightedRandomCategory(distribution.categoryWeights);
    const tier = weightedRandomTier(distribution.tierDistribution);

    if (isChain) {
      const preferred = distribution.preferredChains
        .map(id => CHAIN_BRANDS.find(b => b.id === id))
        .filter((b): b is ChainBrandTemplate => !!b);

      const matching = preferred.filter(b => b.shopCategory === category);
      const candidates = matching.length > 0 ? matching : preferred;

      if (candidates.length > 0) {
        const template = candidates[Math.floor(Math.random() * candidates.length)];
        if (!shops.some(s => s.name === template.name)) {
          shops.push(createChainShop(template, 0, rentBase));
          continue;
        }
      }
    }

    shops.push(createIndependentShop(category, tier, 0, rentBase));
  }

  return shops;
}

/**
 * 每周3%概率新开一家店（约每8个月一家，更接近现实）
 */
export function tryGenerateNewShop(
  locationType: string,
  currentShops: NearbyShop[],
  week: number,
  rentBase: number
): NearbyShop | null {
  // 每周10%概率新开一家店（Round 4: 竞争环境更加激烈）
  if (Math.random() > 0.08) return null;

  // 最多20家周边店铺
  const activeShops = currentShops.filter(s => !s.isClosing);
  if (activeShops.length >= 20) return null;

  const distribution = LOCATION_SHOP_DISTRIBUTIONS.find(
    d => d.locationType === locationType
  );
  if (!distribution) return null;

  const isChain = Math.random() < distribution.chainProbability * 0.8;
  const category = weightedRandomCategory(distribution.categoryWeights);
  const tier = weightedRandomTier(distribution.tierDistribution);

  if (isChain) {
    const candidates = CHAIN_BRANDS.filter(
      b => !activeShops.some(s => s.name === b.name)
    );
    if (candidates.length > 0) {
      const template = candidates[Math.floor(Math.random() * candidates.length)];
      return createChainShop(template, week, rentBase);
    }
  }

  return createIndependentShop(category, tier, week, rentBase);
}

/**
 * 检查店铺关门：独立店3%/连锁1%基础概率，亏损x3
 */
export function checkShopClosing(
  shops: NearbyShop[],
  week: number
): { updatedShops: NearbyShop[]; events: NearbyShopEvent[] } {
  const events: NearbyShopEvent[] = [];

  const updatedShops = shops.map(shop => {
    if (shop.isClosing) return shop;

    // 新开店铺前4周不关门
    if (week - shop.openedWeek < 4) return shop;

    // Round 4: 连锁店几乎不关门(0.3%)，独立店关门率降至2%（竞争对手更持久）
    const baseRate = shop.brandType === 'chain' ? 0.003 : 0.020;
    const lossMultiplier = shop.weeklyProfit < 0 ? 3 : 1;
    const closeRate = baseRate * lossMultiplier;

    if (Math.random() < closeRate) {
      events.push({
        type: 'closing',
        shopId: shop.id,
        shopName: shop.name,
        description: `${shop.name}即将关门歇业`,
        week,
      });
      return { ...shop, isClosing: true, closedWeek: week + 2 };
    }

    return shop;
  });

  // 移除已过关门期限的店铺
  const finalShops = updatedShops.filter(
    s => !(s.isClosing && s.closedWeek && week >= s.closedWeek)
  );

  return { updatedShops: finalShops, events };
}

/**
 * 每周在 priceVolatility 范围内小幅波动价格
 */
export function updateShopPrices(shops: NearbyShop[]): NearbyShop[] {
  return shops.map(shop => {
    if (shop.isClosing) return shop;

    const updatedProducts = shop.products.map(p => {
      const volatility = shop.priceVolatility;
      const change = 1 + randomInRange(-volatility, volatility);
      const newPrice = Math.max(p.baseCost * 1.1, p.price * change);
      return { ...p, price: Math.round(newPrice * 10) / 10 };
    });

    return { ...shop, products: updatedProducts };
  });
}

/**
 * 估算周边店铺利润（用于关门判断）
 * 使用与需求模型一致的竞争力公式计算每家店的得分
 */
export function updateShopProfits(
  shops: NearbyShop[],
  areaTotalDemand: number
): NearbyShop[] {
  const activeShops = shops.filter(s => !s.isClosing);

  const shopScores = activeShops.map(shop => {
    const avgPrice = shop.products.length > 0
      ? shop.products.reduce((s, p) => s + p.price, 0) / shop.products.length : 10;
    const avgAppeal = shop.products.length > 0
      ? shop.products.reduce((s, p) => s + p.appeal, 0) / shop.products.length : 50;
    const shopRep = getShopReputation(shop);
    const exposureCoeff = getExposureCoefficient(shop.exposure);
    const reputationCoeff = getReputationCoefficient(shopRep);
    const qualityScore = avgAppeal / 100;
    const serviceScore = Math.max(0.3, shop.serviceQuality);

    return {
      shop,
      score: exposureCoeff * reputationCoeff * qualityScore * serviceScore,
      avgPrice,
      avgCost: shop.products.length > 0
        ? shop.products.reduce((s, p) => s + p.baseCost, 0) / shop.products.length : 5,
    };
  });

  const totalScore = shopScores.reduce((sum, s) => sum + s.score, 0);

  return shops.map(shop => {
    if (shop.isClosing) return shop;
    const entry = shopScores.find(s => s.shop.id === shop.id);
    if (!entry) return shop;

    const share = totalScore > 0 ? entry.score / totalScore : 0;
    const weeklyRevenue = areaTotalDemand * share * entry.avgPrice;
    const weeklyCost = areaTotalDemand * share * entry.avgCost + shop.monthlyRent / 4;
    return { ...shop, weeklyProfit: weeklyRevenue - weeklyCost };
  });
}
