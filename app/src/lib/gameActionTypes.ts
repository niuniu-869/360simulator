/**
 * gameActionTypes.ts — Action 类型定义
 *
 * 定义 GameAction discriminated union（24种操作）和 ActionResult 接口。
 * 供 gameActions.ts dispatch 函数使用，CLI 和 React UI 共享同一套类型。
 */

import type { GameState, Season, RestockStrategy, BossActionType, DiscountTierId, DeliveryPricingId, PackagingTierId, SupplyPriority } from '@/types/game';

// ============ Action Result ============

export interface ActionResult {
  state: GameState;
  error?: string;
  changed: boolean;
}

// ============ 筹备阶段 Actions ============

export interface SelectBrandAction {
  type: 'select_brand';
  brandId: string | null;
}

export interface SelectLocationAction {
  type: 'select_location';
  locationId: string | null;
}

export interface SelectAddressAction {
  type: 'select_address';
  addressId: string | null;
}

export interface SetStoreAreaAction {
  type: 'set_store_area';
  area: number;
}

export interface SelectDecorationAction {
  type: 'select_decoration';
  decorationId: string | null;
}

export interface ToggleProductAction {
  type: 'toggle_product';
  productId: string;
}

export interface AddStaffAction {
  type: 'add_staff';
  staffTypeId: string;
  assignedTask?: string;  // 招聘时指定初始岗位
}

export interface FireStaffAction {
  type: 'fire_staff';
  staffId: string;
}

export interface OpenStoreAction {
  type: 'open_store';
  season?: Season;
}

// ============ 经营阶段 Actions ============

export interface NextWeekAction {
  type: 'next_week';
}

export interface RestartAction {
  type: 'restart';
}

export interface RecruitStaffAction {
  type: 'recruit_staff';
  channelId: string;
  staffTypeId: string;
  assignedTask?: string;  // 招聘时指定初始岗位
}

export interface JoinPlatformAction {
  type: 'join_platform';
  platformId: string;
}

export interface LeavePlatformAction {
  type: 'leave_platform';
  platformId: string;
}

export interface TogglePromotionAction {
  type: 'toggle_promotion';
  platformId: string;
  tierIndex: number;
}

export interface StartMarketingAction {
  type: 'start_marketing';
  activityId: string;
}

export interface StopMarketingAction {
  type: 'stop_marketing';
  activityId: string;
}

export interface SetProductPriceAction {
  type: 'set_product_price';
  productId: string;
  price: number;
}

export interface SetProductInventoryAction {
  type: 'set_product_inventory';
  productId: string;
  quantity: number;
}

export interface SetRestockStrategyAction {
  type: 'set_restock_strategy';
  productId: string;
  strategy: RestockStrategy;
}

export interface AssignStaffTaskAction {
  type: 'assign_staff_task';
  staffId: string;
  taskType: string;
}

export interface SetStaffWorkHoursAction {
  type: 'set_staff_work_hours';
  staffId: string;
  days: number;
  hours: number;
}

export interface ConsultYongGeAction {
  type: 'consult_yong_ge';
}

export interface ClearWeeklySummaryAction {
  type: 'clear_weekly_summary';
}

export interface ClearLastWeekEventAction {
  type: 'clear_last_week_event';
}

// ============ 员工系统升级 Actions (v2.7) ============

export interface SetStaffSalaryAction {
  type: 'set_staff_salary';
  staffId: string;
  newSalary: number;
}

export interface StaffMoraleAction {
  type: 'staff_morale_action';
  actionType: 'bonus' | 'team_meal' | 'day_off';
  targetStaffId?: string;  // bonus/day_off 针对个人
  bonusAmount?: number;    // bonus 金额档位
}

export interface RetainStaffAction {
  type: 'retain_staff';
  staffId: string;
  method: 'raise' | 'reduce_hours' | 'bonus';
}

// ============ 产品专注度 Actions (v2.8) ============

export interface SetStaffFocusProductAction {
  type: 'set_staff_focus_product';
  staffId: string;
  productId: string | null;  // null = 取消专注
}

// ============ 老板周行动 Actions (v2.9) ============

export interface SetBossActionAction {
  type: 'set_boss_action';
  action: BossActionType;
  role?: string;     // 亲自坐镇时选择的岗位
  shopId?: string;   // 考察/蹲点目标店铺ID
}

// ============ 交互式事件 Actions (v2.9) ============

export interface RespondToEventAction {
  type: 'respond_to_event';
  eventId: string;
  optionId: string;
}

// ============ 外卖运营 Actions (v3.0) ============

export interface SetDiscountTierAction {
  type: 'set_discount_tier';
  platformId: string;
  tierId: DiscountTierId;
}

export interface SetDeliveryPricingAction {
  type: 'set_delivery_pricing';
  platformId: string;
  pricingId: DeliveryPricingId;
}

export interface SetPackagingTierAction {
  type: 'set_packaging_tier';
  platformId: string;
  tierId: PackagingTierId;
}

// ============ 出餐分配优先级 Action ============

export interface SetSupplyPriorityAction {
  type: 'set_supply_priority';
  priority: SupplyPriority;
}

// ============ Discriminated Union ============

export type GameAction =
  // 筹备阶段
  | SelectBrandAction
  | SelectLocationAction
  | SelectAddressAction
  | SetStoreAreaAction
  | SelectDecorationAction
  | ToggleProductAction
  | AddStaffAction
  | FireStaffAction
  | OpenStoreAction
  // 经营阶段
  | NextWeekAction
  | RestartAction
  | RecruitStaffAction
  | JoinPlatformAction
  | LeavePlatformAction
  | TogglePromotionAction
  | StartMarketingAction
  | StopMarketingAction
  | SetProductPriceAction
  | SetProductInventoryAction
  | SetRestockStrategyAction
  | AssignStaffTaskAction
  | SetStaffWorkHoursAction
  | ConsultYongGeAction
  | ClearWeeklySummaryAction
  | ClearLastWeekEventAction
  // 员工系统升级 (v2.7)
  | SetStaffSalaryAction
  | StaffMoraleAction
  | RetainStaffAction
  // 产品专注度 (v2.8)
  | SetStaffFocusProductAction
  // 老板周行动 (v2.9)
  | SetBossActionAction
  // 交互式事件 (v2.9)
  | RespondToEventAction
  // 外卖运营 (v3.0)
  | SetDiscountTierAction
  | SetDeliveryPricingAction
  | SetPackagingTierAction
  // 出餐分配优先级
  | SetSupplyPriorityAction;
