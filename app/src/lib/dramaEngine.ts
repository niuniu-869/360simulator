/**
 * dramaEngine.ts — 戏剧性引擎（Phase 3）
 *
 * 每次 weeklyTick 之后调用 `tickDrama(state)`：
 *   1. 更新 `crisisMode`（none / cash_low / rep_crisis / bankruptcy_warning）
 *   2. 更新 `consecutiveLossWeeks`
 *   3. 检查是否应该强制触发翻盘事件 / 破产倒计时事件
 *   4. 检查是否应该触发高光事件
 *
 * 设计：纯函数 + 副作用通过返回新 state 表达。
 */

import type { GameState, InteractiveGameEvent } from '@/types/game';
import { INTERACTIVE_EVENTS } from '@/data/interactiveEvents';
import { rand } from '@/lib/rng';

// ============ 危机判定 ============

export function evaluateCrisisMode(state: GameState): NonNullable<GameState['crisisMode']> {
  if (state.gamePhase !== 'operating') return 'none';
  const weeklyFixed = state.weeklyFixedCost || 1;
  const runwayWeeks = state.cash / Math.max(1, weeklyFixed);
  const consec = state.consecutiveLossWeeks ?? 0;
  // 1. 破产警告：连亏 ≥ 8 周或 runway < 1
  if (consec >= 8 || runwayWeeks < 1) return 'bankruptcy_warning';
  // 2. 现金告急：runway < 3
  if (runwayWeeks < 3) return 'cash_low';
  // 3. 口碑危机：< 25
  if (state.reputation < 25) return 'rep_crisis';
  return 'none';
}

// ============ 高光/翻盘事件触发 ============

const HIGHLIGHT_EVENTS: Array<{
  id: string;
  cooldownWeeks: number;
  test: (s: GameState) => boolean;
}> = [
  {
    id: 'highlight_viral_dish',
    cooldownWeeks: 12,
    test: (s) => (s.weeklyRevenue ?? 0) >= 10000,
  },
  {
    id: 'highlight_media_visit',
    cooldownWeeks: 16,
    test: (s) => (s.cleanliness ?? 0) >= 80 && s.currentWeek >= 6,
  },
  {
    id: 'highlight_chain_invitation',
    cooldownWeeks: 999, // 一局一次
    test: (s) => (s.consecutiveProfits ?? 0) >= 6 && s.selectedBrand?.type === 'independent',
  },
  {
    id: 'highlight_delivery_top3',
    cooldownWeeks: 16,
    test: (s) => s.deliveryState?.platformRating >= 4.7 && s.deliveryState?.weeklyDeliveryOrders >= 30,
  },
  {
    id: 'highlight_award_winning',
    cooldownWeeks: 999,
    test: (s) => s.reputation >= 90,
  },
];

const TURNAROUND_EVENTS: Array<{
  id: string;
  cooldownWeeks: number;
  test: (s: GameState) => boolean;
  probability: number;
}> = [
  {
    id: 'turnaround_vc_angel',
    cooldownWeeks: 999,
    test: (s) => (s.consecutiveLossWeeks ?? 0) >= 5 && s.cognition.level >= 1,
    probability: 0.5,
  },
  {
    id: 'turnaround_media_redeem',
    cooldownWeeks: 999,
    test: (s) => (s.cleanliness ?? 60) < 50 && s.currentWeek >= 8,
    probability: 0.45,
  },
  {
    id: 'turnaround_community_save',
    cooldownWeeks: 999,
    test: (s) => s.reputation >= 60 && (s.consecutiveLossWeeks ?? 0) >= 4,
    probability: 0.4,
  },
];

const FORCED_DEBT_COLLECTOR_ID = 'turnaround_debt_collector';

function findEvent(id: string): InteractiveGameEvent | undefined {
  return INTERACTIVE_EVENTS.find((e) => e.id === id);
}

/** Drama tick：返回更新后的 state（如有事件触发，会塞到 pendingInteractiveEvent） */
export function tickDrama(state: GameState): GameState {
  if (state.gamePhase !== 'operating') return state;
  const profit = state.weeklySummary?.profit ?? 0;
  const newConsecLoss = profit < 0 ? (state.consecutiveLossWeeks ?? 0) + 1 : 0;
  const next: GameState = {
    ...state,
    consecutiveLossWeeks: newConsecLoss,
    crisisMode: evaluateCrisisMode({
      ...state,
      consecutiveLossWeeks: newConsecLoss,
    }),
    highlightHistory: state.highlightHistory ?? [],
  };

  // 已有 pendingInteractiveEvent 时不再叠加
  if (next.pendingInteractiveEvent) return next;

  // 1) 强制：连亏 8 周触发 debt_collector
  if (newConsecLoss >= 8) {
    const ev = findEvent(FORCED_DEBT_COLLECTOR_ID);
    if (ev && !next.highlightHistory?.includes(FORCED_DEBT_COLLECTOR_ID)) {
      return {
        ...next,
        pendingInteractiveEvent: ev,
        highlightHistory: [...(next.highlightHistory ?? []), FORCED_DEBT_COLLECTOR_ID],
      };
    }
  }

  // 2) 翻盘事件链（连亏 5 周以上）
  if (newConsecLoss >= 5) {
    const candidates = TURNAROUND_EVENTS.filter(
      (t) => !next.highlightHistory?.includes(t.id) && t.test(next),
    );
    for (const t of candidates) {
      if (rand() < t.probability) {
        const ev = findEvent(t.id);
        if (ev) {
          return {
            ...next,
            pendingInteractiveEvent: ev,
            highlightHistory: [...(next.highlightHistory ?? []), t.id],
          };
        }
      }
    }
  }

  // 3) 高光事件（盈利时）
  for (const h of HIGHLIGHT_EVENTS) {
    if (next.highlightHistory?.includes(h.id)) continue;
    if (!h.test(next)) continue;
    const ev = findEvent(h.id);
    if (ev) {
      return {
        ...next,
        pendingInteractiveEvent: ev,
        highlightHistory: [...(next.highlightHistory ?? []), h.id],
      };
    }
  }

  return next;
}
