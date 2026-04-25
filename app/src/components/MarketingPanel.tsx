// 营销活动面板组件 — 双指标漏斗模型
// 合并原 ExposurePanel 功能，按曝光类/口碑类/混合类分类展示

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  EXPOSURE_ACTIVITIES,
  REPUTATION_ACTIVITIES,
  MIXED_ACTIVITIES,
  getActivityRiskLevel,
  calculateActivityEffectDecay,
} from "@/data/marketingData";
import { predictMarketingROI } from "@/lib/gameQuery";
import type {
  MarketingActivityConfig,
  MarketingActivity,
  GameState,
  CognitionLevel,
} from "@/types/game";
import {
  Megaphone,
  AlertTriangle,
  Zap,
  Eye,
  Heart,
  Shuffle,
  TrendingDown,
} from "lucide-react";

interface MarketingPanelProps {
  gameState: GameState;
  cognitionLevel: CognitionLevel;
  onStartActivity?: (activityId: string) => void;
  onStopActivity?: (activityId: string) => void;
}

// 分类标签页类型
type CategoryTab = "exposure" | "reputation" | "mixed";

// 风险等级样式
const riskColors: Record<string, string> = {
  low: "text-emerald-400 border-emerald-500/50",
  medium: "text-yellow-400 border-yellow-500/50",
  high: "text-red-400 border-red-500/50",
};
const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "⚠️高依赖",
};

export function MarketingPanel({
  gameState,
  cognitionLevel,
  onStartActivity,
  onStopActivity,
}: MarketingPanelProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("exposure");

  const {
    exposure,
    reputation,
    activeMarketingActivities,
    cash,
    currentWeek,
    usedOneTimeActivities,
    lastActivityWeek,
  } = gameState;

  // 检查活动状态
  const isActivityActive = (id: string) =>
    activeMarketingActivities.some((a) => a.id === id);

  const getActiveInfo = (id: string) =>
    activeMarketingActivities.find((a) => a.id === id);

  const getActivityStatus = (
    activity: MarketingActivityConfig,
  ): { canStart: boolean; reason?: string } => {
    if (isActivityActive(activity.id))
      return { canStart: false, reason: "进行中" };
    if (cash < activity.baseCost)
      return { canStart: false, reason: "资金不足" };
    if (activity.unique && usedOneTimeActivities.includes(activity.id)) {
      return { canStart: false, reason: "已使用" };
    }
    if (activity.cooldownWeeks && activity.type === "one_time") {
      const lastWeek = lastActivityWeek[activity.id];
      if (lastWeek !== undefined) {
        const remaining = activity.cooldownWeeks - (currentWeek - lastWeek);
        if (remaining > 0)
          return { canStart: false, reason: `冷却${remaining}周` };
      }
    }
    return { canStart: true };
  };

  // 当前分类的活动列表
  const tabActivities: Record<CategoryTab, MarketingActivityConfig[]> = {
    exposure: EXPOSURE_ACTIVITIES,
    reputation: REPUTATION_ACTIVITIES,
    mixed: MIXED_ACTIVITIES,
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className="ark-title flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-orange-500" />
          营销管理
        </h2>
        <div className="text-sm text-slate-400">
          已激活{" "}
          <span className="text-orange-500 font-mono">
            {activeMarketingActivities.length}
          </span>{" "}
          个活动
        </div>
      </div>

      {/* 双指标概览 */}
      <DualMetricsOverview exposure={exposure} reputation={reputation} />

      {/* 进行中的活动 */}
      {activeMarketingActivities.length > 0 && (
        <ActiveActivitiesBar
          activities={activeMarketingActivities}
          onStop={onStopActivity}
        />
      )}

      {/* 依赖警告 */}
      <DependencyWarning activities={activeMarketingActivities} />

      {/* 分类标签页 */}
      <div className="ark-card p-5">
        <div className="flex gap-2 mb-4">
          {[
            {
              key: "exposure" as const,
              label: "曝光类",
              icon: Eye,
              color: "text-cyan-400",
            },
            {
              key: "reputation" as const,
              label: "口碑类",
              icon: Heart,
              color: "text-pink-400",
            },
            {
              key: "mixed" as const,
              label: "混合类",
              icon: Shuffle,
              color: "text-amber-400",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`flex-1 py-2 px-3 text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-[#1a2332] text-slate-400 hover:text-white border border-[#1e293b]"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon
                className={`w-4 h-4 ${activeTab === tab.key ? "text-white" : tab.color}`}
              />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 活动列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tabActivities[activeTab].map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isActive={isActivityActive(activity.id)}
              activeInfo={getActiveInfo(activity.id)}
              status={getActivityStatus(activity)}
              cognitionLevel={cognitionLevel}
              gameState={gameState}
              onStart={() => onStartActivity?.(activity.id)}
              onStop={() => onStopActivity?.(activity.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ 子组件 ============

// 双指标概览
function DualMetricsOverview({
  exposure,
  reputation,
}: {
  exposure: number;
  reputation: number;
}) {
  return (
    <div className="ark-card p-5">
      <h3 className="font-bold text-white mb-4 flex items-center gap-2">
        📊 双指标概览
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {/* 曝光度 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              曝光度
            </span>
            <span className="font-mono text-cyan-400 text-lg">
              {Math.round(exposure)}
            </span>
          </div>
          <Progress value={exposure} className="h-2.5" />
          <p className="text-xs text-slate-500">每周-2 · 花钱买量，停则下降</p>
        </div>
        {/* 口碑 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-pink-400" />
              口碑
            </span>
            <span className="font-mono text-pink-400 text-lg">
              {Math.round(reputation)}
            </span>
          </div>
          <Progress value={reputation} className="h-2.5" />
          <p className="text-xs text-slate-500">
            每周-0.5 · 品质留客，慢但持久
          </p>
        </div>
      </div>
    </div>
  );
}

// 进行中的活动条
function ActiveActivitiesBar({
  activities,
  onStop,
}: {
  activities: MarketingActivity[];
  onStop?: (id: string) => void;
}) {
  return (
    <div className="ark-card p-4">
      <h3 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
        🔥 进行中的活动 ({activities.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {activities.map((a) => {
          const riskLevel = getActivityRiskLevel(a.dependencyCoefficient);
          const isHighRisk = riskLevel === "high";
          return (
            <div
              key={a.id}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border ${
                isHighRisk
                  ? "border-red-500/50 bg-red-500/10 text-red-300"
                  : "border-[#1e293b] bg-[#1a2332] text-slate-300"
              }`}
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-slate-500">·</span>
              <span>{a.activeWeeks}周</span>
              {isHighRisk && <AlertTriangle className="w-3 h-3 text-red-400" />}
              {a.type === "continuous" && onStop && (
                <button
                  className="ml-1 text-red-400 hover:text-red-300"
                  onClick={() => onStop(a.id)}
                  title="停止活动"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 依赖警告
function DependencyWarning({
  activities,
}: {
  activities: MarketingActivity[];
}) {
  const hasHighRisk = activities.some(
    (a) => getActivityRiskLevel(a.dependencyCoefficient) === "high",
  );
  if (!hasHighRisk) return null;

  return (
    <div className="p-4 bg-red-500/10 border border-red-500/50 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold text-red-400">高依赖活动运行中</p>
        <p className="text-xs text-red-300 mt-1">
          停止后曝光度将大幅下降（客户是平台的，不是你的）
        </p>
      </div>
    </div>
  );
}

// 活动卡片
function ActivityCard({
  activity,
  isActive,
  activeInfo,
  status,
  cognitionLevel,
  gameState,
  onStart,
  onStop,
}: {
  activity: MarketingActivityConfig;
  isActive: boolean;
  activeInfo?: MarketingActivity;
  status: { canStart: boolean; reason?: string };
  cognitionLevel: CognitionLevel;
  gameState: GameState;
  onStart: () => void;
  onStop: () => void;
}) {
  // Phase 2: ROI 预览（启动前可见）
  const roiHint = !isActive
    ? predictMarketingROI(gameState, activity.id)
    : null;
  const riskLevel = getActivityRiskLevel(activity.dependencyCoefficient);
  const decay = activeInfo
    ? calculateActivityEffectDecay(
        activeInfo.activeWeeks,
        activity.dependencyCoefficient,
      )
    : 1;

  return (
    <div
      className={`p-4 bg-[#0a0e17] border ${
        isActive ? "border-orange-500/50" : "border-[#1e293b]"
      }`}
    >
      {/* 标题行 */}
      <div className="flex justify-between items-start mb-2">
        <div className="font-bold text-white">{activity.name}</div>
        {activity.dependencyCoefficient > 0 && (
          <Badge variant="outline" className={riskColors[riskLevel]}>
            {riskLabels[riskLevel]}
          </Badge>
        )}
      </div>

      {/* 描述 */}
      <p className="text-xs text-slate-400 mb-2">{activity.description}</p>

      {/* 教学提示 */}
      <p className="text-xs text-amber-400/80 mb-3 italic">
        💡 {activity.teachingTip}
      </p>

      {/* 效果指标（4级显示具体数值，2-3级显示方向） */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {activity.exposureBoost !== 0 && (
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-cyan-500" />
            <span className="text-cyan-400">
              曝光 {activity.exposureBoost > 0 ? "↑" : "↓"}
              {cognitionLevel >= 4 && (
                <>
                  {" "}
                  {activity.exposureBoost > 0 ? "+" : ""}
                  {activity.type === "one_time"
                    ? `${activity.exposureBoost}(${activity.maxDuration || 1}周)`
                    : `${activity.exposureBoost}/周`}
                </>
              )}
            </span>
          </div>
        )}
        {activity.reputationBoost !== 0 && (
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-pink-500" />
            <span
              className={
                activity.reputationBoost > 0 ? "text-pink-400" : "text-red-400"
              }
            >
              口碑 {activity.reputationBoost > 0 ? "↑" : "↓"}
              {cognitionLevel >= 4 && (
                <>
                  {" "}
                  {activity.reputationBoost > 0 ? "+" : ""}
                  {activity.type === "one_time"
                    ? `${activity.reputationBoost}(${activity.maxDuration || 1}周)`
                    : `${activity.reputationBoost}/周`}
                </>
              )}
            </span>
          </div>
        )}
        {activity.priceModifier < 1 && cognitionLevel >= 4 && (
          <div className="text-red-400">
            售价 {(activity.priceModifier * 100).toFixed(0)}%
          </div>
        )}
        {activity.baseCost > 0 && (
          <div className="text-orange-400">
            💰 ¥{activity.baseCost}
            {activity.type === "continuous" ? "/周" : ""}
          </div>
        )}
      </div>

      {/* 运行状态 */}
      {isActive && activeInfo && (
        <div className="text-xs mb-3 space-y-1">
          <div className="text-orange-400 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            已运行 {activeInfo.activeWeeks} 周
            {activity.type === "one_time" && activity.maxDuration && (
              <span className="text-slate-500">
                {" "}
                / 剩余 {activity.maxDuration - activeInfo.activeWeeks} 周
              </span>
            )}
          </div>
          {decay < 1 && (
            <div className="text-yellow-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              效果衰减至 {(decay * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* Phase 2: ROI 预览（启动前可见） */}
      {roiHint && status.canStart && (
        <div className="text-[11px] mb-3 px-2 py-1.5 bg-[#0d141f] border border-[#1e293b] flex flex-wrap gap-x-3 gap-y-0.5">
          <span
            className={
              roiHint.estROI >= 0 ? "text-emerald-400" : "text-red-400"
            }
          >
            预计 ROI:{" "}
            {Number.isFinite(roiHint.estROI)
              ? `${(roiHint.estROI * 100).toFixed(0)}%`
              : "∞"}
          </span>
          <span className="text-slate-400">
            回本:{" "}
            {Number.isFinite(roiHint.weeksToBreakEven)
              ? `${roiHint.weeksToBreakEven}w`
              : "—"}
          </span>
        </div>
      )}

      {/* 操作按钮 */}
      <button
        className={`w-full py-2 text-sm font-bold transition-all ${
          isActive
            ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
            : status.canStart
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "bg-[#1a2332] text-slate-500 border border-[#1e293b] cursor-not-allowed"
        }`}
        disabled={!isActive && !status.canStart}
        onClick={isActive ? onStop : onStart}
      >
        {isActive
          ? "停止活动"
          : status.canStart
            ? "启动活动"
            : status.reason || "不可用"}
      </button>
    </div>
  );
}

export default MarketingPanel;
