/**
 * eventEngine.ts — 交互式事件引擎（v3.1）
 *
 * 职责：
 * 1. 上下文感知触发条件判定（CONTEXT_CHECKS）
 * 2. 事件抽取（rollInteractiveEvent）
 * 3. 事件效果应用（applyEventEffects）— 支持目标员工/延迟/buff/链式
 * 4. 动态描述解析（resolveDescription）
 *
 * v3.1 变更：
 * - applyEventEffects 支持 targetStaff / delayedEffects / buffs / chainEvent / cleanliness
 * - 新增 resolveDescription 解析动态事件描述
 * - 新增上下文检查：supply_shortage / high_skill_staff / staff_morale_gap
 *
 * 纯函数，零 React 依赖。
 */

import type { GameState, InteractiveGameEvent, InteractiveEventEffects, Staff } from '@/types/game';
import { INTERACTIVE_EVENTS } from '@/data/interactiveEvents';
import { applyCognitionExp } from '@/data/cognitionData';

// ============ 上下文判定函数映射 ============

type ContextCheckFn = (state: GameState) => boolean;

const CONTEXT_CHECKS: Record<string, ContextCheckFn> = {
  // 整洁度 < 50
  cleanliness_low: (s) => s.cleanliness < 50,

  // 周工资 > 周收入
  staff_cost_exceeds_revenue: (s) => {
    const weeklySalary = s.staff.reduce((sum, st) => sum + st.salary / 4, 0);
    return s.weeklyRevenue > 0 && weeklySalary > s.weeklyRevenue;
  },

  // 毛利率 < 20%
  low_margin: (s) => {
    if (s.weeklyRevenue <= 0) return false;
    const margin = (s.weeklyRevenue - s.weeklyVariableCost) / s.weeklyRevenue;
    return margin < 0.20;
  },

  // 累计亏损 > 总投资 40%
  deep_loss: (s) => {
    return s.totalInvestment > 0 && s.cumulativeProfit < -(s.totalInvestment * 0.4);
  },

  // 正在做社交媒体推广
  has_social_media_marketing: (s) => {
    return s.activeMarketingActivities.some(a => a.id === 'social_media');
  },

  // 平均疲劳 > 60 或无店长（员工 < 3）
  high_fatigue: (s) => {
    if (s.staff.length === 0) return false;
    const avgFatigue = s.staff.reduce((sum, st) => sum + st.fatigue, 0) / s.staff.length;
    return avgFatigue > 60 || s.staff.length < 3;
  },

  // 装修等级 = economy
  cheap_decoration: (s) => {
    return s.selectedDecoration?.id === 'economy';
  },

  // 只有1-2个产品且口碑 < 50
  single_product_low_rep: (s) => {
    return s.selectedProducts.length <= 2 && s.reputation < 50;
  },

  // 快招品牌
  is_quick_franchise: (s) => {
    return s.selectedBrand?.isQuickFranchise === true;
  },

  // 连续4周有健康告警但无主动操作（不活跃）
  ignoring_advice: (s) => {
    return s.weeksSinceLastAction >= 4;
  },

  // 筹备阶段：正在看加盟品牌
  browsing_franchise: (s) => {
    return s.selectedBrand?.type === 'franchise' || s.selectedBrand === null;
  },

  // 筹备阶段：已选快招品牌
  selected_quick_franchise: (s) => {
    return s.selectedBrand?.isQuickFranchise === true;
  },

  // === v3.1 新增 ===

  // 供给满足率 < 70%
  supply_shortage: (s) => {
    return s.lastWeekFulfillment < 0.70;
  },

  // 存在 skillLevel >= 3 的员工
  high_skill_staff: (s) => {
    return s.staff.some(st => st.skillLevel >= 3);
  },

  // 员工间士气差距 > 30
  staff_morale_gap: (s) => {
    if (s.staff.length < 2) return false;
    const morales = s.staff.map(st => st.morale);
    return Math.max(...morales) - Math.min(...morales) > 30;
  },

  // 口碑 >= 70
  high_reputation: (s) => {
    return s.reputation >= 70;
  },

  // 经营 6 周以上（任何店）
  operating_6_weeks: (s) => {
    return s.currentWeek >= 6;
  },
};

// ============ 事件抽取 ============

/** 判定是否为纯通知型事件（无选项） */
export function isNotificationEvent(event: InteractiveGameEvent): boolean {
  return event.options.length === 0 && !!event.notificationEffects;
}

/**
 * 根据当前状态抽取一个交互事件（或 null）。
 * 每个事件最多触发一次（通过 interactiveEventHistory 去重）。
 *
 * @param setupStep - setup 阶段细分步骤（仅 setup 阶段传入）
 */
export function rollInteractiveEvent(
  state: GameState,
  currentWeek: number,
  setupStep?: 'select_brand' | 'select_location',
): InteractiveGameEvent | null {
  // 如果已有待响应事件，不再抽取
  if (state.pendingInteractiveEvent) return null;

  const phase = state.gamePhase;
  const candidates: InteractiveGameEvent[] = [];

  for (const event of INTERACTIVE_EVENTS) {
    // 去重：已触发过的不再触发
    if (state.interactiveEventHistory.includes(event.id)) continue;

    // 阶段匹配
    if (event.triggerCondition.phase !== phase) continue;

    // setup 阶段：必须匹配 setupStep
    if (event.triggerCondition.phase === 'setup') {
      if (event.triggerCondition.setupStep && event.triggerCondition.setupStep !== setupStep) continue;
      // 没有指定 setupStep 的 setup 事件，只在有 setupStep 参数时才考虑
      if (!event.triggerCondition.setupStep && !setupStep) continue;
    }

    // 周次范围
    if (event.triggerCondition.minWeek !== undefined && currentWeek < event.triggerCondition.minWeek) continue;
    if (event.triggerCondition.maxWeek !== undefined && currentWeek > event.triggerCondition.maxWeek) continue;

    // 上下文条件判定
    if (event.contextCheck) {
      const checkFn = CONTEXT_CHECKS[event.contextCheck];
      if (checkFn && !checkFn(state)) continue;
    }

    candidates.push(event);
  }

  if (candidates.length === 0) return null;

  // 保底机制：经营阶段第5周起，若从未触发过交互事件，强制从候选中随机选一个
  const neverTriggered = state.interactiveEventHistory.length === 0;
  const guaranteeWeek = 5;

  // 按概率加权抽取（每个候选独立掷骰，取第一个命中的）
  // 打乱顺序避免固定优先级
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  for (const event of shuffled) {
    if (Math.random() < event.triggerCondition.probability) {
      return event;
    }
  }

  // 保底：到了保底周且从未触发，强制随机选一个
  if (neverTriggered && currentWeek >= guaranteeWeek && phase === 'operating') {
    return shuffled[0];
  }

  return null;
}

// ============ 动态描述解析 ============

/** 解析事件描述：如果是函数则传入 state 执行，否则直接返回字符串 */
export function resolveDescription(
  event: InteractiveGameEvent,
  state: GameState,
): string {
  if (typeof event.description === 'function') {
    return event.description(state);
  }
  return event.description;
}

// ============ 目标员工选择器 ============

/** 根据 selector 从员工列表中选出目标员工 */
function selectTargetStaff(
  staff: Staff[],
  selector: NonNullable<InteractiveEventEffects['targetStaff']>['selector'],
  taskFilter?: string,
): Staff | null {
  let candidates = staff.filter(s => !s.isOnboarding);
  if (taskFilter) {
    candidates = candidates.filter(s => s.assignedTask === taskFilter);
  }
  if (candidates.length === 0) return null;

  switch (selector) {
    case 'highest_skill':
      return candidates.reduce((best, s) => s.skillLevel > best.skillLevel ? s : best, candidates[0]);
    case 'lowest_morale':
      return candidates.reduce((best, s) => s.morale < best.morale ? s : best, candidates[0]);
    case 'highest_fatigue':
      return candidates.reduce((best, s) => s.fatigue > best.fatigue ? s : best, candidates[0]);
    case 'random':
      return candidates[Math.floor(Math.random() * candidates.length)];
    case 'by_task':
      return candidates[0] || null;
    default:
      return candidates[0] || null;
  }
}

// ============ 效果应用 ============

/**
 * 将交互事件选项效果应用到 GameState。
 * 纯函数，返回新 state。
 * v3.1: 支持 targetStaff / delayedEffects / buffs / chainEvent / cleanliness
 */
export function applyEventEffects(
  state: GameState,
  effects: InteractiveEventEffects,
  sourceEventId?: string,
): GameState {
  let newState = { ...state };

  // === 即时数值效果 ===
  if (effects.cash) {
    newState.cash = newState.cash + effects.cash;
  }

  if (effects.reputation) {
    newState.reputation = Math.max(0, Math.min(100, newState.reputation + effects.reputation));
  }

  if (effects.exposure) {
    newState.exposure = Math.max(0, Math.min(100, newState.exposure + effects.exposure));
  }

  if (effects.cleanliness) {
    newState.cleanliness = Math.max(0, Math.min(100, (newState.cleanliness ?? 60) + effects.cleanliness));
  }

  if (effects.morale && newState.staff.length > 0) {
    newState.staff = newState.staff.map(s => ({
      ...s,
      morale: Math.max(0, Math.min(100, s.morale + (effects.morale || 0))),
    }));
  }

  if (effects.cognitionExp) {
    newState.cognition = applyCognitionExp(newState.cognition, effects.cognitionExp);
  }

  // === 目标员工效果 ===
  if (effects.targetStaff && newState.staff.length > 0) {
    const { selector, taskFilter, effects: staffEffects } = effects.targetStaff;
    const target = selectTargetStaff(newState.staff, selector, taskFilter);

    if (target) {
      if (staffEffects.remove) {
        // 真实移除员工
        newState.staff = newState.staff.filter(s => s.id !== target.id);
      } else {
        newState.staff = newState.staff.map(s => {
          if (s.id !== target.id) return s;
          const updated = { ...s };
          if (staffEffects.morale) updated.morale = Math.max(0, Math.min(100, updated.morale + staffEffects.morale));
          if (staffEffects.fatigue) updated.fatigue = Math.max(0, Math.min(100, updated.fatigue + staffEffects.fatigue));
          if (staffEffects.salary) updated.salary = Math.max(0, updated.salary + staffEffects.salary);
          if (staffEffects.wantsToQuit !== undefined) updated.wantsToQuit = staffEffects.wantsToQuit;
          return updated;
        });
      }
    }
  }

  // === 延迟效果：写入 pendingDelayedEffects 队列 ===
  if (effects.delayedEffects && effects.delayedEffects.length > 0) {
    const newDelayed = effects.delayedEffects.map(de => ({
      executeAtWeek: newState.currentWeek + de.delayWeeks,
      effects: de.effects,
      sourceEventId: sourceEventId || 'unknown',
      description: de.description,
    }));
    newState.pendingDelayedEffects = [
      ...(newState.pendingDelayedEffects || []),
      ...newDelayed,
    ];
  }

  // === 临时 Buff/Debuff：写入 activeEventBuffs ===
  if (effects.buffs && effects.buffs.length > 0) {
    const newBuffs = effects.buffs.map(b => ({
      type: b.type,
      value: b.value,
      durationWeeks: b.durationWeeks,
      source: b.source,
    }));
    newState.activeEventBuffs = [
      ...(newState.activeEventBuffs || []),
      ...newBuffs,
    ];
  }

  // === 链式事件：写入 pendingChainEvents ===
  if (effects.chainEvent) {
    const ce = effects.chainEvent;
    newState.pendingChainEvents = [
      ...(newState.pendingChainEvents || []),
      {
        eventId: ce.eventId,
        triggerAtWeek: newState.currentWeek + ce.delayWeeks,
        probability: ce.probability,
      },
    ];
  }

  return newState;
}
