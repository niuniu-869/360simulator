/**
 * gameRunner.ts — 游戏运行器
 *
 * 持有 GameState，处理 Agent 请求，调用 dispatch/query。
 */

import type { GameState } from '@/types/game';
import type { AgentRequest, AgentResponse, QueryType } from './protocol';
import { createInitialGameState } from '@/lib/gameEngine';
import { dispatch } from '@/lib/gameActions';
import {
  computeCurrentStats,
  computeSupplyDemandResult,
  computeCanOpen,
  computeGameResult,
  getAvailableActions,
} from '@/lib/gameQuery';
import { serializeState } from './stateView';
import {
  brands, locations, decorations, products, staffTypes,
} from '@/data/gameData';
import { DELIVERY_PLATFORMS } from '@/data/deliveryData';
import {
  EXPOSURE_ACTIVITIES,
  REPUTATION_ACTIVITIES,
  MIXED_ACTIVITIES,
} from '@/data/marketingData';

export class GameRunner {
  private state: GameState;

  constructor() {
    this.state = createInitialGameState();
  }

  handleRequest(req: AgentRequest): AgentResponse {
    try {
      switch (req.type) {
        case 'action':
          return this.handleAction(req.id, req.action);
        case 'query':
          return this.handleQuery(req.id, req.query);
        case 'meta':
          return this.handleMeta(req.id, req.meta);
        default:
          return { id: req.id, success: false, error: 'Unknown request type' };
      }
    } catch (err) {
      return {
        id: req.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---- Action 处理 ----

  private handleAction(id: string, action: import('@/lib/gameActionTypes').GameAction): AgentResponse {
    const result = dispatch(this.state, action);
    if (result.error) {
      return { id, success: false, error: result.error };
    }
    if (result.changed) {
      this.state = result.state;
    }
    return { id, success: true, data: serializeState(this.state) };
  }

  // ---- Query 处理 ----

  private handleQuery(id: string, query: QueryType): AgentResponse {
    switch (query) {
      case 'state':
        return { id, success: true, data: serializeState(this.state) };

      case 'available_actions':
        return { id, success: true, data: getAvailableActions(this.state) };

      case 'stats':
        return { id, success: true, data: computeCurrentStats(this.state) };

      case 'supply_demand':
        return { id, success: true, data: computeSupplyDemandResult(this.state) };

      case 'game_info':
        return {
          id, success: true,
          data: {
            canOpen: computeCanOpen(this.state),
            gameResult: computeGameResult(this.state),
          },
        };

      case 'brands':
        return { id, success: true, data: brands };

      case 'locations':
        return { id, success: true, data: locations };

      case 'products':
        return { id, success: true, data: products };

      case 'decorations':
        return { id, success: true, data: decorations };

      case 'staff_types':
        return { id, success: true, data: staffTypes };

      case 'marketing_activities':
        return {
          id, success: true,
          data: {
            exposure: EXPOSURE_ACTIVITIES,
            reputation: REPUTATION_ACTIVITIES,
            mixed: MIXED_ACTIVITIES,
          },
        };

      case 'delivery_platforms':
        return { id, success: true, data: DELIVERY_PLATFORMS };

      default:
        return { id, success: false, error: `Unknown query: ${query}` };
    }
  }

  // ---- Meta 处理 ----

  private handleMeta(id: string, meta: 'help' | 'reset'): AgentResponse {
    switch (meta) {
      case 'reset':
        this.state = createInitialGameState();
        return { id, success: true, data: serializeState(this.state) };

      case 'help':
        return {
          id, success: true,
          data: {
            protocol: 'JSON-lines over stdin/stdout',
            requestTypes: {
              action: '执行游戏操作 — { id, type: "action", action: GameAction }',
              query: '查询游戏数据 — { id, type: "query", query: QueryType }',
              meta: '元操作 — { id, type: "meta", meta: "help" | "reset" }',
            },
            queryTypes: [
              'state', 'available_actions', 'game_info',
              'brands', 'locations', 'products', 'decorations',
              'staff_types', 'marketing_activities', 'delivery_platforms',
              'stats', 'supply_demand',
            ],
            tips: [
              '先 query available_actions 获取当前可用操作',
              '每次 action 响应都会附带最新 state 视图',
              'meta reset 可重新开始游戏',
            ],
          },
        };

      default:
        return { id, success: false, error: `Unknown meta: ${meta}` };
    }
  }
}
