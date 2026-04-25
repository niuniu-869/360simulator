/**
 * protocol.ts — CLI Agent 协议类型定义
 *
 * JSON-lines over stdin/stdout，每行一个 JSON 对象。
 */

import type { GameAction } from '@/lib/gameActionTypes';

// ============ 查询类型 ============

export type QueryType =
  | 'state'
  | 'available_actions'
  | 'game_info'
  | 'brands'
  | 'locations'
  | 'products'
  | 'decorations'
  | 'staff_types'
  | 'marketing_activities'
  | 'delivery_platforms'
  | 'stats'
  | 'supply_demand'
  | 'pending_event'
  | 'inventory'
  | 'weekly_report'
  | 'nearby_shops'
  | 'cognition'
  | 'boss_action'
  | 'timeline'
  | 'achievements'
  | 'crisis_mode'
  | 'toasts';

/** prediction：参数化预测，用于 phase 2 决策预览 */
export type PredictionRequest =
  | { kind: 'price'; productId: string; newPrice: number }
  | { kind: 'marketing'; activityId: string }
  | { kind: 'boss_action'; actionId: string };

// ============ 请求类型 ============

export type AgentRequest =
  | { id: string; type: 'action'; action: GameAction }
  | { id: string; type: 'query'; query: QueryType }
  | { id: string; type: 'meta'; meta: 'help' | 'reset' | { reset: { seed?: number; scenarioId?: string } } }
  | { id: string; type: 'prediction'; prediction: PredictionRequest }
  | { id: string; type: 'auto_advance'; weeks: number };

// ============ 响应类型 ============

export interface AgentResponse {
  id: string;
  success: boolean;
  error?: string;
  data?: unknown;
}
