/**
 * useGameState.ts — React 薄包装层
 *
 * 所有业务逻辑已提取至 gameActions.ts (dispatch) 和 gameQuery.ts (compute*)。
 * 本文件仅负责：useState 持有状态 + useCallback 包装 dispatch + useMemo 包装 compute。
 * 返回接口与重构前完全一致，对 UI 组件零破坏。
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePlaySpeed } from "@/hooks/usePlaySpeed";
import type {
  GameState,
  Brand,
  Location,
  Decoration,
  Product,
  StoreAddress,
  Season,
  RestockStrategy,
  BossActionType,
  DiscountTierId,
  DeliveryPricingId,
  PackagingTierId,
  SupplyPriority,
} from "@/types/game";
import { createInitialGameState, INITIAL_CASH } from "@/lib/gameEngine";
import { dispatch } from "@/lib/gameActions";
import { locations, brands } from "@/data/gameData";
import {
  SCENARIO_BY_ID,
  applyScenarioToInitialState,
} from "@/data/scenarios";
import type { GameAction } from "@/lib/gameActionTypes";
import {
  computeCurrentStats,
  computeSupplyDemandResult,
  computeCanOpen,
  computeGameResult,
} from "@/lib/gameQuery";

// ============ 主存档持久化（刷新不丢进度） ============

/** 主存档 localStorage key（带版本号，schema 变更时 bump 即可使旧档失效）。 */
const SAVE_KEY = "360sim:save:v1";
/** 当前存档 schema 版本。读取时版本不符则忽略旧档、回退新建。 */
const SAVE_VERSION = 1;
/** debounce 写盘间隔（ms）。频繁推进周时合并写入，降低主线程压力。 */
const SAVE_DEBOUNCE_MS = 500;

interface SavedGame {
  version: number;
  savedAt: number;
  state: GameState;
}

/** 安全访问 localStorage（SSR / 隐私模式 / 被禁用时返回 null，绝不抛）。 */
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 读取并校验已保存的存档。
 * 仅当 version 匹配且 state.gamePhase 为 operating 时视为"可恢复的进行中存档"。
 * 任何解析/版本/字段异常一律返回 null（不可崩，回退新建）。
 */
function readSavedGame(): GameState | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGame>;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    const state = parsed.state;
    if (!state || typeof state !== "object") return null;
    // 仅恢复"进行中/已结束"的局；setup 阶段不算可恢复存档
    if (state.gamePhase !== "operating" && state.gamePhase !== "ended") {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/** 写盘（try/catch 防 quota 超限 / 序列化异常）。 */
function writeSavedGame(state: GameState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: SavedGame = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state,
    };
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / 序列化异常：静默忽略，存档失败不影响游戏 */
  }
}

/** 清除主存档（重开 / 玩家手动逃生时调用）。 */
function removeSavedGame(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 是否带有"开新局/复现"意图的 URL 参数。
 * ?seed= 或 ?scenario= 优先级高于存档恢复（用户明确想开新局）。
 */
function readUrlGameIntent(): { scenario?: string; seed?: number } {
  try {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario") || undefined;
    const seedRaw = params.get("seed");
    const seed =
      seedRaw != null && Number.isFinite(Number(seedRaw))
        ? Number(seedRaw)
        : undefined;
    return { scenario, seed };
  } catch {
    return {};
  }
}

/**
 * 构建"一键开局"后的 operating 状态（纯函数，无副作用、无 React 依赖）。
 * 供 quickStart 回调与 useGameState 的 lazy 初始化（URL ?scenario=/?seed= 复现）共用。
 * 契约：返回的 state.gamePhase === "operating"。
 */
function buildQuickStartState(
  scenarioId?: string,
  seedOverride?: number,
): GameState {
  const scenario = scenarioId ? SCENARIO_BY_ID[scenarioId] : undefined;

  // seed：seedOverride > 剧本 recommendedSeed > 随机
  const seed =
    seedOverride ??
    scenario?.recommendedSeed ??
    Math.floor(Math.random() * 1_000_000);

  let s = createInitialGameState(seed);

  // 套用剧本初始现金（仅改 cash，纯函数）
  if (scenario) {
    s = applyScenarioToInitialState(s, scenario.id);
  }

  // 蓝图：有剧本用剧本，否则用"均衡默认"配置
  const brandId = scenario?.brandId ?? "independent";
  const locationId = scenario?.locationId ?? "community";
  const decorationId = scenario?.decorationId ?? "simple";
  const productIds = scenario?.productIds ?? ["milktea", "fruittea", "coffee"];
  const staffSetup = scenario?.staffSetup ?? [
    { staffTypeId: "fulltime" },
    { staffTypeId: "parttime" },
  ];

  // 地址：剧本若指定 addressId 则用之，否则 fallback 到该区位第一个地址
  const location = locations.find((l) => l.id === locationId);
  const addressId = scenario?.addressId ?? location?.addresses[0]?.id ?? null;

  const step = (action: GameAction) => {
    const r = dispatch(s, action);
    if (r.changed) s = r.state;
  };

  // 快招品牌选定后会锁定区位/地址，需先选区位+地址再选品牌（详见 quickStart 历史注释）
  const isQuickFranchise =
    brands.find((b) => b.id === brandId)?.isQuickFranchise === true;

  if (isQuickFranchise) {
    step({ type: "select_location", locationId });
    if (addressId) step({ type: "select_address", addressId });
    step({ type: "select_brand", brandId });
  } else {
    step({ type: "select_brand", brandId });
    step({ type: "select_location", locationId });
    if (addressId) step({ type: "select_address", addressId });
  }
  step({ type: "select_decoration", decorationId });
  for (const productId of productIds) {
    step({ type: "toggle_product", productId });
  }
  for (const st of staffSetup) {
    step({
      type: "add_staff",
      staffTypeId: st.staffTypeId,
      assignedTask: st.assignedTask,
    });
  }
  // 默认 spring，跳过季节弹窗减少摩擦
  step({ type: "open_store", season: "spring" });

  // 清掉筹备期间被随机抽到的事件弹窗，避免进 operating 立刻弹窗
  if (s.pendingInteractiveEvent) {
    s = { ...s, pendingInteractiveEvent: null };
  }

  // 以剧本 initialCash 为开局基准水位（select_brand 会用 INITIAL_CASH 重算，需修正）
  if (scenario?.initialCash !== undefined) {
    const spent = INITIAL_CASH - s.cash;
    s = { ...s, cash: scenario.initialCash - spent };
  }

  // 记录本局剧本 id（用于剧本成就判定与"挑战同款剧本"分享链接）
  s = { ...s, scenarioId: scenario?.id ?? null };

  return s;
}

export function useGameState(opts?: { seed?: number }) {
  // lazy 初始化恢复优先级：
  //   1. URL 带 ?seed= / ?scenario=  → 开新局/复现，忽略存档（优先级最高）
  //   2. 存在有效的 operating/ended 存档 → 恢复存档
  //   3. 否则 → createInitialGameState(opts?.seed)
  // 任何异常都会被 readSavedGame 吞掉并回退到新建，绝不崩。
  const [gameState, setGameState] = useState<GameState>(() => {
    // 1) URL 带 ?scenario=/?seed= → 直接一键开局/复现（优先级最高，分享链接落地即玩）
    const intent = readUrlGameIntent();
    if (intent.scenario !== undefined || intent.seed !== undefined) {
      return buildQuickStartState(intent.scenario, intent.seed);
    }
    // 2) 存在有效的 operating/ended 存档 → 恢复（刷新不丢进度）
    const saved = readSavedGame();
    if (saved) return saved;
    // 3) 否则新建
    return createInitialGameState(opts?.seed);
  });
  // 是否存在可恢复的 operating/ended 存档（供 UI 接"继续/重开"用）。
  // 仅在挂载时探测一次；恢复后玩家从存档继续，仍视为"有存档"。
  const [hasSavedGame] = useState<boolean>(() => readSavedGame() !== null);
  // isAutoAdvancing 用真正的 state（而非 render 期读 ref），
  // 满足 React 19 react-hooks/refs 规则，且能正确驱动 UI 的"取消自动推进"按钮。
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const speedCtl = usePlaySpeed();
  const autoAdvanceRef = useRef<{
    remaining: number;
    cancelled: boolean;
  } | null>(null);

  // ============ debounce 持久化主存档 ============
  // 仅在 operating / ended 阶段写盘（setup 阶段不存）。
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (gameState.gamePhase !== "operating" && gameState.gamePhase !== "ended") {
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      writeSavedGame(gameState);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [gameState]);

  /** 清除主存档（供 UI 接"重开"用）。 */
  const clearSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    removeSavedGame();
  }, []);

  // ============ 辅助：执行 dispatch 并更新 state ============

  const act = useCallback((action: Parameters<typeof dispatch>[1]) => {
    setGameState((prev) => {
      const result = dispatch(prev, action);
      return result.changed ? result.state : prev;
    });
  }, []);

  // ============ 筹备阶段操作 ============

  const selectBrand = useCallback(
    (brand: Brand | null) => {
      act({ type: "select_brand", brandId: brand?.id ?? null });
    },
    [act],
  );

  const selectLocation = useCallback(
    (location: Location | null) => {
      act({ type: "select_location", locationId: location?.id ?? null });
    },
    [act],
  );

  const selectAddress = useCallback(
    (address: StoreAddress | null) => {
      act({ type: "select_address", addressId: address?.id ?? null });
    },
    [act],
  );

  const setStoreArea = useCallback(
    (area: number) => {
      act({ type: "set_store_area", area });
    },
    [act],
  );

  const selectDecoration = useCallback(
    (decoration: Decoration | null) => {
      act({ type: "select_decoration", decorationId: decoration?.id ?? null });
    },
    [act],
  );

  const toggleProduct = useCallback(
    (product: Product) => {
      act({ type: "toggle_product", productId: product.id });
    },
    [act],
  );

  const addStaff = useCallback(
    (staffTypeId: string, assignedTask?: string) => {
      act({ type: "add_staff", staffTypeId, assignedTask });
    },
    [act],
  );

  const fireStaff = useCallback(
    (staffId: string) => {
      act({ type: "fire_staff", staffId });
    },
    [act],
  );

  const openStore = useCallback(
    (season?: Season) => {
      act({ type: "open_store", season });
    },
    [act],
  );

  // ============ 经营阶段操作 ============

  const nextWeek = useCallback(() => {
    act({ type: "next_week" });
  }, [act]);

  const restart = useCallback(
    (seed?: number) => {
      // 重开先清旧存档，避免重开后又被旧档恢复（恢复发生在挂载期，
      // 但 restart 可能在同会话内被多次调用，旧档残留也会污染下次刷新）。
      clearSave();
      if (seed !== undefined) {
        setGameState(createInitialGameState(seed));
      } else {
        act({ type: "restart" });
      }
    },
    [act, clearSave],
  );

  /**
   * quickStart — 一键开局（休闲前门）
   *
   * 在单次 setGameState 内**原子地** fold 一串真实 dispatch，把"选品牌→选址→
   * 装修→选品→招人→开店"6 步筹备一次性走完，直接进入 operating 阶段，
   * 让用户点一下就开店玩，不用走完筹备流程。
   *
   * @param scenarioId  剧本 id（可选）。给定则套用剧本蓝图 + initialCash。
   * @param seedOverride 指定 seed（可选）。优先级：seedOverride > 剧本 recommendedSeed > 随机。
   *
   * 契约：调用后 gameState.gamePhase === "operating"。
   */
  const quickStart = useCallback(
    (scenarioId?: string, seedOverride?: number) => {
      // 复用纯函数构建器（与 lazy 初始化共享逻辑，避免重复）
      setGameState(() => buildQuickStartState(scenarioId, seedOverride));
    },
    [],
  );

  /**
   * autoAdvance — Phase 1 自动推进 N 周
   *  - 自动清弹窗（weeklySummary / lastWeekEvent）
   *  - 遇到 pendingInteractiveEvent 立刻暂停（等玩家响应）
   *  - 间隔 = autoAdvanceTickMs（受 speed 影响）
   */
  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) autoAdvanceRef.current.cancelled = true;
  }, []);

  const autoAdvance = useCallback(
    (weeks: number) => {
      if (!Number.isFinite(weeks) || weeks <= 0) return;
      if (autoAdvanceRef.current) {
        autoAdvanceRef.current.remaining += weeks;
        return;
      }
      autoAdvanceRef.current = { remaining: weeks, cancelled: false };
      // 启动：进入自动推进状态（驱动 UI 显示"取消自动推进"按钮）
      setIsAutoAdvancing(true);

      // 统一收尾：清 ref + 复位 state（所有结束路径都走这里，保证 UI 一致）
      const finish = () => {
        autoAdvanceRef.current = null;
        setIsAutoAdvancing(false);
      };

      const tick = () => {
        const ctx = autoAdvanceRef.current;
        if (!ctx) return;
        if (ctx.cancelled || ctx.remaining <= 0) {
          finish();
          return;
        }
        let stopped = false;
        setGameState((prev) => {
          if (prev.gamePhase !== "operating") {
            stopped = true;
            return prev;
          }
          let s = prev;
          if (s.weeklySummary) {
            const r = dispatch(s, { type: "clear_weekly_summary" });
            if (r.changed) s = r.state;
          }
          if (s.lastWeekEvent) {
            const r = dispatch(s, { type: "clear_last_week_event" });
            if (r.changed) s = r.state;
          }
          if (s.pendingInteractiveEvent) {
            stopped = true;
            return s;
          }
          const r = dispatch(s, { type: "next_week" });
          if (r.error) {
            stopped = true;
            return s;
          }
          if (r.changed) s = r.state;
          return s;
        });
        const ctx2 = autoAdvanceRef.current;
        if (!ctx2) return;
        if (stopped) {
          finish();
          return;
        }
        ctx2.remaining -= 1;
        if (ctx2.remaining > 0 && !ctx2.cancelled) {
          setTimeout(tick, speedCtl.autoAdvanceTickMs);
        } else {
          finish();
        }
      };
      setTimeout(tick, 0);
    },
    [speedCtl.autoAdvanceTickMs],
  );

  const recruitStaff = useCallback(
    (channelId: string, staffTypeId: string, assignedTask?: string) => {
      act({ type: "recruit_staff", channelId, staffTypeId, assignedTask });
    },
    [act],
  );

  // ============ 外卖平台管理 ============

  const joinPlatform = useCallback(
    (platformId: string) => {
      act({ type: "join_platform", platformId });
    },
    [act],
  );

  const leavePlatform = useCallback(
    (platformId: string) => {
      act({ type: "leave_platform", platformId });
    },
    [act],
  );

  const togglePromotion = useCallback(
    (platformId: string, tierIndex: number) => {
      act({ type: "toggle_promotion", platformId, tierIndex });
    },
    [act],
  );

  // v3.0 外卖运营操作
  const setDiscountTier = useCallback(
    (platformId: string, tierId: DiscountTierId) => {
      act({ type: "set_discount_tier", platformId, tierId });
    },
    [act],
  );

  const setDeliveryPricing = useCallback(
    (platformId: string, pricingId: DeliveryPricingId) => {
      act({ type: "set_delivery_pricing", platformId, pricingId });
    },
    [act],
  );

  const setPackagingTier = useCallback(
    (platformId: string, tierId: PackagingTierId) => {
      act({ type: "set_packaging_tier", platformId, tierId });
    },
    [act],
  );

  // ============ 营销活动管理 ============

  const startMarketingActivity = useCallback(
    (activityId: string) => {
      act({ type: "start_marketing", activityId });
    },
    [act],
  );

  const stopMarketingActivity = useCallback(
    (activityId: string) => {
      act({ type: "stop_marketing", activityId });
    },
    [act],
  );

  // ============ 定价 & 库存 ============

  const setProductPrice = useCallback(
    (productId: string, price: number) => {
      act({ type: "set_product_price", productId, price });
    },
    [act],
  );

  const setProductInventory = useCallback(
    (productId: string, quantity: number) => {
      act({ type: "set_product_inventory", productId, quantity });
    },
    [act],
  );

  const setRestockStrategy = useCallback(
    (productId: string, strategy: RestockStrategy) => {
      act({ type: "set_restock_strategy", productId, strategy });
    },
    [act],
  );

  // ============ 员工任务 ============

  const assignStaffToTask = useCallback(
    (staffId: string, taskType: string) => {
      act({ type: "assign_staff_task", staffId, taskType });
    },
    [act],
  );

  const setStaffWorkHours = useCallback(
    (staffId: string, days: number, hours: number) => {
      act({ type: "set_staff_work_hours", staffId, days, hours });
    },
    [act],
  );

  // ============ v2.7 员工系统升级操作 ============

  const setStaffSalary = useCallback(
    (staffId: string, newSalary: number) => {
      act({ type: "set_staff_salary", staffId, newSalary });
    },
    [act],
  );

  const staffMoraleAction = useCallback(
    (
      actionType: "bonus" | "team_meal" | "day_off",
      targetStaffId?: string,
      bonusAmount?: number,
    ) => {
      act({
        type: "staff_morale_action",
        actionType,
        targetStaffId,
        bonusAmount,
      });
    },
    [act],
  );

  const retainStaff = useCallback(
    (staffId: string, method: "raise" | "reduce_hours" | "bonus") => {
      act({ type: "retain_staff", staffId, method });
    },
    [act],
  );

  // ============ v2.8 产品专注度 ============

  const setStaffFocusProduct = useCallback(
    (staffId: string, productId: string | null) => {
      act({ type: "set_staff_focus_product", staffId, productId });
    },
    [act],
  );

  // ============ v2.9 老板周行动 ============

  const setBossAction = useCallback(
    (action: BossActionType, role?: string, shopId?: string) => {
      act({ type: "set_boss_action", action, role, shopId });
    },
    [act],
  );

  // ============ 出餐分配优先级 ============

  const setSupplyPriority = useCallback(
    (priority: SupplyPriority) => {
      act({ type: "set_supply_priority", priority });
    },
    [act],
  );

  // ============ v2.9 交互式事件 ============

  const respondToEvent = useCallback(
    (eventId: string, optionId: string) => {
      act({ type: "respond_to_event", eventId, optionId });
    },
    [act],
  );

  // ============ 认知 & 周总结 ============

  const consultYongGe = useCallback(() => {
    act({ type: "consult_yong_ge" });
  }, [act]);

  const clearWeeklySummary = useCallback(() => {
    act({ type: "clear_weekly_summary" });
  }, [act]);

  const clearLastWeekEvent = useCallback(() => {
    act({ type: "clear_last_week_event" });
  }, [act]);

  // ============ 计算属性（委托给 gameQuery 纯函数） ============

  // 先算 supplyDemandResult，再传入 computeCurrentStats 避免重复计算
  const supplyDemandResult = useMemo(
    () => computeSupplyDemandResult(gameState),
    [gameState],
  );

  const currentStats = useMemo(
    () => computeCurrentStats(gameState, supplyDemandResult ?? undefined),
    [gameState, supplyDemandResult],
  );

  const canOpen = useMemo(() => computeCanOpen(gameState), [gameState]);

  const gameResult = useMemo(() => computeGameResult(gameState), [gameState]);

  // ============ 返回接口（与重构前完全一致） ============

  return {
    gameState,
    currentStats,
    supplyDemandResult,
    canOpen,
    gameResult,
    selectBrand,
    selectLocation,
    selectAddress,
    setStoreArea,
    selectDecoration,
    toggleProduct,
    addStaff,
    fireStaff,
    recruitStaff,
    // 外卖平台管理
    joinPlatform,
    leavePlatform,
    togglePromotion,
    setDiscountTier,
    setDeliveryPricing,
    setPackagingTier,
    openStore,
    nextWeek,
    restart,
    // R2 一键开局（休闲前门）
    quickStart,
    // 认知系统方法
    consultYongGe,
    clearWeeklySummary,
    clearLastWeekEvent,
    // 营销活动管理方法
    startMarketingActivity,
    stopMarketingActivity,
    // 定价策略管理方法
    setProductPrice,
    setProductInventory,
    assignStaffToTask,
    setStaffWorkHours,
    setRestockStrategy,
    // v2.7 员工系统升级
    setStaffSalary,
    staffMoraleAction,
    retainStaff,
    // v2.8 产品专注度
    setStaffFocusProduct,
    // v2.9 老板周行动
    setBossAction,
    // 出餐分配优先级
    setSupplyPriority,
    // v2.9 交互式事件
    respondToEvent,
    // Phase 1: 节奏控制
    autoAdvance,
    cancelAutoAdvance,
    isAutoAdvancing,
    speed: speedCtl.speed,
    setSpeed: speedCtl.setSpeed,
    cycleSpeed: speedCtl.cycleSpeed,
    // 主存档持久化（UI 接"继续/重开"用）
    hasSavedGame,
    clearSave,
  };
}
