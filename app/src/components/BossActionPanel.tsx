/**
 * BossActionPanel.tsx — 老板周行动选择面板
 *
 * 放在经营面板顶部，每周第一个决策：老板这周干什么？
 * 5种行动：亲自坐镇、巡店督导、周边考察、蹲点数人头、同行饭局
 *
 * 架构：选择行动 → 下一周时执行 → 结果在下周显示
 */

import { useState } from "react";
import type {
  GameState,
  BossActionType,
  CognitionLevel,
  InvestigationResult,
  IndustryInsight,
} from "@/types/game";
import { BOSS_ACTIONS, INVESTIGATION_DIMENSIONS } from "@/data/bossActionData";
import {
  User,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Eye,
  MessageCircle,
  MapPin,
} from "lucide-react";

interface BossActionPanelProps {
  gameState: GameState;
  cognitionLevel: CognitionLevel;
  onSetBossAction: (
    action: BossActionType,
    role?: string,
    shopId?: string,
  ) => void;
}

export function BossActionPanel({
  gameState,
  cognitionLevel,
  onSetBossAction,
}: BossActionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // 兼容旧存档：bossAction 可能不存在，提供默认值
  const ba = gameState.bossAction ?? {
    currentAction: "supervise" as const,
    workRole: undefined,
    targetShopId: undefined,
    consecutiveStudyWeeks: 0,
    benchmarkCooldown: 0,
    revealedShopInfo: {},
    investigationHistory: [],
    insightHistory: [],
    activeBuffs: [],
    lastActionWeek: 0,
  };
  const currentConfig = BOSS_ACTIONS.find((a) => a.id === ba.currentAction);

  // 上周的考察/洞察结果（结果在执行后的下一周才可见）
  const lastWeekResults = ba.investigationHistory.filter(
    (r) => r.week === gameState.currentWeek - 1,
  );
  const lastWeekInsights = ba.insightHistory.filter(
    (r) => r.week === gameState.currentWeek - 1,
  );

  // 可考察的周边店铺
  const openShops = gameState.nearbyShops.filter(
    (s) => !s.isClosing && !s.closedWeek,
  );

  // 当前行动是否需要店铺选择
  const needsShopSelect =
    ba.currentAction === "investigate_nearby" ||
    ba.currentAction === "count_traffic";

  const formatMoney = (n: number) =>
    n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n}`;

  return (
    <div className="ark-card p-4 border-l-2 border-l-amber-500/50">
      {/* 标题栏 */}
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-amber-500" />
          <span className="font-bold text-white">老板本周行动</span>
          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {currentConfig?.icon} {currentConfig?.name}
          </span>
          {ba.activeBuffs.length > 0 && (
            <span className="text-xs text-emerald-400">
              ✨ {ba.activeBuffs.length}个增益生效中
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {/* 行动选择网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {BOSS_ACTIONS.map((action) => {
              const isActive = ba.currentAction === action.id;
              const isLocked = cognitionLevel < action.minCognitionLevel;
              const cantAfford = gameState.cash < action.cost;
              // 周边考察需要有可考察的店铺
              const noShops =
                action.id === "investigate_nearby" && openShops.length === 0;
              const disabled = isLocked || cantAfford || noShops;

              return (
                <button
                  key={action.id}
                  className={`p-3 text-left transition-all border ${
                    isActive
                      ? "bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30"
                      : disabled
                        ? "bg-[#0a0e17] border-[#1e293b] opacity-50 cursor-not-allowed"
                        : "bg-[#0a0e17] border-[#1e293b] hover:border-amber-500/30 hover:bg-[#1a2332]"
                  }`}
                  onClick={() => {
                    if (disabled) return;
                    if (action.id === "work_in_store") {
                      onSetBossAction(action.id, "waiter");
                    } else {
                      onSetBossAction(action.id);
                    }
                  }}
                  disabled={disabled}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">
                      {action.icon}{" "}
                      <span className="text-sm font-bold text-white">
                        {action.name}
                      </span>
                    </span>
                    {action.cost > 0 && (
                      <span
                        className={`text-xs ${cantAfford ? "text-red-400" : "text-orange-400"}`}
                      >
                        {formatMoney(action.cost)}
                      </span>
                    )}
                    {action.cost === 0 && (
                      <span className="text-xs text-emerald-400">免费</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {action.description}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {action.effectDescription}
                  </p>
                  {/* Phase 2: 数值化效果提示 */}
                  <p className="text-[10px] text-amber-300/80 mt-1 font-mono">
                    {action.cost > 0 ? `−${formatMoney(action.cost)}` : "+0"}
                    {" · "}+{action.expRange[0]}
                    {action.expRange[0] !== action.expRange[1]
                      ? `~${action.expRange[1]}`
                      : ""}{" "}
                    EXP
                  </p>
                  {isLocked && (
                    <p className="text-[10px] text-red-400 mt-1">
                      🔒 需要认知 Lv{action.minCognitionLevel}
                    </p>
                  )}
                  {noShops && !isLocked && (
                    <p className="text-[10px] text-red-400 mt-1">
                      🚫 周边没有可考察的店铺
                    </p>
                  )}
                  {isActive && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      ✓ 已选择（点击取消）
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* 亲自坐镇：岗位选择 */}
          {ba.currentAction === "work_in_store" && (
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <p className="text-xs text-slate-400 mb-2">
                选择替代岗位（效率70%）：
              </p>
              <div className="flex gap-2">
                {[
                  { id: "waiter", name: "前台", icon: "🙋" },
                  { id: "chef", name: "后厨", icon: "👨‍🍳" },
                  { id: "cleaner", name: "勤杂", icon: "🧹" },
                ].map((role) => (
                  <button
                    key={role.id}
                    className={`px-3 py-1.5 text-xs border transition-all ${
                      ba.workRole === role.id
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                        : "bg-[#1a2332] border-[#1e293b] text-slate-400 hover:border-amber-500/30"
                    }`}
                    onClick={() => onSetBossAction("work_in_store", role.id)}
                  >
                    {role.icon} {role.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 考察/蹲点目标店铺选择 */}
          {needsShopSelect && openShops.length > 0 && (
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <p className="text-xs font-bold text-cyan-400">
                  {ba.currentAction === "investigate_nearby"
                    ? "选择考察目标"
                    : "选择蹲点位置"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ba.currentAction === "count_traffic" && (
                  <button
                    className={`px-3 py-1.5 text-xs border transition-all ${
                      !ba.targetShopId || ba.targetShopId === "_self"
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                        : "bg-[#1a2332] border-[#1e293b] text-slate-400 hover:border-cyan-500/30"
                    }`}
                    onClick={() =>
                      onSetBossAction(ba.currentAction, undefined, "_self")
                    }
                  >
                    📍 本店门口
                  </button>
                )}
                {openShops.map((shop) => (
                  <button
                    key={shop.id}
                    className={`px-3 py-1.5 text-xs border transition-all ${
                      ba.targetShopId === shop.id
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                        : "bg-[#1a2332] border-[#1e293b] text-slate-400 hover:border-cyan-500/30"
                    }`}
                    onClick={() =>
                      onSetBossAction(ba.currentAction, undefined, shop.id)
                    }
                  >
                    🏪 {shop.name}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                💡 结果将在下周揭晓
              </p>
            </div>
          )}

          {/* 行动预告提示 */}
          {ba.currentAction !== "supervise" &&
            ba.currentAction !== "work_in_store" && (
              <div className="px-3 py-2 bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-400/80">
                ⏳ 已安排本周行动：{currentConfig?.name}
                。结果将在下周结算时揭晓。
                {ba.currentAction === "count_traffic" &&
                  ba.consecutiveStudyWeeks >= 1 && (
                    <span className="text-emerald-400 ml-1">
                      （连续蹲点第{ba.consecutiveStudyWeeks + 1}
                      周，将获得额外洞察！）
                    </span>
                  )}
              </div>
            )}

          {/* 上周考察结果 */}
          {lastWeekResults.length > 0 && (
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <p className="text-xs font-bold text-blue-400">上周考察结果</p>
              </div>
              {lastWeekResults.map((result, idx) => (
                <InvestigationResultCard key={idx} result={result} />
              ))}
            </div>
          )}

          {/* 上周饭局洞察 */}
          {lastWeekInsights.length > 0 && (
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                <p className="text-xs font-bold text-purple-400">
                  上周饭局情报
                </p>
              </div>
              {lastWeekInsights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          )}

          {/* 生效中的 buff */}
          {ba.activeBuffs.length > 0 && (
            <div className="p-3 bg-[#0a0e17] border border-[#1e293b]">
              <p className="text-xs text-emerald-400 mb-2">✨ 当前增益</p>
              {ba.activeBuffs.map((buff, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] text-slate-300"
                >
                  <span>
                    {buff.source}:{" "}
                    {buff.type === "supply_cost_reduction"
                      ? `进货成本 -${Math.round(buff.value * 100)}%`
                      : `+${buff.value}`}
                  </span>
                  <span className="text-slate-500">
                    剩余 {buff.remainingWeeks} 周
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 历史记录折叠 */}
          {(ba.investigationHistory.length > 0 ||
            ba.insightHistory.length > 0) && (
            <button
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "收起" : "展开"}历史记录 (
              {ba.investigationHistory.length + ba.insightHistory.length} 条)
            </button>
          )}

          {showHistory && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {/* 考察历史（排除上周已展示的） */}
              {ba.investigationHistory
                .filter((r) => r.week !== gameState.currentWeek - 1)
                .sort((a, b) => b.week - a.week)
                .slice(0, 10)
                .map((result, idx) => (
                  <InvestigationResultCard
                    key={`inv-${idx}`}
                    result={result}
                    compact
                  />
                ))}
              {/* 洞察历史 */}
              {ba.insightHistory
                .filter((r) => r.week !== gameState.currentWeek - 1)
                .sort((a, b) => b.week - a.week)
                .slice(0, 10)
                .map((insight, idx) => (
                  <InsightCard key={`ins-${idx}`} insight={insight} compact />
                ))}
            </div>
          )}

          {/* 勇哥语录 */}
          {currentConfig && (
            <p className="text-[10px] text-slate-600 italic mt-2">
              💬 勇哥说："{currentConfig.yongGeQuote}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============ 子组件 ============

function InvestigationResultCard({
  result,
  compact,
}: {
  result: InvestigationResult;
  compact?: boolean;
}) {
  const dimConfig = INVESTIGATION_DIMENSIONS.find(
    (d) => d.id === result.dimension,
  );
  return (
    <div
      className={`${compact ? "py-1" : "py-2"} ${compact ? "" : "border-b border-[#1e293b] last:border-0"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {!compact && <span className="text-xs">{dimConfig?.icon}</span>}
          <span className="text-[11px] text-slate-300">
            {result.shopName} · {dimConfig?.name}
          </span>
          {compact && (
            <span className="text-[10px] text-slate-600">
              第{result.week}周
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-white">
          {result.displayValue}
        </span>
      </div>
      {result.cogWarning && (
        <div className="flex items-center gap-1 mt-1">
          <AlertTriangle className="w-3 h-3 text-yellow-500" />
          <span className="text-[10px] text-yellow-500/80 italic">
            {result.cogWarning}
          </span>
        </div>
      )}
    </div>
  );
}

function InsightCard({
  insight,
  compact,
}: {
  insight: IndustryInsight;
  compact?: boolean;
}) {
  return (
    <div
      className={`${compact ? "py-1" : "py-2"} ${compact ? "" : "border-b border-[#1e293b] last:border-0"}`}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[11px] text-slate-300 flex-1">
          "{insight.content}"
          {compact && (
            <span className="text-[10px] text-slate-600 ml-1">
              第{insight.week}周
            </span>
          )}
        </span>
      </div>
      {insight.cogWarning && (
        <div className="flex items-center gap-1 mt-1">
          <AlertTriangle className="w-3 h-3 text-yellow-500" />
          <span className="text-[10px] text-yellow-500/80 italic">
            {insight.cogWarning}
          </span>
        </div>
      )}
      {insight.buff && (
        <div className="mt-1 text-[10px] text-emerald-400">
          ✨ 获得增益：{insight.buff.source}
        </div>
      )}
    </div>
  );
}
