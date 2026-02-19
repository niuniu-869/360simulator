// 营销活动系统数据配置 — 双指标漏斗模型
// 曝光度(exposure)：多少人知道你 | 口碑(reputation)：别人怎么看你

import type { MarketingActivityConfig } from '@/types/game';

// ============ 曝光类活动（花钱买量） ============

export const EXPOSURE_ACTIVITIES: MarketingActivityConfig[] = [
  {
    id: 'social_media',
    name: '社交媒体推广',
    type: 'continuous',
    category: 'exposure',
    baseCost: 2000,
    exposureBoost: 15,
    reputationBoost: 0,
    priceModifier: 1.0,
    dependencyCoefficient: 0.3,
    description: '抖音/小红书持续投放，每周提升曝光度',
    teachingTip: '花钱能买到曝光，但停止投入就快速下降',
  },
  {
    id: 'local_ad',
    name: '本地广告投放',
    type: 'one_time',
    category: 'exposure',
    baseCost: 6000,
    exposureBoost: 38,
    reputationBoost: 0,
    priceModifier: 1.0,
    dependencyCoefficient: 0,
    maxDuration: 3,
    cooldownWeeks: 6,
    description: '电梯广告+传单，3周内曝光+25',
    teachingTip: '传统广告覆盖面广，但效果随时间递减',
  },
  {
    id: 'grand_opening',
    name: '开业大酬宾',
    type: 'one_time',
    category: 'exposure',
    baseCost: 12000,
    exposureBoost: 55,
    reputationBoost: 5,
    priceModifier: 0.7,
    dependencyCoefficient: 0,
    maxDuration: 2,
    unique: true,
    description: '开业活动，2周内曝光+40、口碑+5，售价7折（含物料、传单、优惠券）',
    teachingTip: '开业是最好的曝光窗口，但折扣会压缩利润',
  },
];

// ============ 口碑类活动（品质留客） ============

export const REPUTATION_ACTIVITIES: MarketingActivityConfig[] = [
  {
    id: 'ingredient_upgrade',
    name: '食材升级',
    type: 'continuous',
    category: 'reputation',
    baseCost: 800,
    exposureBoost: 0,
    reputationBoost: 3,
    priceModifier: 1.0,
    dependencyCoefficient: 0,
    description: '使用更优质的食材，持续提升口碑',
    teachingTip: '品质是口碑的根基，虽然慢但最可持续',
  },
  {
    id: 'service_training',
    name: '服务培训周',
    type: 'one_time',
    category: 'reputation',
    baseCost: 1200,
    exposureBoost: 0,
    reputationBoost: 10,
    priceModifier: 1.0,
    dependencyCoefficient: 0,
    maxDuration: 1,
    cooldownWeeks: 4,
    description: '集中培训服务技能，1周内口碑+10',
    teachingTip: '好服务让客人愿意再来，也愿意推荐朋友',
  },
  {
    id: 'loyalty_day',
    name: '老客回馈日',
    type: 'one_time',
    category: 'reputation',
    baseCost: 600,
    exposureBoost: 0,
    reputationBoost: 8,
    priceModifier: 0.9,
    dependencyCoefficient: 0,
    maxDuration: 1,
    cooldownWeeks: 3,
    description: '老客户专属优惠，1周内口碑+8',
    teachingTip: '维护老客户的成本远低于获取新客户',
  },
];

// ============ 混合类活动（曝光+口碑，高依赖风险） ============

export const MIXED_ACTIVITIES: MarketingActivityConfig[] = [
  // 注意：meituan 和 douyin_group 已迁移至外卖平台系统（deliveryData.ts）
  {
    id: 'member_system',
    name: '会员体系',
    type: 'continuous',
    category: 'both',
    baseCost: 500,
    exposureBoost: 4,
    reputationBoost: 3,
    priceModifier: 0.9,
    dependencyCoefficient: 0.15,
    description: '建立会员体系，9折优惠提升复购',
    teachingTip: '会员是自己的私域流量，依赖风险低',
  },
  {
    id: 'flash_sale',
    name: '5折大促',
    type: 'one_time',
    category: 'both',
    baseCost: 0,
    exposureBoost: 20,
    reputationBoost: -5,
    priceModifier: 0.5,
    dependencyCoefficient: 0,
    maxDuration: 1,
    cooldownWeeks: 6,
    description: '全场5折，1周内曝光+20，但口碑-5',
    teachingTip: '低价吸引的客户期望值被拉高，恢复原价后容易差评',
  },
];

// ============ 所有活动合集 ============

export const ALL_MARKETING_ACTIVITIES: MarketingActivityConfig[] = [
  ...EXPOSURE_ACTIVITIES,
  ...REPUTATION_ACTIVITIES,
  ...MIXED_ACTIVITIES,
];

// ============ 依赖陷阱配置 ============

export const DEPENDENCY_CONFIG = {
  // 依赖系数阈值
  highRiskThreshold: 0.5,
  mediumRiskThreshold: 0.3,
  // 曝光度自然衰减（每周）
  exposureDecayPerWeek: 2.0,
  // 口碑自然衰减（每周，口碑是长期积累的结果，衰减极慢）
  reputationDecayPerWeek: 0.15,
  // 口碑下限（即使最差也有基础口碑，门面在那里）
  reputationFloor: 10,
};

// ============ 工具函数 ============

/**
 * 获取活动配置
 */
export function getActivityConfig(activityId: string): MarketingActivityConfig | undefined {
  return ALL_MARKETING_ACTIVITIES.find(a => a.id === activityId);
}

/**
 * 计算活动效果衰减（持续运行时边际收益递减）
 * 前4周满效果，之后逐步衰减到 30%
 */
export function calculateActivityEffectDecay(activeWeeks: number, dependencyCoeff: number): number {
  if (dependencyCoeff === 0) return 1.0;
  if (activeWeeks <= 4) return 1.0;
  return Math.max(0.3, 1.0 - (activeWeeks - 4) * dependencyCoeff * 0.05);
}

/**
 * 计算停止高依赖活动后的曝光度惩罚比例
 * 返回值为损失比例（0 ~ 0.5），应用方式：newExposure = exposure * (1 - penalty)
 */
export function calculateStopPenalty(dependencyCoeff: number, activeWeeks: number): number {
  return Math.min(0.5, dependencyCoeff * Math.min(activeWeeks, 20) * 0.05);
}

/**
 * 获取活动风险等级
 */
export function getActivityRiskLevel(dependencyCoeff: number): 'low' | 'medium' | 'high' {
  if (dependencyCoeff >= DEPENDENCY_CONFIG.highRiskThreshold) return 'high';
  if (dependencyCoeff >= DEPENDENCY_CONFIG.mediumRiskThreshold) return 'medium';
  return 'low';
}

/**
 * 获取地址的曝光度下限（由地址可见性决定）
 */
export function getLocationExposureFloor(trafficModifier: number): number {
  // trafficModifier 范围 0.5-1.5，映射到曝光度下限 8-28
  // 好位置的自然客流应保证基础曝光度
  return Math.round(8 + (trafficModifier - 0.5) * 20);
}
