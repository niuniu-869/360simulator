/**
 * achievements.ts — 成就系统（Phase 4）
 *
 * 30+ 成就，分类：
 *   - finance / operation / cognition / event / catastrophe / brand / scenario
 *
 * 设计：
 *   - 每个成就有 id / name / description / category / hidden? / test(state) → boolean
 *   - 主入口 `evaluateAchievements(state, prev)` 返回新解锁的 id 列表
 *   - 玩家 state.unlockedAchievements 持久化（localStorage v2 schema）
 */

import type { GameState } from "@/types/game";

export type AchievementCategory =
  | "finance"
  | "operation"
  | "cognition"
  | "event"
  | "catastrophe"
  | "brand"
  | "scenario";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  hidden?: boolean;
  /** 在第 1 局可达成（true：新手友好） */
  earlyGame?: boolean;
  test: (state: GameState) => boolean;
}

const sumProfit = (s: GameState) => s.cumulativeProfit ?? 0;
const maxRevenue = (s: GameState) => Math.max(0, ...(s.revenueHistory ?? []));
const maxProfit = (s: GameState) => Math.max(0, ...(s.profitHistory ?? []));

export const ACHIEVEMENTS: Achievement[] = [
  // ===== Finance（10）=====
  {
    id: "first_profit",
    name: "首次盈利",
    description: "第一次单周利润 > 0",
    category: "finance",
    earlyGame: true,
    test: (s) => maxProfit(s) > 0,
  },
  {
    id: "profit_streak_3",
    name: "连盈三周",
    description: "连续盈利 3 周",
    category: "finance",
    earlyGame: true,
    test: (s) => (s.consecutiveProfits ?? 0) >= 3,
  },
  {
    id: "profit_streak_6",
    name: "六连盈",
    description: "连续盈利 6 周（达到胜利条件）",
    category: "finance",
    test: (s) => (s.consecutiveProfits ?? 0) >= 6,
  },
  {
    id: "rev_5k",
    name: "周营收破 5k",
    description: "单周营收 ≥ ¥5,000",
    category: "finance",
    earlyGame: true,
    test: (s) => maxRevenue(s) >= 5000,
  },
  {
    id: "rev_10k",
    name: "周营收破万",
    description: "单周营收 ≥ ¥10,000",
    category: "finance",
    test: (s) => maxRevenue(s) >= 10000,
  },
  {
    id: "rev_50k",
    name: "周营收破 5 万",
    description: "单周营收 ≥ ¥50,000",
    category: "finance",
    test: (s) => maxRevenue(s) >= 50000,
  },
  {
    id: "cum_profit_10k",
    name: "累计盈利 1 万",
    description: "累计利润 ≥ ¥10,000",
    category: "finance",
    earlyGame: true,
    test: (s) => sumProfit(s) >= 10000,
  },
  {
    id: "cum_profit_50k",
    name: "累计盈利 5 万",
    description: "累计利润 ≥ ¥50,000",
    category: "finance",
    test: (s) => sumProfit(s) >= 50000,
  },
  {
    id: "cum_profit_100k",
    name: "累计盈利 10 万",
    description: "累计利润 ≥ ¥100,000",
    category: "finance",
    test: (s) => sumProfit(s) >= 100000,
  },
  {
    id: "roi_break_even",
    name: "回本",
    description: "累计利润 ≥ 总投资",
    category: "finance",
    test: (s) => sumProfit(s) >= s.totalInvestment,
  },

  // ===== Operation（8）=====
  {
    id: "open_store",
    name: "开张大吉",
    description: "完成筹备并正式开店",
    category: "operation",
    earlyGame: true,
    test: (s) => s.gamePhase !== "setup",
  },
  {
    id: "first_event_response",
    name: "第一次抉择",
    description: "响应第一个交互事件",
    category: "operation",
    earlyGame: true,
    test: (s) => (s.interactiveEventHistory ?? []).length >= 1,
  },
  {
    id: "staff_4",
    name: "团队成型",
    description: "同时拥有 ≥ 4 个员工",
    category: "operation",
    test: (s) => s.staff.length >= 4,
  },
  {
    id: "platform_join",
    name: "触网经营",
    description: "加入任意外卖平台",
    category: "operation",
    earlyGame: true,
    test: (s) => (s.deliveryState?.platforms ?? []).length >= 1,
  },
  {
    id: "reputation_70",
    name: "口碑名店",
    description: "口碑 ≥ 70",
    category: "operation",
    test: (s) => s.reputation >= 70,
  },
  {
    id: "reputation_90",
    name: "口碑大神",
    description: "口碑 ≥ 90",
    category: "operation",
    test: (s) => s.reputation >= 90,
  },
  {
    id: "cleanliness_90",
    name: "一尘不染",
    description: "整洁度 ≥ 90",
    category: "operation",
    test: (s) => (s.cleanliness ?? 0) >= 90,
  },
  {
    id: "exposure_60",
    name: "小有名气",
    description: "曝光度 ≥ 60",
    category: "operation",
    earlyGame: true,
    test: (s) => s.exposure >= 60,
  },

  // ===== Cognition（4）=====
  {
    id: "cog_lv1",
    name: "认知 Lv.1",
    description: "认知等级达到 Lv.1",
    category: "cognition",
    earlyGame: true,
    test: (s) => s.cognition.level >= 1,
  },
  {
    id: "cog_lv3",
    name: "认知 Lv.3",
    description: "认知等级达到 Lv.3",
    category: "cognition",
    test: (s) => s.cognition.level >= 3,
  },
  {
    id: "cog_lv5",
    name: "认知 Lv.5",
    description: "认知等级达到 Lv.5（满级）",
    category: "cognition",
    test: (s) => s.cognition.level >= 5,
  },
  {
    id: "consult_yongge",
    name: "请教勇哥",
    description: "本周咨询过赛博勇哥",
    category: "cognition",
    earlyGame: true,
    test: (s) => (s.cognition.consultYongGeThisWeek ?? 0) > 0,
  },

  // ===== Event（4）=====
  {
    id: "highlight_first",
    name: "高光时刻",
    description: "触发任意高光事件",
    category: "event",
    test: (s) =>
      (s.highlightHistory ?? []).some((h) => h.startsWith("highlight_")),
  },
  {
    id: "turnaround_first",
    name: "绝地翻盘",
    description: "触发任意翻盘事件",
    category: "event",
    test: (s) =>
      (s.highlightHistory ?? []).some((h) => h.startsWith("turnaround_")),
  },
  {
    id: "event_5",
    name: "事件经历者",
    description: "响应过 ≥ 5 个交互事件",
    category: "event",
    test: (s) => (s.interactiveEventHistory ?? []).length >= 5,
  },
  {
    id: "event_15",
    name: "事件老炮",
    description: "响应过 ≥ 15 个交互事件",
    category: "event",
    test: (s) => (s.interactiveEventHistory ?? []).length >= 15,
  },

  // ===== Catastrophe（4，灰暗成就）=====
  {
    id: "loss_streak_5",
    name: "连亏五周",
    description: "连亏 5 周（dramatic 触发条件）",
    category: "catastrophe",
    test: (s) => (s.consecutiveLossWeeks ?? 0) >= 5,
  },
  {
    id: "loss_streak_10",
    name: "连亏十周",
    description: "连亏 10 周仍未破产",
    category: "catastrophe",
    test: (s) => (s.consecutiveLossWeeks ?? 0) >= 10,
  },
  {
    id: "bankruptcy",
    name: "破产体验卡",
    description: "游戏因破产结束",
    category: "catastrophe",
    hidden: true,
    test: (s) => s.gameOverReason === "bankrupt",
  },
  {
    id: "time_limit_no_win",
    name: "熬到收摊",
    description: "52 周到期未达胜利条件",
    category: "catastrophe",
    hidden: true,
    test: (s) => s.gameOverReason === "time_limit",
  },

  // ===== Brand（3）=====
  {
    id: "win_independent",
    name: "独立胜利",
    description: "以独立品牌打到胜利",
    category: "brand",
    test: (s) =>
      s.gameOverReason === "win" && s.selectedBrand?.type === "independent",
  },
  {
    id: "win_franchise",
    name: "加盟胜利",
    description: "以加盟品牌打到胜利",
    category: "brand",
    test: (s) =>
      s.gameOverReason === "win" && s.selectedBrand?.type === "franchise",
  },
  {
    id: "win_quick_franchise",
    name: "快招破局",
    description: "以快招品牌打到胜利",
    category: "brand",
    test: (s) =>
      s.gameOverReason === "win" && !!s.selectedBrand?.isQuickFranchise,
  },

  // ===== Scenario（占位，Phase 4 后期挂剧本 ID）=====
  {
    id: "scenario_zhinanguozhi",
    name: "剧本：脚盆果汁",
    description: "在「脚盆果汁：蜜雪对面」剧本中打到胜利",
    category: "scenario",
    hidden: true,
    test: (s) =>
      s.gameOverReason === "win" && s.scenarioId === "scen_zhinanguozhi",
  },
  {
    id: "scenario_baiwan",
    name: "剧本：百万奶茶",
    description: "在「百万奶茶大厦」剧本中打到胜利",
    category: "scenario",
    hidden: true,
    test: (s) =>
      s.gameOverReason === "win" && s.scenarioId === "scen_baiwanshenglou",
  },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** 在 weeklyTick 后调用：返回新解锁的 id 列表（state 由调用者更新） */
export function evaluateAchievements(state: GameState): string[] {
  const already = new Set(state.unlockedAchievements ?? []);
  const newlyUnlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (already.has(a.id)) continue;
    try {
      if (a.test(state)) newlyUnlocked.push(a.id);
    } catch {
      // 防御：成就 test 抛错不应阻断游戏
    }
  }
  return newlyUnlocked;
}

// ============ localStorage 持久化（v2 schema） ============

const STORAGE_KEY = "360sim:achievements:v2";

interface PersistedAchievements {
  version: 2;
  unlocked: Record<string, { firstUnlockedAt: number; count: number }>;
}

function readPersisted(): PersistedAchievements {
  if (typeof window === "undefined") return { version: 2, unlocked: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 2, unlocked: {} };
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2 && parsed.unlocked) return parsed;
    // 兼容 v1：拍平为空，避免崩溃
    return { version: 2, unlocked: {} };
  } catch {
    return { version: 2, unlocked: {} };
  }
}

export function persistUnlocked(ids: string[]): void {
  if (typeof window === "undefined") return;
  const cur = readPersisted();
  const now = Date.now();
  for (const id of ids) {
    const existing = cur.unlocked[id];
    if (existing) {
      existing.count += 1;
    } else {
      cur.unlocked[id] = { firstUnlockedAt: now, count: 1 };
    }
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
  } catch {
    // ignore storage quota
  }
}

export function getAllPersistedUnlocked(): Record<
  string,
  { firstUnlockedAt: number; count: number }
> {
  return readPersisted().unlocked;
}

export function clearPersistedAchievements(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
