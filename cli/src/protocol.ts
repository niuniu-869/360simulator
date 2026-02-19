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
  | 'supply_demand';

// ============ 请求类型 ============

export type AgentRequest =
  | { id: string; type: 'action'; action: GameAction }
  | { id: string; type: 'query'; query: QueryType }
  | { id: string; type: 'meta'; meta: 'help' | 'reset' };

// ============ 响应类型 ============

export interface AgentResponse {
  id: string;
  success: boolean;
  error?: string;
  data?: unknown;
}
