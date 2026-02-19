/**
 * 外卖需求平衡性分析脚本 (v3.0 — 权重分 + 满减 + 独立定价)
 *
 * 用真实游戏公式 + 全场景组合，计算当前外卖需求量级，
 * 对比现实基准，输出调参建议。
 *
 * 运行: cd app && npx vite-node src/simulation/delivery-balance-analysis.ts
 */

import { locations, SEASON_MODIFIER } from '@/data/gameData';
import {
  LOCATION_RING_MULTIPLIERS,
  CUSTOMER_RING_DECAY,
} from '@/data/consumerRingData';
import {
  DELIVERY_PLATFORMS,
  DELIVERY_CONVERSION_RATE,
  DELIVERY_DISTANCE_DECAY,
  DISCOUNT_TIERS,
  DELIVERY_PRICING_TIERS,
  getPlatformExposureCoefficient,
  getRatingCoefficient,
  getMultiPlatformOverlapDiscount,
  getDeliveryCompetitionBase,
  calculatePlatformWeightScore,
  getDiscountPricingMultiplier,
} from '@/data/deliveryData';
import {
  getTrafficReachMultiplier,
} from '@/lib/supplyDemand/demandCalculator';

import type { DiscountTierId, DeliveryPricingId } from '@/types/game';

// ============ 类型 ============

type CustomerType = 'students' | 'office' | 'family' | 'tourist';
type RingId = 'ring0' | 'ring1' | 'ring2' | 'ring3';
const CUSTOMER_TYPES: CustomerType[] = ['students', 'office', 'family', 'tourist'];

// ============ 消费者环生成（确定性，取中位数） ============

interface RingConsumers {
  ringId: RingId;
  consumers: Record<CustomerType, number>;
}

function generateRingsDeterministic(
  locationType: string,
  footTraffic: Record<CustomerType, number>,
  trafficModifier: number
): RingConsumers[] {
  const ring0: RingConsumers = {
    ringId: 'ring0',
    consumers: {
      students: Math.round(footTraffic.students * trafficModifier),
      office: Math.round(footTraffic.office * trafficModifier),
      family: Math.round(footTraffic.family * trafficModifier),
      tourist: Math.round(footTraffic.tourist * trafficModifier),
    },
  };

  const multiplierConfig = LOCATION_RING_MULTIPLIERS.find(m => m.locationType === locationType);
  if (!multiplierConfig) return [ring0];

  const outerRings: RingConsumers[] = (['ring1', 'ring2', 'ring3'] as RingId[]).map(ringId => {
    const key = ringId as 'ring1' | 'ring2' | 'ring3';
    const range = multiplierConfig[key];
    const midMultiplier = (range.min + range.max) / 2;

    const consumers = {} as Record<CustomerType, number>;
    CUSTOMER_TYPES.forEach(type => {
      const base = footTraffic[type] * trafficModifier;
      const decay = CUSTOMER_RING_DECAY[type][ringId];
      consumers[type] = Math.round(base * midMultiplier * decay);
    });

    return { ringId, consumers };
  });

  return [ring0, ...outerRings];
}

// ============ v3 外卖需求计算（含满减+定价倍率） ============

interface DeliveryScenario {
  label: string;
  platformCount: 1 | 2 | 3;
  // 权重分组成因子
  activeWeeks: number;
  recentWeeklyOrders: number[];  // 近4周滚动单量
  platformRating: number;
  promotionTierId: string;
  discountTierId: DiscountTierId;
  deliveryPricingId: DeliveryPricingId;
  // 线下指标
  offlineExposure: number;
  reputation: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
}

function calcDeliveryDemandV3(
  rings: RingConsumers[],
  locationType: string,
  scenario: DeliveryScenario,
): { weeklyTotal: number; byRing: Record<RingId, number>; weightScore: number; discountPricingMult: number } {
  // 计算权重分
  const boostWeeks = 2; // 美团默认
  const ws = calculatePlatformWeightScore(
    scenario.activeWeeks, boostWeeks,
    scenario.recentWeeklyOrders,
    scenario.platformRating,
    scenario.promotionTierId,
    scenario.discountTierId,
  );

  const platformExposureCoeff = getPlatformExposureCoefficient(ws.total);
  const ratingCoeff = getRatingCoefficient(scenario.platformRating);
  const seasonMod = SEASON_MODIFIER[scenario.season] - 1;
  const trafficReach = getTrafficReachMultiplier(scenario.offlineExposure, scenario.reputation);

  // v3: 满减+定价组合倍率
  const discountPricingMult = getDiscountPricingMultiplier(scenario.discountTierId, scenario.deliveryPricingId);

  // 简化市场份额
  const avgAppeal = 0.70;
  const playerScore = ws.total * ratingCoeff * avgAppeal;
  const competitionBase = getDeliveryCompetitionBase(locationType);

  const byRing: Record<RingId, number> = { ring0: 0, ring1: 0, ring2: 0, ring3: 0 };
  let weeklyTotal = 0;

  rings.forEach(ring => {
    const ringReach = ring.ringId === 'ring0' ? 1 : trafficReach;
    const decay = DELIVERY_DISTANCE_DECAY[ring.ringId] ?? 0.12;
    const marketShare = playerScore / (playerScore + competitionBase);

    let ringDemand = 0;

    CUSTOMER_TYPES.forEach(type => {
      const consumers = ring.consumers[type] * ringReach;
      if (consumers <= 0) return;

      let audienceMultiplier = 0;
      const platforms = DELIVERY_PLATFORMS.slice(0, scenario.platformCount);
      platforms.forEach((platform, idx) => {
        const mult = platform.audienceMultiplier[type];
        const overlap = idx === 0 ? 1.0 : getMultiPlatformOverlapDiscount(scenario.platformCount, type);
        audienceMultiplier += mult * overlap;
      });

      const demand = consumers
        * audienceMultiplier
        * DELIVERY_CONVERSION_RATE
        * platformExposureCoeff
        * ratingCoeff
        * 1.0  // appealRatio 全产品合计 = 1.0
        * marketShare
        * decay
        * (1 + seasonMod)
        * discountPricingMult;  // v3 核心：满减+定价组合倍率

      ringDemand += demand;
    });

    const weeklyRing = ringDemand * 7;
    byRing[ring.ringId] = Math.round(weeklyRing);
    weeklyTotal += weeklyRing;
  });

  return { weeklyTotal: Math.round(weeklyTotal), byRing, weightScore: ws.total, discountPricingMult };
}

// ============ 现实基准 ============

// @ts-ignore 保留作参考基准
const _BENCHMARKS = {
  tiny_15sqm:   { label: '15㎡档口', weeklyRange: [210, 560] },
  small_30sqm:  { label: '30㎡小店', weeklyRange: [350, 1050] },
  medium_50sqm: { label: '50㎡标准', weeklyRange: [560, 1750] },
  large_80sqm:  { label: '80㎡大店', weeklyRange: [840, 2800] },
};

function getBenchmarkUpper(area: number): number {
  if (area <= 20) return 560;
  if (area <= 35) return 1050;
  if (area <= 55) return 1750;
  return 2800;
}

// ============ 主分析 ============

function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  外卖需求平衡性分析报告 (v3.0 — 权重分 + 满减 + 独立定价)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // --- 第一部分：满减+定价组合倍率矩阵 ---
  console.log('【第一部分】满减 × 定价 组合转化倍率矩阵');
  console.log('─────────────────────────────────────────────────────────');
  const header = '  定价\\满减'.padEnd(16) + DISCOUNT_TIERS.map(t => t.id.padStart(14)).join('');
  console.log(header);
  DELIVERY_PRICING_TIERS.forEach(pt => {
    let line = `  ${pt.id}(×${pt.multiplier})`.padEnd(16);
    DISCOUNT_TIERS.forEach(dt => {
      const mult = getDiscountPricingMultiplier(dt.id, pt.id);
      line += `${mult.toFixed(3)}`.padStart(14);
    });
    console.log(line);
  });
  console.log();

  // --- 第二部分：权重分 → 转化系数映射 ---
  console.log('【第二部分】权重分 → 平台转化系数（S型曲线）');
  console.log('─────────────────────────────────────────────────────────');
  [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90].forEach(w => {
    const coeff = getPlatformExposureCoefficient(w);
    const bar = '█'.repeat(Math.round(coeff * 40));
    console.log(`  权重${String(w).padStart(2)} → ${coeff.toFixed(3)} ${bar}`);
  });
  console.log();

  // --- 第三部分：典型经营场景下的外卖需求 ---
  console.log('【第三部分】典型经营场景 × 满减策略 → 外卖周需求');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 场景定义：模拟不同经营阶段
  const scenarios: DeliveryScenario[] = [
    // 冷启动：新店W3，无评分，无推广，无满减
    {
      label: '冷启动W3-无满减',
      platformCount: 1, activeWeeks: 3, recentWeeklyOrders: [],
      platformRating: 0, promotionTierId: 'none',
      discountTierId: 'none', deliveryPricingId: 'same',
      offlineExposure: 15, reputation: 45, season: 'autumn',
    },
    // 冷启动+小额满减
    {
      label: '冷启动W3-小额满减',
      platformCount: 1, activeWeeks: 3, recentWeeklyOrders: [],
      platformRating: 0, promotionTierId: 'none',
      discountTierId: 'small', deliveryPricingId: 'slight',
      offlineExposure: 15, reputation: 45, season: 'autumn',
    },
    // 冷启动+标准满减+基础推广
    {
      label: '冷启动W3-标准满减+推广',
      platformCount: 1, activeWeeks: 3, recentWeeklyOrders: [],
      platformRating: 0, promotionTierId: 'basic',
      discountTierId: 'standard', deliveryPricingId: 'slight',
      offlineExposure: 15, reputation: 45, season: 'autumn',
    },
    // 成长期W10：有评分，标准满减，小幅上浮
    {
      label: '成长W10-标准满减',
      platformCount: 1, activeWeeks: 10, recentWeeklyOrders: [60, 80, 90, 100],
      platformRating: 3.8, promotionTierId: 'basic',
      discountTierId: 'standard', deliveryPricingId: 'slight',
      offlineExposure: 35, reputation: 55, season: 'autumn',
    },
    // 成熟期W20：双平台，标准满减，中幅上浮
    {
      label: '成熟W20-标准满减',
      platformCount: 2, activeWeeks: 20, recentWeeklyOrders: [120, 130, 140, 150],
      platformRating: 4.2, promotionTierId: 'basic',
      discountTierId: 'standard', deliveryPricingId: 'medium',
      offlineExposure: 60, reputation: 70, season: 'autumn',
    },
    // 成熟期W20：双平台，大额满减，中幅上浮
    {
      label: '成熟W20-大额满减',
      platformCount: 2, activeWeeks: 20, recentWeeklyOrders: [150, 170, 180, 200],
      platformRating: 4.2, promotionTierId: 'advanced',
      discountTierId: 'large', deliveryPricingId: 'medium',
      offlineExposure: 60, reputation: 70, season: 'autumn',
    },
    // 巅峰期：双平台，大额满减+进阶推广，夏季
    {
      label: '巅峰W25-大额满减+夏季',
      platformCount: 2, activeWeeks: 25, recentWeeklyOrders: [200, 220, 230, 250],
      platformRating: 4.5, promotionTierId: 'advanced',
      discountTierId: 'large', deliveryPricingId: 'medium',
      offlineExposure: 80, reputation: 80, season: 'summer',
    },
    // 极端：三平台，亏本冲量，豪华推广，夏季
    {
      label: '极端-亏本冲量+豪华推广',
      platformCount: 3, activeWeeks: 25, recentWeeklyOrders: [300, 350, 380, 400],
      platformRating: 4.5, promotionTierId: 'premium',
      discountTierId: 'loss_leader', deliveryPricingId: 'same',
      offlineExposure: 90, reputation: 85, season: 'summer',
    },
    // 无满减对照：成熟期但不做满减
    {
      label: '成熟W20-无满减(对照)',
      platformCount: 2, activeWeeks: 20, recentWeeklyOrders: [30, 25, 20, 15],
      platformRating: 4.0, promotionTierId: 'basic',
      discountTierId: 'none', deliveryPricingId: 'same',
      offlineExposure: 60, reputation: 70, season: 'autumn',
    },
  ];

  // 选3个代表性区位
  const representativeLocations = locations.filter(l =>
    ['school', 'office', 'community'].includes(l.type)
  );

  scenarios.forEach(scenario => {
    console.log(`--- ${scenario.label} ---`);
    console.log(`    权重分因子: activeWeeks=${scenario.activeWeeks}, rating=${scenario.platformRating}, promo=${scenario.promotionTierId}, discount=${scenario.discountTierId}`);

    const headerLine = '  区位'.padEnd(10) + '地址'.padEnd(12) + '面积'.padEnd(6) +
      '权重分'.padStart(7) + '满减倍率'.padStart(9) + '周需求'.padStart(8) + '日均'.padStart(6) +
      '  Ring0'.padStart(8) + '  Ring1'.padStart(8) + '  Ring2'.padStart(8) + '  Ring3'.padStart(8);
    console.log(headerLine);

    representativeLocations.forEach(loc => {
      loc.addresses.forEach(addr => {
        const rings = generateRingsDeterministic(loc.type, loc.footTraffic, addr.trafficModifier);
        const result = calcDeliveryDemandV3(rings, loc.type, scenario);

        const upper = getBenchmarkUpper(addr.area);
        const ratio = result.weeklyTotal / upper;
        const status = ratio > 1.5 ? '❌' : ratio > 1.0 ? '⚠️' : ratio > 0.5 ? '✅' : '🔵';

        console.log(
          `  ${loc.name}`.padEnd(10) +
          addr.name.padEnd(12) +
          `${addr.area}㎡`.padEnd(6) +
          `${result.weightScore}`.padStart(7) +
          `${result.discountPricingMult.toFixed(2)}`.padStart(9) +
          `${result.weeklyTotal}`.padStart(8) +
          `${Math.round(result.weeklyTotal / 7)}`.padStart(6) +
          `${result.byRing.ring0}`.padStart(8) +
          `${result.byRing.ring1}`.padStart(8) +
          `${result.byRing.ring2}`.padStart(8) +
          `${result.byRing.ring3}`.padStart(8) +
          `  ${status}(${ratio.toFixed(1)}x基准上限)`
        );
      });
    });
    console.log();
  });

  // --- 第四部分：全区位成熟期对比 ---
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('【第四部分】全区位 × 成熟期标准满减 — 与现实基准对比');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const matureScenario: DeliveryScenario = {
    label: '成熟W20-标准满减',
    platformCount: 2, activeWeeks: 20, recentWeeklyOrders: [120, 130, 140, 150],
    platformRating: 4.2, promotionTierId: 'basic',
    discountTierId: 'standard', deliveryPricingId: 'medium',
    offlineExposure: 60, reputation: 70, season: 'autumn',
  };

  let totalOk = 0, totalOver = 0, totalSevere = 0;

  locations.forEach(loc => {
    loc.addresses.forEach(addr => {
      const rings = generateRingsDeterministic(loc.type, loc.footTraffic, addr.trafficModifier);
      const result = calcDeliveryDemandV3(rings, loc.type, matureScenario);
      const upper = getBenchmarkUpper(addr.area);
      const ratio = result.weeklyTotal / upper;
      const status = ratio > 1.5 ? '❌ 严重偏高' : ratio > 1.0 ? '⚠️ 偏高' : '✅ 合理';

      if (ratio <= 1.0) totalOk++;
      else if (ratio <= 1.5) totalOver++;
      else totalSevere++;

      console.log(`  ${loc.name} ${addr.name}(${addr.area}㎡): 周${result.weeklyTotal}单(日${Math.round(result.weeklyTotal / 7)}) vs 基准上限${upper}单 → ${status} (${ratio.toFixed(2)}x)`);
    });
  });
  console.log(`\n  汇总: ✅合理=${totalOk}  ⚠️偏高=${totalOver}  ❌严重偏高=${totalSevere}  (共${totalOk + totalOver + totalSevere}个场景)`);

  // --- 第五部分：满减策略对利润的影响分析 ---
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('【第五部分】满减策略对单均利润的影响（客单价15元基准）');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const basePrice = 15;
  const baseCost = 6; // 原材料成本

  console.log('  满减档位'.padEnd(14) + '定价'.padEnd(10) + '菜单价'.padStart(8) + '顾客付'.padStart(8) +
    '佣金16%'.padStart(9) + '包装费'.padStart(8) + '单均利润'.padStart(9) + '利润率'.padStart(8));
  console.log('  （注：满减补贴已体现在更低的顾客实付金额中，不再单独扣除）');

  DISCOUNT_TIERS.forEach(dt => {
    DELIVERY_PRICING_TIERS.forEach(pt => {
      const menuPrice = basePrice * pt.multiplier;
      const customerPays = menuPrice * (1 - dt.subsidyRate);
      const commission = customerPays * 0.16;
      // v3.1 修复：满减补贴已体现在 customerPays 中（收入=顾客实付），不再双重扣除
      const packageCost = 2.0;
      const profit = customerPays - baseCost - commission - packageCost;
      const profitRate = profit / menuPrice * 100;

      console.log(
        `  ${dt.name}`.padEnd(14) +
        `${pt.name}`.padEnd(10) +
        `¥${menuPrice.toFixed(1)}`.padStart(8) +
        `¥${customerPays.toFixed(1)}`.padStart(8) +
        `¥${commission.toFixed(1)}`.padStart(9) +
        `¥${packageCost.toFixed(1)}`.padStart(8) +
        `¥${profit.toFixed(1)}`.padStart(9) +
        `${profitRate.toFixed(0)}%`.padStart(8)
      );
    });
    console.log('  ---');
  });

  // --- 第六部分：单平台目标验证 ---
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('【第六部分】单平台稳定期目标验证（目标: 80-250单/周）');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 用 office 区位的中等地址作为标准测试
  const testLoc = locations.find(l => l.type === 'office') || locations[0];
  const testAddr = testLoc.addresses[Math.min(1, testLoc.addresses.length - 1)];
  const testRings = generateRingsDeterministic(testLoc.type, testLoc.footTraffic, testAddr.trafficModifier);

  console.log(`  测试区位: ${testLoc.name} ${testAddr.name}(${testAddr.area}㎡)\n`);

  const singlePlatformScenarios: DeliveryScenario[] = [
    { label: 'W3 冷启动-标准满减', platformCount: 1, activeWeeks: 3, recentWeeklyOrders: [], platformRating: 0, promotionTierId: 'none', discountTierId: 'standard', deliveryPricingId: 'slight', offlineExposure: 15, reputation: 45, season: 'autumn' },
    { label: 'W5 扶持结束-标准满减', platformCount: 1, activeWeeks: 5, recentWeeklyOrders: [30, 40], platformRating: 2.5, promotionTierId: 'basic', discountTierId: 'standard', deliveryPricingId: 'slight', offlineExposure: 25, reputation: 50, season: 'autumn' },
    { label: 'W8 成长-标准满减', platformCount: 1, activeWeeks: 8, recentWeeklyOrders: [50, 60, 70, 80], platformRating: 3.5, promotionTierId: 'basic', discountTierId: 'standard', deliveryPricingId: 'slight', offlineExposure: 35, reputation: 55, season: 'autumn' },
    { label: 'W12 稳定-标准满减', platformCount: 1, activeWeeks: 12, recentWeeklyOrders: [80, 90, 100, 110], platformRating: 4.0, promotionTierId: 'basic', discountTierId: 'standard', deliveryPricingId: 'medium', offlineExposure: 45, reputation: 60, season: 'autumn' },
    { label: 'W20 成熟-标准满减', platformCount: 1, activeWeeks: 20, recentWeeklyOrders: [100, 110, 120, 130], platformRating: 4.2, promotionTierId: 'basic', discountTierId: 'standard', deliveryPricingId: 'medium', offlineExposure: 60, reputation: 70, season: 'autumn' },
    { label: 'W20 成熟-大额满减', platformCount: 1, activeWeeks: 20, recentWeeklyOrders: [130, 150, 160, 170], platformRating: 4.2, promotionTierId: 'advanced', discountTierId: 'large', deliveryPricingId: 'medium', offlineExposure: 60, reputation: 70, season: 'autumn' },
    { label: 'W20 成熟-无满减', platformCount: 1, activeWeeks: 20, recentWeeklyOrders: [20, 15, 10, 8], platformRating: 4.0, promotionTierId: 'basic', discountTierId: 'none', deliveryPricingId: 'same', offlineExposure: 60, reputation: 70, season: 'autumn' },
  ];

  singlePlatformScenarios.forEach(s => {
    const result = calcDeliveryDemandV3(testRings, testLoc.type, s);
    const daily = Math.round(result.weeklyTotal / 7);
    const status = result.weeklyTotal < 30 ? '🔵极低' : result.weeklyTotal < 80 ? '📉偏低' : result.weeklyTotal <= 250 ? '✅目标' : result.weeklyTotal <= 400 ? '⚠️偏高' : '❌过高';
    console.log(`  ${s.label.padEnd(28)} 权重${String(result.weightScore).padStart(2)} 倍率${result.discountPricingMult.toFixed(2)} → 周${String(result.weeklyTotal).padStart(4)}单(日${String(daily).padStart(3)}) ${status}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  分析完成');
  console.log('═══════════════════════════════════════════════════════════════════');
}

main();
