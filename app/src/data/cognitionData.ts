// 认知系统数据配置

import type {
  CognitionLevel,
  CognitionLevelConfig,
  CognitionState,
  InfoFuzzConfig,
  PanelId,
} from '@/types/game';

// ============ 认知等级配置 ============

export const COGNITION_LEVELS: CognitionLevelConfig[] = [
  {
    level: 0,
    name: '创业小白',
    title: '愣头青',
    icon: '🥚',
    description: '"我觉得开餐厅很简单，有手就行！" 对餐饮行业一无所知，容易被快招公司忽悠',
    expRequired: 0,
    expTotal: 0,
  },
  {
    level: 1,
    name: '踩坑学徒',
    title: '交学费',
    icon: '🐣',
    description: '"原来开店这么复杂..." 开始意识到餐饮不简单，但还分不清真假信息',
    expRequired: 130,
    expTotal: 130,
  },
  {
    level: 2,
    name: '觉醒新手',
    title: '明白人',
    icon: '🐥',
    description: '"选址定生死，产品定江山" 掌握基础概念，能识别明显套路',
    expRequired: 260,
    expTotal: 390,
  },
  {
    level: 3,
    name: '进阶店主',
    title: '实干家',
    icon: '🐔',
    description: '"数据不会骗人" 学会用数据说话，能做出基本正确的决策',
    expRequired: 420,
    expTotal: 810,
  },
  {
    level: 4,
    name: '成熟老板',
    title: '老江湖',
    icon: '🦃',
    description: '"风险可控，利润可期" 具备系统思维，能预判市场变化',
    expRequired: 680,
    expTotal: 1490,
  },
  {
    level: 5,
    name: '餐饮老炮',
    title: '人精',
    icon: '🦅',
    description: '"这行我懂完了" 行业洞察精准，几乎不会踩大坑',
    expRequired: 900,
    expTotal: 2390,
  },
];

// ============ 踩坑经验配置 ============

export const MISTAKE_EXP_TABLE: Record<string, { exp: number; description: string }> = {
  quick_franchise: { exp: 80, description: '快招被骗 - "吃一堑长一智"' },
  bad_location: { exp: 40, description: '选址失误 - "选址定生死，我信了"' },
  contract_trap: { exp: 35, description: '合同陷阱 - "字太多没仔细看..."' },
  blind_expansion: { exp: 45, description: '盲目扩张 - "步子太大扯到蛋"' },
  inventory_overstock: { exp: 25, description: '库存积压 - "买太多了..."' },
  staff_turnover: { exp: 30, description: '人员流失 - "人心散了"' },
  cash_flow_break: { exp: 60, description: '现金流断裂 - "最惨痛的教训"' },
  supplier_scam: { exp: 35, description: '被供应商坑 - "人心险恶啊"' },
  over_staff: { exp: 20, description: '人员超配 - "工资发不起了"' },
  single_product: { exp: 15, description: '单品执念 - "鸡蛋不能放一个篮子"' },
};

// ============ 被动经验获取配置 ============
// 调整后的数值，确保玩家在12-20周内能达到3级左右

export const PASSIVE_EXP_CONFIG = {
  // 基础时间经验（每周自动）— 现实化：经营认知提升需要更长时间
  weeklyBaseExp: 10,
  // 经营表现
  profitWeekBonus: 18,         // 盈利基础奖励（原8，提升盈利激励）
  profitScalePerThousand: 3,   // 每1000元利润额外经验
  profitScaleMax: 30,          // 利润规模经验上限
  consecutiveProfitThreshold: 3, // 连续盈利奖励触发周数
  consecutiveProfitBonus: 8,   // 连续盈利>=3周额外经验
  lossWeekExp: 10,
  firstTimeEvent: 18,
  // 操作经验（按周结算，不提醒用户）
  operationExpPerAction: 2,
  maxOperationExpPerWeek: 40,
  // 咨询勇哥（专业咨询不便宜）
  consultYongGeExp: 40,
  consultYongGeWeeklyLimit: 2,
  consultYongGeCost: 2000,
  // 其他增长途径
  nearbyShopObserveExp: 7,    // 观察到周边店铺事件
  marketingInsightExp: 6,      // 启动/停止营销活动
  staffManagementExp: 4,       // 招聘/解雇操作
  priceAdjustmentExp: 2,       // 调价操作
};

// ============ 统一认知经验应用函数（唯一升级入口） ============

/**
 * 消除 gameEngine / gameActions / eventEngine 三处重复实现。
 * expToNext 在 Lv5 时设为 Infinity（防止 UI 进度条除零）。
 */
export function applyCognitionExp(
  cognition: CognitionState,
  expGain: number,
): CognitionState {
  const cog = { ...cognition };
  cog.exp += expGain;
  cog.totalExp += expGain;
  while (cog.level < 5 && cog.exp >= cog.expToNext) {
    cog.exp -= cog.expToNext;
    cog.level = (cog.level + 1) as CognitionLevel;
    const nextLevel = COGNITION_LEVELS.find(
      l => l.level === ((cog.level + 1) as CognitionLevel),
    );
    cog.expToNext = nextLevel ? nextLevel.expRequired : Infinity;
  }
  return cog;
}

// ============ 认知减免率配置 ============

export const COGNITION_DISCOUNT_RATE: Record<CognitionLevel, number> = {
  0: 0,
  1: 0.10,
  2: 0.20,
  3: 0.25,
  4: 0.30,
  5: 0.35,
};

// ============ 快招识别错误率 ============

export const QUICK_FRANCHISE_ERROR_RATE: Record<CognitionLevel, number> = {
  0: 0.90,  // 90%概率被骗
  1: 0.70,
  2: 0.50,
  3: 0.30,
  4: 0.15,
  5: 0.05,
};

// ============ 合同陷阱识别错误率 ============

export const CONTRACT_TRAP_ERROR_RATE: Record<CognitionLevel, number> = {
  0: 0.95,
  1: 0.80,
  2: 0.60,
  3: 0.40,
  4: 0.20,
  5: 0.10,
};

// ============ 面板渐进式解锁配置 ============

export const PANEL_UNLOCK_CONFIG: Record<PanelId, CognitionLevel> = {
  operating: 0,
  staff: 0,
  inventory: 1,
  marketing: 2,
  finance: 3,
  supplydemand: 4,
};

export function isPanelUnlocked(panelId: PanelId, level: CognitionLevel): boolean {
  return level >= (PANEL_UNLOCK_CONFIG[panelId] ?? 0);
}

// ============ 信息模糊化配置 ============

export const INFO_FUZZ_CONFIG: InfoFuzzConfig[] = [
  {
    infoType: 'dailyCash',
    unlockLevel: 1,
    fuzzLevels: [
      { level: 0, type: 'hidden' },
      { level: 1, type: 'exact' },
      { level: 2, type: 'exact' },
      { level: 3, type: 'exact' },
      { level: 4, type: 'exact' },
      { level: 5, type: 'exact' },
    ],
  },
  {
    infoType: 'weeklyRevenue',
    unlockLevel: 3,
    fuzzLevels: [
      { level: 0, type: 'fuzzy', fuzzyWords: ['几千块', '不少钱', '还行'] },
      { level: 1, type: 'fuzzy', fuzzyWords: ['几千块', '不少钱', '还行'] },
      { level: 2, type: 'fuzzy', fuzzyWords: ['几千块', '不少钱', '还行'] },
      { level: 3, type: 'range', minRatio: 0.7, maxRatio: 1.3 },
      { level: 4, type: 'range', minRatio: 0.9, maxRatio: 1.1 },
      { level: 5, type: 'exact' },
    ],
  },
  {
    infoType: 'monthlyRevenue',
    unlockLevel: 3,
    fuzzLevels: [
      { level: 0, type: 'hidden' },
      { level: 1, type: 'hidden' },
      { level: 2, type: 'hidden' },
      { level: 3, type: 'range', minRatio: 0.7, maxRatio: 1.3 },
      { level: 4, type: 'range', minRatio: 0.9, maxRatio: 1.1 },
      { level: 5, type: 'exact' },
    ],
  },
  {
    // 走量改造 R1：核心会计概念前移到 Lv1，Lv0 给模糊值建立教学存在感
    infoType: 'grossMargin',
    unlockLevel: 1,
    fuzzLevels: [
      { level: 0, type: 'fuzzy', fuzzyWords: ['毛利薄', '一般', '挺赚'] },
      { level: 1, type: 'range', minRatio: 0.7, maxRatio: 1.3 },
      { level: 2, type: 'range', minRatio: 0.8, maxRatio: 1.2 },
      { level: 3, type: 'range', minRatio: 0.9, maxRatio: 1.1 },
      { level: 4, type: 'range', minRatio: 0.95, maxRatio: 1.05 },
      { level: 5, type: 'exact' },
    ],
  },
  {
    infoType: 'netProfit',
    unlockLevel: 3,
    fuzzLevels: [
      { level: 0, type: 'hidden' },
      { level: 1, type: 'hidden' },
      { level: 2, type: 'hidden' },
      { level: 3, type: 'range', minRatio: 0.7, maxRatio: 1.3 },
      { level: 4, type: 'range', minRatio: 0.9, maxRatio: 1.1 },
      { level: 5, type: 'exact' },
    ],
  },
  {
    // 走量改造 R1：核心会计概念前移到 Lv1，Lv0 给模糊值建立教学存在感
    infoType: 'variableCost',
    unlockLevel: 1,
    fuzzLevels: [
      { level: 0, type: 'fuzzy', fuzzyWords: ['挺高的', '不少'] },
      { level: 1, type: 'range', minRatio: 0.7, maxRatio: 1.3 },
      { level: 2, type: 'range', minRatio: 0.8, maxRatio: 1.2 },
      { level: 3, type: 'exact' },
      { level: 4, type: 'exact' },
      { level: 5, type: 'exact' },
    ],
  },
  {
    // 走量改造 R1：核心会计概念前移到 Lv1，Lv0 给模糊值建立教学存在感
    infoType: 'fixedCost',
    unlockLevel: 1,
    fuzzLevels: [
      { level: 0, type: 'fuzzy', fuzzyWords: ['不少钱', '大头'] },
      { level: 1, type: 'range', minRatio: 0.8, maxRatio: 1.2 },
      { level: 2, type: 'range', minRatio: 0.8, maxRatio: 1.2 },
      { level: 3, type: 'range', minRatio: 0.9, maxRatio: 1.1 },
      { level: 4, type: 'exact' },
      { level: 5, type: 'exact' },
    ],
  },
  {
    infoType: 'competitorCount',
    unlockLevel: 1,
    fuzzLevels: [
      { level: 0, type: 'hidden' },
      { level: 1, type: 'fuzzy', fuzzyWords: ['有几家', '挺多的'] },
      { level: 2, type: 'range', minRatio: 0.5, maxRatio: 1.5 },
      { level: 3, type: 'exact' },
      { level: 4, type: 'exact' },
      { level: 5, type: 'exact' },
    ],
  },
  {
    infoType: 'locationScore',
    unlockLevel: 2,
    fuzzLevels: [
      { level: 0, type: 'fuzzy', fuzzyWords: ['看起来还行', '挺热闹'] },
      { level: 1, type: 'fuzzy', fuzzyWords: ['看起来还行', '一般般'] },
      { level: 2, type: 'fuzzy', fuzzyWords: ['好', '一般', '差'] },
      { level: 3, type: 'fuzzy', fuzzyWords: ['A级', 'B级', 'C级'] },
      { level: 4, type: 'range', minRatio: 0.9, maxRatio: 1.1 },
      { level: 5, type: 'exact' },
    ],
  },
  {
    infoType: 'breakEvenPoint',
    unlockLevel: 2,
    fuzzLevels: [
      { level: 0, type: 'hidden' },
      { level: 1, type: 'hidden' },
      { level: 2, type: 'fuzzy', fuzzyWords: ['大概每天XX单', '挺多的'] },
      { level: 3, type: 'range', minRatio: 0.8, maxRatio: 1.2 },
      { level: 4, type: 'range', minRatio: 0.95, maxRatio: 1.05 },
      { level: 5, type: 'exact' },
    ],
  },
];
