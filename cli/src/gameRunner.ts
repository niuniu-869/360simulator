/**
 * gameRunner.ts — 游戏运行器
 *
 * 持有 GameState，处理 Agent 请求，调用 dispatch/query。
 *
 * Phase 0+ 增强：
 *  - 持有 TimelineCollector，每周采样落盘
 *  - 支持 auto_advance（CLI 等价 UI "自动推进 N 周"）
 *  - 支持 timeline / prediction / crisis_mode / toasts query
 *  - meta reset 支持携带 { seed, scenarioId }
 */

import type { GameState } from "@/types/game";
import type {
  AgentRequest,
  AgentResponse,
  PredictionRequest,
  QueryType,
} from "./protocol";
import { createInitialGameState } from "@/lib/gameEngine";
import { dispatch } from "@/lib/gameActions";
import {
  computeCurrentStats,
  computeSupplyDemandResult,
  computeCanOpen,
  computeGameResult,
  getAvailableActions,
  predictPriceChange,
  predictMarketingROI,
} from "@/lib/gameQuery";
import { serializeState } from "./stateView";
import {
  brands,
  locations,
  decorations,
  products,
  staffTypes,
} from "@/data/gameData";
import { DELIVERY_PLATFORMS } from "@/data/deliveryData";
import {
  EXPOSURE_ACTIVITIES,
  REPUTATION_ACTIVITIES,
  MIXED_ACTIVITIES,
} from "@/data/marketingData";
import { TimelineCollector } from "./timeline";

export class GameRunner {
  private state: GameState;
  private timeline: TimelineCollector;

  constructor() {
    this.state = createInitialGameState();
    this.timeline = new TimelineCollector();
  }

  handleRequest(req: AgentRequest): AgentResponse {
    try {
      switch (req.type) {
        case "action":
          return this.handleAction(req.id, req.action);
        case "query":
          return this.handleQuery(req.id, req.query);
        case "meta":
          return this.handleMeta(req.id, req.meta);
        case "prediction":
          return this.handlePrediction(req.id, req.prediction);
        case "auto_advance":
          return this.handleAutoAdvance(req.id, req.weeks);
        default: {
          const r = req as { id?: string };
          return {
            id: r.id ?? "0",
            success: false,
            error: "Unknown request type",
          };
        }
      }
    } catch (err) {
      const r = req as { id?: string };
      return {
        id: r.id ?? "0",
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---- Action 处理 ----

  private handleAction(
    id: string,
    action: import("@/lib/gameActionTypes").GameAction,
  ): AgentResponse {
    if (
      action.type === "next_week" &&
      this.state.pendingInteractiveEvent &&
      this.state.gamePhase === "operating"
    ) {
      return {
        id,
        success: false,
        error:
          `Pending interactive event "${this.state.pendingInteractiveEvent.name}" must be responded first ` +
          `(use respond_to_event). Query "pending_event" to see options.`,
      };
    }
    const result = dispatch(this.state, action);
    if (result.error) {
      return { id, success: false, error: result.error };
    }
    if (result.changed) {
      this.state = result.state;
    }

    // 时间线收集：决策 + 周快照
    this.recordDecision(action);
    if (action.type === "next_week" && this.state.gamePhase !== "setup") {
      this.timeline.snapshotAfterWeek(this.state);
    }
    if (action.type === "respond_to_event") {
      const evId = (action as { eventId: string }).eventId;
      const optId = (action as { optionId: string }).optionId;
      this.timeline.recordEvent({
        id: evId,
        name:
          this.state.lastInteractiveEventResponse?.eventId === evId
            ? evId
            : evId,
        category: "response",
        optionId: optId,
      });
    }

    return { id, success: true, data: serializeState(this.state) };
  }

  private recordDecision(
    action: import("@/lib/gameActionTypes").GameAction,
  ): void {
    // 仅记录"关键玩家决策"，跳过 next_week / clear_* 等推进类
    const ignored = new Set([
      "next_week",
      "clear_weekly_summary",
      "clear_last_week_event",
    ]);
    if (ignored.has(action.type)) return;
    this.timeline.recordDecision({
      type: action.type,
      payload: action as unknown as Record<string, unknown>,
      week: this.state.currentWeek,
    });
  }

  // ---- auto_advance 处理 ----

  private handleAutoAdvance(id: string, weeks: number): AgentResponse {
    if (this.state.gamePhase !== "operating") {
      return {
        id,
        success: false,
        error: "auto_advance 需在 operating 阶段调用",
      };
    }
    if (!Number.isFinite(weeks) || weeks <= 0) {
      return { id, success: false, error: "weeks 必须为正数" };
    }
    let advanced = 0;
    while (advanced < weeks) {
      // 自动清掉上周回顾弹窗（UI 等价行为）
      if (this.state.weeklySummary) {
        const r = dispatch(this.state, { type: "clear_weekly_summary" });
        if (r.changed) this.state = r.state;
      }
      if (this.state.lastWeekEvent) {
        const r = dispatch(this.state, { type: "clear_last_week_event" });
        if (r.changed) this.state = r.state;
      }
      if (this.state.pendingInteractiveEvent) {
        // 遇到待响应事件 → 暂停，让 agent 决策
        break;
      }
      const r = dispatch(this.state, { type: "next_week" });
      if (r.error) {
        return { id, success: false, error: r.error };
      }
      if (r.changed) this.state = r.state;
      this.timeline.snapshotAfterWeek(this.state);
      advanced += 1;
      if (this.state.gamePhase === "ended") break;
    }
    return {
      id,
      success: true,
      data: {
        advanced,
        stoppedReason:
          this.state.gamePhase === "ended"
            ? "ended"
            : this.state.pendingInteractiveEvent
              ? "pending_event"
              : "reached_target",
        state: serializeState(this.state),
      },
    };
  }

  // ---- Query 处理 ----

  private handleQuery(id: string, query: QueryType): AgentResponse {
    switch (query) {
      case "state":
        return { id, success: true, data: serializeState(this.state) };
      case "available_actions":
        return { id, success: true, data: getAvailableActions(this.state) };
      case "stats":
        return { id, success: true, data: computeCurrentStats(this.state) };
      case "supply_demand":
        return {
          id,
          success: true,
          data: computeSupplyDemandResult(this.state),
        };
      case "game_info":
        return {
          id,
          success: true,
          data: {
            canOpen: computeCanOpen(this.state),
            gameResult: computeGameResult(this.state),
            seed: this.state.seed ?? null,
          },
        };
      case "pending_event": {
        const ev = this.state.pendingInteractiveEvent;
        if (!ev) return { id, success: true, data: null };
        const desc =
          typeof ev.description === "function"
            ? ev.description(this.state)
            : ev.description;
        return {
          id,
          success: true,
          data: {
            id: ev.id,
            name: ev.name,
            description: desc,
            category: ev.category,
            isNotification:
              !!ev.notificationEffects && (ev.options || []).length === 0,
            notificationQuote: ev.notificationQuote,
            options: (ev.options || []).map((o) => ({
              id: o.id,
              text: o.text,
              yonggeQuote: o.yonggeQuote,
              narrativeHint: o.narrativeHint,
              effects: o.effects,
            })),
          },
        };
      }
      case "inventory":
        return { id, success: true, data: this.state.inventoryState };
      case "weekly_report":
        return {
          id,
          success: true,
          data:
            this.state.weeklySummary ?? this.state.lastWeeklySummary ?? null,
        };
      case "nearby_shops":
        return {
          id,
          success: true,
          data: {
            shops: this.state.nearbyShops,
            events: this.state.nearbyShopEvents,
          },
        };
      case "cognition":
        return { id, success: true, data: this.state.cognition };
      case "boss_action":
        return { id, success: true, data: this.state.bossAction };
      case "brands":
        return { id, success: true, data: brands };
      case "locations":
        return { id, success: true, data: locations };
      case "products":
        return { id, success: true, data: products };
      case "decorations":
        return { id, success: true, data: decorations };
      case "staff_types":
        return { id, success: true, data: staffTypes };
      case "marketing_activities":
        return {
          id,
          success: true,
          data: {
            exposure: EXPOSURE_ACTIVITIES,
            reputation: REPUTATION_ACTIVITIES,
            mixed: MIXED_ACTIVITIES,
          },
        };
      case "delivery_platforms":
        return { id, success: true, data: DELIVERY_PLATFORMS };
      case "timeline":
        return { id, success: true, data: this.timeline.getAll() };
      case "achievements":
        return {
          id,
          success: true,
          data: {
            unlocked:
              (this.state as unknown as { unlockedAchievements?: string[] })
                .unlockedAchievements ?? [],
          },
        };
      case "crisis_mode":
        return {
          id,
          success: true,
          data:
            (this.state as unknown as { crisisMode?: string }).crisisMode ??
            "none",
        };
      case "toasts":
        return {
          id,
          success: true,
          data: (this.state as unknown as { toasts?: unknown[] }).toasts ?? [],
        };
      default:
        return { id, success: false, error: `Unknown query: ${query}` };
    }
  }

  // ---- prediction 处理 ----

  private handlePrediction(id: string, p: PredictionRequest): AgentResponse {
    if (!p) return { id, success: false, error: "prediction payload missing" };
    switch (p.kind) {
      case "price":
        return {
          id,
          success: true,
          data: predictPriceChange(this.state, p.productId, p.newPrice),
        };
      case "marketing":
        return {
          id,
          success: true,
          data: predictMarketingROI(this.state, p.activityId),
        };
      case "boss_action":
        return {
          id,
          success: true,
          data: {
            actionId: p.actionId,
            hint: "详见 BOSS_ACTION_HINTS（Phase 2 完整化）",
          },
        };
      default:
        return {
          id,
          success: false,
          error: `Unknown prediction kind: ${(p as unknown as { kind: string }).kind}`,
        };
    }
  }

  // ---- Meta 处理 ----

  private handleMeta(
    id: string,
    meta: "help" | "reset" | { reset: { seed?: number; scenarioId?: string } },
  ): AgentResponse {
    if (typeof meta === "object" && meta && "reset" in meta) {
      const opts = meta.reset;
      this.state = createInitialGameState(opts?.seed);
      this.timeline.reset();
      return {
        id,
        success: true,
        data: {
          ...serializeState(this.state),
          scenarioId: opts?.scenarioId ?? null,
        },
      };
    }
    switch (meta) {
      case "reset":
        this.state = createInitialGameState();
        this.timeline.reset();
        return { id, success: true, data: serializeState(this.state) };
      case "help":
        return {
          id,
          success: true,
          data: {
            protocol: "JSON-lines over stdin/stdout",
            requestTypes: {
              action: '{ id, type:"action", action:GameAction }',
              query: '{ id, type:"query", query:QueryType }',
              meta: '{ id, type:"meta", meta:"reset"|"help"|{reset:{seed?,scenarioId?}} }',
              prediction: '{ id, type:"prediction", prediction:{kind, ...} }',
              auto_advance: '{ id, type:"auto_advance", weeks:number }',
            },
            queryTypes: [
              "state",
              "available_actions",
              "game_info",
              "brands",
              "locations",
              "products",
              "decorations",
              "staff_types",
              "marketing_activities",
              "delivery_platforms",
              "stats",
              "supply_demand",
              "pending_event",
              "inventory",
              "weekly_report",
              "nearby_shops",
              "cognition",
              "boss_action",
              "timeline",
              "achievements",
              "crisis_mode",
              "toasts",
            ],
            tips: [
              "先 query available_actions 获取当前可用操作",
              "每次 action 响应都会附带最新 state 视图",
              "若 state.pendingInteractiveEvent 非空，必须先 respond_to_event 才能 next_week",
              "auto_advance 会自动跑 N 周，遇到事件/结束即暂停",
              "meta { reset:{seed:42} } 启动可复现局",
            ],
          },
        };
      default:
        return { id, success: false, error: `Unknown meta: ${meta}` };
    }
  }
}
