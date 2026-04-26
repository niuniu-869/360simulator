import type {
  GameState,
  MonthlyObjective,
  MonthlyObjectiveMetric,
  MonthlyObjectiveResult,
  MonthlyObjectiveReward,
  WeeklySummary,
} from "@/types/game";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function objectiveId(startWeek: number, metric: MonthlyObjectiveMetric): string {
  return `month_${Math.ceil(startWeek / 4)}_${metric}`;
}

function formatTarget(value: number, unit: MonthlyObjective["unit"]): string {
  if (unit === "money") return `¥${Math.round(value).toLocaleString()}`;
  if (unit === "percent") return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}`;
}

function rewardFor(
  focus: MonthlyObjective["focus"],
): MonthlyObjectiveReward {
  const base = { cognitionExp: 35 };
  switch (focus) {
    case "finance":
      return { ...base, cash: 1200 };
    case "growth":
      return { ...base, exposure: 4 };
    case "reputation":
      return { ...base, reputation: 4 };
    case "supply":
      return { ...base, reputation: 2, exposure: 2 };
    case "survival":
      return { ...base, cash: 1800 };
  }
}

export function createMonthlyObjective(
  state: GameState,
  startWeek: number,
): MonthlyObjective {
  const endWeek = startWeek + 3;
  const fixedCost = Math.max(1, state.weeklyFixedCost || 0);
  const runwayWeeks = state.cash / fixedCost;

  if (state.currentWeek <= 1 || state.cumulativeProfit < 0 || runwayWeeks < 4) {
    const targetValue = Math.max(0, Math.round(fixedCost * 0.35));
    return {
      id: objectiveId(startWeek, "monthly_profit"),
      title: "止血月",
      description: "这个月先证明店能不亏钱，再谈扩张。",
      focus: "finance",
      metric: "monthly_profit",
      startWeek,
      endWeek,
      targetValue,
      currentValue: 0,
      accumulatedValue: 0,
      weeksMeasured: 0,
      unit: "money",
      reward: rewardFor("finance"),
      status: "active",
    };
  }

  if ((state.lastWeekFulfillment || 1) < 0.82) {
    return {
      id: objectiveId(startWeek, "avg_fulfillment"),
      title: "履约修复月",
      description: "让大多数顾客买得到东西，别把需求白白送给隔壁。",
      focus: "supply",
      metric: "avg_fulfillment",
      startWeek,
      endWeek,
      targetValue: 0.84,
      currentValue: state.lastWeekFulfillment || 0,
      accumulatedValue: 0,
      weeksMeasured: 0,
      unit: "percent",
      reward: rewardFor("supply"),
      status: "active",
    };
  }

  if (state.exposure < 35) {
    const targetValue = clamp(state.exposure + 10, 25, 38);
    return {
      id: objectiveId(startWeek, "exposure"),
      title: "打开知名度",
      description: "这个月的重点是让附近的人知道你在营业。",
      focus: "growth",
      metric: "exposure",
      startWeek,
      endWeek,
      targetValue,
      currentValue: state.exposure,
      baselineValue: state.exposure,
      accumulatedValue: 0,
      weeksMeasured: 0,
      unit: "score",
      reward: rewardFor("growth"),
      status: "active",
    };
  }

  if (state.reputation < 50) {
    const targetValue = clamp(state.reputation + 8, 42, 55);
    return {
      id: objectiveId(startWeek, "reputation"),
      title: "口碑修复月",
      description: "少一点骚操作，多一点稳定体验，把回头客做回来。",
      focus: "reputation",
      metric: "reputation",
      startWeek,
      endWeek,
      targetValue,
      currentValue: state.reputation,
      baselineValue: state.reputation,
      accumulatedValue: 0,
      weeksMeasured: 0,
      unit: "score",
      reward: rewardFor("reputation"),
      status: "active",
    };
  }

  const revenueBaseline = Math.max(0, state.weeklyRevenue || 0) * 4;
  const targetValue = Math.max(16000, Math.round(revenueBaseline * 1.08));
  return {
    id: objectiveId(startWeek, "monthly_revenue"),
    title: "稳步增长月",
    description: "在不赔钱的前提下，把这个月的营业额往上推一档。",
    focus: "growth",
    metric: "monthly_revenue",
    startWeek,
    endWeek,
    targetValue,
    currentValue: 0,
    accumulatedValue: 0,
    weeksMeasured: 0,
    unit: "money",
    reward: rewardFor("growth"),
    status: "active",
  };
}

export function updateMonthlyObjectiveProgress(
  objective: MonthlyObjective | null,
  state: GameState,
  summary: WeeklySummary,
): MonthlyObjective | null {
  if (!objective || objective.status !== "active") return objective;
  if (summary.week < objective.startWeek || summary.week > objective.endWeek) {
    return objective;
  }

  const next = { ...objective };
  next.weeksMeasured += 1;

  switch (next.metric) {
    case "monthly_profit":
      next.accumulatedValue += summary.profit;
      next.currentValue = next.accumulatedValue;
      break;
    case "monthly_revenue":
      next.accumulatedValue += summary.revenue;
      next.currentValue = next.accumulatedValue;
      break;
    case "avg_fulfillment":
      next.accumulatedValue += summary.fulfillmentRate;
      next.currentValue = next.accumulatedValue / next.weeksMeasured;
      break;
    case "exposure":
      next.currentValue = state.exposure;
      break;
    case "reputation":
      next.currentValue = state.reputation;
      break;
    case "cash_buffer":
      next.currentValue = state.cash;
      break;
  }

  return next;
}

export function completeMonthlyObjective(
  objective: MonthlyObjective,
  week: number,
): { objective: MonthlyObjective; result: MonthlyObjectiveResult } {
  const success = objective.currentValue >= objective.targetValue;
  const completed = {
    ...objective,
    status: success ? "completed" as const : "failed" as const,
  };
  const summary = success
    ? `达成：${formatTarget(objective.currentValue, objective.unit)} / 目标 ${formatTarget(objective.targetValue, objective.unit)}`
    : `未达成：${formatTarget(objective.currentValue, objective.unit)} / 目标 ${formatTarget(objective.targetValue, objective.unit)}`;

  return {
    objective: completed,
    result: {
      objectiveId: objective.id,
      title: objective.title,
      success,
      summary,
      reward: success ? objective.reward : {},
      completedAtWeek: week,
    },
  };
}

