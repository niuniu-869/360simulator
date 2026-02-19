/**
 * useGameState.ts — React 薄包装层
 *
 * 所有业务逻辑已提取至 gameActions.ts (dispatch) 和 gameQuery.ts (compute*)。
 * 本文件仅负责：useState 持有状态 + useCallback 包装 dispatch + useMemo 包装 compute。
 * 返回接口与重构前完全一致，对 UI 组件零破坏。
 */

import { useState, useCallback, useMemo } from 'react';
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
} from '@/types/game';
import { createInitialGameState } from '@/lib/gameEngine';
import { dispatch } from '@/lib/gameActions';
import {
  computeCurrentStats,
  computeSupplyDemandResult,
  computeCanOpen,
  computeGameResult,
} from '@/lib/gameQuery';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());

  // ============ 辅助：执行 dispatch 并更新 state ============

  const act = useCallback((action: Parameters<typeof dispatch>[1]) => {
    setGameState(prev => {
      const result = dispatch(prev, action);
      return result.changed ? result.state : prev;
    });
  }, []);

  // ============ 筹备阶段操作 ============

  const selectBrand = useCallback((brand: Brand | null) => {
    act({ type: 'select_brand', brandId: brand?.id ?? null });
  }, [act]);

  const selectLocation = useCallback((location: Location | null) => {
    act({ type: 'select_location', locationId: location?.id ?? null });
  }, [act]);

  const selectAddress = useCallback((address: StoreAddress | null) => {
    act({ type: 'select_address', addressId: address?.id ?? null });
  }, [act]);

  const setStoreArea = useCallback((area: number) => {
    act({ type: 'set_store_area', area });
  }, [act]);

  const selectDecoration = useCallback((decoration: Decoration | null) => {
    act({ type: 'select_decoration', decorationId: decoration?.id ?? null });
  }, [act]);

  const toggleProduct = useCallback((product: Product) => {
    act({ type: 'toggle_product', productId: product.id });
  }, [act]);

  const addStaff = useCallback((staffTypeId: string, assignedTask?: string) => {
    act({ type: 'add_staff', staffTypeId, assignedTask });
  }, [act]);

  const fireStaff = useCallback((staffId: string) => {
    act({ type: 'fire_staff', staffId });
  }, [act]);

  const openStore = useCallback((season?: Season) => {
    act({ type: 'open_store', season });
  }, [act]);

  // ============ 经营阶段操作 ============

  const nextWeek = useCallback(() => {
    act({ type: 'next_week' });
  }, [act]);

  const restart = useCallback(() => {
    act({ type: 'restart' });
  }, [act]);

  const recruitStaff = useCallback((channelId: string, staffTypeId: string, assignedTask?: string) => {
    act({ type: 'recruit_staff', channelId, staffTypeId, assignedTask });
  }, [act]);

  // ============ 外卖平台管理 ============

  const joinPlatform = useCallback((platformId: string) => {
    act({ type: 'join_platform', platformId });
  }, [act]);

  const leavePlatform = useCallback((platformId: string) => {
    act({ type: 'leave_platform', platformId });
  }, [act]);

  const togglePromotion = useCallback((platformId: string, tierIndex: number) => {
    act({ type: 'toggle_promotion', platformId, tierIndex });
  }, [act]);

  // v3.0 外卖运营操作
  const setDiscountTier = useCallback((platformId: string, tierId: DiscountTierId) => {
    act({ type: 'set_discount_tier', platformId, tierId });
  }, [act]);

  const setDeliveryPricing = useCallback((platformId: string, pricingId: DeliveryPricingId) => {
    act({ type: 'set_delivery_pricing', platformId, pricingId });
  }, [act]);

  const setPackagingTier = useCallback((platformId: string, tierId: PackagingTierId) => {
    act({ type: 'set_packaging_tier', platformId, tierId });
  }, [act]);

  // ============ 营销活动管理 ============

  const startMarketingActivity = useCallback((activityId: string) => {
    act({ type: 'start_marketing', activityId });
  }, [act]);

  const stopMarketingActivity = useCallback((activityId: string) => {
    act({ type: 'stop_marketing', activityId });
  }, [act]);

  // ============ 定价 & 库存 ============

  const setProductPrice = useCallback((productId: string, price: number) => {
    act({ type: 'set_product_price', productId, price });
  }, [act]);

  const setProductInventory = useCallback((productId: string, quantity: number) => {
    act({ type: 'set_product_inventory', productId, quantity });
  }, [act]);

  const setRestockStrategy = useCallback((productId: string, strategy: RestockStrategy) => {
    act({ type: 'set_restock_strategy', productId, strategy });
  }, [act]);

  // ============ 员工任务 ============

  const assignStaffToTask = useCallback((staffId: string, taskType: string) => {
    act({ type: 'assign_staff_task', staffId, taskType });
  }, [act]);

  const setStaffWorkHours = useCallback((staffId: string, days: number, hours: number) => {
    act({ type: 'set_staff_work_hours', staffId, days, hours });
  }, [act]);

  // ============ v2.7 员工系统升级操作 ============

  const setStaffSalary = useCallback((staffId: string, newSalary: number) => {
    act({ type: 'set_staff_salary', staffId, newSalary });
  }, [act]);

  const staffMoraleAction = useCallback((
    actionType: 'bonus' | 'team_meal' | 'day_off',
    targetStaffId?: string,
    bonusAmount?: number,
  ) => {
    act({ type: 'staff_morale_action', actionType, targetStaffId, bonusAmount });
  }, [act]);

  const retainStaff = useCallback((staffId: string, method: 'raise' | 'reduce_hours' | 'bonus') => {
    act({ type: 'retain_staff', staffId, method });
  }, [act]);

  // ============ v2.8 产品专注度 ============

  const setStaffFocusProduct = useCallback((staffId: string, productId: string | null) => {
    act({ type: 'set_staff_focus_product', staffId, productId });
  }, [act]);

  // ============ v2.9 老板周行动 ============

  const setBossAction = useCallback((action: BossActionType, role?: string, shopId?: string) => {
    act({ type: 'set_boss_action', action, role, shopId });
  }, [act]);

  // ============ 出餐分配优先级 ============

  const setSupplyPriority = useCallback((priority: SupplyPriority) => {
    act({ type: 'set_supply_priority', priority });
  }, [act]);

  // ============ v2.9 交互式事件 ============

  const respondToEvent = useCallback((eventId: string, optionId: string) => {
    act({ type: 'respond_to_event', eventId, optionId });
  }, [act]);

  // ============ 认知 & 周总结 ============

  const consultYongGe = useCallback(() => {
    act({ type: 'consult_yong_ge' });
  }, [act]);

  const clearWeeklySummary = useCallback(() => {
    act({ type: 'clear_weekly_summary' });
  }, [act]);

  const clearLastWeekEvent = useCallback(() => {
    act({ type: 'clear_last_week_event' });
  }, [act]);

  // ============ 计算属性（委托给 gameQuery 纯函数） ============

  // 先算 supplyDemandResult，再传入 computeCurrentStats 避免重复计算
  const supplyDemandResult = useMemo(() => computeSupplyDemandResult(gameState), [gameState]);

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
  };
}
