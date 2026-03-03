/**
 * bossActionData.ts — 老板周行动系统数据配置
 *
 * 5种老板行动：亲自坐镇、巡店督导、周边考察、蹲点数人头、同行饭局
 * 核心权衡：省钱干活 vs 花钱长见识 vs 给店里加buff
 */

import type {
  BossActionType,
  CognitionLevel,
  InvestigationDimension,
  NearbyShop,
} from '@/types/game';

// ============ 行动配置 ============

export interface BossActionConfig {
  id: BossActionType;
  name: string;
  icon: string;
  cost: number;                    // 每周费用
  expRange: [number, number];      // 认知经验范围 [min, max]
  minCognitionLevel: CognitionLevel;
  description: string;
  effectDescription: string;       // 效果说明
  yongGeQuote: string;             // 勇哥语录
}

export const BOSS_ACTIONS: BossActionConfig[] = [
  {
    id: 'work_in_store',
    name: '亲自坐镇',
    icon: '🏪',
    cost: 0,
    expRange: [5, 5],
    minCognitionLevel: 0,
    description: '替代一个岗位，节省该岗位一人周薪',
    effectDescription: '老板效率 = 正式员工的 70%',
    yongGeQuote: '老板天天在后厨炒菜，那你开的是饭店还是大排档？',
  },
  {
    id: 'supervise',
    name: '巡店督导',
    icon: '📋',
    cost: 0,
    expRange: [8, 8],
    minCognitionLevel: 0,
    description: '坐镇管理，提升全员状态',
    effectDescription: '全员士气+3，效率+8%',
    yongGeQuote: '老板在，员工干活都利索点，这就是管理的价值。',
  },
  {
    id: 'investigate_nearby',
    name: '周边考察',
    icon: '🔍',
    cost: 200,
    expRange: [25, 35],
    minCognitionLevel: 0,
    description: '考察一家周边店铺，揭示一个维度的信息',
    effectDescription: '盲人摸象：每次只能看到一面，信息可能有误',
    yongGeQuote: '知己知彼，但你一次只能摸到大象的一条腿。',
  },
  {
    id: 'count_traffic',
    name: '蹲点数人头',
    icon: '📊',
    cost: 0,
    expRange: [15, 20],
    minCognitionLevel: 0,
    description: '在店门口观察客流，获取需求数据',
    effectDescription: '连续蹲点2周可获得额外洞察',
    yongGeQuote: '在门口站一天，比看十份报告都管用。',
  },
  {
    id: 'industry_dinner',
    name: '同行饭局',
    icon: '🍻',
    cost: 500,
    expRange: [30, 40],
    minCognitionLevel: 1,
    description: '和同行吃饭聊天，获取行业情报',
    effectDescription: '信息真假参半，认知越高越能分辨',
    yongGeQuote: '同行的话，三分真七分假，你得自己有判断力。',
  },
];

export function getBossActionConfig(actionId: BossActionType): BossActionConfig | undefined {
  return BOSS_ACTIONS.find(a => a.id === actionId);
}

// ============ 老板坐镇效率系数 ============

/** 老板替代员工时的效率折扣 */
export const BOSS_WORK_EFFICIENCY = 0.70;

// ============ 巡店督导效果 ============

export const SUPERVISE_EFFECTS = {
  moraleBoost: 3,        // 全员士气 +3
  efficiencyBoost: 0.08, // 全员效率 +8%（本周生效）
};

// ============ 考察信息可靠性配置 ============

/** 各认知等级下，考察信息的准确率 */
export const INVESTIGATION_ACCURACY: Record<CognitionLevel, number> = {
  0: 0.45,  // Lv0: 45% 准确
  1: 0.55,  // Lv1: 55%
  2: 0.65,  // Lv2: 65%
  3: 0.78,  // Lv3: 78%
  4: 0.88,  // Lv4: 88%
  5: 0.95,  // Lv5: 95%
};

/** 认知等级 >= 此值时，对不准确信息给出提示 */
export const COG_WARNING_THRESHOLD: CognitionLevel = 2;

/** 不准确信息的提示语（随机选一条） */
export const COG_WARNING_MESSAGES = [
  '我寻思他说的好像不太对劲...',
  '这数据看着有点离谱啊',
  '总觉得哪里不对，但说不上来',
  '嗯...跟我观察到的好像有出入',
  '这个信息得打个问号',
  '直觉告诉我这不太靠谱',
];

// ============ 考察维度配置 ============

export const INVESTIGATION_DIMENSIONS: {
  id: InvestigationDimension;
  name: string;
  icon: string;
}[] = [
  { id: 'traffic', name: '日均客流', icon: '👥' },
  { id: 'price', name: '客单价', icon: '💰' },
  { id: 'category', name: '主打品类', icon: '🍜' },
  { id: 'decoration', name: '装修档次', icon: '🏠' },
  { id: 'staffCount', name: '员工人数', icon: '👷' },
];

// ============ 考察结果生成 ============

/**
 * 生成考察结果（可能有误的信息）
 */
export function generateInvestigationResult(
  shop: NearbyShop,
  dimension: InvestigationDimension,
  cogLevel: CognitionLevel,
): { displayValue: string; isAccurate: boolean; cogWarning?: string } {
  const isAccurate = Math.random() < INVESTIGATION_ACCURACY[cogLevel];

  let realValue: string;
  let fakeValue: string;

  switch (dimension) {
    case 'traffic': {
      // 真实值基于店铺曝光度估算日客流
      const realTraffic = Math.round(shop.exposure * 1.2 + 15);
      realValue = `约 ${realTraffic} 人/天`;
      // 假值偏差 ±40-80%
      const fakeFactor = 0.4 + Math.random() * 0.8;
      const direction = Math.random() > 0.5 ? 1 : -1;
      fakeValue = `约 ${Math.round(realTraffic * (1 + direction * fakeFactor))} 人/天`;
      break;
    }
    case 'price': {
      const avgPrice = shop.products.length > 0
        ? Math.round(shop.products.reduce((s, p) => s + p.price, 0) / shop.products.length)
        : 20;
      realValue = `¥${avgPrice}`;
      const fakeOffset = Math.round((3 + Math.random() * 10) * (Math.random() > 0.5 ? 1 : -1));
      fakeValue = `¥${Math.max(5, avgPrice + fakeOffset)}`;
      break;
    }
    case 'category': {
      const categoryNames: Record<string, string> = {
        drink: '饮品', food: '快餐', snack: '小吃', meal: '正餐', grocery: '便利', service: '服务',
      };
      realValue = categoryNames[shop.shopCategory] || '综合';
      const fakeCategories = Object.values(categoryNames).filter(c => c !== realValue);
      fakeValue = fakeCategories[Math.floor(Math.random() * fakeCategories.length)];
      break;
    }
    case 'decoration': {
      const levelNames = ['', '简陋', '简约', '标准', '精装', '豪华'];
      realValue = levelNames[shop.decorationLevel] || '标准';
      const fakeLevels = levelNames.slice(1).filter(l => l !== realValue);
      fakeValue = fakeLevels[Math.floor(Math.random() * fakeLevels.length)];
      break;
    }
    case 'staffCount': {
      // 基于店铺品牌类型估算员工数
      const realCount = shop.brandType === 'chain' ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3);
      realValue = `${realCount} 人`;
      const fakeCount = Math.max(1, realCount + Math.round((Math.random() * 4 - 2)));
      fakeValue = fakeCount === realCount ? `${realCount + 2} 人` : `${fakeCount} 人`;
      break;
    }
  }

  const displayValue = isAccurate ? realValue : fakeValue;

  // 认知等级足够时，对不准确信息给出提示
  let cogWarning: string | undefined;
  if (!isAccurate && cogLevel >= COG_WARNING_THRESHOLD) {
    cogWarning = COG_WARNING_MESSAGES[Math.floor(Math.random() * COG_WARNING_MESSAGES.length)];
  }

  return { displayValue, isAccurate, cogWarning };
}

// ============ 蹲点数人头结果生成 ============

export const TRAFFIC_COUNT_CONFIG = {
  consecutiveBonusWeeks: 2,    // 连续蹲点2周触发额外奖励
  consecutiveBonusExp: 20,     // 额外经验
  insightMessage: '连续观察后你发现了客流的规律：',
};

/**
 * 生成蹲点观察结果（可能有误的客流数据）
 */
export function generateTrafficCountResult(
  baseTraffic: number,
  cogLevel: CognitionLevel,
): { displayValue: string; isAccurate: boolean; cogWarning?: string } {
  const isAccurate = Math.random() < INVESTIGATION_ACCURACY[cogLevel];

  const realValue = `日均客流约 ${Math.round(baseTraffic)} 人`;
  const fakeFactor = 0.3 + Math.random() * 0.5;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const fakeTraffic = Math.round(baseTraffic * (1 + direction * fakeFactor));
  const fakeValue = `日均客流约 ${fakeTraffic} 人`;

  const displayValue = isAccurate ? realValue : fakeValue;

  let cogWarning: string | undefined;
  if (!isAccurate && cogLevel >= COG_WARNING_THRESHOLD) {
    cogWarning = COG_WARNING_MESSAGES[Math.floor(Math.random() * COG_WARNING_MESSAGES.length)];
  }

  return { displayValue, isAccurate, cogWarning };
}

// ============ 同行饭局配置 ============

/** 饭局信息可靠率（按认知等级） */
export const DINNER_RELIABILITY: Record<CognitionLevel, number> = {
  0: 0.40,
  1: 0.50,
  2: 0.60,
  3: 0.75,
  4: 0.85,
  5: 0.95,
};

/** 饭局可能获得的 buff 概率 */
export const DINNER_BUFF_CHANCE = 0.12;

/** 饭局洞察模板 */
export const DINNER_INSIGHTS = {
  accurate: [
    { content: '听说最近{category}品类竞争加剧，新店开了好几家', category: 'market' },
    { content: '有个老板说他家用的供应商比市场价便宜10%，在城东批发市场', category: 'supply' },
    { content: '这片区周末客流比工作日多40%左右，得备足周末的货', category: 'demand' },
    { content: '隔壁街那家店上了外卖后营业额涨了30%', category: 'delivery' },
    { content: '现在招人不好招，得把薪资开到行业均价以上才行', category: 'staff' },
    { content: '做营销别光发传单，线上种草效果好很多', category: 'marketing' },
  ],
  inaccurate: [
    { content: '听说这片区马上要拆迁，客流会暴涨', category: 'market' },
    { content: '有人推荐了个供应商，说能便宜30%，质量一样好', category: 'supply' },
    { content: '据说周边要开个大商场，以后客流翻倍', category: 'demand' },
    { content: '外卖不赚钱的，抽成太高了，别做', category: 'delivery' },
    { content: '员工嘛，给最低工资就行，反正都是临时工', category: 'staff' },
    { content: '现在做生意不用营销，酒香不怕巷子深', category: 'marketing' },
  ],
};

/**
 * 生成饭局洞察
 */
export function generateDinnerInsight(
  cogLevel: CognitionLevel,
  _week: number,
  playerCategory?: string,
): { content: string; isAccurate: boolean; cogWarning?: string; buff?: { type: 'supply_cost_reduction'; value: number; weeks: number; source: string } } {
  const isAccurate = Math.random() < DINNER_RELIABILITY[cogLevel];

  const pool = isAccurate ? DINNER_INSIGHTS.accurate : DINNER_INSIGHTS.inaccurate;
  const insight = pool[Math.floor(Math.random() * pool.length)];

  // 替换模板变量
  const categoryNames: Record<string, string> = {
    drink: '饮品', food: '快餐', snack: '小吃', meal: '正餐',
  };
  const categoryName = playerCategory ? (categoryNames[playerCategory] || playerCategory) : '餐饮';
  const content = insight.content.replace(/\{category\}/g, categoryName);

  let cogWarning: string | undefined;
  if (!isAccurate && cogLevel >= COG_WARNING_THRESHOLD) {
    cogWarning = COG_WARNING_MESSAGES[Math.floor(Math.random() * COG_WARNING_MESSAGES.length)];
  }

  // 小概率获得供应商 buff（仅准确信息时）
  let buff: { type: 'supply_cost_reduction'; value: number; weeks: number; source: string } | undefined;
  if (isAccurate && insight.category === 'supply' && Math.random() < DINNER_BUFF_CHANCE / DINNER_RELIABILITY[cogLevel]) {
    buff = {
      type: 'supply_cost_reduction',
      value: 0.05,  // 进货成本 -5%
      weeks: 4,
      source: '同行推荐的供应商',
    };
  }

  return { content, isAccurate, cogWarning, buff };
}
