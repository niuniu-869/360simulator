// 员工系统数据配置（v2.1 重构）

import type {
  RecruitmentChannel,
  TaskDefinition,
  StaffFatigueEffect,
  Staff,
} from "@/types/game";
import { rand } from "@/lib/rng";

// ============ 岗位定义 ============

export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    id: "chef",
    name: "后厨",
    icon: "👨‍🍳",
    productionMultiplier: 1.3,
    serviceMultiplier: 0.0,
    description: "专注出餐，产能最高",
  },
  {
    id: "waiter",
    name: "前台/服务",
    icon: "🙋",
    productionMultiplier: 0.3,
    serviceMultiplier: 1.0,
    description: "服务顾客，提升满意度",
  },
  {
    id: "marketer",
    name: "营销",
    icon: "📢",
    productionMultiplier: 0.0,
    serviceMultiplier: 0.0,
    exposureBoostRate: 2.5,
    description: "线下发传单+线上运营，提升曝光度",
  },
  {
    id: "cleaner",
    name: "勤杂",
    icon: "🧹",
    productionMultiplier: 0.0,
    serviceMultiplier: 0.4,
    cleanlinessRate: 8.0,
    description: "维护店面整洁，间接提升口碑",
  },
  {
    id: "manager",
    name: "店长",
    icon: "📋",
    productionMultiplier: 0.3,
    serviceMultiplier: 0.5,
    description: "全员效率+10%，偶尔帮忙出餐",
  },
];

// ============ 招聘渠道配置 ============

export const RECRUITMENT_CHANNELS: RecruitmentChannel[] = [
  {
    id: "walk_in",
    name: "店门招聘",
    cost: 0,
    candidateQuality: "normal",
    description: "在店门口贴招聘启事，免费但质量一般",
  },
  {
    id: "online_post",
    name: "网络招聘",
    cost: 200,
    candidateQuality: "normal",
    description: "在招聘网站发布信息",
  },
  {
    id: "referral",
    name: "员工推荐",
    cost: 500,
    candidateQuality: "high",
    description: "老员工推荐，质量较高",
  },
  {
    id: "agency",
    name: "中介招聘",
    cost: 1000,
    candidateQuality: "excellent",
    description: "通过中介招聘，质量最高",
  },
];

// ============ 岗位经验配置 ============

/** 岗位经验系数（不同岗位积累经验速度不同） */
export const TASK_EXP_COEFFICIENTS: Record<string, number> = {
  chef: 1.0,
  waiter: 1.0,
  marketer: 0.9,
  cleaner: 0.7,
  manager: 1.2,
};

/** 技能升级阈值表 */
export const SKILL_UPGRADE_TABLE: { level: number; expRequired: number }[] = [
  { level: 1, expRequired: 80 }, // Lv1→2 约8周（新员工需2-3个月熟练）
  { level: 2, expRequired: 160 }, // Lv2→3 约16周
  { level: 3, expRequired: 320 }, // Lv3→4 约32周
  { level: 4, expRequired: 640 }, // Lv4→5 约64周
];

/** 标准周工时基准（6天×8小时=48小时） */
const STANDARD_WEEKLY_HOURS = 48;

// ============ 工时配置 ============

export const WORK_HOURS_CONFIG = {
  minDays: 5,
  maxDays: 7,
  minHours: 4,
  maxHours: 12,
  fatigueExponent: 1.5, // 疲劳指数
};

// ============ 解雇士气配置 ============

export const FIRE_MORALE_CONFIG = {
  basePenalty: -8, // 基础士气惩罚
  tenureWeeksThreshold: 8, // 在职超过此周数额外惩罚
  tenureExtraPenalty: -4, // 老员工额外惩罚
  highSkillThreshold: 3, // 高技能阈值
  highSkillExtraPenalty: -3, // 高技能额外惩罚
};

// ============ 士气效果配置 ============

export interface MoraleEffect {
  minMorale: number;
  maxMorale: number;
  efficiencyMod: number;
  serviceMod: number;
  status: string;
  icon: string;
}

export const MORALE_EFFECTS: MoraleEffect[] = [
  {
    minMorale: 80,
    maxMorale: 100,
    efficiencyMod: 1.2,
    serviceMod: 1.15,
    status: "优秀",
    icon: "😊",
  },
  {
    minMorale: 60,
    maxMorale: 79,
    efficiencyMod: 1.0,
    serviceMod: 1.0,
    status: "正常",
    icon: "😐",
  },
  {
    minMorale: 40,
    maxMorale: 59,
    efficiencyMod: 0.9,
    serviceMod: 0.9,
    status: "消极",
    icon: "😕",
  },
  {
    minMorale: 20,
    maxMorale: 39,
    efficiencyMod: 0.75,
    serviceMod: 0.8,
    status: "低落",
    icon: "😞",
  },
  {
    minMorale: 0,
    maxMorale: 19,
    efficiencyMod: 0.6,
    serviceMod: 0.65,
    status: "崩溃",
    icon: "😫",
  },
];

// ============ 员工疲劳效果配置 ============

export const STAFF_FATIGUE_EFFECTS: StaffFatigueEffect[] = [
  {
    minFatigue: 0,
    maxFatigue: 30,
    efficiencyPenalty: 1.0,
    servicePenalty: 1.0,
    quitRisk: 0,
    status: "精力充沛",
    icon: "💪",
  },
  {
    minFatigue: 31,
    maxFatigue: 50,
    efficiencyPenalty: 0.95,
    servicePenalty: 0.95,
    quitRisk: 0,
    status: "略感疲惫",
    icon: "😐",
  },
  {
    minFatigue: 51,
    maxFatigue: 70,
    efficiencyPenalty: 0.85,
    servicePenalty: 0.85,
    quitRisk: 0.05,
    status: "疲惫",
    icon: "😓",
  },
  {
    minFatigue: 71,
    maxFatigue: 90,
    efficiencyPenalty: 0.7,
    servicePenalty: 0.7,
    quitRisk: 0.15,
    status: "过劳",
    icon: "😫",
  },
  {
    minFatigue: 91,
    maxFatigue: 100,
    efficiencyPenalty: 0.5,
    servicePenalty: 0.5,
    quitRisk: 0.3,
    status: "濒临崩溃",
    icon: "🆘",
  },
];

// ============ 工具函数 ============

/**
 * 获取士气效果
 */
export function getMoraleEffect(morale: number): MoraleEffect {
  const effect = MORALE_EFFECTS.find(
    (e) => morale >= e.minMorale && morale <= e.maxMorale,
  );
  return effect || MORALE_EFFECTS[MORALE_EFFECTS.length - 1];
}

/**
 * 获取员工疲劳效果
 */
export function getStaffFatigueEffect(fatigue: number): StaffFatigueEffect {
  const effect = STAFF_FATIGUE_EFFECTS.find(
    (e) => fatigue >= e.minFatigue && fatigue <= e.maxFatigue,
  );
  return effect || STAFF_FATIGUE_EFFECTS[STAFF_FATIGUE_EFFECTS.length - 1];
}

/**
 * 根据招聘渠道生成员工技能等级
 */
export function generateSkillLevel(
  quality: "normal" | "high" | "excellent",
): number {
  const ranges = {
    normal: { min: 1, max: 2 },
    high: { min: 2, max: 3 },
    excellent: { min: 3, max: 4 },
  };
  const range = ranges[quality];
  return Math.floor(rand() * (range.max - range.min + 1)) + range.min;
}

/**
 * 获取岗位定义
 */
export function getTaskDefinition(taskId: string): TaskDefinition | undefined {
  return TASK_DEFINITIONS.find((t) => t.id === taskId);
}

/**
 * 计算员工每周岗位经验
 * 公式：10 × 岗位系数 × (周工时/48) × 士气系数
 */
export function calculateWeeklyExp(staff: Staff): number {
  const baseExp = 10;
  const taskCoeff = TASK_EXP_COEFFICIENTS[staff.assignedTask] || 1.0;
  const weeklyHours = staff.workDaysPerWeek * staff.workHoursPerDay;
  const hoursRatio = weeklyHours / STANDARD_WEEKLY_HOURS;
  // 士气系数：高士气加速，低士气减速
  const moraleCoeff =
    staff.morale >= 80
      ? 1.2
      : staff.morale >= 60
        ? 1.0
        : staff.morale >= 40
          ? 0.8
          : 0.6;
  return Math.round(baseExp * taskCoeff * hoursRatio * moraleCoeff);
}

/**
 * 获取指定等级升级所需经验
 */
export function getSkillUpgradeRequirement(level: number): number {
  const entry = SKILL_UPGRADE_TABLE.find((e) => e.level === level);
  return entry?.expRequired ?? Infinity;
}

/**
 * 计算基于工时的疲劳增长
 * 公式：岗位基础疲劳 × (周工时/48)^1.5
 */
export function calculateFatigueGain(staff: Staff): number {
  const taskFatigueMap: Record<string, number> = {
    chef: 10,
    waiter: 8,
    marketer: 7,
    cleaner: 8,
    manager: 5,
  };
  const baseFatigue = taskFatigueMap[staff.assignedTask] || 8;
  const weeklyHours = staff.workDaysPerWeek * staff.workHoursPerDay;
  const hoursRatio = weeklyHours / STANDARD_WEEKLY_HOURS;
  return Math.round(
    baseFatigue * Math.pow(hoursRatio, WORK_HOURS_CONFIG.fatigueExponent),
  );
}

/**
 * 计算工时对士气的影响
 * ≤35h: +2, ≤48h: 0, ≤60h: -2, >60h: -5
 */
export function calculateWorkHoursMoraleEffect(staff: Staff): number {
  const weeklyHours = staff.workDaysPerWeek * staff.workHoursPerDay;
  if (weeklyHours <= 35) return 2;
  if (weeklyHours <= 48) return 0;
  if (weeklyHours <= 60) return -2;
  return -5;
}

/**
 * 计算解雇对其他员工士气的影响
 */
export function calculateFireMoraleImpact(
  firedStaff: Staff,
  currentWeek: number,
): number {
  let penalty = FIRE_MORALE_CONFIG.basePenalty;
  // 老员工额外惩罚
  const tenure = currentWeek - firedStaff.hiredWeek;
  if (tenure >= FIRE_MORALE_CONFIG.tenureWeeksThreshold) {
    penalty += FIRE_MORALE_CONFIG.tenureExtraPenalty;
  }
  // 高技能额外惩罚
  if (firedStaff.skillLevel >= FIRE_MORALE_CONFIG.highSkillThreshold) {
    penalty += FIRE_MORALE_CONFIG.highSkillExtraPenalty;
  }
  return penalty;
}

// ============ v2.7 员工系统升级配置 ============

/** 薪资调整配置 */
export const SALARY_CONFIG = {
  minRatio: 0.8, // 最低为 baseSalary × wageLevel × 0.8
  maxRatio: 2.0, // 最高为 baseSalary × wageLevel × 2.0
  /** 加薪士气加成：moraleBoost = 涨幅% × coefficient，上限 maxBoost */
  raiseCoefficient: 15,
  raiseMaxBoost: 20,
  /** 加薪士气加成每周衰减量 */
  raiseBoostDecay: 4,
  /** 降薪士气惩罚：moralePenalty = -(降幅% × coefficient) */
  cutCoefficient: 25,
  /** 降薪触发离职风险检查的概率 */
  cutQuitCheckRate: 0.3,
};

/** 士气管理操作配置 */
export const MORALE_ACTION_CONFIG = {
  bonus: {
    amounts: [500, 1000, 2000], // 三档奖金
    moraleBoosts: [15, 22, 30], // 对应士气提升
    otherBoost: 3, // 其他员工公平感加成
    cooldownWeeks: 4, // 每人冷却4周
    /** 认知等级要求 */
    minCognitionLevel: 1 as const,
  },
  team_meal: {
    costPerPerson: 200, // 每人200元
    moraleBoost: 8, // 全员士气+8
    fatigueReduction: 5, // 全员疲劳-5
    cooldownWeeks: 4, // 全局冷却4周
    minCognitionLevel: 1 as const,
  },
  day_off: {
    fatigueReduction: 15, // 疲劳-15
    moraleBoost: 5, // 士气+5
    cooldownWeeks: 2, // 每人冷却2周
    minCognitionLevel: 1 as const,
  },
};

/** 离职挽留配置 */
export const RETENTION_CONFIG = {
  raise: {
    salaryIncreaseRate: 0.2, // 加薪20%
    moraleBoost: 15,
    successRate: 0.8,
    minCognitionLevel: 2 as const,
  },
  reduce_hours: {
    targetDays: 5,
    targetHours: 8,
    fatigueReduction: 20,
    successRate: 0.6,
    minCognitionLevel: 2 as const,
  },
  bonus: {
    costRatio: 0.5, // 月薪×50%
    moraleBoost: 20,
    successRate: 0.7,
    minCognitionLevel: 2 as const,
  },
};

/** 转岗过渡期配置 */
export const TRANSITION_CONFIG = {
  durationWeeks: 1, // 过渡期1周
  efficiencyPenalty: 0.5, // 过渡期效率×0.5
  expRetainRatio: 0.3, // 新岗位保留30%通用经验
  sameTaskRetainRatio: 0.5, // 回归旧岗位保留50%经验
};
