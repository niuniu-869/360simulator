/**
 * timeline.ts — 周时间线收集器
 *
 * 在每次 next_week 后采样一条记录，便于 agent 复盘整局：
 *   - 关键决策（pricing / boss action / marketing / staff）
 *   - 现金/利润变化
 *   - 触发的事件
 *   - 戏剧性时刻（crisis / highlight / turning_point）
 *
 * 设计：纯数据收集器，不影响游戏逻辑。
 */

import type { GameState } from '@/types/game';

export interface TimelineDecision {
  type: string;       // 'price_change' | 'start_marketing' | 'fire_staff' | 'boss_action' | ...
  detail?: string;
  payload?: Record<string, unknown>;
  week: number;
}

export interface TimelineEvent {
  id: string;
  name: string;
  category: string;
  optionId?: string;
  isNotification?: boolean;
}

export interface DramaMoment {
  type: 'crisis' | 'highlight' | 'turning_point' | 'bankruptcy_threat';
  detail: string;
  week: number;
}

export interface TimelineEntry {
  week: number;
  cash: number;
  cashChange: number;
  profit: number;
  cumulativeProfit: number;
  exposure: number;
  reputation: number;
  cleanliness: number;
  staffCount: number;
  events: TimelineEvent[];
  decisions: TimelineDecision[];
  dramaMoments: DramaMoment[];
  pendingEventId: string | null;
  gamePhase: string;
  gameOverReason: string | null;
}

export class TimelineCollector {
  private entries: TimelineEntry[] = [];
  private pendingDecisions: TimelineDecision[] = [];
  private pendingEvents: TimelineEvent[] = [];
  private prevCash: number | null = null;

  reset(): void {
    this.entries = [];
    this.pendingDecisions = [];
    this.pendingEvents = [];
    this.prevCash = null;
  }

  /** 记录一次玩家决策（在 dispatch 之后调用） */
  recordDecision(d: TimelineDecision): void {
    this.pendingDecisions.push(d);
  }

  /** 记录一个事件触发/响应 */
  recordEvent(ev: TimelineEvent): void {
    this.pendingEvents.push(ev);
  }

  /** 在 next_week 之后调用，把当前状态切片落盘 */
  snapshotAfterWeek(state: GameState): TimelineEntry {
    const cash = Math.round(state.cash);
    const cashChange = this.prevCash === null ? 0 : cash - this.prevCash;
    this.prevCash = cash;

    const drama = this.detectDrama(state);

    const entry: TimelineEntry = {
      week: state.currentWeek,
      cash,
      cashChange,
      profit: Math.round(state.weeklySummary?.profit ?? 0),
      cumulativeProfit: Math.round(state.cumulativeProfit ?? 0),
      exposure: Math.round((state.exposure ?? 0) * 10) / 10,
      reputation: Math.round((state.reputation ?? 0) * 10) / 10,
      cleanliness: Math.round((state.cleanliness ?? 60) * 10) / 10,
      staffCount: state.staff.length,
      events: this.pendingEvents.slice(),
      decisions: this.pendingDecisions.slice(),
      dramaMoments: drama,
      pendingEventId: state.pendingInteractiveEvent?.id ?? null,
      gamePhase: state.gamePhase,
      gameOverReason: state.gameOverReason ?? null,
    };

    this.entries.push(entry);
    this.pendingDecisions = [];
    this.pendingEvents = [];
    return entry;
  }

  /** 取整条时间线（agent 复盘用） */
  getAll(): TimelineEntry[] {
    return this.entries.slice();
  }

  /** 简易戏剧性检测 — Phase 3 会被 dramaEngine 替换/增强 */
  private detectDrama(state: GameState): DramaMoment[] {
    const out: DramaMoment[] = [];
    const week = state.currentWeek;
    const weeklyProfit = state.weeklySummary?.profit ?? 0;
    const revenue = state.weeklySummary?.revenue ?? 0;

    // 现金告急
    const fixedCost = state.weeklyFixedCost ?? 1;
    const runwayWeeks = fixedCost > 0 ? state.cash / fixedCost : 999;
    if (runwayWeeks < 3 && state.gamePhase === 'operating') {
      out.push({
        type: 'bankruptcy_threat',
        detail: `runway ≈ ${runwayWeeks.toFixed(1)}w`,
        week,
      });
    }

    // 单周亏损巨大
    if (weeklyProfit < -3000) {
      out.push({ type: 'crisis', detail: `周亏 ¥${Math.round(-weeklyProfit)}`, week });
    }

    // 单周营收破万 → 高光
    if (revenue >= 10000) {
      out.push({ type: 'highlight', detail: `营收破万 ¥${Math.round(revenue)}`, week });
    }

    // 连续盈利转折
    if ((state.consecutiveProfits ?? 0) === 6) {
      out.push({ type: 'turning_point', detail: '连续盈利 6 周（胜利条件）', week });
    }

    return out;
  }
}
