/**
 * stateView.ts — GameState → AgentGameView 序列化
 *
 * 将完整 GameState 转换为 Agent 友好的 JSON 摘要。
 */

import type { GameState } from '@/types/game';
import {
  computeCurrentStats,
  computeSupplyDemandResult,
  computeCanOpen,
  computeGameResult,
  getAvailableActions,
} from '@/lib/gameQuery';

export interface AgentGameView {
  phase: string;
  gameOverReason?: string | null;
  week: number;
  totalWeeks: number;
  season: string | null;
  cash: number;
  totalInvestment: number;
  cumulativeProfit: number;
  consecutiveProfits: number;

  // 配置摘要
  brand: { id: string; name: string; type: string } | null;
  location: { id: string; name: string; type: string } | null;
  address: { id: string; name: string; area: number } | null;
  decoration: { id: string; name: string; level: number } | null;
  products: Array<{ id: string; name: string; price: number }>;
  staff: Array<{
    id: string; name: string; typeId: string;
    salary: number; task: string; morale: number;
  }>;

  // 双指标 + 整洁度
  exposure: number;
  reputation: number;
  cleanliness: number;
  cognitionLevel: number;

  // 营销
  activeMarketing: Array<{
    id: string; name: string; activeWeeks: number;
  }>;

  // 外卖
  hasDelivery: boolean;
  platforms: Array<{
    platformId: string; promotionTier: string;
    weeklyCost: number;
  }>;

  // 每周总结（含健康告警）
  weeklySummary: {
    healthAlerts: Array<{
      id: string;
      severity: string;
      title: string;
      message: string;
      suggestion: string;
      category: string;
    }>;
  } | null;
}

/** 将 GameState 序列化为 Agent 友好的视图 */
export function serializeState(state: GameState): AgentGameView {
  return {
    phase: state.gamePhase,
    gameOverReason: state.gameOverReason ?? null,
    week: state.currentWeek,
    totalWeeks: state.totalWeeks,
    season: state.currentSeason ?? null,
    cash: Math.round(state.cash),
    totalInvestment: Math.round(state.totalInvestment),
    cumulativeProfit: Math.round(state.cumulativeProfit || 0),
    consecutiveProfits: state.consecutiveProfits || 0,

    brand: state.selectedBrand
      ? { id: state.selectedBrand.id, name: state.selectedBrand.name, type: state.selectedBrand.type }
      : null,
    location: state.selectedLocation
      ? { id: state.selectedLocation.id, name: state.selectedLocation.name, type: state.selectedLocation.type }
      : null,
    address: state.selectedAddress
      ? { id: state.selectedAddress.id, name: state.selectedAddress.name, area: state.selectedAddress.area }
      : null,
    decoration: state.selectedDecoration
      ? { id: state.selectedDecoration.id, name: state.selectedDecoration.name, level: state.selectedDecoration.level }
      : null,

    products: state.selectedProducts.map(p => ({
      id: p.id, name: p.name,
      price: state.productPrices[p.id] ?? p.basePrice,
    })),
    staff: state.staff.map(s => ({
      id: s.id, name: s.name, typeId: s.typeId,
      salary: s.salary, task: s.assignedTask, morale: s.morale,
    })),

    exposure: Math.round(state.exposure * 10) / 10,
    reputation: Math.round(state.reputation * 10) / 10,
    cleanliness: Math.round((state.cleanliness ?? 60) * 10) / 10,
    cognitionLevel: state.cognition.level,

    activeMarketing: (state.activeMarketingActivities || []).map(a => ({
      id: a.id, name: a.name, activeWeeks: a.activeWeeks ?? 0,
    })),

    hasDelivery: state.hasDelivery,
    platforms: state.deliveryState.platforms.map(p => ({
      platformId: p.platformId,
      promotionTier: p.promotionTierId,
      weeklyCost: p.weeklyPromotionCost,
    })),

    weeklySummary: state.weeklySummary
      ? {
          healthAlerts: (state.weeklySummary.healthAlerts || []).map(a => ({
            id: a.id,
            severity: a.severity,
            title: a.title,
            message: a.message,
            suggestion: a.suggestion,
            category: a.category,
          })),
        }
      : null,
  };
}
